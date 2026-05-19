import { describe, it, expect } from 'vitest';
import { mapInclusionToDomains } from '@/lib/scoring/inclusion-linkage';

describe('Inclusion-linkage — V2 (spec §12.2)', () => {
  it('Economic Security contributes to Employment, Housing, Health', () => {
    const scores = mapInclusionToDomains({
      economic_security: 4,
      skill_use_growth: 0,
      workplace_dignity: 0,
      voice_agency: 0,
      social_belonging: 0,
      wellbeing_confidence: 0,
    });
    expect(scores.employment).toBeDefined();
    expect(scores.housing).toBeDefined();
    expect(scores.health).toBeDefined();
  });

  it('uniform high inclusion gives all touched domains the same value', () => {
    const scores = mapInclusionToDomains({
      economic_security: 5,
      skill_use_growth: 5,
      workplace_dignity: 5,
      voice_agency: 5,
      social_belonging: 5,
      wellbeing_confidence: 5,
    });
    for (const v of Object.values(scores)) {
      expect(v).toBeCloseTo(5, 5);
    }
  });

  it('Education appears only via Skill Use & Growth', () => {
    const onlySkill = mapInclusionToDomains({
      economic_security: 0,
      skill_use_growth: 4,
      workplace_dignity: 0,
      voice_agency: 0,
      social_belonging: 0,
      wellbeing_confidence: 0,
    });
    // Education is only touched by Skill Use & Growth → score = 4.
    expect(onlySkill.education).toBeCloseTo(4, 5);
    // Employment is touched by Economic Security, Skill Use & Growth, Workplace Dignity
    // With only Skill Use = 4 (others 0), Employment mean = (0+4+0)/3 ≈ 1.33.
    expect(onlySkill.employment).toBeCloseTo(4 / 3, 5);
    // Health is touched by Economic Security and Wellbeing & Confidence — not Skill Use.
    // With both contributing dimensions = 0, Health appears with value 0.
    expect(onlySkill.health).toBeCloseTo(0, 5);
  });

  it('multi-contributor domain averages contributing dimensions', () => {
    // Belonging is touched by Workplace Dignity, Social Belonging, Wellbeing & Confidence.
    // Set those three to 2, 4, 6 → mean = 4.
    const scores = mapInclusionToDomains({
      economic_security: 0,
      skill_use_growth: 0,
      workplace_dignity: 2,
      voice_agency: 0,
      social_belonging: 4,
      wellbeing_confidence: 6,    // Out of range but the function shouldn't clamp; downstream UI does.
    });
    expect(scores.belonging).toBeCloseTo(4, 5);
  });
});
