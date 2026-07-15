'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Shortlist a candidate for a specific workforce partner. This is the
 * explicit gate that controls what candidates a partner sees on their
 * portal — under Path B, cohort membership alone is no longer enough.
 *
 * If the candidate is already shortlisted for this partner (row exists,
 * withdrawn_at is null), the action is a no-op that returns success.
 */
export async function shortlistForPartnerAction(input: {
  partnerId: string;
  candidateId: string;
  notes?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  // Upsert: on unique (partner_id, candidate_id) collision, we un-withdraw
  // and update notes rather than erroring — supports re-shortlisting.
  const { error } = await supabase
    .from('partner_shortlist')
    .upsert(
      {
        partner_id: input.partnerId,
        candidate_id: input.candidateId,
        notes: input.notes ?? null,
        shortlisted_by: user.user?.id ?? null,
        withdrawn_at: null,
      } as never,
      { onConflict: 'partner_id,candidate_id' },
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/candidates/${input.candidateId}`);
  revalidatePath('/partner/interviews');
  return { ok: true };
}

/**
 * Withdraw a candidate from a partner's shortlist. Soft withdrawal —
 * the row remains for audit but stops the partner from seeing them.
 */
export async function withdrawFromShortlistAction(input: {
  partnerId: string;
  candidateId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('partner_shortlist')
    .update({ withdrawn_at: new Date().toISOString() } as never)
    .eq('partner_id', input.partnerId)
    .eq('candidate_id', input.candidateId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/candidates/${input.candidateId}`);
  revalidatePath('/partner/interviews');
  return { ok: true };
}
