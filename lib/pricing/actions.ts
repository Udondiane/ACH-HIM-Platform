'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { quoteSchema } from './schema';
import { calculateQuote, type PricingParameters } from './calculator';

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fdToPlain(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  if (obj.partner_id === '') obj.partner_id = null;
  if (obj.cohort_id === '') obj.cohort_id = null;
  if (obj.valid_until === '') obj.valid_until = null;
  return obj;
}

async function loadParams(): Promise<PricingParameters> {
  const supabase = createClient();
  const { data } = await supabase
    .from('pricing_parameters')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  return (data as PricingParameters | null) ?? {
    cost_per_candidate: 1670,
    sustainability_margin: 500,
    sponsorship_price: 2170,
    placement_volume: 750,
    placement_standard: 1500,
    placement_premium: 2500,
    retention_6mo_volume: 225,
    retention_12mo_volume: 300,
    retention_6mo_standard: 250,
    retention_12mo_standard: 325,
    retention_6mo_premium: 300,
    retention_12mo_premium: 375,
    volume_discount_threshold_1: 5,
    volume_discount_rate_1: 0.10,
    volume_discount_threshold_2: 10,
    volume_discount_rate_2: 0.20,
    direct_hirer_sv_fee: 1000,
    cost_recovery_margin_pct: 0.10,
    sustainability_margin_pct: 0.30,
  };
}

async function nextQuoteRef(): Promise<string> {
  const supabase = createClient();
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('pricing_quotes')
    .select('id', { count: 'exact', head: true });
  return `QT-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`;
}

export async function createQuoteAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = quoteSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const params = await loadParams();
  const result = calculateQuote(parsed.data, params);
  const supabase = createClient();

  const quoteRef = await nextQuoteRef();
  const insertPayload = {
    quote_ref: quoteRef,
    partner_id: parsed.data.partner_id || null,
    cohort_id: parsed.data.cohort_id || null,
    track: parsed.data.track,
    candidate_count: parsed.data.candidate_count,
    expected_hires_volume: parsed.data.expected_hires_volume,
    expected_hires_standard: parsed.data.expected_hires_standard,
    expected_hires_premium: parsed.data.expected_hires_premium,
    retention_6mo_rate: parsed.data.retention_6mo_rate,
    retention_12mo_rate: parsed.data.retention_12mo_rate,
    tender_pack_fee: parsed.data.tender_pack_fee,
    valid_until: parsed.data.valid_until || null,
    notes: parsed.data.notes || null,
    delivery_cost_internal: result.delivery_cost_internal,
    cost_recovery_floor: result.cost_recovery_floor,
    sustainability_floor: result.sustainability_floor,
    suggested_price: result.subtotal,
    margin_amount: result.margin_amount,
    margin_pct: result.margin_pct,
    traffic_light: result.traffic_light,
    status: 'draft',
  };

  const { data, error } = await supabase
    .from('pricing_quotes')
    .insert(insertPayload as never)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  const row = data as { id: string };

  // Insert line items
  const linePayload = result.lines.map((l, i) => ({
    quote_id: row.id,
    sort_order: i,
    kind: l.kind,
    band: l.band ?? null,
    quantity: l.quantity,
    unit_amount: l.unit_amount,
    line_total: l.line_total,
    label: l.label,
  }));
  if (linePayload.length > 0) {
    await supabase.from('pricing_quote_lines').insert(linePayload as never);
  }

  revalidatePath('/pricing');
  redirect(`/pricing/${row.id}`);
}

export async function setQuoteStatusAction(id: string, status: string) {
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'sent') patch.sent_at = new Date().toISOString();
  if (status === 'accepted') patch.accepted_at = new Date().toISOString();
  await supabase.from('pricing_quotes').update(patch as never).eq('id', id);
  revalidatePath('/pricing');
  revalidatePath(`/pricing/${id}`);
}
