import { describe, it, expect } from 'vitest';
import { calculateStability } from '@/lib/scoring/stability';
import { coverageWeightedOptional } from '@/lib/scoring/coverage';
import { buildTrajectory, handCalcCapabilities } from './_fixtures';
import type { DomainAggregate } from '@/lib/scoring/types';

describe('Stability — V2 trajectory scoring', () => {
  it('declining trajectory (0.8 → 0.7 → 0.6 → 0.5) returns 0.5', () => {
    const caps = handCalcCapabilities();
    const trajectory = buildTrajectory([0.8, 0.7, 0.6, 0.5], caps);
    const s = calculateStability(trajectory, caps);
    expect(s).toBeCloseTo(0.5, 5);
  });

  it('stable improvement (0.4 → 0.5 → 0.6 → 0.65) yields stability ≥ 0.6', () => {
    const caps = handCalcCapabilities();
    const trajectory = buildTrajectory([0.4, 0.5, 0.6, 0.65], caps);
    const s = calculateStability(trajectory, caps);
    expect(s).toBeGreaterThan(0.6);
  });

  it('flat trajectory (0.6 → 0.6 → 0.6 → 0.6) returns 0.6 (neutral)', () => {
    const caps = handCalcCapabilities();
    const trajectory = buildTrajectory([0.6, 0.6, 0.6, 0.6], caps);
    const s = calculateStability(trajectory, caps);
    expect(s).toBeCloseTo(0.6, 5);
  });

  it('single timepoint returns 0 (insufficient data)', () => {
    const caps = handCalcCapabilities();
    const trajectory = buildTrajectory([0.5], caps);
    expect(calculateStability(trajectory, caps)).toBe(0);
  });
});

describe('Coverage-weighted Optional Score — V2', () => {
  function agg(domain: any, mean: number): DomainAggregate {
    return {
      domain,
      role: 'optional',
      domainMean: mean,
      factors: [],
    };
  }

  it('wide coverage > narrow coverage at same mean', () => {
    const narrow = coverageWeightedOptional([agg('belonging', 3.5), agg('social', 3.5)]);
    const wide   = coverageWeightedOptional([
      agg('belonging', 3.5), agg('social', 3.5), agg('health', 3.5),
      agg('housing', 3.5),   agg('rights', 3.5),
    ]);
    expect(wide).toBeGreaterThan(narrow);
  });

  it('full 7-domain coverage approaches simple mean / 5', () => {
    const all7 = ['employment','housing','education','health','belonging','social','rights']
      .map(d => agg(d, 3.5));
    const v = coverageWeightedOptional(all7);
    expect(v).toBeCloseTo(3.5/5, 5);
  });

  it('no domains touched returns 0', () => {
    const v = coverageWeightedOptional([agg('belonging', 0), agg('social', 0)]);
    expect(v).toBe(0);
  });
});
