'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { candidateSchema } from './schema';

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fdToPlain(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  // Unchecked checkboxes are absent from FormData entirely.
  if (!('is_ach_tenant' in obj)) obj.is_ach_tenant = false;
  if (!('at_risk' in obj)) obj.at_risk = false;
  // The data_collection_consent_confirmed field is a UI-only gate (HTML required).
  // It is not persisted — drop it before parsing so Zod doesn't reject the unknown key.
  delete obj.data_collection_consent_confirmed;
  return obj;
}

function normalisePayload(input: ReturnType<typeof candidateSchema.parse>, ref: string) {
  return {
    candidate_ref: ref,
    given_name: input.given_name,
    family_name: input.family_name,
    preferred_locale: input.preferred_locale,
    country_of_origin: input.country_of_origin,
    arrival_year: input.arrival_year,
    english_level: input.english_level || null,
    status: input.status,
    career_goal_summary: input.career_goal_summary || null,
    development_plan: input.development_plan || null,
    notes: input.notes || null,
    is_ach_tenant: input.is_ach_tenant,
    at_risk: input.at_risk,
    at_risk_reason: input.at_risk_reason || null,
    exit_reason: input.exit_reason || null,
    exit_date: input.exit_date || null,
    exit_notes: input.exit_notes || null,
    progression_type: input.status === 'progressed' ? (input.progression_type || null) : null,
    progression_notes: input.status === 'progressed' ? (input.progression_notes || null) : null,
  };
}

async function nextCandidateRef(supabase: ReturnType<typeof createClient>): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `C-${year}-`;
  const { data } = await supabase
    .from('candidates')
    .select('candidate_ref')
    .like('candidate_ref', `${prefix}%`);

  const refs = ((data ?? []) as { candidate_ref: string }[]).map(r => r.candidate_ref);
  // Find the highest numeric suffix among refs matching the simple C-YYYY-NNN pattern.
  // Refs with sub-codes like C-2025-VW3-012 are ignored — they won't collide because we
  // pad to 3 digits and the next simple ref is independent.
  const pattern = new RegExp(`^C-${year}-(\\d+)$`);
  let max = 0;
  for (const r of refs) {
    const m = r.match(pattern);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export async function createCandidateAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = candidateSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = createClient();
  const submittedRef = (parsed.data.candidate_ref ?? '').trim();
  const ref = submittedRef || (await nextCandidateRef(supabase));

  const { data, error } = await supabase
    .from('candidates')
    .insert(normalisePayload(parsed.data, ref) as never)
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  const row = data as { id: string } | null;

  // If the form was opened from a cohort page (hidden 'enrol_cohort_id'
  // field), auto-enrol the new candidate into that cohort and route them
  // back to the cohort.
  const enrolCohortId = (fd.get('enrol_cohort_id') as string | null)?.trim() || null;
  if (enrolCohortId && row?.id) {
    await supabase.from('cohort_candidates').upsert({
      cohort_id: enrolCohortId,
      candidate_id: row.id,
      sponsoring_partner_id: null,
    } as never, { onConflict: 'cohort_id,candidate_id' });
    revalidatePath(`/cohorts/${enrolCohortId}`);
    revalidatePath('/candidates');
    revalidatePath('/dashboard');
    redirect(`/cohorts/${enrolCohortId}`);
  }

  revalidatePath('/candidates');
  revalidatePath('/dashboard');
  redirect(`/candidates/${row!.id}`);
}

export async function updateCandidateAction(
  id: string,
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = candidateSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = createClient();
  // On update we require an existing ref (form preserves it). If somehow blank, regenerate.
  const submittedRef = (parsed.data.candidate_ref ?? '').trim();
  const ref = submittedRef || (await nextCandidateRef(supabase));
  const { error } = await supabase
    .from('candidates')
    .update(normalisePayload(parsed.data, ref) as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/candidates');
  revalidatePath(`/candidates/${id}`);
  return { ok: true, id };
}

export async function withdrawCandidateAction(id: string) {
  const supabase = createClient();
  await supabase.from('candidates').update({ status: 'withdrawn' } as never).eq('id', id);
  revalidatePath('/candidates');
  redirect('/candidates');
}

export async function setAudioConsentAction(candidateId: string, consent: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from('candidates')
    .update({
      consent_audio_recording: consent,
      consent_audio_recording_date: consent ? new Date().toISOString().slice(0, 10) : null,
    } as never)
    .eq('id', candidateId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}

export async function recordConsentAction(
  candidateId: string,
  flags: {
    may_be_named?: boolean;
    may_be_quoted?: boolean;
    may_appear_in_case_study?: boolean;
    may_ai_analyse_transcript?: boolean;
  },
  notes?: string,
) {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  await supabase.from('candidate_consent').insert({
    candidate_id: candidateId,
    may_be_named: !!flags.may_be_named,
    may_be_quoted: !!flags.may_be_quoted,
    may_appear_in_case_study: !!flags.may_appear_in_case_study,
    may_share_career_goal_with_partner: false,
    may_ai_analyse_transcript: !!flags.may_ai_analyse_transcript,
    recorded_by: user.user?.id ?? null,
    notes: notes ?? null,
  } as never);
  revalidatePath(`/candidates/${candidateId}`);
}
