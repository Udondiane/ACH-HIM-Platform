'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { assertCan, canManageDevFund } from '@/lib/auth/capabilities';

const VALID_DECISIONS = ['approved', 'declined', 'in_review'] as const;
type Decision = typeof VALID_DECISIONS[number];

export async function decideTrainingRequestAction(
  requestId: string,
  decision: Decision,
  notes: string,
) {
  // Financial decision — restricted to Finance & Contracts (or Programme Lead
  // per canManageDevFund). Enum-validated so the caller cannot inject an
  // arbitrary status.
  const user = await requireUser(['ach_staff']);
  assertCan(canManageDevFund, user);
  if (!VALID_DECISIONS.includes(decision)) {
    throw new Error('Invalid decision.');
  }

  const supabase = createClient();
  const patch: Record<string, unknown> = {
    state: decision,
    review_notes: notes || null,
  };
  if (decision === 'approved' || decision === 'declined') {
    patch.decided_at = new Date().toISOString();
  }
  await supabase.from('training_requests').update(patch as never).eq('id', requestId);
  revalidatePath('/development-fund');
}
