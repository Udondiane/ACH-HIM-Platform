'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cohortSchema } from './schema';

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fdToPlain(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  for (const k of ['programme_weeks','target_size','delivery_cost']) {
    if (obj[k] === '') obj[k] = undefined;
  }
  return obj;
}

function normalisePayload(input: ReturnType<typeof cohortSchema.parse>) {
  return {
    cohort_ref: input.cohort_ref,
    name: input.name,
    structure: input.structure,
    status: input.status,
    location: input.location || null,
    sector_focus: input.sector_focus || null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    programme_weeks: input.programme_weeks === '' ? null : input.programme_weeks ?? null,
    target_size: input.target_size === '' ? null : input.target_size ?? null,
    delivery_cost: input.delivery_cost === '' ? null : input.delivery_cost ?? null,
    notes: input.notes || null,
  };
}

export async function createCohortAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = cohortSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cohorts')
    .insert(normalisePayload(parsed.data) as never)
    .select('id').single();
  if (error) return { ok: false, error: error.message };
  const row = data as { id: string } | null;
  revalidatePath('/cohorts');
  revalidatePath('/dashboard');
  redirect(`/cohorts/${row!.id}`);
}

export async function updateCohortAction(
  id: string,
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = cohortSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('cohorts')
    .update(normalisePayload(parsed.data) as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/cohorts');
  revalidatePath(`/cohorts/${id}`);
  return { ok: true, id };
}

export async function cancelCohortAction(id: string) {
  const supabase = createClient();
  await supabase.from('cohorts').update({ status: 'cancelled' } as never).eq('id', id);
  revalidatePath('/cohorts');
  redirect('/cohorts');
}

// Linking partners / candidates to a cohort
export async function linkPartnerToCohortAction(
  cohortId: string,
  partnerId: string,
  sponsorship_count: number,
  engagement_fee: number,
  is_lead_partner: boolean,
) {
  const supabase = createClient();
  await supabase.from('cohort_partners').upsert({
    cohort_id: cohortId, partner_id: partnerId, sponsorship_count, engagement_fee, is_lead_partner,
  } as never, { onConflict: 'cohort_id,partner_id' });
  revalidatePath(`/cohorts/${cohortId}`);
}

export async function unlinkPartnerFromCohortAction(cohortPartnerId: string, cohortId: string) {
  const supabase = createClient();
  await supabase.from('cohort_partners').delete().eq('id', cohortPartnerId);
  revalidatePath(`/cohorts/${cohortId}`);
}

export async function linkCandidateToCohortAction(
  cohortId: string,
  candidateId: string,
  sponsoringPartnerId?: string | null,
) {
  const supabase = createClient();
  await supabase.from('cohort_candidates').upsert({
    cohort_id: cohortId, candidate_id: candidateId,
    sponsoring_partner_id: sponsoringPartnerId ?? null,
  } as never, { onConflict: 'cohort_id,candidate_id' });
  revalidatePath(`/cohorts/${cohortId}`);
}

export async function unlinkCandidateFromCohortAction(rowId: string, cohortId: string) {
  const supabase = createClient();
  await supabase.from('cohort_candidates').delete().eq('id', rowId);
  revalidatePath(`/cohorts/${cohortId}`);
}
