/* Interview records (both ACH selection + partner interview) and
   journey-stage tracking for the full programme funnel:
   EOI -> shortlisted -> ACH interview -> partner interview ->
   training -> placement -> hired / moved on / not hired.

   Two principles:
   - ACH staff CAN record both types of interview (operational reality)
   - Partner staff (via partner portal) can ONLY record their own
     partner_interview rows for their own organisation (RLS enforced) */

do $$ begin
  create type public.interview_kind as enum (
    'ach_selection',
    'partner_interview',
    'follow_up'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.interview_outcome as enum (
    'pending',
    'proceed',
    'hold',
    'reject',
    'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.candidate_journey_stage as enum (
    'eoi_received',
    'shortlisted',
    'ach_interview_done',
    'partner_interview_done',
    'training',
    'placement',
    'hired',
    'progressed_other',
    'not_hired',
    'withdrawn'
  );
exception when duplicate_object then null; end $$;

alter table public.candidates
  add column if not exists journey_stage public.candidate_journey_stage;

create table if not exists public.candidate_interviews (
  id                     uuid primary key default gen_random_uuid(),
  candidate_id           uuid not null references public.candidates(id) on delete cascade,
  cohort_id              uuid references public.cohorts(id) on delete set null,
  partner_id             uuid references public.partners(id) on delete set null,
  kind                   public.interview_kind not null,
  scheduled_for          date,
  conducted_on           date,
  interviewer_name       text,
  interviewer_role       text,
  outcome                public.interview_outcome not null default 'pending',
  fit_score              integer check (fit_score between 1 and 5),
  strengths              text,
  development_areas      text,
  general_feedback       text,
  notes_internal         text,
  recorded_by            uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_interviews_candidate on public.candidate_interviews(candidate_id);
create index if not exists idx_interviews_cohort on public.candidate_interviews(cohort_id);
create index if not exists idx_interviews_partner on public.candidate_interviews(partner_id);
create index if not exists idx_interviews_kind on public.candidate_interviews(kind);

create or replace function public.update_interviews_updated_at()
returns trigger language plpgsql as $body$
begin
  NEW.updated_at := now();
  return NEW;
end;
$body$;

drop trigger if exists trg_interviews_updated_at on public.candidate_interviews;
create trigger trg_interviews_updated_at
  before update on public.candidate_interviews
  for each row execute function public.update_interviews_updated_at();

alter table public.candidate_interviews enable row level security;

drop policy if exists "interviews_ach_all" on public.candidate_interviews;
create policy "interviews_ach_all" on public.candidate_interviews
  for all using (
    (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  ) with check (
    (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  );

drop policy if exists "interviews_partner_read_own" on public.candidate_interviews;
create policy "interviews_partner_read_own" on public.candidate_interviews
  for select using (
    partner_id = public.current_partner_id()
  );

drop policy if exists "interviews_partner_write_own" on public.candidate_interviews;
create policy "interviews_partner_write_own" on public.candidate_interviews
  for insert with check (
    kind = 'partner_interview'
    and partner_id = public.current_partner_id()
  );

drop policy if exists "interviews_partner_update_own" on public.candidate_interviews;
create policy "interviews_partner_update_own" on public.candidate_interviews
  for update using (
    kind = 'partner_interview'
    and partner_id = public.current_partner_id()
  ) with check (
    kind = 'partner_interview'
    and partner_id = public.current_partner_id()
  );
