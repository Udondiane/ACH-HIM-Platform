import { describe, it, expect } from 'vitest';
import {
  weightsForRatio, hybridOptionAWeights, hybridOptionBWeights,
} from '@/lib/scoring/weights';
import {
  scoreClassification, deriveProjectType, classify, depthLeaningScore,
} from '@/lib/scoring/classification';

describe('Weights — spec §3.3 / §3.4 lookups', () => {
  it('depth ratios produce α=r/(r+1)', () => {
    expect(weightsForRatio('d1_1').alpha).toBeCloseTo(0.50, 5);
    expect(weightsForRatio('d2_1').alpha).toBeCloseTo(0.67, 2);
    expect(weightsForRatio('d3_1').alpha).toBeCloseTo(0.75, 5);
    expect(weightsForRatio('d4_1').alpha).toBeCloseTo(0.80, 5);
    expect(weightsForRatio('d5_1').alpha).toBeCloseTo(0.83, 2);
  });

  it('breadth ratios mirror with β=r/(r+1) and asymmetry — no b5_1', () => {
    expect(weightsForRatio('b2_1').beta).toBeCloseTo(0.67, 2);
    expect(weightsForRatio('b3_1').beta).toBeCloseTo(0.75, 5);
    expect(weightsForRatio('b4_1').beta).toBeCloseTo(0.80, 5);
  });

  it('α + β = 1 for every ratio', () => {
    for (const ratio of ['d1_1','d2_1','d3_1','d4_1','d5_1','b2_1','b3_1','b4_1'] as const) {
      const w = weightsForRatio(ratio);
      expect(w.alpha + w.beta).toBeCloseTo(1, 5);
    }
  });

  it('hybrid option A always returns 0.50/0.50', () => {
    expect(hybridOptionAWeights().alpha).toBeCloseTo(0.50, 5);
    expect(hybridOptionAWeights().beta).toBeCloseTo(0.50, 5);
  });

  it('hybrid option B interpolates: depthLeaningScore 0.7 → α ≈ 0.60', () => {
    const w = hybridOptionBWeights(0.7);
    // 0.25 + 0.7 × 0.5 = 0.60
    expect(w.alpha).toBeCloseTo(0.60, 5);
    expect(w.beta).toBeCloseTo(0.40, 5);
  });

  it('hybrid option B clamps inputs out of [0,1]', () => {
    expect(hybridOptionBWeights(-1).alpha).toBeCloseTo(0.25, 5);
    expect(hybridOptionBWeights(2).alpha).toBeCloseTo(0.75, 5);
  });
});

describe('Classification — V2 four-question questionnaire', () => {
  it('A=2, C=1, B=0 with depth-derivation at total ≥ 6', () => {
    const total = scoreClassification({
      q1_primary_objective: 'A',
      q2_participation_intensity: 'A',
      q3_service_delivery: 'A',
      q4_expected_change_pattern: 'C',
    });
    expect(total).toBe(7);
    expect(deriveProjectType(total)).toBe('depth');
  });

  it('all B → breadth', () => {
    const total = scoreClassification({
      q1_primary_objective: 'B',
      q2_participation_intensity: 'B',
      q3_service_delivery: 'B',
      q4_expected_change_pattern: 'B',
    });
    expect(total).toBe(0);
    expect(deriveProjectType(total)).toBe('breadth');
  });

  it('mid-range → hybrid', () => {
    expect(deriveProjectType(3)).toBe('hybrid');
    expect(deriveProjectType(4)).toBe('hybrid');
    expect(deriveProjectType(5)).toBe('hybrid');
  });

  it('classify produces depthLeaningScore = total/8', () => {
    const c = classify({
      q1_primary_objective: 'A',
      q2_participation_intensity: 'A',
      q3_service_delivery: 'C',
      q4_expected_change_pattern: 'C',
    });
    expect(c.total).toBe(6);
    expect(c.depthLeaningScore).toBeCloseTo(0.75, 5);
    expect(c.projectType).toBe('depth');
  });
});
