-- ============================================================
-- 031 · cohort service_type
-- ============================================================
-- Distinguishes delivery shapes within a programme design. A project
-- (e.g. Bridge to Employment) can run cohorts with different service
-- mixes — full programme, IAG-only, training-only — without needing
-- a separate project per shape. Methodology version stamp stays at the
-- project level; the cohort just records WHICH shape it ran.
--
-- Default 'full_programme' so existing cohorts are unaffected.
-- ============================================================

do $$ begin
  create type public.cohort_service_type as enum (
    'full_programme',
    'iag_only',
    'training_only'
  );
exception when duplicate_object then null; end $$;

-- Safety net: if the type was previously created with only two values,
-- add training_only without erroring on duplicates.
alter type public.cohort_service_type add value if not exists 'training_only';

alter table public.cohorts
  add column if not exists service_type public.cohort_service_type
    not null default 'full_programme';

create index if not exists idx_cohorts_service_type
  on public.cohorts(service_type);
