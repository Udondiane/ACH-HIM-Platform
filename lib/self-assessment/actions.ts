'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { assertCan, canRunAssessments } from '@/lib/auth/capabilities';

/**
 * Generate a single-use self-assessment token for a beneficiary at a
 * given timepoint. Returns the redemption URL — staff share this via
 * WhatsApp, SMS, or email. Beneficiary opens on their phone, completes
 * the assessment (factor scores + closing reflection at 3/6/12mo, or
 * reflection only at baseline), submits.
 *
 * Token defaults to 14-day expiry so stale forwards stop working.
 */
export type Timepoint = 'baseline' | 'mid_3mo' | 'exit_6mo' | 'followup_12mo';

export async function createSelfAssessmentTokenAction(input: {
  candidateId: string;
  projectId: string;
  timepoint: Timepoint;
}): Promise<
  | { ok: true; token: string; url: string; expiresAt: string }
  | { ok: false; error: string }
> {
  const user = await requireUser(['ach_staff']);
  assertCan(canRunAssessments, user);
  const supabase = createClient();
  const { data: authUser } = await supabase.auth.getUser();

  // Verify candidate + project are consistent — candidate must be
  // enrolled in a cohort under this project.
  const { data: cohortRows } = await supabase
    .from('cohorts').select('id').eq('project_id', input.projectId);
  const cohortIds = ((cohortRows as { id: string }[] | null) ?? []).map(c => c.id);
  if (cohortIds.length === 0) return { ok: false, error: 'Project has no cohorts.' };
  const { data: enrolment } = await supabase
    .from('cohort_candidates')
    .select('candidate_id')
    .eq('candidate_id', input.candidateId)
    .in('cohort_id', cohortIds)
    .maybeSingle();
  if (!enrolment) return { ok: false, error: 'Beneficiary is not enrolled on this project.' };

  // Random 32-byte URL-safe token. Won't collide in this dataset.
  const token = randomBytes(32).toString('base64url');

  const { data, error } = await supabase.from('self_assessment_tokens').insert({
    token,
    candidate_id: input.candidateId,
    project_id: input.projectId,
    timepoint: input.timepoint,
    created_by: authUser.user?.id ?? null,
  } as never).select('token, expires_at').single();

  if (error) return { ok: false, error: error.message };

  const row = data as { token: string; expires_at: string };
  const base = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const url = `${base.replace(/\/$/, '')}/self-assess/${row.token}`;

  revalidatePath(`/candidates/${input.candidateId}`);
  return { ok: true, token: row.token, url, expiresAt: row.expires_at };
}

/**
 * Redeem a self-assessment token. Public — no auth required. Called
 * from the beneficiary form. Validates token, upserts the reflection
 * (and — at 3/6/12mo — the factor scores) onto the assessment for
 * that (candidate, project, timepoint), marks the token used.
 *
 * Uses the service client because the beneficiary is not authenticated;
 * the token IS the credential.
 */
export interface FactorScoreInput {
  indicatorId: string;
  numericValue: number;      // 1-5
}

export async function submitSelfAssessmentAction(input: {
  token: string;
  responseText: string;
  capturedVia: 'typed' | 'voice' | 'voice_edited';
  spokenLanguage?: string | null;
  audioAttachmentId?: string | null;
  factorResponses?: FactorScoreInput[];   // populated at 3/6/12mo
  consented: boolean;                     // explicit re-affirmation at submit
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.consented) {
    return { ok: false, error: 'Please tick the consent box before submitting your answers.' };
  }

  const supabase = createServiceClient();

  // Validate token — must exist, not used, not expired.
  const { data: tokenRow } = await supabase
    .from('self_assessment_tokens')
    .select('id, candidate_id, project_id, timepoint, used_at, expires_at')
    .eq('token', input.token)
    .maybeSingle();
  if (!tokenRow) return { ok: false, error: 'Invalid or unknown link. Ask your ACH contact for a new one.' };
  const t = tokenRow as { id: string; candidate_id: string; project_id: string; timepoint: Timepoint; used_at: string | null; expires_at: string };
  if (t.used_at) return { ok: false, error: 'This link has already been used. Ask your ACH contact for a new one.' };
  if (new Date(t.expires_at) < new Date()) return { ok: false, error: 'This link has expired. Ask your ACH contact for a new one.' };

  const text = input.responseText.trim();
  if (text.length < 3) return { ok: false, error: 'Please write at least a short answer before submitting.' };

  // Validate factor scores if supplied — must be 1-5 integers.
  const factorScores = input.factorResponses ?? [];
  for (const r of factorScores) {
    if (!r.indicatorId) return { ok: false, error: 'One of your answers is missing a question reference. Please try again.' };
    if (!Number.isFinite(r.numericValue) || r.numericValue < 1 || r.numericValue > 5) {
      return { ok: false, error: 'One of your answers is out of range. Please score each question between 1 and 5.' };
    }
  }

  // Find or create the assessment row for this (candidate, project, timepoint).
  const { data: existing } = await supabase
    .from('assessments')
    .select('id, cohort_id')
    .eq('candidate_id', t.candidate_id)
    .eq('project_id', t.project_id)
    .eq('timepoint', t.timepoint)
    .maybeSingle();

  let assessmentId: string;
  if (existing) {
    assessmentId = (existing as { id: string }).id;
  } else {
    const { data: cohortRows } = await supabase
      .from('cohorts').select('id').eq('project_id', t.project_id).order('created_at', { ascending: true });
    const projectCohortIds = ((cohortRows as { id: string }[] | null) ?? []).map(c => c.id);
    const { data: link } = await supabase
      .from('cohort_candidates')
      .select('cohort_id')
      .eq('candidate_id', t.candidate_id)
      .in('cohort_id', projectCohortIds)
      .maybeSingle();
    const cohortId = (link as { cohort_id: string } | null)?.cohort_id ?? projectCohortIds[0] ?? null;

    const { data: created, error: createErr } = await supabase.from('assessments').insert({
      project_id: t.project_id,
      candidate_id: t.candidate_id,
      cohort_id: cohortId,
      timepoint: t.timepoint,
      assessed_on: new Date().toISOString().slice(0, 10),
      status: 'in_progress',
      assessment_source: 'candidate_self',
    } as never).select('id').single();
    if (createErr) return { ok: false, error: createErr.message };
    assessmentId = (created as { id: string }).id;
  }

  // Mark the assessment as self-scored when a beneficiary is providing
  // scores. Reflection-only submissions leave the source untouched so
  // an assessment that mixes staff + self scoring keeps its staff
  // provenance at the row level.
  if (factorScores.length > 0) {
    await supabase.from('assessments').update({
      assessment_source: 'candidate_self',
    } as never).eq('id', assessmentId);
  }

  // Save the closing reflection onto the assessment.
  const { error: updateErr } = await supabase.from('assessments').update({
    closing_reflection_text: text,
    closing_reflection_captured_via: input.capturedVia,
    closing_reflection_language: input.spokenLanguage ?? null,
    closing_reflection_audio_id: input.audioAttachmentId ?? null,
  } as never).eq('id', assessmentId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Upsert factor scores. Each response is tagged is_self_scored=true
  // so aggregate reporting can distinguish provenance.
  if (factorScores.length > 0) {
    const rows = factorScores.map(r => ({
      assessment_id: assessmentId,
      indicator_id: r.indicatorId,
      numeric_value: r.numericValue,
      is_self_scored: true,
    }));
    const { error: scoreErr } = await supabase
      .from('assessment_responses')
      .upsert(rows as never, { onConflict: 'assessment_id,indicator_id' });
    if (scoreErr) return { ok: false, error: scoreErr.message };
  }

  // Mark the token used so it can't be redeemed twice.
  await supabase.from('self_assessment_tokens').update({
    used_at: new Date().toISOString(),
    response_length: text.length,
  } as never).eq('id', t.id);

  return { ok: true };
}
