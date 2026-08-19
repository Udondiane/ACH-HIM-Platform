'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { assertCan, canManageBids } from '@/lib/auth/capabilities';

export async function saveCohortTomsClaimAction(
  cohortId: string,
  tomsCode: string,
  quantity: number,
  notes: string | null,
) {
  const user = await requireUser(['ach_staff']);
  assertCan(canManageBids, user);
  const supabase = createClient();
  if (quantity <= 0) {
    await supabase.from('cohort_toms_claims').delete().eq('cohort_id', cohortId).eq('toms_code', tomsCode);
  } else {
    await supabase.from('cohort_toms_claims').upsert(
      { cohort_id: cohortId, toms_code: tomsCode, quantity, notes } as never,
      { onConflict: 'cohort_id,toms_code' },
    );
  }
  revalidatePath(`/cohorts/${cohortId}`);
}
