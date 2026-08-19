'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { assertCan, canManageImpactLibrary } from '@/lib/auth/capabilities';

export type QuoteSource = 'assessment' | 'partner_exit' | 'partner_retention' | 'interview' | 'other';
export type QuoteSpeaker = 'candidate' | 'assessor' | 'partner' | 'other';

/**
 * Turn a piece of text into a featured quote. Consent-aware: if the candidate
 * has not granted may_be_named consent, use_anonymised defaults to true and
 * display_name is nulled regardless of what the caller sent.
 */
export async function createFeaturedQuoteAction(input: {
  candidate_id: string;
  cohort_id?: string | null;
  source_type: QuoteSource;
  source_ref?: string | null;
  speaker_type: QuoteSpeaker;
  quote_text: string;
  context?: string | null;
  display_name?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const sessionUser = await requireUser(['ach_staff']);
  assertCan(canManageImpactLibrary, sessionUser);

  const text = input.quote_text?.trim();
  if (!text) return { ok: false, error: 'Quote text is required.' };

  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  // Consent gate: check the candidate's latest consent record.
  const { data: latestConsent } = await supabase
    .from('candidate_consent')
    .select('may_be_named, may_be_quoted')
    .eq('candidate_id', input.candidate_id)
    .order('given_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const consent = (latestConsent ?? {}) as { may_be_named?: boolean; may_be_quoted?: boolean };

  if (!consent.may_be_quoted && !consent.may_be_named) {
    return {
      ok: false,
      error: 'This candidate has not granted quoting consent. Record consent before featuring a quote.',
    };
  }

  // If by-name consent is not granted, force anonymised and drop display_name.
  const use_anonymised = !consent.may_be_named;
  const display_name = consent.may_be_named ? (input.display_name?.trim() || null) : null;

  const { data, error } = await supabase.from('featured_quotes').insert({
    candidate_id: input.candidate_id,
    cohort_id: input.cohort_id ?? null,
    source_type: input.source_type,
    source_ref: input.source_ref ?? null,
    speaker_type: input.speaker_type,
    quote_text: text,
    context: input.context?.trim() || null,
    use_anonymised,
    display_name,
    tagged_by: user.user?.id ?? null,
  } as never).select('id').single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/candidates/${input.candidate_id}`);
  if (input.cohort_id) revalidatePath(`/cohorts/${input.cohort_id}`);
  revalidatePath('/reports/featured-quotes');

  return { ok: true, id: (data as { id: string }).id };
}

export async function archiveFeaturedQuoteAction(
  id: string,
  reason?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser(['ach_staff']);
  assertCan(canManageImpactLibrary, user);
  const supabase = createClient();
  const { error } = await supabase
    .from('featured_quotes')
    .update({
      archived_at: new Date().toISOString(),
      archived_reason: reason?.trim() || null,
    } as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/reports/featured-quotes');
  return { ok: true };
}

export async function markResponseFeatureWorthyAction(input: {
  response_id: string;
  candidate_id: string;
  feature_worthy: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser(['ach_staff']);
  assertCan(canManageImpactLibrary, user);
  const supabase = createClient();
  const { error } = await supabase
    .from('assessment_responses')
    .update({ feature_worthy: input.feature_worthy } as never)
    .eq('id', input.response_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/candidates/${input.candidate_id}`);
  return { ok: true };
}

export async function setCandidateVoiceAction(input: {
  response_id: string;
  candidate_id: string;
  candidate_voice: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser(['ach_staff']);
  assertCan(canManageImpactLibrary, user);
  const supabase = createClient();
  const { error } = await supabase
    .from('assessment_responses')
    .update({ candidate_voice: input.candidate_voice.trim() || null } as never)
    .eq('id', input.response_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/candidates/${input.candidate_id}`);
  return { ok: true };
}
