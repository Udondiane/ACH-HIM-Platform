-- HIM · Azure Postgres schema
--
-- Combined and de-Supabase-ified schema for a fresh Azure Database for
-- PostgreSQL Flexible Server. Every Supabase-specific construct
-- (auth.uid() references in RLS policies, gen_random_uuid via pg_supabase,
-- storage.foo tables) has been removed or replaced. RLS is preserved
-- structurally but the policies read a session variable
-- app.current_user_id set by the app layer at the start of every
-- request, rather than Supabase's auth.uid().
--
-- Apply order matters:
--   1. Extensions
--   2. Domain enums + supporting types
--   3. Core tables (partners → candidates → cohorts → assessments)
--   4. Reference framework (domains, factors, indicators)
--   5. Consent, quotes, outcomes, reports
--   6. Row-level-security setup
--
-- For the full change history, see the numbered migrations in the
-- original Supabase project (supabase/migrations/001..059). This file
-- is the flattened current-state schema derived from applying all of
-- them in order.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- Type enums
-- ============================================================
do $$ begin
  create type partner_type as enum (
    'workforce_partner', 'capability_investor', 'training_partner', 'grant_funder'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type partner_status as enum ('prospect', 'active', 'paused', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type candidate_status as enum (
    'applicant', 'in_programme', 'placed', 'progressed', 'withdrawn'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type cohort_status as enum (
    'planned', 'recruiting', 'in_progress', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type cohort_structure as enum ('single_partner', 'multi_partner', 'consortium');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Core: partners
-- ============================================================
create table if not exists partners (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  type            partner_type,
  types           partner_type[] not null default '{}',
  status          partner_status not null default 'prospect',
  sector          text,
  region          text,
  hq_country      text default 'United Kingdom',
  website         text,
  employee_count  integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_partners_type on partners(type);
create index if not exists idx_partners_types on partners using gin (types);

-- ============================================================
-- Core: projects
-- ============================================================
create table if not exists projects (
  id                              uuid primary key default uuid_generate_v4(),
  project_ref                     text unique not null,
  name                            text not null,
  description                     text,
  funding_model                   text,
  funder_name                     text,
  evaluation_type                 text,
  type                            text,
  weight_ratio                    text,
  status                          text not null default 'active',
  start_date                      date,
  end_date                        date,
  baseline_window_days            integer not null default 3,
  partner_provides_standard_data  boolean not null default false,
  end_narrative_what_worked       text,
  end_narrative_challenges        text,
  end_narrative_unexpected        text,
  completed_at                    timestamptz,
  custom_activities               text,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create table if not exists project_activities (
  project_id  uuid not null references projects(id) on delete cascade,
  activity    text not null,
  primary key (project_id, activity)
);

create table if not exists project_capabilities (
  project_id       uuid not null references projects(id) on delete cascade,
  domain           text not null,
  role             text not null check (role in ('core', 'optional')),
  selected_factors text[] not null default '{}',
  primary key (project_id, domain)
);

create table if not exists project_data_providers (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  email        text not null,
  contact_name text,
  role         text,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- Core: cohorts
-- ============================================================
create table if not exists cohorts (
  id              uuid primary key default uuid_generate_v4(),
  cohort_ref      text unique not null,
  name            text not null,
  structure       cohort_structure not null default 'multi_partner',
  service_type    text not null default 'full_programme',
  status          cohort_status not null default 'planned',
  location        text,
  sector_focus    text,
  start_date      date,
  end_date        date,
  programme_weeks integer,
  target_size     integer,
  delivery_cost   numeric(10, 2),
  notes           text,
  project_id      uuid references projects(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists cohort_partners (
  id                uuid primary key default uuid_generate_v4(),
  cohort_id         uuid not null references cohorts(id) on delete cascade,
  partner_id        uuid not null references partners(id) on delete restrict,
  sponsorship_count integer default 0,
  engagement_fee    numeric(10, 2) default 0,
  is_lead_partner   boolean default false,
  unique (cohort_id, partner_id)
);

-- ============================================================
-- Core: candidates
-- ============================================================
create table if not exists candidates (
  id                       uuid primary key default uuid_generate_v4(),
  candidate_ref            text unique not null,
  given_name               text,
  family_name              text,
  preferred_name           text,
  email                    text,
  phone                    text,
  address_line1            text,
  postcode                 text,
  date_of_birth            date,
  country_of_origin        text,
  arrival_year             integer,
  preferred_locale         text default 'en',
  english_level            text,
  esol_level               text,
  benefit_status           text,
  ni_number                text,
  career_goal_summary      text,
  notes                    text,
  status                   candidate_status not null default 'applicant',
  at_risk                  boolean not null default false,
  at_risk_reason           text,
  exit_reason              text,
  exit_date                date,
  exit_notes               text,
  progression_type         text,
  progression_notes        text,
  is_ach_tenant            boolean not null default false,
  application_source_data  jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table if not exists cohort_candidates (
  id                       uuid primary key default uuid_generate_v4(),
  cohort_id                uuid not null references cohorts(id) on delete cascade,
  candidate_id             uuid not null references candidates(id) on delete cascade,
  sponsoring_partner_id    uuid references partners(id),
  intervention_start_date  date,
  unique (cohort_id, candidate_id)
);

create table if not exists candidate_consent (
  id                                 uuid primary key default uuid_generate_v4(),
  candidate_id                       uuid not null references candidates(id) on delete cascade,
  may_be_named                       boolean default false,
  may_be_quoted                      boolean default false,
  may_appear_in_case_study           boolean default false,
  may_share_career_goal_with_partner boolean default false,
  may_ai_analyse_transcript          boolean default false,
  may_be_recontacted_for_followup    boolean default false,
  given_at                           timestamptz not null default now(),
  recorded_by                        uuid,
  notes                              text
);

-- ============================================================
-- Framework: domains, factors, indicators
-- ============================================================
create table if not exists domains (
  id           text primary key,
  name         text not null,
  description  text,
  sort_order   integer
);

create table if not exists factors (
  id                       text primary key,
  name                     text not null,
  conversion_factor_type   text not null,
  measurement_question     text,
  behavioural_prompt       text,
  measurement_method       text not null default 'likert_1_5',
  is_universal             boolean not null default false,
  observable_bullets       jsonb,
  score_guides             jsonb
);

create table if not exists factor_domains (
  factor_id  text not null references factors(id) on delete cascade,
  domain_id  text not null references domains(id) on delete cascade,
  primary key (factor_id, domain_id)
);

create table if not exists indicators (
  id          text primary key,
  factor_id   text not null references factors(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 100
);

-- ============================================================
-- Assessments + responses
-- ============================================================
create table if not exists assessments (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid references projects(id) on delete set null,
  candidate_id  uuid not null references candidates(id) on delete cascade,
  cohort_id     uuid references cohorts(id) on delete set null,
  timepoint     text not null check (timepoint in ('baseline','mid_3mo','exit_6mo','followup_12mo')),
  assessed_on   date not null,
  assessor_id   uuid,
  status        text not null default 'in_progress',
  unique (project_id, candidate_id, timepoint)
);

create table if not exists assessment_responses (
  id                  uuid primary key default uuid_generate_v4(),
  assessment_id       uuid not null references assessments(id) on delete cascade,
  indicator_id        text not null references indicators(id) on delete restrict,
  numeric_value       numeric(4, 2),
  narrative           text,
  observable_changes  text,
  practices           text,
  candidate_voice     text,
  feature_worthy      boolean not null default false,
  unique (assessment_id, indicator_id)
);

-- ============================================================
-- Placements + retention
-- ============================================================
create table if not exists placements (
  id             uuid primary key default uuid_generate_v4(),
  candidate_id   uuid not null references candidates(id) on delete cascade,
  partner_id     uuid not null references partners(id) on delete restrict,
  cohort_id      uuid references cohorts(id) on delete set null,
  role_title     text,
  salary_band    text,
  salary_actual  numeric(10, 2),
  salary_pence   integer,
  start_date     date not null,
  end_date       date,
  status         text not null default 'started',
  notes          text,
  created_at     timestamptz not null default now()
);

create table if not exists placement_retention_checks (
  id             uuid primary key default uuid_generate_v4(),
  placement_id   uuid not null references placements(id) on delete cascade,
  timepoint      text not null check (timepoint in ('retention_3mo','retention_6mo','retention_12mo')),
  checked_on     date not null default current_date,
  still_employed boolean,
  role_now       text,
  progression    text,
  left_date      date,
  left_reason    text,
  unique (placement_id, timepoint)
);

-- ============================================================
-- Outcomes tracker + featured quotes + reports
-- ============================================================
create table if not exists beneficiary_outcomes (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references projects(id) on delete cascade,
  candidate_id   uuid not null references candidates(id) on delete cascade,
  outcome_key    text not null,
  outcome_label  text,
  achieved_on    date not null default current_date,
  notes          text,
  recorded_by    uuid,
  created_at     timestamptz not null default now()
);
create unique index if not exists uq_beneficiary_outcomes_row
  on beneficiary_outcomes(project_id, candidate_id, outcome_key)
  where outcome_key <> 'other';

create table if not exists featured_quotes (
  id                uuid primary key default uuid_generate_v4(),
  candidate_id      uuid references candidates(id) on delete set null,
  cohort_id         uuid references cohorts(id) on delete set null,
  quote_text        text not null,
  context           text,
  speaker_type      text default 'beneficiary',
  use_anonymised    boolean default true,
  display_name      text,
  archived_at       timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists cohort_reports (
  id           uuid primary key default uuid_generate_v4(),
  cohort_id    uuid not null references cohorts(id) on delete cascade,
  report_type  text not null,
  status       text not null default 'draft',
  generated_at timestamptz,
  issued_at    timestamptz,
  content      jsonb
);

-- ============================================================
-- Row-level-security scaffolding (app-layer session variable)
-- ============================================================
-- The Azure-native rewire uses this pattern:
--   Before each request, the app runs:
--       SET LOCAL app.current_user_id = '<uuid>';
--       SET LOCAL app.current_user_email = '<email>';
--   Policies then read those via current_setting('app.current_user_id').
-- No auth.uid() dependency on Supabase remains.
--
-- RLS is left disabled here for the first Azure deployment (matches the
-- AUTH_DISABLED pilot mode). Enable per-table when Entra ID rollout
-- completes across all ACH staff. Sample policies live in db/rls.sql.

-- End of schema.
