-- Capture the nature of a candidate's progression beyond first placement.
-- When candidates.status = 'progressed', staff record HOW the candidate
-- progressed (promotion, second job, further study, self-employment, etc.)
-- plus a free-text note (used especially when type = 'other').
--
-- Kept on the candidates table rather than a separate progression_events
-- table because v1 of the platform tracks only the LATEST progression
-- summary. A dedicated history table can come later if Diane needs to
-- show progression chains over multiple years.

DO $$ BEGIN
  CREATE TYPE public.candidate_progression_type AS ENUM (
    'promotion',
    'second_job',
    'higher_role_elsewhere',
    'further_study',
    'self_employment',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS progression_type public.candidate_progression_type,
  ADD COLUMN IF NOT EXISTS progression_notes text;

COMMENT ON COLUMN public.candidates.progression_type IS
  'How the candidate progressed beyond first placement. Only populated when status = ''progressed''.';
COMMENT ON COLUMN public.candidates.progression_notes IS
  'Free text. Required when progression_type = ''other''; useful detail otherwise.';
