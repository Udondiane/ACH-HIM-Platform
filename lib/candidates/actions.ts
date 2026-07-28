'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { candidateSchema } from './schema';

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Bulk-create candidates from a set of pre-validated rows (typically the
 * output of mapRow() in ./import.ts, after ACH has ticked which rows to
 * import). Optionally enrol every newly-created candidate in a cohort.
 *
 * Duplicate handling: candidates matching an existing row on email or
 * NI number are skipped and reported back — not merged, not overwritten.
 * The caller decides what to do with the skipped list.
 */
export async function bulkImportCandidatesAction(input: {
  rows: Array<{
    mapped: Record<string, unknown>;
    application_source_data: Record<string, unknown>;
  }>;
  cohortId?: string;
}): Promise<
  | { ok: true; created: number; skipped_duplicates: number; failed: Array<{ row: number; error: string }> }
  | { ok: false; error: string }
> {
  const supabase = createClient();
  let created = 0;
  let skipped = 0;
  const failed: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < input.rows.length; i++) {
    const r = input.rows[i];
    const m = r.mapped;

    // Duplicate check on email + ni_number
    if (m.email || m.ni_number) {
      const orClauses: string[] = [];
      if (m.email)     orClauses.push(`email.eq.${m.email}`);
      if (m.ni_number) orClauses.push(`ni_number.eq.${m.ni_number}`);
      const { data: dupe } = await supabase
        .from('candidates')
        .select('id')
        .or(orClauses.join(','))
        .limit(1)
        .maybeSingle();
      if (dupe) { skipped++; continue; }
    }

    const insert: Record<string, unknown> = {
      given_name:       m.given_name ?? null,
      family_name:      m.family_name ?? null,
      preferred_name:   m.preferred_name ?? null,
      email:            m.email ?? null,
      phone:            m.phone ?? null,
      address_line1:    m.address_line1 ?? null,
      postcode:         m.postcode ?? null,
      date_of_birth:    m.date_of_birth ?? null,
      country_of_origin:m.country_of_origin ?? null,
      arrival_year:     m.arrival_year ?? null,
      preferred_locale: m.preferred_locale ?? 'en',
      english_level:    m.english_level ?? null,
      esol_level:       m.esol_level ?? null,
      benefit_status:   m.benefit_status ?? null,
      ni_number:        m.ni_number ?? null,
      career_goal_summary: m.career_goal_summary ?? null,
      notes:            m.notes ?? null,
      status:           'applicant',
      application_source_data: Object.keys(r.application_source_data).length > 0 ? r.application_source_data : null,
    };

    const { data, error: insErr } = await supabase
      .from('candidates')
      .insert(insert as never)
      .select('id')
      .single();

    if (insErr) { failed.push({ row: i + 1, error: insErr.message }); continue; }
    created++;

    const candidateId = (data as { id: string } | null)?.id;
    if (input.cohortId && candidateId) {
      await supabase
        .from('cohort_candidates')
        .insert({ cohort_id: input.cohortId, candidate_id: candidateId } as never);
    }
  }

  revalidatePath('/candidates');
  return { ok: true, created, skipped_duplicates: skipped, failed };
}

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

  // Guard: status='placed' must be backed by an actual placements row. Setting
  // the flag without a placement row leaves the candidate invisible on partner
  // dashboards and timepoint reports. Placements are the source of truth for
  // "placed"; this action can only set the flag if that source already agrees.
  if (parsed.data.status === 'placed') {
    const { data: placementRow } = await supabase
      .from('placements')
      .select('id')
      .eq('candidate_id', id)
      .limit(1)
      .maybeSingle();
    if (!placementRow) {
      return {
        ok: false,
        error: 'To mark this candidate as placed, first record a placement (Record placement button). The Placed status is set automatically once the placement exists.',
        fieldErrors: { status: ['Record a placement first — status will update automatically.'] } as Record<string, string[]>,
      };
    }
  }

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

export async function withdrawCandidateAction(
  id: string,
  opts?: { exitReason?: string | null; exitNotes?: string | null; exitDate?: string | null },
) {
  const supabase = createClient();
  await supabase.from('candidates').update({
    status: 'withdrawn',
    exit_reason: opts?.exitReason ?? null,
    exit_notes: opts?.exitNotes ?? null,
    exit_date: opts?.exitDate ?? new Date().toISOString().slice(0, 10),
  } as never).eq('id', id);
  revalidatePath('/candidates');
  redirect('/candidates');
}

// Audio-recording consent is stored on `candidate_consent` as
// `may_ai_analyse_transcript` (see migration 039). We carry forward the
// most recent publication flags so the timestamp of a toggle doesn't
// silently reset previously-recorded consent to false.
export async function setAudioConsentAction(candidateId: string, consent: boolean) {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const { data: latest } = await supabase
    .from('candidate_consent')
    .select('may_be_named, may_be_quoted, may_appear_in_case_study, may_share_career_goal_with_partner, may_be_recontacted_for_followup')
    .eq('candidate_id', candidateId)
    .order('given_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const prior = (latest ?? {}) as Record<string, boolean | null>;

  const { error } = await supabase.from('candidate_consent').insert({
    candidate_id: candidateId,
    may_be_named: !!prior.may_be_named,
    may_be_quoted: !!prior.may_be_quoted,
    may_appear_in_case_study: !!prior.may_appear_in_case_study,
    may_share_career_goal_with_partner: !!prior.may_share_career_goal_with_partner,
    may_be_recontacted_for_followup: !!prior.may_be_recontacted_for_followup,
    may_ai_analyse_transcript: consent,
    recorded_by: user.user?.id ?? null,
    notes: consent ? 'Audio recording consent granted.' : 'Audio recording consent withdrawn.',
  } as never);
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
    may_be_recontacted_for_followup?: boolean;
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
    may_be_recontacted_for_followup: !!flags.may_be_recontacted_for_followup,
    recorded_by: user.user?.id ?? null,
    notes: notes ?? null,
  } as never);
  revalidatePath(`/candidates/${candidateId}`);
}
