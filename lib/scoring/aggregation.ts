/**
 * Aggregation — spec §7.2, §7.3, §7.4, §8.2.
 *
 *   Indicator scores 0–5.
 *   Mixed-method normalisation:
 *     - likert_1_5  → numericValue passes through (already 0–5).
 *     - likert_1_10 → numericValue / 2 (scale down to 0–5).
 *     - yes_no      → yes=5, no=0 (encoded at storage time but we re-check).
 *     - count       → not normalised here; treat the storage value as 0–5
 *                     (the assessment UI clamps counts to a 0–5 scale).
 *     - checklist   → fraction of items present × 5.
 *     - narrative   → NOT scored numerically; preserved as text only.
 *
 *   Aggregation order (spec §7.3):
 *     1. indicators average within a factor
 *     2. factors average within a conversion-factor-type within a domain
 *     3. conversion-factor-types average within a domain → domain mean
 *
 *   Universal-factor deduplication (spec §7.4):
 *     A universal factor is assessed once per (candidate, timepoint).
 *     Its indicator responses propagate to every domain where the factor applies.
 *     The aggregation walker simply uses domainIds[] on each response — the
 *     storage layer has already deduplicated.
 */

import type {
  DomainId, IndicatorResponse, ProjectCapability, DomainAggregate, CapabilityRole,
} from './types';

const CHECKLIST_MAX = 5;

/**
 * Convert a raw indicator response to a 0–5 score, or null if narrative-only.
 */
export function normaliseIndicator(r: IndicatorResponse): number | null {
  if (r.measurementMethod === 'narrative') return null;
  if (r.numericValue === null || Number.isNaN(r.numericValue)) {
    // Checklist: derive from checked items.
    if (r.measurementMethod === 'checklist' && r.checklistItems) {
      const total = r.checklistItems.length;
      if (total === 0) return 0;
      // The schema doesn't store the total possible — caller is expected to
      // have set numericValue from the storage layer. If null reaches here,
      // we treat the items as fraction of CHECKLIST_MAX items.
      return Math.min(CHECKLIST_MAX, total);
    }
    return null;
  }
  switch (r.measurementMethod) {
    case 'likert_1_5':  return clamp05(r.numericValue);
    case 'likert_1_10': return clamp05(r.numericValue / 2);
    case 'yes_no':      return clamp05(r.numericValue);   // yes=5 / no=0 by convention
    case 'count':       return clamp05(r.numericValue);
    case 'checklist':   return clamp05(r.numericValue);
  }
}

function clamp05(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 5) return 5;
  return n;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/**
 * Aggregate raw responses for one domain into a 0–5 domain mean,
 * preserving the per-factor breakdown for UI tooltips.
 */
export function aggregateDomain(
  domain: DomainId,
  role: CapabilityRole,
  responses: IndicatorResponse[],
  selectedFactorIds: string[] = [],   // empty array = use all factors
): DomainAggregate {
  const domainResponses = responses.filter(r => r.domainIds.includes(domain));

  // Group by factor
  const byFactor = new Map<string, IndicatorResponse[]>();
  for (const r of domainResponses) {
    if (selectedFactorIds.length > 0 && !selectedFactorIds.includes(r.factorId)) continue;
    if (!byFactor.has(r.factorId)) byFactor.set(r.factorId, []);
    byFactor.get(r.factorId)!.push(r);
  }

  // For each factor: mean of its indicators (numerics only).
  const factors: DomainAggregate['factors'] = [];
  for (const [factorId, indicators] of byFactor) {
    const indicatorOut = indicators.map(i => {
      const v = normaliseIndicator(i);
      return {
        indicatorId: i.indicatorId,
        value: v ?? 0,
        isNarrativeOnly: v === null,
      };
    });
    const numericVals = indicatorOut.filter(x => !x.isNarrativeOnly).map(x => x.value);
    const factorMean = mean(numericVals);
    factors.push({
      factorId,
      factorMean,
      factorType: indicators[0].conversionFactorType,
      indicators: indicatorOut,
    });
  }

  // Group factors by conversion-factor-type → mean within type → mean of types = domain mean.
  // (Spec §7.3 explicitly does this two-step rollup so domains with thin coverage
  // in one factor type aren't skewed by another type's heavier weighting.)
  const byType = new Map<string, number[]>();
  for (const f of factors) {
    if (!byType.has(f.factorType)) byType.set(f.factorType, []);
    byType.get(f.factorType)!.push(f.factorMean);
  }
  const typeMeans: number[] = [];
  for (const [, fmeans] of byType) typeMeans.push(mean(fmeans));
  const domainMean = mean(typeMeans);

  return { domain, role, domainMean, factors };
}

/**
 * Roll up all selected capabilities for a project.
 * Excludes capabilities not present in the project's selection.
 */
export function aggregateProject(
  capabilities: ProjectCapability[],
  responses: IndicatorResponse[],
): DomainAggregate[] {
  return capabilities.map(c =>
    aggregateDomain(c.domain, c.role, responses, c.selectedFactors),
  );
}
