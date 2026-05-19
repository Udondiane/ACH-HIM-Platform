import { describe, it, expect } from 'vitest';
import { evaluateDelphi } from '@/lib/scoring/delphi';

describe('Delphi consensus — V2 (spec §5)', () => {
  it('Rule A: 8 of 10 experts pick option 3 → consensus by agreement_70', () => {
    const result = evaluateDelphi({
      optionCounts: { '3:1': 8, '2:1': 1, '4:1': 1 },
    });
    expect(result.consensus).toBe(true);
    expect(result.rule).toBe('agreement_70');
    expect(result.winningOption).toBe('3:1');
    expect(result.agreementPct).toBeCloseTo(0.8, 5);
  });

  it('Rule A: exactly 7 of 10 (70%) reaches consensus', () => {
    const result = evaluateDelphi({
      optionCounts: { '3:1': 7, '2:1': 2, '4:1': 1 },
    });
    expect(result.consensus).toBe(true);
    expect(result.rule).toBe('agreement_70');
  });

  it('Rule A: 6 of 10 (60%) does NOT reach consensus', () => {
    const result = evaluateDelphi({
      optionCounts: { '3:1': 6, '2:1': 2, '4:1': 2 },
    });
    expect(result.consensus).toBe(false);
  });

  it('Rule B: numeric ratings with IQR ≤ 1 → consensus by iqr_one_scale', () => {
    // Ten experts rating on a 1–5 scale, clustered around 3 with IQR=1
    const result = evaluateDelphi({
      optionCounts: { '3': 5, '4': 4, '5': 1 },
      numericRatings: [3, 3, 3, 3, 3, 4, 4, 4, 4, 5],
    });
    expect(result.consensus).toBe(true);
    // It might satisfy Rule A first if any option ≥70%, otherwise Rule B kicks in.
    // With 5/10 modal = 50%, Rule A fails, Rule B passes.
    expect(result.rule).toBe('iqr_one_scale');
    expect(result.iqr).toBeLessThanOrEqual(1);
  });

  it('Rule B: numeric ratings with IQR > 1 → no consensus', () => {
    const result = evaluateDelphi({
      optionCounts: { '1': 2, '2': 2, '3': 2, '4': 2, '5': 2 },
      numericRatings: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    });
    expect(result.consensus).toBe(false);
    expect(result.iqr).toBeGreaterThan(1);
  });
});
