'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { assertCan, canWriteBeneficiaries } from '@/lib/auth/capabilities';

/** Tick or untick an outcome for a beneficiary on a project. */
export async function setBeneficiaryOutcomeAction(
  projectId: string,
  candidateId: string,
  outcomeKey: string,
  outcomeLabel: string,
  ticked: boolean,
  notes?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sessionUser = await requireUser(['ach_staff']);
  assertCan(canWriteBeneficiaries, sessionUser);
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!ticked) {
    // Untick: delete the row (or the 'other' rows for that project+candidate,
    // which the unique index doesn't collapse).
    const q = supabase
      .from('beneficiary_outcomes')
      .delete()
      .eq('project_id', projectId)
      .eq('candidate_id', candidateId)
      .eq('outcome_key', outcomeKey);
    const { error } = await q;
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/outcomes-report`);
    return { ok: true };
  }

  // Tick: upsert. For non-'other' outcomes the unique index prevents dupes;
  // for 'other' we allow multiple rows so each unexpected outcome can be
  // recorded separately.
  const row = {
    project_id: projectId,
    candidate_id: candidateId,
    outcome_key: outcomeKey,
    outcome_label: outcomeLabel,
    notes: notes ?? null,
    recorded_by: user.user?.id ?? null,
  };
  if (outcomeKey === 'other') {
    const { error } = await supabase.from('beneficiary_outcomes').insert(row as never);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from('beneficiary_outcomes')
      .upsert(row as never, { onConflict: 'project_id,candidate_id,outcome_key' });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/outcomes-report`);
  return { ok: true };
}
