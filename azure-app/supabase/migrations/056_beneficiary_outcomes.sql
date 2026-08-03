-- 056 · Beneficiary outcomes · interim outcome tracking during the project
--
-- Captures the moment a beneficiary reaches an outcome (course passed,
-- job started, housing secured, career goal agreed, etc.) while the
-- project is still running. Feeds the outcomes report and lets ACH staff
-- check off outcomes as they land rather than only capturing them at
-- close-out.
--
-- Outcome catalogue is derived from PROGRAMME_ACTIVITIES in code — no DB
-- reference table needed. Free-text 'notes' + a special 'other' outcome
-- key covers unexpected outcomes.

create table if not exists public.beneficiary_outcomes (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id)   on delete cascade,
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  outcome_key    text not null,
  outcome_label  text,
  achieved_on    date not null default current_date,
  notes          text,
  recorded_by    uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create unique index if not exists uq_beneficiary_outcomes_row
  on public.beneficiary_outcomes(project_id, candidate_id, outcome_key)
  where outcome_key <> 'other';

create index if not exists idx_beneficiary_outcomes_project on public.beneficiary_outcomes(project_id);
create index if not exists idx_beneficiary_outcomes_candidate on public.beneficiary_outcomes(candidate_id);

comment on table public.beneficiary_outcomes is
  'Per-beneficiary outcome ticks recorded during the project. Outcome key is a PROGRAMME_ACTIVITY id (or "other" for unexpected). Feeds the outcomes report.';

-- Cosmetic reconciliation: earlier training programmes were named via
-- SQL initcap of the activity id which produced "English Training".
-- Rename to match the proper labels from PROGRAMME_ACTIVITIES.
update public.training_programmes set name = replace(name, 'English Training', 'English language training'), category = 'English language training' where source_activity_id = 'english_training' and name like '%English Training%';
update public.training_programmes set name = replace(name, 'Employability Coaching', 'Employability coaching / interview prep'), category = 'Employability coaching / interview prep' where source_activity_id = 'employability_coaching' and name like '%Employability Coaching%';
