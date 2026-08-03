-- 053 · Move 'in_programme' trigger from baseline → training enrolment
--
-- Migration 046 auto-promoted a candidate to 'in_programme' the moment
-- a baseline assessment was saved. That was wrong for how ACH actually
-- works.
--
-- Real flow (IKEA-style):
--   1. Initial screening
--   2. Baseline assessment collected for EVERYONE who passed screening
--      — you cannot yet tell who will end up in the intervention
--   3. ACH interviews all screened candidates
--   4. ACH shortlists to the employer
--   5. Employer interviews the shortlist and selects
--   6. ACH trains the selected — plus a few extras for certification benefit
--   7. Selected ones go on to placement
--
-- The moment where a candidate goes from "in the pool" to "actively
-- receiving ACH's intervention" is enrolment in a training programme.
-- Baseline is a screening measurement, not an intervention.
--
-- Selection by the employer stays a separate fact (recorded on
-- candidate_interviews), not the trigger for status.

-- ── 1. Drop the baseline-based trigger from migration 046 ──
drop trigger if exists trg_auto_in_programme on public.assessments;
drop function if exists public.auto_set_in_programme_on_baseline();

-- ── 2. New trigger: training enrolment → in_programme ──
-- Fires when a training_enrolments row is created OR its status is
-- changed to enrolled/completed. Only promotes candidates who are
-- currently 'applicant' — never rewinds someone from placed/progressed
-- back to in_programme, and never touches withdrawn.
create or replace function public.auto_set_in_programme_on_training_enrolment()
returns trigger language plpgsql as $$
begin
  if NEW.status in ('enrolled', 'completed') then
    update public.candidates
       set status = 'in_programme'
     where id = NEW.candidate_id
       and status = 'applicant';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_auto_in_programme_from_training on public.training_enrolments;
create trigger trg_auto_in_programme_from_training
  after insert or update of status on public.training_enrolments
  for each row execute function public.auto_set_in_programme_on_training_enrolment();

-- ── 3. Backfill ──
-- Two directions:
--   (a) Any candidate with a training enrolment (enrolled or completed)
--       who isn't already placed/progressed/withdrawn → in_programme.
--   (b) Any candidate currently in_programme who has NO qualifying
--       training enrolment → revert to applicant. This fixes the
--       25-candidate IKEA cohort where baseline auto-promoted everyone.

-- (a) promote those who belong in in_programme
update public.candidates c
   set status = 'in_programme'
  from public.training_enrolments te
 where te.candidate_id = c.id
   and te.status in ('enrolled', 'completed')
   and c.status = 'applicant';

-- (b) demote those who don't
update public.candidates c
   set status = 'applicant'
 where c.status = 'in_programme'
   and not exists (
     select 1 from public.training_enrolments te
      where te.candidate_id = c.id
        and te.status in ('enrolled', 'completed')
   );
