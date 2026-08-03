-- ============================================================
-- 015 · Equivalence library (V2 — spec §11.4)
-- ============================================================
-- Locally-derived social value equivalence values built from
-- publicly available sources (DWP unemployment costs, ONS earnings,
-- etc.) with citation tracking. Also supports optional HACT/TOMS
-- calculation pathway as alternative methodology selection at
-- report generation time.
-- ============================================================

do $$ begin
  create type public.equivalence_methodology as enum (
    'ach_local',    -- locally-derived from public sources
    'hact',         -- HACT social value calculator (proprietary, partner brings license)
    'toms'          -- TOMs (Social Value Portal)
  );
exception when duplicate_object then null; end $$;

create table if not exists public.equivalence_values (
  id            uuid primary key default gen_random_uuid(),
  outcome_code  text not null,                 -- e.g. 'employment_outcome_12mo'
  outcome_label text not null,
  methodology   public.equivalence_methodology not null default 'ach_local',
  -- £ value per outcome unit (lower bound for conservatism per spec §11.3)
  value_per_unit numeric(12,2) not null,
  unit_label    text not null default 'per outcome',
  -- citation
  source_name   text not null,                 -- e.g. 'DWP unemployment cost (2024)'
  source_url    text,
  source_year   integer,
  source_notes  text,
  -- versioning: equivalence library is method-version-stamped on each report
  effective_from date not null default current_date,
  effective_to   date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (outcome_code, methodology, effective_from)
);

create index if not exists idx_eq_methodology on public.equivalence_values(methodology);
create index if not exists idx_eq_active on public.equivalence_values(is_active);

-- Seed the locally-derived starter set (conservative lower bounds).
-- These are starting figures ACH can update; each carries its source.
insert into public.equivalence_values (outcome_code, outcome_label, methodology, value_per_unit, source_name, source_year, source_notes) values
  ('employment_outcome_3mo',  'Employment outcome — sustained at 3 months',  'ach_local',  4500.00, 'DWP labour market benefits cost-avoidance (lower bound)', 2024, 'Conservative lower bound; full DWP figure higher.'),
  ('employment_outcome_12mo', 'Employment outcome — sustained at 12 months', 'ach_local', 13800.00, 'DWP + ONS earnings (UK refugee employment cohort, 12mo)', 2024, 'Lower bound combining benefits saving + earnings gain.'),
  ('progression_uplift_12mo', 'Earnings uplift on progression (12 months)',  'ach_local',  3200.00, 'ONS Earnings & hours worked (refugee cohort approximation)', 2024, 'Per progressed candidate, lower bound.'),
  ('retention_savings_volume','Retention savings — Volume band per leaver',  'ach_local',  3900.00, 'CIPD Resourcing & Talent Planning (entry-level replacement cost)', 2024, 'Memo §13 reference, lower-bound.'),
  ('retention_savings_standard','Retention savings — Standard band per leaver','ach_local',6250.00, 'CIPD + Oxford Economics replacement cost methodology', 2024, 'Memo §13 reference.'),
  ('retention_savings_premium','Retention savings — Premium band per leaver','ach_local',11550.00, 'CIPD + Oxford Economics replacement cost methodology', 2024, 'Memo §13 reference.')
on conflict do nothing;

-- Equivalence applications — which equivalence row was used for which calculation.
-- This is the audit trail that lets a report be re-traced years later.
create table if not exists public.equivalence_applications (
  id            uuid primary key default gen_random_uuid(),
  equivalence_id uuid not null references public.equivalence_values(id) on delete restrict,
  -- what the value was applied to
  applied_to_kind text not null check (applied_to_kind in (
    'cohort_outcome', 'partner_report', 'evidence_pack', 'tender_pack'
  )),
  applied_to_id uuid not null,
  units         numeric(10,2) not null,
  resulting_value numeric(12,2) not null,
  applied_at    timestamptz not null default now()
);

create index if not exists idx_eqa_applied on public.equivalence_applications(applied_to_kind, applied_to_id);

alter table public.equivalence_values       enable row level security;
alter table public.equivalence_applications enable row level security;

drop policy if exists "eq_read" on public.equivalence_values;
create policy "eq_read" on public.equivalence_values for select using (auth.role() = 'authenticated');
drop policy if exists "eq_ach_write" on public.equivalence_values;
create policy "eq_ach_write" on public.equivalence_values for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "eqa_ach_all" on public.equivalence_applications;
create policy "eqa_ach_all" on public.equivalence_applications for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop trigger if exists trg_eq_updated_at on public.equivalence_values;
create trigger trg_eq_updated_at before update on public.equivalence_values
  for each row execute function public.touch_updated_at();
