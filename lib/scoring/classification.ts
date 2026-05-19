/**
 * Classification questionnaire — spec §4.2 (V2).
 *
 * Four questions, A/B/C responses:
 *   A = 2  (strongly depth-leaning)
 *   C = 1  (mixed)
 *   B = 0  (strongly breadth-leaning)
 *
 * Total (0–8) determines project type:
 *   6–8 → depth-oriented   (exemplar α=0.75, β=0.25)
 *   3–5 → hybrid           (option A: α=β=0.50)
 *   0–2 → breadth-oriented (exemplar α=0.25, β=0.75)
 */

import type { ProjectType, WeightRatio } from './types';

export type ABCResponse = 'A' | 'B' | 'C';
export type ClassificationResponses = {
  q1_primary_objective: ABCResponse;
  q2_participation_intensity: ABCResponse;
  q3_service_delivery: ABCResponse;
  q4_expected_change_pattern: ABCResponse;
};

const RESPONSE_VALUE: Record<ABCResponse, number> = { A: 2, C: 1, B: 0 };

export function scoreClassification(r: ClassificationResponses): number {
  return (
    RESPONSE_VALUE[r.q1_primary_objective]
    + RESPONSE_VALUE[r.q2_participation_intensity]
    + RESPONSE_VALUE[r.q3_service_delivery]
    + RESPONSE_VALUE[r.q4_expected_change_pattern]
  );
}

export function deriveProjectType(total: number): ProjectType {
  if (total >= 6) return 'depth';
  if (total >= 3) return 'hybrid';
  return 'breadth';
}

export function exemplarWeightRatio(type: ProjectType): WeightRatio {
  switch (type) {
    case 'depth':   return 'd3_1';  // α=0.75, β=0.25
    case 'breadth': return 'b3_1';  // α=0.25, β=0.75
    case 'hybrid':  return 'd1_1';  // α=β=0.50
  }
}

/**
 * Depth-leaning score in [0,1] for use with hybrid option B (V2).
 * Mapping: total/8.
 */
export function depthLeaningScore(r: ClassificationResponses): number {
  return scoreClassification(r) / 8;
}

export type ClassificationResult = {
  total: number;
  projectType: ProjectType;
  suggestedRatio: WeightRatio;
  depthLeaningScore: number;
};

export function classify(r: ClassificationResponses): ClassificationResult {
  const total = scoreClassification(r);
  const projectType = deriveProjectType(total);
  return {
    total,
    projectType,
    suggestedRatio: exemplarWeightRatio(projectType),
    depthLeaningScore: total / 8,
  };
}
