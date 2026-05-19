import { describe, it, expect } from 'vitest';
import { calculateHim } from '@/lib/scoring/him';
import { handCalcResponses, handCalcCapabilities } from './_fixtures';

describe('HIM — hand-calc reference (spec §8 worked example)', () => {
  it('depth project, α=0.75, β=0.25, coreScore=0.85, optionalScore=0.65 → HIM = 0.80', () => {
    const result = calculateHim({
      projectType: 'depth',
      weightRatio: 'd3_1',
      capabilities: handCalcCapabilities(),
      responses: handCalcResponses(),
    });

    expect(result.alpha).toBeCloseTo(0.75, 5);
    expect(result.beta).toBeCloseTo(0.25, 5);
    expect(result.coreScore).toBeCloseTo(0.85, 5);
    expect(result.optionalScore).toBeCloseTo(0.65, 5);
    expect(result.him).toBeCloseTo(0.80, 5);
  });

  it('breadth project, α=0.25, β=0.75 — swaps relative weight', () => {
    const result = calculateHim({
      projectType: 'breadth',
      weightRatio: 'b3_1',
      capabilities: handCalcCapabilities(),
      responses: handCalcResponses(),
    });

    expect(result.alpha).toBeCloseTo(0.25, 5);
    expect(result.beta).toBeCloseTo(0.75, 5);
    // HIM = 0.25 × 0.85 + 0.75 × 0.65 = 0.2125 + 0.4875 = 0.70
    expect(result.him).toBeCloseTo(0.70, 5);
  });

  it('hybrid option A — equal weights regardless of ratio', () => {
    const result = calculateHim({
      projectType: 'hybrid',
      weightRatio: 'd3_1',     // ignored under hybrid option A
      hybridOption: 'A',
      capabilities: handCalcCapabilities(),
      responses: handCalcResponses(),
    });

    expect(result.alpha).toBeCloseTo(0.5, 5);
    expect(result.beta).toBeCloseTo(0.5, 5);
    // HIM = 0.5 × 0.85 + 0.5 × 0.65 = 0.75
    expect(result.him).toBeCloseTo(0.75, 5);
  });
});
