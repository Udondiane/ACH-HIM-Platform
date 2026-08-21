-- ============================================================
-- 063 · assessment closing reflection (default quote-eliciting question)
-- ============================================================
-- Every assessment already captures factor-level responses (numeric
-- score + narrative + observable changes + practices) and lets the
-- assessor tag any of those as "feature-worthy" candidate voice for
-- outcomes reports. In practice that tagging is opportunistic —
-- assessors have to remember to do it, and many assessments end
-- without a single quotable line captured.
--
-- This migration adds a first-class "closing reflection" — one
-- open-ended question rendered as the final card of every assessment.
-- The wording is generated in the app from the project's ticked
-- activities and the assessment timepoint, so the question is always
-- contextual to what the beneficiary has actually done.
--
-- Guarantees at least one quote per assessment, which powers the
-- narrative spine of every outcomes report + featured-quotes library.
-- ============================================================

alter table public.assessments
  add column if not exists closing_reflection_text text,
  add column if not exists closing_reflection_captured_via text
    check (closing_reflection_captured_via in ('typed','voice','voice_edited')),
  add column if not exists closing_reflection_language text,
  add column if not exists closing_reflection_audio_id uuid
    references public.assessment_attachments(id) on delete set null;

comment on column public.assessments.closing_reflection_text is
  'Answer to the default open-ended question asked at end of every assessment ("In your own words..."). Guarantees at least one quote per assessment for outcomes reports.';
comment on column public.assessments.closing_reflection_captured_via is
  'How the closing reflection was captured: typed, transcribed from voice, or voice + edited afterwards.';
comment on column public.assessments.closing_reflection_language is
  'IETF language tag detected by Whisper (or the candidate preferred_locale if typed).';
comment on column public.assessments.closing_reflection_audio_id is
  'Optional link to the original audio recording in assessment_attachments — audit trail if the transcript is later disputed.';
