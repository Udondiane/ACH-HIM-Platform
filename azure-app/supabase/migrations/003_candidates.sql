-- ============================================================
-- 003 · candidates and consent
-- ============================================================
-- Candidates are the unit of capability assessment.
-- Consent is tracked granularly (per spec §15.4 + §17): naming,
-- quoting, case-study use are separate decisions per candidate.
-- Career goals & development plans are PRIVATE — partners do not
-- see them unless candidate consents (§17).
-- ============================================================

do $$ begin
  create type public.candidate_status as enum (
    'applicant', 'enrolled', 'in_programme', 'completed',
    'placed', 'progressed', 'withdrawn'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.candidates (
  id                   uuid primary key default gen_random_uuid(),
  candidate_ref        text unique not null,   -- anonymised display id (e.g. "C-2026-042")
  given_name           text not null,
  family_name          text,
  preferred_locale     text default 'en',
  country_of_origin    text,
  arrival_year         integer,
  english_level        text,                   -- e.g. A1/A2/B1/B2/C1/C2
  status               public.candidate_status not null default 'applicant',
  career_goal_summary  text,                   -- private — partners never see this
  development_plan     text,                   -- private — partners never see this
  notes                text,                   -- ACH-internal notes
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_candidates_status on public.candidates(status);
create index if not exists idx_candidates_ref on public.candidates(candidate_ref);

-- Consent records — granular, dated, revocable. Spec §15.4 + §17.
create table if not exists public.candidate_consent (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  -- scope of consent
  may_be_named         boolean not null default false,
  may_be_quoted        boolean not null default false,
  may_appear_in_case_study boolean not null default false,
  may_share_career_goal_with_partner boolean not null default false,
  -- audit trail
  given_at      timestamptz not null default now(),
  withdrawn_at  timestamptz,
  recorded_by   uuid references auth.users(id),
  signed_form_ref text,
  notes         text
);

create index if not exists idx_consent_candidate on public.candidate_consent(candidate_id);

-- Backfill FK
alter table public.user_roles
  drop constraint if exists fk_user_roles_candidate;
alter table public.user_roles
  add constraint fk_user_roles_candidate
  foreign key (candidate_id) references public.candidates(id) on delete set null;

-- RLS
alter table public.candidates enable row level security;
alter table public.candidate_consent enable row level security;

-- ACH staff: full
drop policy if exists "candidates_ach_all" on public.candidates;
create policy "candidates_ach_all" on public.candidates
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "consent_ach_all" on public.candidate_consent;
create policy "consent_ach_all" on public.candidate_consent
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

-- Candidate sees their own row
drop policy if exists "candidates_self_read" on public.candidates;
create policy "candidates_self_read" on public.candidates
  for select using (id = public.current_candidate_id());

drop policy if exists "candidates_self_update" on public.candidates;
create policy "candidates_self_update" on public.candidates
  for update using (id = public.current_candidate_id())
  with check (id = public.current_candidate_id());

drop policy if exists "consent_self_read" on public.candidate_consent;
create policy "consent_self_read" on public.candidate_consent
  for select using (candidate_id = public.current_candidate_id());

-- (Partner access to anonymised candidate trajectories is granted via
--  dedicated views in later migrations — not via direct table reads.)

drop trigger if exists trg_candidates_updated_at on public.candidates;
create trigger trg_candidates_updated_at before update on public.candidates
  for each row execute function public.touch_updated_at();
