'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export type Result = { ok: true } | { ok: false; error: string };

// ============================================================
// PARTNER GROWTH OBSERVATIONS (3-month exit report)
// ============================================================

export async function savePartnerGrowthObservationAction(input: {
  placementId: string;
  timepoint: 'setup' | 'exit_3mo' | 'retention_6mo' | 'retention_12mo';
  languageGrowth?: string | null;
  peerNetworksGrowth?: string | null;
  selfEfficacyGrowth?: string | null;
  workplaceNormsGrowth?: string | null;
  taskPerformance?: string | null;
  whatStoodOut?: string | null;
  deiTargetContribution?: boolean | null;
  deiTargetNote?: string | null;
  recordedByPartnerRole?: string | null;
}): Promise<Result> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const payload = {
    placement_id: input.placementId,
    timepoint: input.timepoint,
    language_growth: input.languageGrowth ?? null,
    peer_networks_growth: input.peerNetworksGrowth ?? null,
    self_efficacy_growth: input.selfEfficacyGrowth ?? null,
    workplace_norms_growth: input.workplaceNormsGrowth ?? null,
    task_performance: input.taskPerformance ?? null,
    what_stood_out: input.whatStoodOut ?? null,
    dei_target_contribution: input.deiTargetContribution ?? null,
    dei_target_note: input.deiTargetNote ?? null,
    recorded_by: user.user?.id ?? null,
    recorded_by_partner_role: input.recordedByPartnerRole ?? null,
  };

  const { error } = await supabase
    .from('partner_growth_observations')
    .upsert(payload as never, { onConflict: 'placement_id,timepoint' });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/placements/${input.placementId}/timepoints`);
  return { ok: true };
}

// ============================================================
// PLACEMENT OFFERS (3-month exit decision)
// ============================================================

export async function savePlacementOfferAction(input: {
  placementId: string;
  offerType: 'permanent' | 'fixed_term_extension' | 'apprenticeship' | 'placement_ends' | 'none';
  offerReason?: string | null;
  offerDate?: string | null;
  candidateResponse?: 'accepted' | 'declined' | 'no_response' | 'not_applicable' | null;
  candidateResponseReasonCategory?: string | null;
  candidateResponseReasonText?: string | null;
  candidateResponseDate?: string | null;
}): Promise<Result> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const payload = {
    placement_id: input.placementId,
    offer_type: input.offerType,
    offer_reason: input.offerReason ?? null,
    offer_date: input.offerDate ?? null,
    candidate_response: input.candidateResponse ?? null,
    candidate_response_reason_category: input.candidateResponseReasonCategory ?? null,
    candidate_response_reason_text: input.candidateResponseReasonText ?? null,
    candidate_response_date: input.candidateResponseDate ?? null,
    recorded_by: user.user?.id ?? null,
  };

  const { error } = await supabase
    .from('placement_offers')
    .upsert(payload as never, { onConflict: 'placement_id' });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/placements/${input.placementId}/timepoints`);
  return { ok: true };
}

// ============================================================
// PLACEMENT RETENTION CHECKS (6mo and 12mo)
// ============================================================

export async function savePlacementRetentionCheckAction(input: {
  placementId: string;
  timepoint: 'retention_6mo' | 'retention_12mo';
  stillEmployed?: boolean | null;
  roleAtCheck?: string | null;
  leavingDate?: string | null;
  leavingReason?: string | null;
  progressionNote?: string | null;
}): Promise<Result> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const payload = {
    placement_id: input.placementId,
    timepoint: input.timepoint,
    still_employed: input.stillEmployed ?? null,
    role_at_check: input.roleAtCheck ?? null,
    leaving_date: input.leavingDate ?? null,
    leaving_reason: input.leavingReason ?? null,
    progression_note: input.progressionNote ?? null,
    checked_by: user.user?.id ?? null,
  };

  const { error } = await supabase
    .from('placement_retention_checks')
    .upsert(payload as never, { onConflict: 'placement_id,timepoint' });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/placements/${input.placementId}/timepoints`);
  return { ok: true };
}

// ============================================================
// PARTNER ACCESS TOKEN GENERATION
// ============================================================

export async function generatePartnerAccessTokenAction(input: {
  partnerId: string;
  projectId?: string | null;
  label?: string | null;
  expiresAt?: string | null;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 16);

  const { error } = await supabase
    .from('partner_access_tokens')
    .insert({
      partner_id: input.partnerId,
      project_id: input.projectId ?? null,
      token,
      label: input.label ?? null,
      expires_at: input.expiresAt ?? null,
      created_by: user.user?.id ?? null,
    } as never);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/partners/${input.partnerId}`);
  return { ok: true, token };
}

export async function revokePartnerAccessTokenAction(tokenId: string, partnerId: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from('partner_access_tokens')
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq('id', tokenId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/partners/${partnerId}`);
  return { ok: true };
}
