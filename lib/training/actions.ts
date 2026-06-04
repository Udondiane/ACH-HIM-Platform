'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { trainingSchema } from './schema';

export type TrainingResult = { ok: true; id: string } | { ok: false; error: string };

function fdToPlain(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  for (const k of ['attended_sessions', 'total_sessions']) {
    if (obj[k] === '') obj[k] = undefined;
  }
  return obj;
}

function normalisePayload(input: ReturnType<typeof trainingSchema.parse>) {
  return {
    candidate_id: input.candidate_id,
    cohort_id: input.cohort_id || null,
    training_name: input.training_name,
    trainer: input.trainer || null,
    scheduled_start: input.scheduled_start || null,
    scheduled_end: input.scheduled_end || null,
    attended_sessions: input.attended_sessions === '' ? null : input.attended_sessions ?? null,
    total_sessions: input.total_sessions === '' ? null : input.total_sessions ?? null,
    completion_status: input.completion_status,
    completion_date: input.completion_date || null,
    certificate_url: input.certificate_url || null,
    notes: input.notes || null,
  };
}

export async function createTrainingAction(_prev: TrainingResult | null, fd: FormData): Promise<TrainingResult> {
  const parsed = trainingSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.errors.map(e => e.message).join('; ') };
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('candidate_training')
    .insert({ ...normalisePayload(parsed.data), recorded_by: user.user?.id ?? null } as never)
    .select('id').single();
  if (error) return { ok: false, error: error.message };
  if (parsed.data.completion_status === 'in_progress' || parsed.data.completion_status === 'completed') {
    await supabase.from('candidates').update({ journey_stage: 'training' } as never).eq('id', parsed.data.candidate_id);
  }
  revalidatePath(`/candidates/${parsed.data.candidate_id}`);
  revalidatePath(`/candidates/${parsed.data.candidate_id}/training`);
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateTrainingAction(id: string, _prev: TrainingResult | null, fd: FormData): Promise<TrainingResult> {
  const parsed = trainingSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.errors.map(e => e.message).join('; ') };
  const supabase = createClient();
  const { error } = await supabase
    .from('candidate_training')
    .update(normalisePayload(parsed.data) as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/candidates/${parsed.data.candidate_id}`);
  revalidatePath(`/candidates/${parsed.data.candidate_id}/training`);
  return { ok: true, id };
}

export async function deleteTrainingAction(id: string, candidateId: string) {
  const supabase = createClient();
  await supabase.from('candidate_training').delete().eq('id', id);
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath(`/candidates/${candidateId}/training`);
}

/**
 * Bulk-record a single training session against a list of attendees in a
 * cohort. One candidate_training row is created per attendee, all carrying
 * the same training_name / trainer / dates / topic / cohort_id. Used by the
 * tutor cohort roster page so a session can be logged in one form submit
 * rather than per-candidate.
 */
export async function bulkLogTrainingSessionAction(input: {
  cohortId: string;
  candidateIds: string[];
  trainingName: string;
  trainer: string | null;
  sessionDate: string;
  topic: string | null;
  completionStatus: 'not_started' | 'in_progress' | 'completed';
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!input.candidateIds.length) return { ok: false, error: 'No attendees selected.' };
  if (!input.trainingName.trim()) return { ok: false, error: 'Training name is required.' };
  if (!input.sessionDate) return { ok: false, error: 'Session date is required.' };

  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const rows = input.candidateIds.map(cid => ({
    candidate_id: cid,
    cohort_id: input.cohortId,
    training_name: input.trainingName.trim(),
    trainer: input.trainer?.trim() || null,
    scheduled_start: input.sessionDate,
    scheduled_end: input.sessionDate,
    attended_sessions: 1,
    total_sessions: 1,
    completion_status: input.completionStatus,
    completion_date: input.completionStatus === 'completed' ? input.sessionDate : null,
    notes: input.topic?.trim() || null,
    recorded_by: user.user?.id ?? null,
  }));

  const { error } = await supabase.from('candidate_training').insert(rows as never);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/cohorts/${input.cohortId}/training`);
  for (const cid of input.candidateIds) {
    revalidatePath(`/candidates/${cid}`);
    revalidatePath(`/candidates/${cid}/training`);
  }
  return { ok: true, count: rows.length };
}
