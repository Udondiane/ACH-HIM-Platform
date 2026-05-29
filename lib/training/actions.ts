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
