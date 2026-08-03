// Memo §3–5 pricing calculator. Pure function — no I/O.
// Given inputs + current pricing_parameters, returns the itemised
// breakdown plus traffic-light flag against the cost-recovery /
// sustainability floors.

export type Band = 'volume' | 'standard' | 'premium';
export type TrafficLight = 'green' | 'amber' | 'red';

export type PricingParameters = {
  cost_per_candidate: number;
  sustainability_margin: number;
  sponsorship_price: number;
  placement_volume: number;
  placement_standard: number;
  placement_premium: number;
  retention_6mo_volume: number;
  retention_12mo_volume: number;
  retention_6mo_standard: number;
  retention_12mo_standard: number;
  retention_6mo_premium: number;
  retention_12mo_premium: number;
  volume_discount_threshold_1: number;
  volume_discount_rate_1: number;
  volume_discount_threshold_2: number;
  volume_discount_rate_2: number;
  direct_hirer_sv_fee: number;
  cost_recovery_margin_pct: number;
  sustainability_margin_pct: number;
};

export type QuoteInputs = {
  track: 'capability_investor' | 'workforce_partner' | 'training_partner' | 'direct_hirer';
  candidate_count: number;
  expected_hires_volume: number;
  expected_hires_standard: number;
  expected_hires_premium: number;
  retention_6mo_rate: number;
  retention_12mo_rate: number;
  tender_pack_fee: number;
};

export type LineItem = {
  kind:
    | 'sponsorship'
    | 'placement'
    | 'retention_6mo'
    | 'retention_12mo'
    | 'tender_pack'
    | 'direct_hire_sv'
    | 'discount';
  band?: Band;
  quantity: number;
  unit_amount: number;
  line_total: number;
  label: string;
};

export type QuoteResult = {
  lines: LineItem[];
  subtotal: number;
  total_hires: number;
  delivery_cost_internal: number;
  cost_recovery_floor: number;
  sustainability_floor: number;
  margin_amount: number;
  margin_pct: number;
  traffic_light: TrafficLight;
};

function placementFee(band: Band, p: PricingParameters): number {
  if (band === 'volume') return p.placement_volume;
  if (band === 'standard') return p.placement_standard;
  return p.placement_premium;
}
function retention6Fee(band: Band, p: PricingParameters): number {
  if (band === 'volume') return p.retention_6mo_volume;
  if (band === 'standard') return p.retention_6mo_standard;
  return p.retention_6mo_premium;
}
function retention12Fee(band: Band, p: PricingParameters): number {
  if (band === 'volume') return p.retention_12mo_volume;
  if (band === 'standard') return p.retention_12mo_standard;
  return p.retention_12mo_premium;
}

function bandLabel(b: Band): string {
  if (b === 'volume') return 'Volume £20–23k';
  if (b === 'standard') return 'Standard £23–28k';
  return 'Premium £28k+';
}

export function calculateQuote(
  inputs: QuoteInputs,
  p: PricingParameters,
): QuoteResult {
  const lines: LineItem[] = [];

  // Sponsorship floor (every track that uses sponsorship)
  if (
    inputs.candidate_count > 0 &&
    (inputs.track === 'capability_investor' || inputs.track === 'workforce_partner')
  ) {
    lines.push({
      kind: 'sponsorship',
      quantity: inputs.candidate_count,
      unit_amount: p.sponsorship_price,
      line_total: inputs.candidate_count * p.sponsorship_price,
      label: `Sponsorship × ${inputs.candidate_count} candidates`,
    });
  }

  // Workforce Partner: placement + retention by band
  const bands: { band: Band; n: number }[] = [
    { band: 'volume', n: inputs.expected_hires_volume },
    { band: 'standard', n: inputs.expected_hires_standard },
    { band: 'premium', n: inputs.expected_hires_premium },
  ];

  const total_hires = bands.reduce((s, b) => s + b.n, 0);

  if (inputs.track === 'workforce_partner' || inputs.track === 'direct_hirer') {
    // Placement fees per band
    for (const { band, n } of bands) {
      if (n <= 0) continue;
      const fee = placementFee(band, p);
      lines.push({
        kind: 'placement',
        band,
        quantity: n,
        unit_amount: fee,
        line_total: n * fee,
        label: `Placement fee — ${bandLabel(band)}`,
      });
    }

    // Volume discount (placement only, by total hires)
    let discountRate = 0;
    if (total_hires >= p.volume_discount_threshold_2) {
      discountRate = p.volume_discount_rate_2;
    } else if (total_hires >= p.volume_discount_threshold_1) {
      discountRate = p.volume_discount_rate_1;
    }
    if (discountRate > 0) {
      const placementSubtotal = lines
        .filter(l => l.kind === 'placement')
        .reduce((s, l) => s + l.line_total, 0);
      const discount = placementSubtotal * discountRate;
      lines.push({
        kind: 'discount',
        quantity: 1,
        unit_amount: -discount,
        line_total: -discount,
        label: `Volume discount (${Math.round(discountRate * 100)}% on placement, ${total_hires} hires)`,
      });
    }

    // Retention 6-month fees
    for (const { band, n } of bands) {
      if (n <= 0) continue;
      const expectedRetained = Math.round(n * inputs.retention_6mo_rate);
      if (expectedRetained <= 0) continue;
      const fee = retention6Fee(band, p);
      lines.push({
        kind: 'retention_6mo',
        band,
        quantity: expectedRetained,
        unit_amount: fee,
        line_total: expectedRetained * fee,
        label: `Retention 6mo — ${bandLabel(band)} (expected ${Math.round(inputs.retention_6mo_rate * 100)}%)`,
      });
    }

    // Retention 12-month fees
    for (const { band, n } of bands) {
      if (n <= 0) continue;
      const expectedRetained = Math.round(n * inputs.retention_12mo_rate);
      if (expectedRetained <= 0) continue;
      const fee = retention12Fee(band, p);
      lines.push({
        kind: 'retention_12mo',
        band,
        quantity: expectedRetained,
        unit_amount: fee,
        line_total: expectedRetained * fee,
        label: `Retention 12mo — ${bandLabel(band)} (expected ${Math.round(inputs.retention_12mo_rate * 100)}%)`,
      });
    }
  }

  // Direct hirer social-value fee
  if (inputs.track === 'direct_hirer' && total_hires > 0) {
    lines.push({
      kind: 'direct_hire_sv',
      quantity: total_hires,
      unit_amount: p.direct_hirer_sv_fee,
      line_total: total_hires * p.direct_hirer_sv_fee,
      label: `Social-value fee × ${total_hires} direct hires`,
    });
  }

  // Tender Support Pack add-on
  if (inputs.tender_pack_fee > 0) {
    lines.push({
      kind: 'tender_pack',
      quantity: 1,
      unit_amount: inputs.tender_pack_fee,
      line_total: inputs.tender_pack_fee,
      label: 'Tender Support Pack',
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);

  // Internal delivery cost: candidate-driven only (sponsorship side).
  const delivery_cost_internal = inputs.candidate_count * p.cost_per_candidate;
  const cost_recovery_floor =
    delivery_cost_internal * (1 + p.cost_recovery_margin_pct);
  const sustainability_floor =
    delivery_cost_internal * (1 + p.sustainability_margin_pct);

  const margin_amount = subtotal - delivery_cost_internal;
  const margin_pct =
    delivery_cost_internal > 0
      ? (margin_amount / delivery_cost_internal) * 100
      : 0;

  let traffic_light: TrafficLight = 'green';
  if (delivery_cost_internal > 0) {
    if (subtotal < cost_recovery_floor) traffic_light = 'red';
    else if (subtotal < sustainability_floor) traffic_light = 'amber';
    else traffic_light = 'green';
  }

  return {
    lines,
    subtotal,
    total_hires,
    delivery_cost_internal,
    cost_recovery_floor,
    sustainability_floor,
    margin_amount,
    margin_pct,
    traffic_light,
  };
}
