'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { interviewSchema } from './schema';

export type InterviewResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function fdToPlain(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  if (obj.fit_score === '') obj.fit_score = undefined;
  return obj;
}

function normalisePayload(input: ReturnType<typeof interviewSchema.parse>) {
  return {
    candidate_id: input.candidate_id,
    cohort_id: input.cohort_id || null,
    partner_id: input.partner_id || null,
    kind: input.kind,
    scheduled_for: input.scheduled_for || null,
    conducted_on: input.conducted_on || null,
    interviewer_name: input.interviewer_name || null,
    interviewer_role: input.interviewer_role || null,
    outcome: input.outcome,
    fit_score: input.fit_score === '' ? null : input.fit_score ?? null,
    strengths: input.strengths || null,
    development_areas: input.development_areas || null,
    general_feedback: input.general_feedback || null,
    notes_internal: input.notes_internal || null,
  };
}

async function maybeAdvanceJourney(supabase: ReturnType<typeof createClient>, candidateId: string, kind: string, outcome: string) {
  let nextStage: string | null = null;
  if (kind === 'ach_selection' && outcome === 'proceed') nextStage = 'ach_interview_done';
  else if (kind === 'partner_interview' && outcome === 'proceed') nextStage = 'partner_interview_done';
  if (!nextStage) return;
  await supabase.from('candidates').update({ journey_stage: nextStage } as never).eq('id', candidateId);
}

export async function createInterviewAction(_prev: InterviewResult | null, fd: FormData): Promise<InterviewResult> {
  const parsed = interviewSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return { ok: false, error: 'Please check the form fields: ' + parsed.error.errors.map(e => e.message).join('; ') };
  }
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const payload = { ...normalisePayload(parsed.data), recorded_by: user.user?.id ?? null };

  // Idempotent semantics: for a given (candidate, kind, partner) tuple
  // there should only ever be one interview record. If ACH double-clicks
  // save, or navigates back and re-submits, or the form is re-mounted
  // and posted again, we update the existing row rather than creating a
  // duplicate. Prevents the "same candidate appears twice in the partner
  // interview list" bug.
  let existingQuery = supabase
    .from('candidate_interviews')
    .select('id')
    .eq('candidate_id', parsed.data.candidate_id)
    .eq('kind', parsed.data.kind)
    .limit(1);
  if (parsed.data.partner_id) {
    existingQuery = existingQuery.eq('partner_id', parsed.data.partner_id);
  } else {
    existingQuery = existingQuery.is('partner_id', null);
  }
  const { data: existing } = await existingQuery.maybeSingle();
  const existingId = (existing as { id: string } | null)?.id;

  let savedId: string;
  if (existingId) {
    const { error: updErr } = await supabase
      .from('candidate_interviews')
      .update(payload as never)
      .eq('id', existingId);
    if (updErr) return { ok: false, error: updErr.message };
    savedId = existingId;
  } else {
    const { data, error } = await supabase
      .from('candidate_interviews')
      .insert(payload as never)
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    savedId = (data as { id: string }).id;
  }

  await maybeAdvanceJourney(supabase, parsed.data.candidate_id, parsed.data.kind, parsed.data.outcome);
  revalidatePath(`/candidates/${parsed.data.candidate_id}`);
  revalidatePath(`/candidates/${parsed.data.candidate_id}/interviews`);
  revalidatePath('/partner/interviews');
  return { ok: true, id: savedId };
}

export async function updateInterviewAction(id: string, _prev: InterviewResult | null, fd: FormData): Promise<InterviewResult> {
  const parsed = interviewSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return { ok: false, error: 'Please check the form fields: ' + parsed.error.errors.map(e => e.message).join('; ') };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('candidate_interviews')
    .update(normalisePayload(parsed.data) as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  await maybeAdvanceJourney(supabase, parsed.data.candidate_id, parsed.data.kind, parsed.data.outcome);
  revalidatePath(`/candidates/${parsed.data.candidate_id}`);
  revalidatePath(`/candidates/${parsed.data.candidate_id}/interviews`);
  revalidatePath('/partner/interviews');
  return { ok: true, id };
}

export async function deleteInterviewAction(id: string, candidateId: string) {
  const supabase = createClient();
  await supabase.from('candidate_interviews').delete().eq('id', id);
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath(`/candidates/${candidateId}/interviews`);
  revalidatePath('/partner/interviews');
}

export async function updateJourneyStageAction(candidateId: string, stage: string) {
  const supabase = createClient();
  await supabase.from('candidates').update({ journey_stage: stage } as never).eq('id', candidateId);
  revalidatePath(`/candidates/${candidateId}`);
}
