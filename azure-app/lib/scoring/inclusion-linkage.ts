/**
 * Inclusion-to-Capability linkage — V2 (spec §12.2).
 *
 * The 6-dimension Inclusion Assessment is methodologically a PARALLEL
 * framework, not a substitute. But for *placed* candidates, the placing
 * employer's inclusion dimensions also describe environmental conversion
 * factors operating on the candidate.
 *
 * Mapping (spec §12.2, table):
 *   Economic Security & Stability  → Employment, Housing, Health
 *   Skill Use & Growth             → Employment, Education
 *   Workplace Dignity & Respect    → Employment, Belonging
 *   Voice & Agency                 → Social, Rights
 *   Social Belonging & Inclusion   → Belonging, Social
 *   Wellbeing & Confidence         → Health, Belonging
 *
 * For each capability domain, the inclusion-derived environmental score is
 * the mean of the contributing inclusion dimensions (0–5 scale, native).
 */

import type { DomainId } from './types';

export type InclusionScores = {
  economic_security:    number;  // 0–5
  skill_use_growth:     number;
  workplace_dignity:    number;
  voice_agency:         number;
  social_belonging:     number;
  wellbeing_confidence: number;
};

const MAPPING: Record<keyof InclusionScores, DomainId[]> = {
  economic_security:    ['employment', 'housing', 'health'],
  skill_use_growth:     ['employment', 'education'],
  workplace_dignity:    ['employment', 'belonging'],
  voice_agency:         ['social', 'rights'],
  social_belonging:     ['belonging', 'social'],
  wellbeing_confidence: ['health', 'belonging'],
};

/**
 * Compute per-capability-domain inclusion-derived env scores (0–5).
 * Returns a partial map — only domains touched by the mapping are filled.
 */
export function mapInclusionToDomains(
  s: InclusionScores,
): Partial<Record<DomainId, number>> {
  // Accumulator: for each domain, list of contributing dimension scores.
  const contributing: Partial<Record<DomainId, number[]>> = {};
  for (const dim of Object.keys(MAPPING) as Array<keyof InclusionScores>) {
    const score = s[dim];
    if (typeof score !== 'number' || !Number.isFinite(score)) continue;
    for (const domain of MAPPING[dim]) {
      if (!contributing[domain]) contributing[domain] = [];
      contributing[domain]!.push(score);
    }
  }

  const out: Partial<Record<DomainId, number>> = {};
  for (const [domain, vals] of Object.entries(contributing)) {
    if (vals && vals.length > 0) {
      out[domain as DomainId] = vals.reduce((s, x) => s + x, 0) / vals.length;
    }
  }
  return out;
}
