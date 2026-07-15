-- 040_path_b_partner_and_import.sql
--
-- Path B build — schema additions to support:
--   1. Partner shortlist gate (ACH explicitly forwards candidates to partners)
--   2. Partner-side observations, exit reports, retention checks
--   3. Modular candidate import from application forms (MS Forms, others)
--   4. Retention savings calculation
--
-- Additive only. No destructive changes to existing data. Safe to run
-- alongside live production data.

-- =============================================================
-- 1. PARTNER SHORTLIST GATE
-- =============================================================
-- ACH explicitly forwards a candidate to a workforce partner.
-- Partner visibility now filters by presence of a shortlist row.

create table if not exists public.partner_shortlist (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners(id) on delete cascade,
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  shortlisted_at timestamptz not null default now(),
  shortlisted_by uuid references auth.users(id),
  notes          text,
  withdrawn_at   timestamptz,
  unique (partner_id, candidate_id)
);

create index if not exists idx_shortlist_partner   on public.partner_shortlist(partner_id);
create index if not exists idx_shortlist_candidate on public.partner_shortlist(candidate_id);

alter table public.partner_shortlist enable row level security;
drop policy if exists "shortlist_ach_all" on public.partner_shortlist;
create policy "shortlist_ach_all" on public.partner_shortlist
  for all to authenticated using (true) with check (true);

-- =============================================================
-- 2. PARTNER GROWTH OBSERVATIONS
-- =============================================================
-- Structured observation captured by the workforce partner supervisor
-- at each timepoint (exit, 6mo, 12mo). Growth ratings on IKEA-observable
-- factors + task performance + team contribution + DEI target flag.

create table if not exists public.partner_growth_observations (
  id                       uuid primary key default gen_random_uuid(),
  placement_id             uuid not null references public.placements(id) on delete cascade,
  timepoint                text not null
    check (timepoint in ('setup', 'exit_3mo', 'retention_6mo', 'retention_12mo')),
  language_growth          text check (language_growth       in ('declined','no_change','some','clear','significant')),
  peer_networks_growth     text check (peer_networks_growth  in ('declined','no_change','some','clear','significant')),
  self_efficacy_growth     text check (self_efficacy_growth  in ('declined','no_change','some','clear','significant')),
  workplace_norms_growth   text check (workplace_norms_growth in ('declined','no_change','some','clear','significant')),
  task_performance         text check (task_performance       in ('below','meeting','exceeding')),
  what_stood_out           text,
  dei_target_contribution  boolean,
  dei_target_note          text,
  recorded_at              timestamptz not null default now(),
  recorded_by              uuid references auth.users(id),
  recorded_by_partner_role text,   -- 'supervisor', 'poc', 'hr' etc. (freeform label)
  unique (placement_id, timepoint)
);

create index if not exists idx_pgo_placement on public.partner_growth_observations(placement_id);

alter table public.partner_growth_observations enable row level security;
drop policy if exists "pgo_ach_all" on public.partner_growth_observations;
create policy "pgo_ach_all" on public.partner_growth_observations
  for all to authenticated using (true) with check (true);

-- =============================================================
-- 3. PLACEMENT OFFERS
-- =============================================================
-- Exit decision from the workforce partner and candidate's response.

create table if not exists public.placement_offers (
  id                    uuid primary key default gen_random_uuid(),
  placement_id          uuid not null references public.placements(id) on delete cascade,
  offer_type            text not null
    check (offer_type in ('permanent', 'fixed_term_extension', 'apprenticeship', 'placement_ends', 'none')),
  offer_reason          text,
  offer_date            date,
  candidate_response    text
    check (candidate_response in ('accepted','declined','no_response','not_applicable') or candidate_response is null),
  candidate_response_reason_category text
    check (candidate_response_reason_category in (
      'alternative_employment','personal_health','family_circumstances',
      'compensation','location','role_fit','other'
    ) or candidate_response_reason_category is null),
  candidate_response_reason_text     text,
  candidate_response_date            date,
  recorded_at   timestamptz not null default now(),
  recorded_by   uuid references auth.users(id),
  unique (placement_id)
);

create index if not exists idx_offer_placement on public.placement_offers(placement_id);

alter table public.placement_offers enable row level security;
drop policy if exists "offer_ach_all" on public.placement_offers;
create policy "offer_ach_all" on public.placement_offers
  for all to authenticated using (true) with check (true);

-- =============================================================
-- 4. PLACEMENT RETENTION CHECKS
-- =============================================================
-- 6-month and 12-month check-ins on whether candidate is still employed.

create table if not exists public.placement_retention_checks (
  id                  uuid primary key default gen_random_uuid(),
  placement_id        uuid not null references public.placements(id) on delete cascade,
  timepoint           text not null
    check (timepoint in ('retention_6mo', 'retention_12mo')),
  still_employed      boolean,
  current_role        text,
  leaving_date        date,
  leaving_reason      text,
  progression_note    text,
  checked_at          timestamptz not null default now(),
  checked_by          uuid references auth.users(id),
  unique (placement_id, timepoint)
);

create index if not exists idx_retention_placement on public.placement_retention_checks(placement_id);

alter table public.placement_retention_checks enable row level security;
drop policy if exists "retention_ach_all" on public.placement_retention_checks;
create policy "retention_ach_all" on public.placement_retention_checks
  for all to authenticated using (true) with check (true);

-- =============================================================
-- 5. RETENTION SAVINGS + PARTNER FIELDS
-- =============================================================

alter table public.partners
  add column if not exists replacement_cost_band text
    check (replacement_cost_band in (
      'under_500','500_1500','1500_3000','3000_5000','over_5000','unknown'
    ) or replacement_cost_band is null);

-- =============================================================
-- 6. APPLICATION SOURCE DATA + IMPORT SUPPORT
-- =============================================================
-- Free-form JSONB for any fields captured on the programme's application
-- form that don't map to native HIM candidate columns. Preserves original
-- data for audit and for display on the candidate detail page.

alter table public.candidates
  add column if not exists application_source_data jsonb,
  add column if not exists esol_level              text,
  add column if not exists benefit_status          text;

-- =============================================================
-- 7. PARTNER SCOPED ACCESS TOKENS (magic-link entry)
-- =============================================================
-- Partner staff access their scoped surface via a token URL rather than
-- authenticated login (for the pilot phase). Revocable, expirable, audited.

create table if not exists public.partner_access_tokens (
  id                uuid primary key default gen_random_uuid(),
  partner_id        uuid not null references public.partners(id) on delete cascade,
  project_id        uuid references public.projects(id) on delete set null,
  token             text not null unique,
  label             text,
  expires_at        timestamptz,
  revoked_at        timestamptz,
  last_used_at      timestamptz,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);

create index if not exists idx_pat_token   on public.partner_access_tokens(token);
create index if not exists idx_pat_partner on public.partner_access_tokens(partner_id);

alter table public.partner_access_tokens enable row level security;
drop policy if exists "pat_ach_all" on public.partner_access_tokens;
create policy "pat_ach_all" on public.partner_access_tokens
  for all to authenticated using (true) with check (true);
