-- ============================================================
-- 004 · cohorts (multi-partner / single-partner classification)
-- ============================================================
-- Per spec §13.3: two cohort structures with different pricing
-- implications. Each cohort has a list of partners engaged and
-- a list of candidates enrolled.
-- ============================================================

do $$ begin
  create type public.cohort_structure as enum (
    'multi_partner',     -- standard product, multiple partners engaging
    'single_partner'     -- bespoke, dedicated to one partner
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cohort_status as enum (
    'planned', 'recruiting', 'in_progress', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.cohorts (
  id              uuid primary key default gen_random_uuid(),
  cohort_ref      text unique not null,       -- e.g. "BRI-2026-Q3"
  name            text not null,
  structure       public.cohort_structure not null,
  status          public.cohort_status not null default 'planned',
  location        text,                       -- Bristol / Birmingham / etc.
  sector_focus    text,
  start_date      date,
  end_date        date,
  programme_weeks integer default 12,
  target_size     integer default 11,
  delivery_cost   numeric(10,2),              -- internal: ACH's modelled cost basis
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_cohorts_status on public.cohorts(status);
create index if not exists idx_cohorts_structure on public.cohorts(structure);

-- Partner engagement in a cohort (many-to-many)
create table if not exists public.cohort_partners (
  id            uuid primary key default gen_random_uuid(),
  cohort_id     uuid not null references public.cohorts(id) on delete cascade,
  partner_id    uuid not null references public.partners(id) on delete restrict,
  -- how many candidate sponsorships this partner has committed to
  sponsorship_count integer not null default 0,
  engagement_fee   numeric(10,2),     -- amount this partner pays for engagement
  is_lead_partner  boolean not null default false,  -- relevant for single_partner cohorts
  notes            text,
  created_at       timestamptz not null default now(),
  unique (cohort_id, partner_id)
);

create index if not exists idx_cp_cohort on public.cohort_partners(cohort_id);
create index if not exists idx_cp_partner on public.cohort_partners(partner_id);

-- Candidate enrolment in a cohort (many-to-many; one candidate may
-- traverse multiple cohorts across their journey)
create table if not exists public.cohort_candidates (
  id            uuid primary key default gen_random_uuid(),
  cohort_id     uuid not null references public.cohorts(id) on delete cascade,
  candidate_id  uuid not null references public.candidates(id) on delete restrict,
  enrolled_at   timestamptz not null default now(),
  completed_at  timestamptz,
  withdrew_at   timestamptz,
  withdrew_reason text,
  -- which sponsoring partner (if any) this candidate's slot is attached to.
  -- nullable: candidates may not be tied to a specific partner sponsorship.
  sponsoring_partner_id uuid references public.partners(id),
  unique (cohort_id, candidate_id)
);

create index if not exists idx_cc_cohort on public.cohort_candidates(cohort_id);
create index if not exists idx_cc_candidate on public.cohort_candidates(candidate_id);
create index if not exists idx_cc_sponsor on public.cohort_candidates(sponsoring_partner_id);

-- Single-partner cohorts have a check: only one partner row, marked lead.
-- (Enforced at app layer via server actions for clarity; not as a DB constraint
--  because we want partial states during cohort setup.)

-- RLS
alter table public.cohorts enable row level security;
alter table public.cohort_partners enable row level security;
alter table public.cohort_candidates enable row level security;

drop policy if exists "cohorts_ach_all" on public.cohorts;
create policy "cohorts_ach_all" on public.cohorts
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "cp_ach_all" on public.cohort_partners;
create policy "cp_ach_all" on public.cohort_partners
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "cc_ach_all" on public.cohort_candidates;
create policy "cc_ach_all" on public.cohort_candidates
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

-- Partner: read cohorts they're engaged in
drop policy if exists "cohorts_partner_read" on public.cohorts;
create policy "cohorts_partner_read" on public.cohorts
  for select using (
    exists (
      select 1 from public.cohort_partners cp
      where cp.cohort_id = id and cp.partner_id = public.current_partner_id()
    )
  );

drop policy if exists "cp_partner_self" on public.cohort_partners;
create policy "cp_partner_self" on public.cohort_partners
  for select using (partner_id = public.current_partner_id());

-- Candidate: read cohorts they're enrolled in
drop policy if exists "cohorts_candidate_read" on public.cohorts;
create policy "cohorts_candidate_read" on public.cohorts
  for select using (
    exists (
      select 1 from public.cohort_candidates cc
      where cc.cohort_id = id and cc.candidate_id = public.current_candidate_id()
    )
  );

drop policy if exists "cc_candidate_self" on public.cohort_candidates;
create policy "cc_candidate_self" on public.cohort_candidates
  for select using (candidate_id = public.current_candidate_id());

drop trigger if exists trg_cohorts_updated_at on public.cohorts;
create trigger trg_cohorts_updated_at before update on public.cohorts
  for each row execute function public.touch_updated_at();
