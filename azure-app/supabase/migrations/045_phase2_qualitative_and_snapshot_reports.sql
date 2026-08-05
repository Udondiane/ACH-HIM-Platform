-- ============================================================
-- 045 · Phase 2 · qualitative capture + snapshot reports
-- ============================================================
-- Adds the primitives HIM needs to produce funder-ready reports:
--   1. Candidate's own voice (at indicator level) alongside assessor narrative
--   2. A featured quotes library (from assessments, partner reports, interviews)
--   3. Cohort-level report snapshots (close-out + 12-month impact) with
--      methodology stamping so reports stay static even as data evolves
--   4. One extra consent flag for follow-up recontact
--
-- Consent map (existing fields kept, new one added):
--   may_be_named                       – quote by name in external outputs
--   may_be_quoted                      – quote anonymised in external outputs
--   may_appear_in_case_study           – full case-study feature
--   may_share_career_goal_with_partner – (unchanged)
--   may_be_recontacted_for_followup    – NEW · re-consenting for 12-month
--                                        impact follow-up
--
-- Photo/image upload is intentionally NOT part of this migration.
-- ============================================================

-- 1. Extra consent flag
alter table public.candidate_consent
  add column if not exists may_be_recontacted_for_followup boolean not null default false;

comment on column public.candidate_consent.may_be_recontacted_for_followup is
  'Consent for ACH to recontact this candidate for 12-month follow-up assessment / impact reporting.';

-- 2. Candidate voice at indicator level
-- assessment_responses.narrative currently holds the assessor's write-up.
-- candidate_voice explicitly holds the candidate's own words on that indicator.
-- feature_worthy lets assessors flag a piece of text as quote-library material
-- during the assessment; the featured quote can then be materialised via
-- the featured_quotes table below.
alter table public.assessment_responses
  add column if not exists candidate_voice text,
  add column if not exists feature_worthy  boolean not null default false;

comment on column public.assessment_responses.candidate_voice is
  'Candidate’s own words on this indicator, captured verbatim by assessor. Separated from assessor narrative for reporting/quoting.';
comment on column public.assessment_responses.feature_worthy is
  'Assessor has flagged this response (narrative or candidate_voice) as worth featuring in reports. Feeds featured_quotes surfacing.';

-- 3. Featured quotes library
-- A quote can originate from an assessment response, a partner-facing form,
-- a selection interview, or free-form. Source is normalised via source_type
-- + source_ref for later navigation and provenance in reports.
do $$ begin
  create type public.quote_source_type as enum (
    'assessment', 'partner_exit', 'partner_retention', 'interview', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.quote_speaker_type as enum (
    'candidate', 'assessor', 'partner', 'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.featured_quotes (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  cohort_id      uuid references public.cohorts(id) on delete set null,
  source_type    public.quote_source_type   not null,
  source_ref     uuid,                       -- pointer to the originating row
  speaker_type   public.quote_speaker_type  not null,
  quote_text     text not null,
  context        text,                       -- what was being discussed
  use_anonymised boolean not null default true,
  display_name   text,                       -- populated only if by-name allowed
  tagged_at      timestamptz not null default now(),
  tagged_by      uuid references auth.users(id),
  archived_at    timestamptz,
  archived_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_fq_candidate on public.featured_quotes(candidate_id);
create index if not exists idx_fq_cohort    on public.featured_quotes(cohort_id);
create index if not exists idx_fq_source    on public.featured_quotes(source_type, source_ref);
create index if not exists idx_fq_active    on public.featured_quotes(archived_at) where archived_at is null;

comment on table public.featured_quotes is
  'Curated quotes for use in HIM reports (close-out, 12-month impact, case studies). Respects candidate consent granularity.';

-- 4. Cohort report snapshots (close-out + 12-month impact)
-- Snapshots exist so reports remain static once issued to a funder, even if
-- underlying assessments/placements change later. snapshot is a jsonb blob
-- containing everything needed to render the report at read time.
do $$ begin
  create type public.cohort_report_type as enum (
    'close_out', 'impact_12mo'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cohort_report_status as enum (
    'draft', 'issued'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.cohort_reports (
  id                   uuid primary key default gen_random_uuid(),
  cohort_id            uuid not null references public.cohorts(id) on delete cascade,
  report_type          public.cohort_report_type   not null,
  status               public.cohort_report_status not null default 'draft',
  methodology_version  text not null default 'v1.0',
  snapshot             jsonb not null default '{}'::jsonb,
  generated_at         timestamptz not null default now(),
  generated_by         uuid references auth.users(id),
  issued_at            timestamptz,
  issued_by            uuid references auth.users(id),
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- One draft + one issued per (cohort, type) at most. Enforced softly at the
-- application layer; DB allows multiple drafts should ACH want to compare.
create index if not exists idx_cr_cohort  on public.cohort_reports(cohort_id);
create index if not exists idx_cr_type    on public.cohort_reports(report_type);
create index if not exists idx_cr_status  on public.cohort_reports(status);

comment on table public.cohort_reports is
  'Methodology-stamped snapshots of cohort-level reports. Draft snapshots are refreshable; issued snapshots are immutable evidence for funders.';

-- 5. Row-level security
alter table public.featured_quotes enable row level security;
alter table public.cohort_reports  enable row level security;

drop policy if exists "fq_ach_all" on public.featured_quotes;
create policy "fq_ach_all" on public.featured_quotes
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "cr_ach_all" on public.cohort_reports;
create policy "cr_ach_all" on public.cohort_reports
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

-- Candidates may read their own featured quotes (they're about them).
drop policy if exists "fq_self_read" on public.featured_quotes;
create policy "fq_self_read" on public.featured_quotes
  for select using (candidate_id = public.current_candidate_id());

-- 6. Triggers
drop trigger if exists trg_fq_updated_at on public.featured_quotes;
create trigger trg_fq_updated_at before update on public.featured_quotes
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_cr_updated_at on public.cohort_reports;
create trigger trg_cr_updated_at before update on public.cohort_reports
  for each row execute function public.touch_updated_at();
