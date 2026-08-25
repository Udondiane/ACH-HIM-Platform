-- ============================================================
-- 068 · Self-assessment factor scoring
-- ============================================================
-- Extends the 067 self-assessment token flow so beneficiaries can
-- complete the full HIM factor scoring via the tokenised link — not
-- just the closing reflection. Reflection-only was defensible at
-- baseline (staff usually captures the HIM assessment in person) but
-- at 3mo / 6mo / 12mo the factor scoring IS the assessment.
--
-- Additions:
--   1. assessments.assessment_source — 'staff' | 'candidate_self' | 'partner'
--      so aggregate reports can distinguish self-scored from
--      staff-scored data. Different methodology, different aggregation
--      treatment.
--   2. assessment_responses.is_self_scored — mirror flag on the response
--      row for finer-grained provenance.
--   3. self_assessment_tokens.submitted_at — separates "opened the link"
--      from "final-submitted the assessment", so a beneficiary can
--      reopen their link and continue where they left off (save-and-
--      resume UX). used_at retains its "final consumed" semantic; the
--      redemption path treats used_at as the terminal state.
-- ============================================================

-- 1. Assessment-level provenance
alter table public.assessments
  add column if not exists assessment_source text not null default 'staff';

do $$ begin
  alter table public.assessments
    add constraint assessments_source_check
    check (assessment_source in ('staff', 'candidate_self', 'partner'));
exception when duplicate_object then null; end $$;

comment on column public.assessments.assessment_source is
  'Provenance of the scores on this assessment. Reports use this to distinguish self-scored (candidate) from staff-scored data — different methodology, different aggregation treatment.';

-- 2. Response-level provenance
alter table public.assessment_responses
  add column if not exists is_self_scored boolean not null default false;

comment on column public.assessment_responses.is_self_scored is
  'True if this response was captured through the beneficiary self-assessment flow (public tokenised link) rather than by staff or partner. Row-level equivalent of assessments.assessment_source, useful when a single assessment row mixes provenance (rare but possible if staff top up an incomplete self-scored assessment).';

create index if not exists idx_ar_self_scored
  on public.assessment_responses(assessment_id)
  where is_self_scored = true;

-- 3. Save-and-resume support on tokens
alter table public.self_assessment_tokens
  add column if not exists opened_at timestamptz;

comment on column public.self_assessment_tokens.opened_at is
  'First time the beneficiary opened the link. Left NULL until first open. Used only for lightweight analytics / troubleshooting — the redemption decision is still based on used_at (terminal, single-use).';
