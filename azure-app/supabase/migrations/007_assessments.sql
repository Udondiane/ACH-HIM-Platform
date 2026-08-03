-- ============================================================
-- 007 · assessments and responses (timepoints + mixed methods)
-- ============================================================
-- Spec §7.2 / §8.3: assessments are persisted by timepoint so the
-- stability component (v2) can read multi-timepoint trajectories.
-- Mixed methods: likert / yes_no / count / checklist / narrative.
-- Aggregation logic lives in lib/scoring/, not in the database.
-- ============================================================

do $$ begin
  create type public.assessment_timepoint as enum (
    'baseline', 'mid_3mo', 'exit_6mo', 'followup_12mo'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.assessments (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete set null,
  cohort_id     uuid references public.cohorts(id) on delete set null,
  timepoint     public.assessment_timepoint not null,
  -- when the assessment took place (may differ from row created_at)
  assessed_on   date not null default current_date,
  assessor_id   uuid references auth.users(id),
  status        text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'reviewed')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One assessment per (candidate, project, timepoint).
  -- project nullable so candidates can be assessed outside a project.
  unique (candidate_id, project_id, timepoint)
);

create index if not exists idx_assess_candidate on public.assessments(candidate_id);
create index if not exists idx_assess_project on public.assessments(project_id);
create index if not exists idx_assess_timepoint on public.assessments(timepoint);

-- Indicator-level responses. One row per (assessment, indicator).
-- Mixed methods normalised at scoring time (lib/scoring), not in storage.
create table if not exists public.assessment_responses (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  indicator_id    text not null references public.indicators(id) on delete restrict,
  -- Numeric value 0–5 for indicators that have a quantitative reading.
  -- For yes_no: yes=5, no=0 (per spec §7.2).
  -- For count: stored as numeric; scoring layer maps to 0–5 if needed.
  -- For narrative: numeric_value is null; narrative carries the response.
  numeric_value   numeric(4,2),
  narrative       text,
  -- For checklist factors: the items ticked, JSON array of strings.
  checklist_items text[],
  -- Trainer/observer evidence (free text).
  evidence        text,
  responded_at    timestamptz not null default now(),
  unique (assessment_id, indicator_id)
);

create index if not exists idx_ar_assessment on public.assessment_responses(assessment_id);
create index if not exists idx_ar_indicator on public.assessment_responses(indicator_id);

-- ── Universal factor cache ────────────────────────────────
-- For universal factors (digital_literacy, self_efficacy, english_fluency)
-- we want to assess once per (candidate, timepoint) and propagate.
-- This view exposes universal-factor responses linked to any of their domains.
-- The scoring library uses this view for deduplication.
create or replace view public.universal_factor_responses as
  select
    ar.id              as response_id,
    a.candidate_id,
    a.project_id,
    a.timepoint,
    ar.indicator_id,
    i.factor_id,
    f.is_universal,
    fd.domain_id,
    ar.numeric_value,
    ar.narrative
  from public.assessment_responses ar
  join public.indicators i      on i.id = ar.indicator_id
  join public.factors    f      on f.id = i.factor_id
  join public.factor_domains fd on fd.factor_id = f.id
  join public.assessments a     on a.id = ar.assessment_id
  where f.is_universal = true;

-- RLS
alter table public.assessments enable row level security;
alter table public.assessment_responses enable row level security;

drop policy if exists "assess_ach_all" on public.assessments;
create policy "assess_ach_all" on public.assessments
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "ar_ach_all" on public.assessment_responses;
create policy "ar_ach_all" on public.assessment_responses
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

-- Candidates can read their own assessments (read-only, no edit)
drop policy if exists "assess_self_read" on public.assessments;
create policy "assess_self_read" on public.assessments
  for select using (candidate_id = public.current_candidate_id());

drop policy if exists "ar_self_read" on public.assessment_responses;
create policy "ar_self_read" on public.assessment_responses
  for select using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_id and a.candidate_id = public.current_candidate_id()
    )
  );

-- Partner dashboards aggregate via dedicated views in later migrations.
-- Partners do NOT read assessment_responses directly.

drop trigger if exists trg_assessments_updated_at on public.assessments;
create trigger trg_assessments_updated_at before update on public.assessments
  for each row execute function public.touch_updated_at();
