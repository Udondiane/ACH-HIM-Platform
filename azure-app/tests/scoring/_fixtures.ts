/**
 * Test fixtures for scoring tests.
 *
 * The HIM hand-calc reference (HIM = 0.80):
 *   depth project, α=0.75, β=0.25
 *   Core domains: Employment, Education          → mean / 5 = 0.85
 *   Optional domains: Belonging, Social, Health  → mean / 5 = 0.65
 *
 *   HIM = 0.75 × 0.85 + 0.25 × 0.65 = 0.6375 + 0.1625 = 0.80
 *
 * To get coreScore=0.85 from a /5 mean, the domain means must average 4.25/5.
 * We construct responses whose normalised indicator values produce that.
 */

import type {
  IndicatorResponse, ProjectCapability, AssessmentSnapshot, AssessmentTimepoint,
} from '@/lib/scoring/types';

/** Build a single likert_1_5 indicator response. */
export function r(
  indicatorId: string,
  factorId: string,
  domainIds: ('employment'|'housing'|'education'|'health'|'belonging'|'social'|'rights')[],
  value: number,
  opts?: {
    factorType?: 'personal'|'social'|'environmental';
    isUniversal?: boolean;
    method?: IndicatorResponse['measurementMethod'];
  },
): IndicatorResponse {
  return {
    indicatorId,
    factorId,
    domainIds,
    conversionFactorType: opts?.factorType ?? 'personal',
    isUniversal: opts?.isUniversal ?? false,
    measurementMethod: opts?.method ?? 'likert_1_5',
    numericValue: value,
    narrative: null,
  };
}

/**
 * Build a set of responses whose Core domain means produce coreMean=4.25 / 5 = 0.85,
 * and Optional domain means produce optionalMean=3.25 / 5 = 0.65.
 *
 * Implementation: every Core indicator scores 4.25; every Optional 3.25.
 * Mean of means → exactly 4.25 (Core) and 3.25 (Optional).
 *
 * To satisfy the two-step rollup (factor → factor-type → domain), we keep
 * a single factor and single factor-type per domain in this fixture, so the
 * two-step rollup degenerates to a simple mean and matches the hand-calc.
 */
export function handCalcResponses(): IndicatorResponse[] {
  const out: IndicatorResponse[] = [];
  // Core: Employment + Education
  out.push(r('emp.r1', 'work_readiness', ['employment'], 4.25));
  out.push(r('emp.r2', 'work_readiness', ['employment'], 4.25));
  out.push(r('edu.r1', 'learning_disposition', ['education'], 4.25));
  out.push(r('edu.r2', 'learning_disposition', ['education'], 4.25));
  // Optional: Belonging + Social + Health
  out.push(r('bel.r1', 'sense_of_belonging', ['belonging'], 3.25));
  out.push(r('bel.r2', 'sense_of_belonging', ['belonging'], 3.25));
  out.push(r('soc.r1', 'civic_engagement', ['social'], 3.25));
  out.push(r('hea.r1', 'mental_wellbeing', ['health'], 3.25));
  return out;
}

export function handCalcCapabilities(): ProjectCapability[] {
  return [
    { domain: 'employment', role: 'core',     selectedFactors: [] },
    { domain: 'education',  role: 'core',     selectedFactors: [] },
    { domain: 'belonging',  role: 'optional', selectedFactors: [] },
    { domain: 'social',     role: 'optional', selectedFactors: [] },
    { domain: 'health',     role: 'optional', selectedFactors: [] },
  ];
}

/**
 * Build a trajectory of snapshots with a uniform per-snapshot score 0–1.
 * Used to test stability calculations precisely.
 *
 * If domainScore=0.6, every indicator returns 3.0 (=0.6*5).
 */
export function buildTrajectory(
  scores: number[],
  capabilities: ProjectCapability[],
): AssessmentSnapshot[] {
  const tps: AssessmentTimepoint[] = ['baseline','mid_3mo','exit_6mo','followup_12mo'];
  return scores.map((s, i) => ({
    candidateId: 'fixture',
    timepoint: tps[i] ?? 'followup_12mo',
    responses: capabilities.map(c => r(
      `${c.domain}.t${i}`,
      `${c.domain}_fac`,
      [c.domain],
      s * 5,
    )),
  }));
}
