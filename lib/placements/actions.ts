'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { assertCan, canWriteBeneficiaries } from '@/lib/auth/capabilities';
import { placementSchema, type SalaryBand } from './schema';

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fdToPlain(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  if (obj.salary_actual === '') obj.salary_actual = undefined;
  if (!('sponsored_placement' in obj)) obj.sponsored_placement = false;
  return obj;
}

/* Memo §5 — milestone amounts by salary band. Denormalised onto the
 * placement_milestones row at creation time so historical accuracy is
 * preserved if the schedule ever changes. */
const MILESTONE_AMOUNTS: Record<SalaryBand, { placement: number; r6: number; r12: number }> = {
  volume:   { placement: 1500, r6: 1000, r12: 1000 },
  standard: { placement: 2500, r6: 1500, r12: 1500 },
  premium:  { placement: 4000, r6: 2000, r12: 2000 },
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createPlacementAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const user = await requireUser(['ach_staff']);
  assertCan(canWriteBeneficiaries, user);
  const parsed = placementSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;

  const supabase = createClient();

  const { data: placementRow, error: insertErr } = await supabase
    .from('placements')
    .insert({
      candidate_id:        input.candidate_id,
      partner_id:          input.partner_id,
      cohort_id:           (input.cohort_id && input.cohort_id !== '__none__') ? input.cohort_id : null,
      role_title:          input.role_title,
      salary_band:         input.salary_band,
      salary_actual:       input.salary_actual === '' ? null : input.salary_actual ?? null,
      start_date:          input.start_date,
      status:              input.status,
      sponsored_placement: input.sponsored_placement,
      notes:               input.notes || null,
    } as never)
    .select('id')
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };
  const placementId = (placementRow as { id: string }).id;

  // Auto-generate the three milestones per memo §5.
  const amounts = MILESTONE_AMOUNTS[input.salary_band];
  const milestoneRows = [
    { kind: 'placement',     amount: amounts.placement, due_on: input.start_date },
    { kind: 'retention_6mo', amount: amounts.r6,        due_on: addDays(input.start_date, 183) },
    { kind: 'retention_12mo',amount: amounts.r12,       due_on: addDays(input.start_date, 365) },
  ].map(m => ({ ...m, placement_id: placementId, state: 'pending' as const }));

  const { error: milestoneErr } = await supabase
    .from('placement_milestones')
    .insert(milestoneRows as never);
  if (milestoneErr) {
    // Don't roll back the placement — milestones can be added later.
    // Surface the message so staff know.
    return { ok: false, error: `Placement saved, but milestones failed: ${milestoneErr.message}` };
  }

  // Move candidate to 'placed' status so they appear in the right reports.
  await supabase.from('candidates').update({ status: 'placed' } as never).eq('id', input.candidate_id);

  revalidatePath(`/candidates/${input.candidate_id}`);
  revalidatePath('/dashboard');
  redirect(`/candidates/${input.candidate_id}`);
}
