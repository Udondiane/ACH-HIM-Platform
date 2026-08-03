-- Anchor every candidate's assessment timeline to an intervention start date,
-- and gate baseline collection by a configurable window.
--
-- Two cases:
--   1. Cohorted programmes (Bridge to Employment): the whole cohort starts on
--      a known date. cohorts.intervention_start_date holds it.
--   2. Rolling / non-cohorted programmes (IAG, training, support strands):
--      each person starts on their own date. cohorts.is_rolling = true and
--      cohort_candidates.intervention_start_date holds the per-person date.
--
-- Effective start for any candidate is:
--   COALESCE(cohort_candidates.intervention_start_date, cohorts.intervention_start_date)
--
-- Baseline must be collected within projects.baseline_window_days days
-- AFTER the effective start (default 14). Past the window the baseline
-- button locks and the candidate is reported as "no valid baseline."
-- A baseline can be recorded any time before the effective start.

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS intervention_start_date date,
  ADD COLUMN IF NOT EXISTS is_rolling boolean NOT NULL DEFAULT false;

ALTER TABLE public.cohort_candidates
  ADD COLUMN IF NOT EXISTS intervention_start_date date;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS baseline_window_days integer NOT NULL DEFAULT 14;

COMMENT ON COLUMN public.cohorts.intervention_start_date IS
  'When the cohort''s intervention starts. NULL means rolling — use cohort_candidates.intervention_start_date per person.';
COMMENT ON COLUMN public.cohorts.is_rolling IS
  'True when this cohort represents rolling/individual enrolments rather than a synchronised group start.';
COMMENT ON COLUMN public.cohort_candidates.intervention_start_date IS
  'Per-person intervention start date. Required when the parent cohort is rolling; optional override otherwise.';
COMMENT ON COLUMN public.projects.baseline_window_days IS
  'Window (in days, from intervention start) inside which baseline assessments must be recorded. Defaults to 14.';
