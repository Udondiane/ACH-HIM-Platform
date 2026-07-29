-- 057 · Custom activities on projects
--
-- The PROGRAMME_ACTIVITIES list is opinionated (ESOL, digital skills,
-- coaching, wraparound, etc.) but ACH occasionally delivers something
-- outside that vocabulary. Rather than growing the taxonomy every time,
-- projects get a free-text 'custom_activities' field where staff record
-- the one-off activities as a newline-separated list.
--
-- These don't drive factor measurement or training auto-spawn — they're
-- just captured as part of the project record and echoed on the outcomes
-- report so nothing gets lost.

alter table public.projects
  add column if not exists custom_activities text;

comment on column public.projects.custom_activities is
  'Newline-separated free-text list of activities not covered by PROGRAMME_ACTIVITIES. Captured on project setup via the "Other activity" checkbox.';
