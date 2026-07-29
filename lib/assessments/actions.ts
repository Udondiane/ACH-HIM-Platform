'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { baselineWindowState } from './intervention';

type Timepoint = 'baseline' | 'mid_3mo' | 'exit_6mo' | 'followup_12mo';

export type StartResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function startAssessmentAction(
  projectId: string,
  candidateId: string,
  timepoint: Timepoint,
): Promise<StartResult> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  // If an assessment for this (candidate, project, timepoint) already exists,
  // resume it rather than overwriting assessed_on / status. The previous
  // upsert behaviour silently reset the date and bumped status back to
  // in_progress, which corrupted audit trails.
  const { data: existing } = await supabase
    .from('assessments')
    .select('id')
    .eq('project_id', projectId)
    .eq('candidate_id', candidateId)
    .eq('timepoint', timepoint)
    .maybeSingle();
  if (existing) {
    revalidatePath(`/projects/${projectId}`);
    redirect(`/projects/${projectId}/assess/${(existing as { id: string }).id}`);
  }

  // Look up the candidate's cohort.
  const { data: cc } = await supabase
    .from('cohort_candidates')
    .select('cohort_id, intervention_start_date, cohorts(intervention_start_date)')
    .eq('candidate_id', candidateId)
    .maybeSingle();
  const ccRow = cc as { cohort_id?: string; intervention_start_date?: string | null; cohorts?: { intervention_start_date?: string | null } } | null;
  const cohortId = ccRow?.cohort_id ?? null;

  // Baseline hard lockout: refuse to start a baseline once the project's
  // baseline window has closed. Window is computed from project.start_date +
  // project.baseline_window_days. Later timepoints remain unaffected.
  if (timepoint === 'baseline') {
    const { data: proj } = await supabase
      .from('projects')
      .select('start_date, baseline_window_days')
      .eq('id', projectId)
      .maybeSingle();
    const projRow = proj as { start_date: string | null; baseline_window_days: number | null } | null;
    if (projRow?.start_date) {
      const start = new Date(`${projRow.start_date}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + (projRow.baseline_window_days ?? 3));
      const today = new Date();
      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (todayMid > end) {
        return { ok: false, error: `Baseline window closed on ${end.toISOString().slice(0, 10)}. Later timepoints are still available.` };
      }
    }
  }

  const { data, error } = await supabase
    .from('assessments')
    .insert({
      project_id: projectId,
      candidate_id: candidateId,
      cohort_id: cohortId,
      timepoint,
      assessed_on: new Date().toISOString().slice(0, 10),
      assessor_id: user.user?.id ?? null,
      status: 'in_progress',
    } as never)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  const row = data as { id: string } | null;
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/assess/${row!.id}`);
}

export async function startAssessmentForCandidateAction(
  candidateId: string,
  timepoint: Timepoint,
): Promise<StartResult> {
  const supabase = createClient();
  // Find the candidate's project via cohort_candidates → cohorts.project_id
  const { data: cc } = await supabase
    .from('cohort_candidates')
    .select('cohort_id, cohorts(project_id)')
    .eq('candidate_id', candidateId)
    .maybeSingle();
  const projectId = (cc as { cohorts?: { project_id?: string } } | null)?.cohorts?.project_id ?? null;
  if (!projectId) {
    return { ok: false, error: 'Candidate is not yet linked to a cohort with a project. Add them to a cohort first.' };
  }
  return startAssessmentAction(projectId, candidateId, timepoint);
}

export async function saveAssessmentResponseAction(
  assessmentId: string,
  indicatorId: string,
  numericValue: number | null,
  narrative: string | null,
  observableChanges: string | null = null,
  practices: string | null = null,
) {
  const supabase = createClient();
  await supabase
    .from('assessment_responses')
    .upsert({
      assessment_id: assessmentId,
      indicator_id: indicatorId,
      numeric_value: numericValue,
      narrative,
      observable_changes: observableChanges,
      practices,
    } as never, { onConflict: 'assessment_id,indicator_id' });
}

/**
 * Adjust a score after AI review. Called when the assessor sees the AI
 * suggestion differs from their own and chooses to change theirs.
 *
 * Preserves the original assessor score in original_score_before_ai_review,
 * flags was_adjusted_after_ai_review=true, and requires a reason (structured
 * category + free text). This is the audit trail that makes assessor↔AI
 * calibration research meaningful.
 */
export async function adjustScoreAfterAiReviewAction(input: {
  assessmentId: string;
  indicatorId: string;
  newScore: number;
  originalScore: number | null;
  reasonCategory: 'assessor_observed_more' | 'ai_missed_cultural_context'
    | 'ai_missed_language_nuance' | 'assessor_error_corrected' | 'other';
  reasonText: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.reasonText || input.reasonText.trim().length < 3) {
    return { ok: false, error: 'A reason for the adjustment is required.' };
  }
  if (input.newScore < 0 || input.newScore > 5) {
    return { ok: false, error: 'Score must be between 0 and 5.' };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('assessment_responses')
    .update({
      numeric_value: input.newScore,
      original_score_before_ai_review: input.originalScore,
      was_adjusted_after_ai_review: true,
      adjustment_reason_category: input.reasonCategory,
      adjustment_reason: input.reasonText.trim().slice(0, 2000),
      adjusted_at: new Date().toISOString(),
    } as never)
    .eq('assessment_id', input.assessmentId)
    .eq('indicator_id', input.indicatorId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function saveFactorResponseAction(
  assessmentId: string,
  factorId: string,
  responseText: string | null,
  capturedVia: 'typed' | 'voice' | 'voice_edited' = 'typed',
  spokenLanguage: string | null = null,
  audioAttachmentId: string | null = null,
) {
  const supabase = createClient();
  const { error } = await supabase
    .from('assessment_factor_responses')
    .upsert({
      assessment_id: assessmentId,
      factor_id: factorId,
      response_text: responseText,
      captured_via: capturedVia,
      spoken_language: spokenLanguage,
      audio_attachment_id: audioAttachmentId,
    } as never, { onConflict: 'assessment_id,factor_id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function completeAssessmentAction(assessmentId: string, projectId: string) {
  const supabase = createClient();
  await supabase.from('assessments').update({ status: 'completed' } as never).eq('id', assessmentId);
  /* Project lock on first-assessment-completed disabled for the training
     session so the assessor can edit freely. */
  revalidatePath(`/projects/${projectId}/assess/${assessmentId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function applyAiSuggestionsAction(
  assessmentId: string,
  suggestions: { indicatorId: string; numericValue: number | null; observableChanges: string; practices: string }[],
) {
  const supabase = createClient();
  for (const s of suggestions) {
    await supabase.from('assessment_responses').upsert({
      assessment_id: assessmentId,
      indicator_id: s.indicatorId,
      numeric_value: s.numericValue,
      observable_changes: s.observableChanges || null,
      practices: s.practices || null,
    } as never, { onConflict: 'assessment_id,indicator_id' });
  }
}

export async function unlockProjectAction(projectId: string) {
  const supabase = createClient();
  await supabase.from('projects').update({ is_locked: false } as never).eq('id', projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function exportProjectJsonAction(projectId: string): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const supabase = createClient();
  const [proj, caps, assessments, cohorts] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
    supabase.from('project_capabilities').select('*').eq('project_id', projectId),
    supabase.from('assessments').select(`
      id, candidate_id, timepoint, assessed_on, status, notes, created_at,
      candidates(candidate_ref, given_name, country_of_origin),
      assessment_responses(indicator_id, numeric_value, narrative, observable_changes, practices)
    `).eq('project_id', projectId),
    supabase.from('cohorts').select('id, cohort_ref, name, status, start_date, end_date').eq('project_id', projectId),
  ]);
  if (proj.error) return { ok: false, error: proj.error.message };
  return {
    ok: true,
    data: {
      project: proj.data,
      capabilities: caps.data ?? [],
      cohorts: cohorts.data ?? [],
      assessments: assessments.data ?? [],
      exported_at: new Date().toISOString(),
      methodology_version: 'v1.0',
    },
  };
}
