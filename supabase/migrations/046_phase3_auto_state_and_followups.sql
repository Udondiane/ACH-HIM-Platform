-- ============================================================
-- 046 · Phase 3 · auto-state triggers + follow-up dispatch
-- ============================================================
-- Two problems this migration solves:
--
-- 1. TEDIUM: staff have to remember to update candidate.status when
--    events happen (placement created, retention confirmed, etc).
--    Triggers below do it automatically. Manual override still works.
--
-- 2. FOLLOW-UP CAPTURE: we need a table to track outreach dispatches
--    (3mo/6mo/12mo) plus a view that HIM staff can read as their
--    "who needs to be contacted" queue. Populated automatically by
--    daily cron.
-- ============================================================

-- ── 1. Auto-status: placement created ⇒ candidate is 'placed' ──
-- The check enforcing "no status=placed without a placement row"
-- already exists in the app layer (lib/candidates/actions.ts). This
-- trigger flips the other direction: when a placement DOES land, the
-- candidate is auto-promoted so nobody has to remember.

create or replace function public.auto_set_placed_on_placement()
returns trigger language plpgsql as $$
begin
  update public.candidates
     set status = 'placed'
   where id = NEW.candidate_id
     and status in ('applicant', 'enrolled', 'in_programme', 'completed');
  return NEW;
end $$;

drop trigger if exists trg_auto_placed on public.placements;
create trigger trg_auto_placed
  after insert on public.placements
  for each row execute function public.auto_set_placed_on_placement();


-- ── 2. Auto-status: 12mo retention confirmed ⇒ 'progressed' ──
-- If a partner verifies "still employed" at the 12-month check, the
-- candidate has genuinely progressed. Move them.

create or replace function public.auto_set_progressed_on_12mo_retention()
returns trigger language plpgsql as $$
declare
  v_candidate_id uuid;
begin
  if NEW.timepoint = 'retention_12mo' and NEW.still_employed = true then
    select candidate_id into v_candidate_id
      from public.placements
     where id = NEW.placement_id;

    if v_candidate_id is not null then
      update public.candidates
         set status = 'progressed'
       where id = v_candidate_id
         and status = 'placed';
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_auto_progressed on public.placement_retention_checks;
create trigger trg_auto_progressed
  after insert or update on public.placement_retention_checks
  for each row execute function public.auto_set_progressed_on_12mo_retention();


-- ── 3. Auto-flag: 12mo retention says NOT employed ⇒ at_risk ──
-- The impact story cares about progression that stuck. When it didn't,
-- ACH needs to know without hunting through spreadsheets.

create or replace function public.auto_flag_regression_on_12mo_retention()
returns trigger language plpgsql as $$
declare
  v_candidate_id uuid;
begin
  if NEW.timepoint = 'retention_12mo' and NEW.still_employed = false then
    select candidate_id into v_candidate_id
      from public.placements
     where id = NEW.placement_id;

    if v_candidate_id is not null then
      update public.candidates
         set at_risk = true,
             at_risk_reason = coalesce(at_risk_reason, '12mo retention lost')
       where id = v_candidate_id
         and at_risk is not true;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_auto_flag_regression on public.placement_retention_checks;
create trigger trg_auto_flag_regression
  after insert or update on public.placement_retention_checks
  for each row execute function public.auto_flag_regression_on_12mo_retention();


-- ── 4. Auto-status: baseline assessment completed ⇒ 'in_programme' ──
-- The moment an assessor completes a baseline assessment, the candidate
-- is clearly past 'applicant' / 'enrolled'. Promote them.

create or replace function public.auto_set_in_programme_on_baseline()
returns trigger language plpgsql as $$
begin
  if NEW.timepoint = 'baseline' and NEW.status in ('completed', 'reviewed') then
    update public.candidates
       set status = 'in_programme'
     where id = NEW.candidate_id
       and status in ('applicant', 'enrolled');
  end if;
  return NEW;
end $$;

drop trigger if exists trg_auto_in_programme on public.assessments;
create trigger trg_auto_in_programme
  after insert or update on public.assessments
  for each row execute function public.auto_set_in_programme_on_baseline();


-- ── 5. Follow-up dispatches ──
-- Tracks each outreach: which timepoint, which channel, when sent, when
-- responded, what the response contained. The queue page reads a view
-- built on top of this + assessments.

do $$ begin
  create type public.followup_channel as enum (
    'whatsapp', 'phone_call', 'sms', 'email', 'in_person'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.followup_status as enum (
    'queued', 'sent', 'responded', 'no_response', 'flagged', 'closed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.followup_timepoint as enum (
    'mid_3mo', 'exit_6mo', 'followup_12mo'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.follow_up_dispatches (
  id                uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references public.candidates(id) on delete cascade,
  cohort_id         uuid references public.cohorts(id) on delete set null,
  placement_id      uuid references public.placements(id) on delete set null,
  timepoint         public.followup_timepoint not null,
  due_date          date not null default current_date,
  channel           public.followup_channel,
  status            public.followup_status not null default 'queued',
  attempts          integer not null default 0,
  sent_at           timestamptz,
  responded_at      timestamptz,
  response_text     text,
  response_flagged  boolean not null default false,
  flag_reason       text,
  assessment_id     uuid references public.assessments(id) on delete set null,
  handled_by        uuid references auth.users(id),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (candidate_id, timepoint)
);

create index if not exists idx_fud_candidate on public.follow_up_dispatches(candidate_id);
create index if not exists idx_fud_status    on public.follow_up_dispatches(status);
create index if not exists idx_fud_due       on public.follow_up_dispatches(due_date);
create index if not exists idx_fud_flagged   on public.follow_up_dispatches(response_flagged) where response_flagged = true;

comment on table public.follow_up_dispatches is
  'Follow-up outreach records for 3mo/6mo/12mo timepoints. Populated by daily cron and worked by ACH staff via the /follow-ups queue.';


-- ── 6. Auto-create dispatches when a placement lands ──
-- Placement start_date drives 3/6/12mo dates automatically.

create or replace function public.auto_create_followup_dispatches_on_placement()
returns trigger language plpgsql as $$
begin
  if NEW.start_date is null then
    return NEW;
  end if;

  insert into public.follow_up_dispatches
    (candidate_id, cohort_id, placement_id, timepoint, due_date)
  values
    (NEW.candidate_id, NEW.cohort_id, NEW.id, 'mid_3mo',       NEW.start_date + interval '3 months'),
    (NEW.candidate_id, NEW.cohort_id, NEW.id, 'exit_6mo',      NEW.start_date + interval '6 months'),
    (NEW.candidate_id, NEW.cohort_id, NEW.id, 'followup_12mo', NEW.start_date + interval '12 months')
  on conflict (candidate_id, timepoint) do nothing;

  return NEW;
end $$;

drop trigger if exists trg_auto_create_dispatches on public.placements;
create trigger trg_auto_create_dispatches
  after insert on public.placements
  for each row execute function public.auto_create_followup_dispatches_on_placement();


-- ── 7. Follow-ups queue view ──
-- What ACH staff read on /follow-ups. Ordered by urgency, joined for UI.

create or replace view public.follow_ups_queue as
  select
    fud.id,
    fud.candidate_id,
    fud.cohort_id,
    fud.placement_id,
    fud.timepoint,
    fud.due_date,
    fud.channel,
    fud.status,
    fud.attempts,
    fud.response_flagged,
    fud.flag_reason,
    fud.sent_at,
    fud.responded_at,
    c.candidate_ref,
    c.given_name,
    c.family_name,
    c.preferred_name,
    c.at_risk,
    co.name        as cohort_name,
    p.role_title   as placement_role,
    part.name      as placement_partner,
    case
      when fud.due_date < current_date - 7 then 'overdue'
      when fud.due_date <= current_date     then 'due'
      when fud.due_date <= current_date + 7 then 'soon'
      else 'upcoming'
    end            as urgency
  from public.follow_up_dispatches fud
  join public.candidates c on c.id = fud.candidate_id
  left join public.cohorts   co   on co.id = fud.cohort_id
  left join public.placements p   on p.id = fud.placement_id
  left join public.partners   part on part.id = p.partner_id;


-- ── 8. RLS ──
alter table public.follow_up_dispatches enable row level security;

drop policy if exists "fud_ach_all" on public.follow_up_dispatches;
create policy "fud_ach_all" on public.follow_up_dispatches
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());


-- ── 9. Trigger housekeeping ──
drop trigger if exists trg_fud_updated_at on public.follow_up_dispatches;
create trigger trg_fud_updated_at before update on public.follow_up_dispatches
  for each row execute function public.touch_updated_at();


-- ── 10. Backfill: create dispatches for any existing placements ──
-- One-off statement so demo data has content without waiting for a cron.
insert into public.follow_up_dispatches
  (candidate_id, cohort_id, placement_id, timepoint, due_date)
select
  p.candidate_id, p.cohort_id, p.id, 'mid_3mo',       p.start_date + interval '3 months'
from public.placements p
where p.start_date is not null
on conflict do nothing;

insert into public.follow_up_dispatches
  (candidate_id, cohort_id, placement_id, timepoint, due_date)
select
  p.candidate_id, p.cohort_id, p.id, 'exit_6mo',      p.start_date + interval '6 months'
from public.placements p
where p.start_date is not null
on conflict do nothing;

insert into public.follow_up_dispatches
  (candidate_id, cohort_id, placement_id, timepoint, due_date)
select
  p.candidate_id, p.cohort_id, p.id, 'followup_12mo', p.start_date + interval '12 months'
from public.placements p
where p.start_date is not null
on conflict do nothing;
