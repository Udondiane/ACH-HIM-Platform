-- ============================================================
-- Migration 042 — backfill audio consent onto candidate_consent (D6 from audit)
-- ============================================================
-- Audio-recording consent was previously stored as a boolean +
-- date on the candidates row (migration 030), while all other consent
-- flags live as dated rows on candidate_consent. Two write paths, same
-- meaning ("did the candidate agree to voice recording") — the AI
-- pipeline already reads from candidate_consent.may_ai_analyse_transcript,
-- so that side is authoritative going forward.
--
-- This migration backfills the candidate_consent table with any
-- unrepresented candidates.consent_audio_recording=true rows so no
-- existing consent is lost when the app-layer setter switches over.
-- No data on candidates.consent_audio_recording is deleted here —
-- the column is left in place for now and can be dropped in a later
-- migration once we've verified no other reader references it.
-- ============================================================

insert into public.candidate_consent (
  candidate_id,
  given_at,
  may_be_named,
  may_be_quoted,
  may_appear_in_case_study,
  may_share_career_goal_with_partner,
  may_ai_analyse_transcript,
  notes
)
select
  c.id                                                                as candidate_id,
  coalesce(c.consent_audio_recording_date::timestamptz, now())         as given_at,
  false                                                                as may_be_named,
  false                                                                as may_be_quoted,
  false                                                                as may_appear_in_case_study,
  false                                                                as may_share_career_goal_with_partner,
  true                                                                 as may_ai_analyse_transcript,
  'Backfilled from candidates.consent_audio_recording (migration 042).' as notes
from public.candidates c
where c.consent_audio_recording = true
  and not exists (
    select 1 from public.candidate_consent cc
    where cc.candidate_id = c.id
      and cc.may_ai_analyse_transcript = true
  );
