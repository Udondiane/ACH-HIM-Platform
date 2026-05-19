import { describe, it, expect } from 'vitest';
import {
  aggregateDomain, normaliseIndicator,
} from '@/lib/scoring/aggregation';
import { r } from './_fixtures';

describe('Aggregation — mixed-method normalisation', () => {
  it('likert_1_5 passes through 0–5 unchanged', () => {
    expect(normaliseIndicator(r('x','f',['employment'], 3.5))).toBe(3.5);
  });

  it('likert_1_10 scaled to 0–5', () => {
    expect(normaliseIndicator(r('x','f',['employment'], 7, { method: 'likert_1_10' }))).toBe(3.5);
  });

  it('yes_no: Yes=5, No=0 (stored as the numeric value)', () => {
    expect(normaliseIndicator(r('x','f',['employment'], 5, { method: 'yes_no' }))).toBe(5);
    expect(normaliseIndicator(r('x','f',['employment'], 0, { method: 'yes_no' }))).toBe(0);
  });

  it('narrative responses return null (excluded from numeric scoring)', () => {
    const resp = r('x','f',['employment'], 0, { method: 'narrative' });
    resp.numericValue = null;
    resp.narrative = 'Reported significant improvement in confidence.';
    expect(normaliseIndicator(resp)).toBeNull();
  });

  it('values clamp to 0–5 (handles bad input gracefully)', () => {
    expect(normaliseIndicator(r('x','f',['employment'], -1))).toBe(0);
    expect(normaliseIndicator(r('x','f',['employment'], 99))).toBe(5);
  });
});

describe('Aggregation — universal-factor deduplication', () => {
  it('digital_literacy assessed once propagates to Employment and Education', () => {
    const resps = [
      // Universal: digital_literacy applies to both Employment + Education
      r('dl.email', 'digital_literacy', ['employment','education'], 4,
        { factorType: 'personal', isUniversal: true }),
      r('dl.search', 'digital_literacy', ['employment','education'], 4,
        { factorType: 'personal', isUniversal: true }),
      // Domain-specific Employment factor:
      r('emp.r1', 'work_readiness', ['employment'], 4),
      r('emp.r2', 'work_readiness', ['employment'], 4),
      // Domain-specific Education factor:
      r('edu.r1', 'learning_disposition', ['education'], 4),
    ];

    const employmentAgg = aggregateDomain('employment', 'core', resps);
    const educationAgg  = aggregateDomain('education',  'core', resps);

    // Both domains should see digital_literacy as one of their factors.
    expect(employmentAgg.factors.some(f => f.factorId === 'digital_literacy')).toBe(true);
    expect(educationAgg.factors.some(f => f.factorId === 'digital_literacy')).toBe(true);

    // With value=4 across all indicators, both domain means must equal 4.
    expect(employmentAgg.domainMean).toBeCloseTo(4, 5);
    expect(educationAgg.domainMean).toBeCloseTo(4, 5);
  });
});

describe('Aggregation — two-step rollup (factor → type → domain)', () => {
  it('factor types averaged separately then combined', () => {
    // Two factor types: personal (scored 5) and environmental (scored 1)
    // Two-step rollup: personal type mean = 5, environmental = 1, domain mean = 3
    const resps = [
      r('p1','personal_fac',['employment'], 5, { factorType: 'personal' }),
      r('p2','personal_fac',['employment'], 5, { factorType: 'personal' }),
      r('e1','env_fac',['employment'], 1, { factorType: 'environmental' }),
      r('e2','env_fac',['employment'], 1, { factorType: 'environmental' }),
    ];
    const agg = aggregateDomain('employment', 'core', resps);
    expect(agg.domainMean).toBeCloseTo(3, 5);
  });
});
