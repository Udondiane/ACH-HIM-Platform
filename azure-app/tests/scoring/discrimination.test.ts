import { describe, it, expect } from 'vitest';
import { discrimination } from '@/lib/scoring/discrimination';

describe('Discrimination Ratio — V2 (spec §6)', () => {
  it('high between-group variance + low within → DR > 2 → "good"', () => {
    const result = discrimination({
      groups: {
        depth:   [0.85, 0.86, 0.84, 0.85, 0.87, 0.86, 0.84, 0.85, 0.86, 0.85],
        hybrid:  [0.65, 0.66, 0.65, 0.67, 0.66, 0.65, 0.64, 0.65, 0.66, 0.65],
        breadth: [0.45, 0.46, 0.44, 0.45, 0.46, 0.45, 0.44, 0.45, 0.46, 0.45],
      },
    });
    expect(result.status).toBe('computed');
    if (result.status === 'computed') {
      expect(result.dr).toBeGreaterThan(2);
      expect(result.verdict).toBe('good');
    }
  });

  it('moderate separation → 1 ≤ DR ≤ 2 → "moderate"', () => {
    // Group means held at ~0.70, 0.60, 0.50. Within-group spread tuned
    // so DR lands in [1,2]. (Per-group SD ~0.075 → V_within ~0.0056,
    // V_between = ((0.7-0.6)²+0+(0.5-0.6)²)/3 ≈ 0.00667, DR ≈ 1.19.)
    const result = discrimination({
      groups: {
        depth:   [0.58, 0.60, 0.63, 0.66, 0.69, 0.72, 0.75, 0.78, 0.74, 0.85],
        hybrid:  [0.48, 0.50, 0.53, 0.56, 0.59, 0.62, 0.65, 0.68, 0.64, 0.75],
        breadth: [0.38, 0.40, 0.43, 0.46, 0.49, 0.52, 0.55, 0.58, 0.54, 0.65],
      },
    });
    expect(result.status).toBe('computed');
    if (result.status === 'computed') {
      expect(result.dr).toBeGreaterThanOrEqual(1);
      expect(result.dr).toBeLessThanOrEqual(2);
      expect(result.verdict).toBe('moderate');
    }
  });

  it('low between-group variance → DR < 1 → "poor"', () => {
    const result = discrimination({
      groups: {
        depth:   [0.60, 0.65, 0.55, 0.70, 0.50, 0.65, 0.60, 0.70, 0.55, 0.60],
        hybrid:  [0.62, 0.67, 0.57, 0.72, 0.52, 0.67, 0.62, 0.72, 0.57, 0.62],
        breadth: [0.58, 0.63, 0.53, 0.68, 0.48, 0.63, 0.58, 0.68, 0.53, 0.58],
      },
    });
    expect(result.status).toBe('computed');
    if (result.status === 'computed') {
      expect(result.dr).toBeLessThan(1);
      expect(result.verdict).toBe('poor');
    }
  });

  it('n < 10 in any group returns insufficient_data', () => {
    const result = discrimination({
      groups: {
        depth:   [0.85, 0.86, 0.84, 0.85],   // only 4 — short of 10
        hybrid:  [0.65, 0.66, 0.65, 0.67, 0.66, 0.65, 0.64, 0.65, 0.66, 0.65],
        breadth: [0.45, 0.46, 0.44, 0.45, 0.46, 0.45, 0.44, 0.45, 0.46, 0.45],
      },
    });
    expect(result.status).toBe('insufficient_data');
    if (result.status === 'insufficient_data') {
      expect(result.reason).toContain('depth');
    }
  });

  it('custom minN parameter overrides default', () => {
    const result = discrimination({
      groups: {
        depth:   [0.85, 0.86, 0.84],
        hybrid:  [0.65, 0.66, 0.65],
        breadth: [0.45, 0.46, 0.44],
      },
      minN: 3,
    });
    expect(result.status).toBe('computed');
  });
});
