'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

  // Look up the candidate's cohort via cohort_candidates → cohort_id
  const { data: cc } = await supabase
    .from('cohort_candidates').select('cohort_id').eq('candidate_id', candidateId).maybeSingle();
  const cohortId = (cc as { cohort_id?: string } | null)?.cohort_id ?? null;

  // Upsert (one assessment per candidate+project+timepoint thanks to the unique constraint)
  const { data, error } = await supabase
    .from('assessments')
    .upsert(
      {
        project_id: projectId,
        candidate_id: candidateId,
        cohort_id: cohortId,
        timepoint,
        assessed_on: new Date().toISOString().slice(0, 10),
        assessor_id: user.user?.id ?? null,
        status: 'in_progress',
      } as never,
      { onConflict: 'candidate_id,project_id,timepoint' }
    )
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  const row = data as { id: string } | null;
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/assess/${row!.id}`);
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

export async function completeAssessmentAction(assessmentId: string, projectId: string) {
  const supabase = createClient();
  await supabase.from('assessments').update({ status: 'completed' } as never).eq('id', assessmentId);
  /* Once any assessment is completed, lock the project so its Core/Optional
     selection cannot drift mid-flight (Eval Surface methodology guard). */
  await supabase.from('projects').update({ is_locked: true } as never).eq('id', projectId);
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
