/**
 * Coverage-weighted Optional Score — V2 (spec §8.2 note).
 *
 * Rationale: breadth-oriented programmes deserve credit for the *number* of
 * Optional domains touched, not just the average level achieved across them.
 * A project with 5 Optional domains lightly improved should score higher than
 * one with 2 Optional domains improved by the same average margin.
 *
 * Implementation:
 *   coverage = (count of non-zero Optional domain means) / 7
 *   weight   = 0.5 + 0.5 × coverage    (so coverage=0 → 0.5; coverage=1 → 1.0)
 *   optional_score = simple_mean × weight   (still 0–1)
 *
 * The 0.5 floor preserves the simple-average behaviour as the lower bound and
 * means coverage-weighted is *always ≥* simple-average up to coverage=1
 * where they coincide at coverage=1.0... wait, that's reversed. Let's fix:
 *
 * Actually for coverage=1.0 (all 7 Optional domains touched) we want the
 * full simple mean. For coverage<1 we want to *penalise* under-coverage,
 * not amplify it. Re-think.
 *
 * Correct interpretation per spec §3.1 ("scope of emergent outcomes across
 * multiple life domains"): Optional Score should *reward* breadth. Two
 * breadth-oriented programmes with the same mean Optional level but different
 * coverage breadth should be differentiated.
 *
 * Mechanism: multiply the simple mean by a coverage factor that scales
 * from 0.7 at coverage=1/7 to 1.0 at coverage=7/7. Below 1/7 (no coverage)
 * it's 0 by definition.
 *
 *   coverage_factor = 0.7 + 0.3 × (n_covered − 1) / (n_total − 1)
 *                   where n_total = max Optional domains possible
 *
 * This satisfies the spec's stated direction (coverage-weighted, V2 only,
 * favours wide-coverage breadth-oriented projects).
 */

import type { DomainAggregate } from './types';

/** Returns Optional Score [0,1] using coverage weighting. */
export function coverageWeightedOptional(
  optionalAggregates: DomainAggregate[],
): number {
  if (optionalAggregates.length === 0) return 0;

  const means = optionalAggregates.map(a => a.domainMean);
  const nonZero = means.filter(m => m > 0).length;
  if (nonZero === 0) return 0;

  const simpleMean = means.reduce((s, m) => s + m, 0) / means.length;

  // coverage_factor 0.7 → 1.0 as nonZero goes from 1 → 7 (total possible)
  // (using fixed n_total = 7 to anchor against the framework, not just the
  // project's selection — a project that selected only 2 Optional domains
  // still has bounded coverage relative to the seven-domain capability set)
  const nTotal = 7;
  const factor =
    nonZero <= 1 ? 0.7 :
    nonZero >= nTotal ? 1.0 :
    0.7 + 0.3 * (nonZero - 1) / (nTotal - 1);

  return Math.min(1, (simpleMean / 5) * factor);
}
