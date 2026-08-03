/**
 * Weights — Saaty AHP foundation per spec §3.2.
 *
 *   α = r/(r+1) for Depth
 *   β = 1/(r+1) for Breadth
 *
 * with r being the relative-importance ratio chosen from spec §3.3 / §3.4.
 *
 * Hybrid option A: fixed equal weights α=β=0.50 (v1 default).
 * Hybrid option B: interpolated weights from project classification
 *                   characteristics (V2). The interpolation uses the
 *                   classification questionnaire's depth-leaning score
 *                   to lerp α between 0.50 and 0.75.
 */

import type { WeightRatio, HybridOption, ProjectType } from './types';

export type Weights = { alpha: number; beta: number };

/**
 * Pure α/β lookup for the discrete ratios in spec §3.3 / §3.4.
 * Values rounded to 2dp per spec tables.
 */
export function weightsForRatio(ratio: WeightRatio): Weights {
  switch (ratio) {
    // Depth-favoured (spec §3.3)
    case 'd1_1': return { alpha: 0.50, beta: 0.50 };
    case 'd2_1': return { alpha: 0.67, beta: 0.33 };
    case 'd3_1': return { alpha: 0.75, beta: 0.25 };
    case 'd4_1': return { alpha: 0.80, beta: 0.20 };
    case 'd5_1': return { alpha: 0.83, beta: 0.17 };
    // Breadth-favoured (spec §3.4). Asymmetry: no b5_1 — spec §3.4 note.
    case 'b2_1': return { alpha: 0.33, beta: 0.67 };
    case 'b3_1': return { alpha: 0.25, beta: 0.75 };
    case 'b4_1': return { alpha: 0.20, beta: 0.80 };
  }
}

/**
 * Hybrid option A: fixed equal weights regardless of ratio (v1).
 */
export function hybridOptionAWeights(): Weights {
  return { alpha: 0.5, beta: 0.5 };
}

/**
 * Hybrid option B (V2): interpolated weights from project characteristics.
 *
 * Input: depthLeaningScore in [0,1] derived from the classification
 *        questionnaire (1 = strongly depth, 0 = strongly breadth, 0.5 = balanced).
 * Output: α between 0.25 (full breadth) and 0.75 (full depth), linear.
 *
 * This sits *between* a pure d3_1 (α=0.75) and b3_1 (α=0.25). It does not
 * exceed those — projects clearly at one extreme should be reclassified.
 */
export function hybridOptionBWeights(depthLeaningScore: number): Weights {
  const clamped = Math.max(0, Math.min(1, depthLeaningScore));
  const alpha = 0.25 + clamped * 0.50;   // 0.25 → 0.75
  return { alpha, beta: 1 - alpha };
}

/**
 * Resolve project weights given type + ratio choice + hybrid option.
 *
 * For non-hybrid types, the ratio determines weights directly.
 * For hybrid type, option A returns fixed equal weights; option B requires
 * a depthLeaningScore (otherwise falls back to option A).
 */
export function resolveWeights(opts: {
  projectType: ProjectType;
  weightRatio: WeightRatio;
  hybridOption?: HybridOption;
  depthLeaningScore?: number;
}): Weights {
  if (opts.projectType === 'hybrid') {
    if (opts.hybridOption === 'B' && typeof opts.depthLeaningScore === 'number') {
      return hybridOptionBWeights(opts.depthLeaningScore);
    }
    return hybridOptionAWeights();
  }
  return weightsForRatio(opts.weightRatio);
}
