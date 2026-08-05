/**
 * Discrimination Ratio — V2 (spec §6).
 *
 *   DR = V_between / V_within
 *
 * where V_between is the variance of group means and V_within is the
 * mean within-group variance, computed across project-type cohorts
 * (depth vs hybrid vs breadth) on the same outcome metric.
 *
 * Gating: n ≥ 10 per project type, otherwise return 'insufficient_data'.
 *
 * Interpretation thresholds (spec §6.3):
 *   DR > 2.0   → good discrimination
 *   1.0 ≤ DR ≤ 2.0 → moderate discrimination
 *   DR < 1.0   → poor discrimination
 */

export type DiscriminationResult =
  | { status: 'insufficient_data'; reason: string; perTypeN: Record<string, number> }
  | {
      status: 'computed';
      dr: number;
      verdict: 'good' | 'moderate' | 'poor';
      vBetween: number;
      vWithin: number;
      perTypeN: Record<string, number>;
      groupMeans: Record<string, number>;
    };

export type DiscriminationInput = {
  // map from project-type label → array of HIM (or any 0–1) outcomes
  groups: Record<string, number[]>;
  minN?: number;  // default 10
};

export function discrimination({ groups, minN = 10 }: DiscriminationInput): DiscriminationResult {
  const perTypeN: Record<string, number> = {};
  for (const k of Object.keys(groups)) perTypeN[k] = groups[k].length;

  // Gating: every named group must have at least minN observations.
  for (const k of Object.keys(groups)) {
    if (groups[k].length < minN) {
      return {
        status: 'insufficient_data',
        reason: `Group "${k}" has n=${groups[k].length}; need ≥${minN}.`,
        perTypeN,
      };
    }
  }

  // Per-group means and variances.
  const groupMeans: Record<string, number> = {};
  const groupVars:  number[] = [];
  for (const k of Object.keys(groups)) {
    const xs = groups[k];
    const m = mean(xs);
    groupMeans[k] = m;
    groupVars.push(variance(xs, m));
  }

  // V_within: mean of within-group variances.
  const vWithin = mean(groupVars);

  // V_between: variance of group means.
  const overallMean = mean(Object.values(groupMeans));
  const meansArr = Object.values(groupMeans);
  const vBetween =
    meansArr.length === 0
      ? 0
      : meansArr.reduce((s, m) => s + (m - overallMean) ** 2, 0) / meansArr.length;

  if (vWithin === 0) {
    // Degenerate; very high discrimination by definition.
    return {
      status: 'computed',
      dr: Number.POSITIVE_INFINITY,
      verdict: 'good',
      vBetween,
      vWithin,
      perTypeN,
      groupMeans,
    };
  }

  const dr = vBetween / vWithin;
  const verdict: 'good' | 'moderate' | 'poor' =
    dr > 2 ? 'good' : dr >= 1 ? 'moderate' : 'poor';

  return { status: 'computed', dr, verdict, vBetween, vWithin, perTypeN, groupMeans };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function variance(xs: number[], m?: number): number {
  if (xs.length === 0) return 0;
  const mu = m ?? mean(xs);
  return xs.reduce((s, x) => s + (x - mu) ** 2, 0) / xs.length;
}
