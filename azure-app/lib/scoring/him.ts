/**
 * HIM (Holistic Impact Metric) — main calculation.
 *
 * Per spec §8:
 *   Core Score    = mean of Core domain means / 5
 *   Optional Score = mean of Optional domain means / 5  (v1: simple_average)
 *                  = coverage-weighted variant         (v2)
 *   HIM           = α × Core + β × Optional
 *
 * With stability blending (v2):
 *   HIM_blended = (1 − stabilityBlend) × HIM + stabilityBlend × stabilityScore
 *
 * Hand-calc reference (load-bearing test):
 *   depth project · α=0.75 · β=0.25
 *   coreScore = 0.85 · optionalScore = 0.65
 *   HIM = 0.75 × 0.85 + 0.25 × 0.65 = 0.6375 + 0.1625 = 0.80
 */

import type {
  HimInputs, HimResult, DomainAggregate, ProjectCapability,
} from './types';
import { resolveWeights } from './weights';
import { aggregateDomain } from './aggregation';
import { coverageWeightedOptional } from './coverage';
import { calculateStability } from './stability';

export function calculateHim(inputs: HimInputs): HimResult {
  const optionalScheme = inputs.optionalScheme ?? 'simple_average';
  const stabilityBlend = clamp01(inputs.stabilityBlend ?? 0);

  // 1) Aggregate every selected capability into a domain mean.
  const domainBreakdown: DomainAggregate[] = inputs.capabilities.map((c: ProjectCapability) =>
    aggregateDomain(c.domain, c.role, inputs.responses, c.selectedFactors),
  );

  // Optionally fold in inclusion-assessment-derived environmental scores (V2 §12.2).
  // We treat the inclusion env score as an extra "environmental factor" applied
  // to the domain mean as a 30/70 blend toward the inclusion view, only for
  // domains where inclusionEnvScores supplies a value AND a placement exists.
  // (Application-layer caller decides eligibility; here we just apply the blend
  // if the score is present.)
  if (inputs.inclusionEnvScores) {
    for (const agg of domainBreakdown) {
      const envScore = inputs.inclusionEnvScores[agg.domain];
      if (typeof envScore === 'number') {
        agg.domainMean = 0.7 * agg.domainMean + 0.3 * envScore;
      }
    }
  }

  // 2) Split Core / Optional and compute scores.
  const coreAggs    = domainBreakdown.filter(a => a.role === 'core');
  const optionalAggs= domainBreakdown.filter(a => a.role === 'optional');

  const coreMeans   = coreAggs.map(a => a.domainMean);
  const optionalMeans = optionalAggs.map(a => a.domainMean);

  // Core: simple mean / 5 (spec §8.2).
  const coreScore = coreAggs.length === 0
    ? 0
    : (coreMeans.reduce((s, m) => s + m, 0) / coreMeans.length) / 5;

  // Optional: v1 simple, v2 coverage-weighted.
  let optionalScore: number;
  if (optionalAggs.length === 0) {
    optionalScore = 0;
  } else if (optionalScheme === 'coverage_weighted') {
    optionalScore = coverageWeightedOptional(optionalAggs);
  } else {
    optionalScore = (optionalMeans.reduce((s, m) => s + m, 0) / optionalMeans.length) / 5;
  }

  // 3) Resolve weights (α/β).
  const weights = resolveWeights({
    projectType: inputs.projectType,
    weightRatio: inputs.weightRatio,
    hybridOption: inputs.hybridOption,
  });

  // 4) Combine.
  let him = weights.alpha * coreScore + weights.beta * optionalScore;
  him = clamp01(him);

  // 5) Stability blending (v2, opt-in).
  let stabilityScore: number | undefined;
  if (stabilityBlend > 0 && inputs.trajectory && inputs.trajectory.length >= 2) {
    stabilityScore = calculateStability(inputs.trajectory, inputs.capabilities);
    him = (1 - stabilityBlend) * him + stabilityBlend * stabilityScore;
    him = clamp01(him);
  }

  const trace = {
    coreDomains:     coreAggs.map(a => a.domain),
    optionalDomains: optionalAggs.map(a => a.domain),
    coreMeans,
    optionalMeans,
    optionalScheme,
    notes: [
      `α=${weights.alpha.toFixed(2)}, β=${weights.beta.toFixed(2)}`,
      `coreScore=${coreScore.toFixed(4)}, optionalScore=${optionalScore.toFixed(4)}`,
      stabilityScore !== undefined ? `stability=${stabilityScore.toFixed(4)}, blend=${stabilityBlend}` : '',
    ].filter(Boolean),
  };

  return {
    projectType: inputs.projectType,
    weightRatio: inputs.weightRatio,
    alpha: weights.alpha,
    beta:  weights.beta,
    coreScore,
    optionalScore,
    him,
    stabilityScore,
    domainBreakdown,
    trace,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
