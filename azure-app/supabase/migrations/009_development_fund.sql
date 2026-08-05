-- ============================================================
-- 009 · Development Fund · training catalogue · requests · enrolments
-- ============================================================
-- Spec §14: retention milestone payments are ringfenced for
-- candidate-led development training. The Fund tracks per-candidate
-- balances accumulated from milestone payments + match funding.
-- Approval workflow: candidate request → ACH caseworker review →
-- approval or decline with reasoning → appeal mechanism if declined.
-- ============================================================

-- ── TRAINING CATALOGUE ────────────────────────────────────
do $$ begin
  create type public.training_eligibility as enum (
    'accredited_qual_l2_l5',
    'sector_certification',
    'language_qualification',
    'soft_skills_progression',
    'pre_degree_access',
    'ineligible'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.training_catalogue (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  title         text not null,
  description   text,
  category      public.training_eligibility not null,
  level         text,                       -- e.g. 'Level 3', 'CertHE'
  duration_weeks integer,
  total_cost    numeric(10,2) not null,
  accreditation text,
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_catalogue_category on public.training_catalogue(category);
create index if not exists idx_catalogue_active on public.training_catalogue(is_active);

-- ── DEVELOPMENT FUND BALANCES ─────────────────────────────
-- One row per candidate. Balance is derived from milestone payments +
-- match funding, less approved training spend.
create table if not exists public.development_fund_balances (
  candidate_id      uuid primary key references public.candidates(id) on delete cascade,
  -- accumulators (always non-negative)
  total_credited    numeric(10,2) not null default 0,
  total_spent       numeric(10,2) not null default 0,
  total_match_funding numeric(10,2) not null default 0,
  -- last update marker; balance recomputed on milestone state changes
  last_recomputed_at timestamptz not null default now()
);

-- Per-milestone contributions (ledger entries from milestone payments)
create table if not exists public.dev_fund_credits (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  -- nullable: pooled/grant contributions don't originate in a milestone
  source_milestone_id uuid references public.placement_milestones(id) on delete set null,
  partner_id    uuid references public.partners(id) on delete set null,
  amount        numeric(10,2) not null,
  source        text not null check (source in ('milestone','match_funding','grant','pool')),
  credited_at   timestamptz not null default now(),
  notes         text
);

create index if not exists idx_dfc_candidate on public.dev_fund_credits(candidate_id);

-- ── TRAINING REQUESTS (approval workflow) ────────────────
do $$ begin
  create type public.training_request_state as enum (
    'submitted', 'in_review', 'approved', 'declined', 'appealed', 'enrolled', 'completed', 'withdrawn'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.training_requests (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  training_id   uuid references public.training_catalogue(id) on delete set null,
  -- For training not in the catalogue, candidate can describe it ad hoc:
  custom_title   text,
  custom_provider text,
  custom_cost    numeric(10,2),
  career_rationale text not null,   -- candidate's documented rationale
  state         public.training_request_state not null default 'submitted',
  reviewer_id   uuid references auth.users(id),
  review_notes  text,
  decided_at    timestamptz,
  appeal_text   text,
  appeal_decided_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_treq_candidate on public.training_requests(candidate_id);
create index if not exists idx_treq_state on public.training_requests(state);

-- ── ENROLMENTS ────────────────────────────────────────────
do $$ begin
  create type public.enrolment_state as enum (
    'enrolled', 'in_progress', 'completed', 'withdrawn', 'recovered'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.training_enrolments (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.training_requests(id) on delete restrict,
  candidate_id    uuid not null references public.candidates(id)        on delete restrict,
  training_id     uuid references public.training_catalogue(id),
  enrolled_on     date not null default current_date,
  amount_charged  numeric(10,2) not null,
  completion_date date,
  state           public.enrolment_state not null default 'enrolled',
  -- anti-fraud / withdrawal recovery (spec §14.4)
  withdrawal_reason text,
  recovery_amount   numeric(10,2),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_enrol_candidate on public.training_enrolments(candidate_id);
create index if not exists idx_enrol_state on public.training_enrolments(state);

-- ── BALANCE RECOMPUTATION ────────────────────────────────
-- Update the balance row when credits or enrolment spend change.
create or replace function public.recompute_dev_fund_balance(p_candidate uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.development_fund_balances (candidate_id, total_credited, total_spent, total_match_funding, last_recomputed_at)
  values (p_candidate, 0, 0, 0, now())
  on conflict (candidate_id) do nothing;

  update public.development_fund_balances b
    set
      total_credited = coalesce((
        select sum(amount) from public.dev_fund_credits c
        where c.candidate_id = p_candidate
      ), 0),
      total_match_funding = coalesce((
        select sum(amount) from public.dev_fund_credits c
        where c.candidate_id = p_candidate and source = 'match_funding'
      ), 0),
      total_spent = coalesce((
        select sum(amount_charged) from public.training_enrolments e
        where e.candidate_id = p_candidate
        and state in ('enrolled','in_progress','completed')
      ), 0),
      last_recomputed_at = now()
    where b.candidate_id = p_candidate;
end $$;

create or replace function public.trg_dev_fund_recompute() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_dev_fund_balance(old.candidate_id);
    return old;
  else
    perform public.recompute_dev_fund_balance(new.candidate_id);
    return new;
  end if;
end $$;

drop trigger if exists trg_credits_recompute on public.dev_fund_credits;
create trigger trg_credits_recompute
  after insert or update or delete on public.dev_fund_credits
  for each row execute function public.trg_dev_fund_recompute();

drop trigger if exists trg_enrol_recompute on public.training_enrolments;
create trigger trg_enrol_recompute
  after insert or update or delete on public.training_enrolments
  for each row execute function public.trg_dev_fund_recompute();

-- RLS
alter table public.training_catalogue        enable row level security;
alter table public.development_fund_balances enable row level security;
alter table public.dev_fund_credits          enable row level security;
alter table public.training_requests         enable row level security;
alter table public.training_enrolments       enable row level security;

-- Training catalogue is readable by all authenticated users
drop policy if exists "cat_read" on public.training_catalogue;
create policy "cat_read" on public.training_catalogue for select using (auth.role() = 'authenticated');
drop policy if exists "cat_ach_write" on public.training_catalogue;
create policy "cat_ach_write" on public.training_catalogue for all using (public.is_ach_staff()) with check (public.is_ach_staff());

-- Balance & credits — candidate sees their own; ACH sees all
drop policy if exists "balance_ach_all" on public.development_fund_balances;
create policy "balance_ach_all" on public.development_fund_balances
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "balance_self" on public.development_fund_balances;
create policy "balance_self" on public.development_fund_balances
  for select using (candidate_id = public.current_candidate_id());

drop policy if exists "credits_ach_all" on public.dev_fund_credits;
create policy "credits_ach_all" on public.dev_fund_credits
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "credits_self" on public.dev_fund_credits;
create policy "credits_self" on public.dev_fund_credits
  for select using (candidate_id = public.current_candidate_id());

-- Partner sees credit rows attributed to them (their milestone payments)
-- but only the £ amount and candidate_ref — not career goals.
-- For now we allow direct read; the partner dashboard joins to candidate_ref via a view.
drop policy if exists "credits_partner_read" on public.dev_fund_credits;
create policy "credits_partner_read" on public.dev_fund_credits
  for select using (partner_id = public.current_partner_id());

-- Training requests — candidate sees own; ACH sees all
drop policy if exists "treq_ach_all" on public.training_requests;
create policy "treq_ach_all" on public.training_requests
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "treq_self_read" on public.training_requests;
create policy "treq_self_read" on public.training_requests
  for select using (candidate_id = public.current_candidate_id());
drop policy if exists "treq_self_insert" on public.training_requests;
create policy "treq_self_insert" on public.training_requests
  for insert with check (candidate_id = public.current_candidate_id());

-- Enrolments — candidate sees own; ACH sees all
drop policy if exists "enrol_ach_all" on public.training_enrolments;
create policy "enrol_ach_all" on public.training_enrolments
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "enrol_self_read" on public.training_enrolments;
create policy "enrol_self_read" on public.training_enrolments
  for select using (candidate_id = public.current_candidate_id());

drop trigger if exists trg_treq_updated_at on public.training_requests;
create trigger trg_treq_updated_at before update on public.training_requests
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_enrol_updated_at on public.training_enrolments;
create trigger trg_enrol_updated_at before update on public.training_enrolments
  for each row execute function public.touch_updated_at();
