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
  if (obj.arrival_year === '') obj.arrival_year = undefined;
  // Unchecked checkboxes are absent from FormData entirely.
  if (!('is_ach_tenant' in obj)) obj.is_ach_tenant = false;
  return obj;
}

function normalisePayload(input: ReturnType<typeof candidateSchema.parse>, ref: string) {
  return {
    candidate_ref: ref,
    given_name: input.given_name,
    family_name: input.family_name || null,
    preferred_locale: input.preferred_locale,
    country_of_origin: input.country_of_origin || null,
    arrival_year: input.arrival_year === '' ? null : input.arrival_year ?? null,
    english_level: input.english_level || null,
    status: input.status,
    career_goal_summary: input.career_goal_summary || null,
    development_plan: input.development_plan || null,
    notes: input.notes || null,
    is_ach_tenant: input.is_ach_tenant,
    exit_reason: input.exit_reason || null,
    exit_date: input.exit_date || null,
    exit_notes: input.exit_notes || null,
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

export async function recordConsentAction(
  candidateId: string,
  flags: {
    may_be_named?: boolean;
    may_be_quoted?: boolean;
    may_appear_in_case_study?: boolean;
    may_share_career_goal_with_partner?: boolean;
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
    may_share_career_goal_with_partner: !!flags.may_share_career_goal_with_partner,
    recorded_by: user.user?.id ?? null,
    notes: notes ?? null,
  } as never);
  revalidatePath(`/candidates/${candidateId}`);
}
