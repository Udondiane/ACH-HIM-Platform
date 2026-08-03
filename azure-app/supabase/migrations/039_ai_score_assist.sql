-- 039_ai_score_assist.sql
-- AI scoring assist for HIM assessments.
--
-- The IKEA pilot surfaced an inter-rater reliability issue: the same
-- candidate scored by two different assessors produced HIM profiles that
-- diverged by up to 2 points on Work-Readiness Confidence. This migration
-- introduces the schema for AI-assisted scoring as HIM's structural
-- response.
--
-- Workflow:
--   1. Assessor scores each factor blind (no AI visible)
--   2. Once submitted, AI reads the transcript + observable_bullets and
--      independently produces its own suggested score with rationale
--   3. Assessor is shown the comparison. Consensus is celebrated; divergence
--      triggers an explicit adjust-or-keep decision with a required reason.
--   4. All three data points are logged: assessor's original score, AI's
--      suggested score, assessor's final score with adjustment reason.
--
-- Adds:
--   1. ai_score_suggestions       — per-factor AI suggestion + rationale
--   2. assessment_responses.*     — adjustment tracking columns
--   3. candidate_consent.may_ai_analyse_transcript — GDPR-explicit consent
--      for the AI processing of interview transcripts

create table if not exists public.ai_score_suggestions (
  id                          uuid primary key default gen_random_uuid(),
  assessment_id               uuid not null references public.assessments(id) on delete cascade,
  factor_id                   text not null references public.factors(id) on delete cascade,
  -- what the assessor had scored when the AI ran (may be null if run before scoring)
  assessor_score_at_ai_time   numeric(4,2),
  -- what the AI proposed
  ai_suggested_score          numeric(4,2),
  ai_rationale                text,
  ai_evidence_quotes          jsonb,
  ai_confidence               text
    check (ai_confidence in ('low', 'medium', 'high') or ai_confidence is null),
  -- provenance
  model_version               text not null default 'unknown',
  prompt_version              text not null default 'v1',
  transcript_source           text not null default 'typed'
    check (transcript_source in ('typed', 'voice', 'voice_edited', 'none')),
  transcript_char_count       integer,
  -- lifecycle
  status                      text not null default 'completed'
    check (status in ('completed', 'skipped_no_consent', 'skipped_no_transcript', 'failed')),
  error_message               text,
  created_at                  timestamptz not null default now(),
  unique (assessment_id, factor_id, created_at)
);

create index if not exists idx_ai_score_assessment on public.ai_score_suggestions(assessment_id);
create index if not exists idx_ai_score_factor     on public.ai_score_suggestions(factor_id);

alter table public.ai_score_suggestions enable row level security;

drop policy if exists "ai_score_ach_all" on public.ai_score_suggestions;
create policy "ai_score_ach_all" on public.ai_score_suggestions
  for all to authenticated using (true) with check (true);

-- Adjustment tracking on assessment_responses. All columns nullable so
-- existing rows are untouched and future rows only populate when an AI
-- review has actually happened.
alter table public.assessment_responses
  add column if not exists original_score_before_ai_review numeric(4,2),
  add column if not exists was_adjusted_after_ai_review    boolean not null default false,
  add column if not exists adjustment_reason               text,
  add column if not exists adjustment_reason_category      text,
  add column if not exists adjusted_at                     timestamptz;

-- Consent flag on candidate_consent for AI transcript analysis.
alter table public.candidate_consent
  add column if not exists may_ai_analyse_transcript boolean not null default false;
