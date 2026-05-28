/* All-features migration: brings the platform up to parity with the
   two reference apps (HIM Evaluation Surface + Impact Tracker).

   1. Add observable_changes + practices text columns to
      assessment_responses (Impact Tracker pattern)
   2. Add is_locked flag to projects (Eval Surface pattern - prevent
      Core/Optional changes once assessments are in flight)
   3. Add evaluation_type to projects (Formative / Summative from
      Impact Tracker; nullable so existing projects do not need it)
   4. Add personnel + focus to projects (Impact Tracker metadata) */

alter table public.assessment_responses
  add column if not exists observable_changes text,
  add column if not exists practices text;

alter table public.projects
  add column if not exists is_locked boolean not null default false,
  add column if not exists evaluation_type text
    check (evaluation_type in ('formative', 'summative') or evaluation_type is null),
  add column if not exists personnel text,
  add column if not exists focus_area text;
