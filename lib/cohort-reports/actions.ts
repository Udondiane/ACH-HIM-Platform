'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { assertCan, canWriteBeneficiaries } from '@/lib/auth/capabilities';

export type CohortReportType = 'close_out' | 'impact_12mo';

export async function generateCohortReportAction(input: {
  cohort_id: string;
  report_type: CohortReportType;
  snapshot: Record<string, unknown>;
  notes?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const sessionUser = await requireUser(['ach_staff']);
  assertCan(canWriteBeneficiaries, sessionUser);
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const { data, error } = await supabase.from('cohort_reports').insert({
    cohort_id:   input.cohort_id,
    report_type: input.report_type,
    status:      'draft',
    methodology_version: 'v1.0',
    snapshot:    input.snapshot,
    generated_by: user.user?.id ?? null,
    notes:        input.notes ?? null,
  } as never).select('id').single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/cohorts/${input.cohort_id}`);
  revalidatePath(`/cohorts/${input.cohort_id}/close-out`);
  revalidatePath(`/cohorts/${input.cohort_id}/impact-12mo`);
  return { ok: true, id: (data as { id: string }).id };
}

export async function issueCohortReportAction(id: string, cohort_id: string) {
  const sessionUser = await requireUser(['ach_staff']);
  assertCan(canWriteBeneficiaries, sessionUser);
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('cohort_reports')
    .update({
      status: 'issued',
      issued_at: new Date().toISOString(),
      issued_by: user.user?.id ?? null,
    } as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cohorts/${cohort_id}`);
  revalidatePath(`/cohorts/${cohort_id}/close-out`);
  revalidatePath(`/cohorts/${cohort_id}/impact-12mo`);
  return { ok: true };
}
