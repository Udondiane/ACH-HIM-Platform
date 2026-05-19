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
) {
  const supabase = createClient();
  await supabase
    .from('assessment_responses')
    .upsert({
      assessment_id: assessmentId,
      indicator_id: indicatorId,
      numeric_value: numericValue,
      narrative,
    } as never, { onConflict: 'assessment_id,indicator_id' });
}

export async function completeAssessmentAction(assessmentId: string, projectId: string) {
  const supabase = createClient();
  await supabase.from('assessments').update({ status: 'completed' } as never).eq('id', assessmentId);
  revalidatePath(`/projects/${projectId}/assess/${assessmentId}`);
  revalidatePath(`/projects/${projectId}`);
}
