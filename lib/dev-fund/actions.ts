'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function decideTrainingRequestAction(
  requestId: string,
  decision: 'approved' | 'declined' | 'in_review',
  notes: string,
) {
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
