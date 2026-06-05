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
  if (!('is_rolling' in obj)) obj.is_rolling = false;
  return obj;
}

function normalisePayload(input: ReturnType<typeof cohortSchema.parse>) {
  // intervention_start_date + is_rolling live in migration 034; omit them
  // until the migration is applied so saves work everywhere.
  return {
    cohort_ref: input.cohort_ref,
    name: input.name,
    project_id: (input.project_id && input.project_id !== '__none__') ? input.project_id : null,
    structure: input.structure,
    service_type: input.service_type,
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

/** Resolve a cohort_ref that doesn't collide. If the submitted one already
 *  exists, append -2 / -3 / -N until we find a free slot. */
async function uniqueCohortRef(
  supabase: ReturnType<typeof createClient>,
  desired: string,
): Promise<string> {
  let candidate = desired;
  let n = 2;
  for (;;) {
    const { data } = await supabase
      .from('cohorts').select('id').eq('cohort_ref', candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${desired}-${n}`;
    n += 1;
    if (n > 50) return `${desired}-${Date.now()}`; // safety net
  }
}

export async function createCohortAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = cohortSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = createClient();

  // Try the desired ref first, then escalate to numbered suffixes, then a
  // hard timestamp fallback. Retry the insert itself if a race-condition
  // duplicate still slips through (PostgREST error code 23505).
  const baseRef = parsed.data.cohort_ref;
  const candidates: string[] = [baseRef];
  for (let n = 2; n <= 50; n++) candidates.push(`${baseRef}-${n}`);
  candidates.push(`${baseRef}-${Date.now()}`);

  for (const ref of candidates) {
    const payload = { ...normalisePayload(parsed.data), cohort_ref: ref };
    const { data, error } = await supabase
      .from('cohorts')
      .insert(payload as never)
      .select('id').single();

    if (!error) {
      const row = data as { id: string };
      revalidatePath('/cohorts');
      revalidatePath('/dashboard');
      redirect(`/cohorts/${row.id}`);
    }
    // 23505 = unique violation. Anything else, bail.
    const isDup = typeof error?.message === 'string' && (
      error.message.includes('cohorts_cohort_ref_key') ||
      error.message.includes('duplicate key value')
    );
    if (!isDup) return { ok: false, error: error.message };
  }

  return { ok: false, error: 'Could not allocate a unique cohort reference. Please try a different name.' };
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
  _interventionStartDate?: string | null,
) {
  // intervention_start_date column is part of migration 034; omitted from
  // the insert until that migration is applied.
  const supabase = createClient();
  await supabase.from('cohort_candidates').upsert({
    cohort_id: cohortId, candidate_id: candidateId,
    sponsoring_partner_id: sponsoringPartnerId ?? null,
  } as never, { onConflict: 'cohort_id,candidate_id' });
  revalidatePath(`/cohorts/${cohortId}`);
}

export async function setCandidateInterventionStartAction(
  cohortCandidateRowId: string,
  cohortId: string,
  startDate: string | null,
) {
  const supabase = createClient();
  const { error } = await supabase
    .from('cohort_candidates')
    .update({ intervention_start_date: startDate || null } as never)
    .eq('id', cohortCandidateRowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cohorts/${cohortId}`);
  return { ok: true };
}

export async function unlinkCandidateFromCohortAction(rowId: string, cohortId: string) {
  const supabase = createClient();
  await supabase.from('cohort_candidates').delete().eq('id', rowId);
  revalidatePath(`/cohorts/${cohortId}`);
}
