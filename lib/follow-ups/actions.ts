'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createFeaturedQuoteAction } from '@/lib/featured-quotes/actions';

type ActionResult = { ok: true } | { ok: false; error: string };

const CONCERN_KEYWORDS = [
  'lost my job', 'lost the job', 'let go', 'made redundant', 'sacked',
  'struggling', 'struggle', 'not coping', 'depressed', 'anxious',
  'homeless', 'evicted', 'no money', 'no income',
  'unhappy', 'hate it', 'quit', 'leaving',
  'racist', 'discriminated', 'harassment', 'unsafe',
];

function classifyResponse(text: string): { flagged: boolean; reason: string | null } {
  const lower = text.toLowerCase();
  for (const kw of CONCERN_KEYWORDS) {
    if (lower.includes(kw)) {
      return { flagged: true, reason: `Response mentions "${kw}"` };
    }
  }
  return { flagged: false, reason: null };
}

/**
 * Record a follow-up response captured by ACH staff during a call or
 * WhatsApp exchange. Behind the scenes this also:
 *   1. Creates or upserts an assessment record at the correct timepoint
 *   2. Writes the response as candidate_voice on a placeholder response
 *   3. Auto-flags if the response contains concerning keywords
 *   4. Optionally creates a featured quote if marked feature-worthy
 *   5. If it's a 6mo/12mo check, upserts placement_retention_checks so
 *      the impact report populates without staff having to touch a
 *      second form
 */
export async function recordFollowUpResponseAction(input: {
  dispatch_id: string;
  channel: 'whatsapp' | 'phone_call' | 'sms' | 'email' | 'in_person';
  response_text: string;
  candidate_still_employed?: boolean | null;    // 6mo/12mo only
  progression_note?: string | null;             // 12mo only
  feature_worthy?: boolean;
  quote_context?: string | null;
  notes?: string | null;
}): Promise<ActionResult> {
  if (!input.response_text?.trim()) {
    return { ok: false, error: 'Response text is required.' };
  }
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  // Load the dispatch
  const { data: dispatch, error: dispatchErr } = await supabase
    .from('follow_up_dispatches')
    .select('id, candidate_id, cohort_id, placement_id, timepoint')
    .eq('id', input.dispatch_id)
    .maybeSingle();
  if (dispatchErr || !dispatch) {
    return { ok: false, error: dispatchErr?.message ?? 'Dispatch not found.' };
  }
  const d = dispatch as any;

  // 1. Upsert an assessment at the correct timepoint
  const { data: existingAssessment } = await supabase
    .from('assessments')
    .select('id, project_id')
    .eq('candidate_id', d.candidate_id)
    .eq('timepoint', d.timepoint)
    .maybeSingle();

  let assessmentId: string | null = (existingAssessment as any)?.id ?? null;
  if (!assessmentId) {
    const { data: created, error: aErr } = await supabase
      .from('assessments')
      .insert({
        candidate_id: d.candidate_id,
        cohort_id: d.cohort_id,
        timepoint: d.timepoint,
        status: 'completed',
        assessor_id: user.user?.id ?? null,
        notes: `Captured via follow-up dispatch (${input.channel}).`,
      } as never)
      .select('id')
      .single();
    if (aErr) return { ok: false, error: aErr.message };
    assessmentId = (created as { id: string }).id;
  } else {
    await supabase
      .from('assessments')
      .update({ status: 'completed', assessor_id: user.user?.id ?? null } as never)
      .eq('id', assessmentId);
  }

  // 2. Try to write the candidate voice against a placeholder indicator on
  //    this assessment so that any featured quote can point back to a formal
  //    assessment_responses row. Uses the reserved indicator id
  //    'followup_narrative'; if that indicator is not seeded, the insert
  //    fails the FK check — non-fatal, because the same response_text is
  //    persisted on the dispatch below (see step 4). We warn so operators
  //    know the link is not being made and can seed the indicator if wanted.
  const { data: responseRow, error: rErr } = await supabase
    .from('assessment_responses')
    .insert({
      assessment_id: assessmentId,
      indicator_id: 'followup_narrative',
      candidate_voice: input.response_text.trim(),
      narrative: input.notes?.trim() || null,
      feature_worthy: !!input.feature_worthy,
    } as never)
    .select('id')
    .maybeSingle();
  if (rErr) {
    console.warn('[follow-ups] assessment_responses insert skipped (non-fatal):', rErr.message);
  }
  const responseId: string | null = (responseRow as any)?.id ?? null;

  // 3. Classify for concerning content
  const classification = classifyResponse(input.response_text);

  // 4. Update the dispatch itself
  const dispatchUpdate = {
    channel: input.channel,
    status: (classification.flagged ? 'flagged' : 'responded') as 'flagged' | 'responded',
    responded_at: new Date().toISOString(),
    response_text: input.response_text.trim(),
    response_flagged: classification.flagged,
    flag_reason: classification.reason,
    assessment_id: assessmentId,
    handled_by: user.user?.id ?? null,
    attempts: undefined,   // placeholder; real increment below
    notes: input.notes?.trim() || null,
  };
  // Increment attempts by 1
  const { data: current } = await supabase
    .from('follow_up_dispatches')
    .select('attempts')
    .eq('id', input.dispatch_id)
    .maybeSingle();
  const currentAttempts = ((current as any)?.attempts as number) ?? 0;

  const { error: dErr } = await supabase
    .from('follow_up_dispatches')
    .update({
      ...dispatchUpdate,
      attempts: currentAttempts + 1,
    } as never)
    .eq('id', input.dispatch_id);
  if (dErr) return { ok: false, error: dErr.message };

  // 5. If this is a 6mo or 12mo retention check, upsert placement_retention_checks
  //    so the impact report populates without a second form.
  if (
    d.placement_id &&
    (d.timepoint === 'exit_6mo' || d.timepoint === 'followup_12mo') &&
    typeof input.candidate_still_employed === 'boolean'
  ) {
    const retentionTimepoint = d.timepoint === 'exit_6mo' ? 'retention_6mo' : 'retention_12mo';
    await supabase
      .from('placement_retention_checks')
      .upsert({
        placement_id: d.placement_id,
        timepoint: retentionTimepoint,
        still_employed: input.candidate_still_employed,
        progression_note: input.progression_note?.trim() || null,
        checked_by: user.user?.id ?? null,
        checked_at: new Date().toISOString(),
      } as never, { onConflict: 'placement_id,timepoint' });
  }

  // 6. If feature-worthy, materialise as a featured quote
  if (input.feature_worthy) {
    await createFeaturedQuoteAction({
      candidate_id: d.candidate_id,
      cohort_id: d.cohort_id ?? null,
      source_type:
        d.timepoint === 'followup_12mo' ? 'partner_retention'
        : d.timepoint === 'exit_6mo'    ? 'partner_retention'
        : 'assessment',
      source_ref: responseId ?? null,
      speaker_type: 'candidate',
      quote_text: input.response_text.trim(),
      context: input.quote_context?.trim() || `${d.timepoint.replace('_', ' ')} follow-up`,
    });
  }

  revalidatePath('/follow-ups');
  revalidatePath('/dashboard');
  revalidatePath(`/candidates/${d.candidate_id}`);
  if (d.cohort_id) revalidatePath(`/cohorts/${d.cohort_id}`);
  return { ok: true };
}

/**
 * Mark a dispatch as attempted but no response received. Increments the
 * attempts counter. After 3 attempts we surface it on the exceptions
 * dashboard for staff intervention.
 */
export async function markDispatchAttemptedAction(id: string, note?: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: current } = await supabase
    .from('follow_up_dispatches')
    .select('attempts, status')
    .eq('id', id)
    .maybeSingle();
  const currentAttempts = ((current as any)?.attempts as number) ?? 0;
  const nextAttempts = currentAttempts + 1;
  const status = nextAttempts >= 3 ? 'no_response' : 'sent';

  const { error } = await supabase
    .from('follow_up_dispatches')
    .update({
      attempts: nextAttempts,
      status,
      sent_at: new Date().toISOString(),
      notes: note?.trim() || null,
    } as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/follow-ups');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function closeDispatchAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from('follow_up_dispatches')
    .update({ status: 'closed' } as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/follow-ups');
  revalidatePath('/dashboard');
  return { ok: true };
}
