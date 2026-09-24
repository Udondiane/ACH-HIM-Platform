import { describe, it, expect } from 'vitest';
import { deriveTypeAndWeight } from '@/lib/projects/schema';

/**
 * Tests for the two-step derivation finalised on 2026-09-24.
 *
 *   Step 1 · project type from questionnaire total (methodology doc §5.2)
 *   Step 2 · weight ratio from Delphi Round 1 (July 2026) 2:1 defaults
 *            (with pure-intent escalation to 3:1)
 *
 * Load-bearing behaviours below match the methodology doc + Delphi
 * Round 1 findings report. Any change here needs a corresponding
 * change to both the doc and the audit trail on downstream reports.
 */

describe('deriveTypeAndWeight — two-step reconciled derivation', () => {

  describe('Step 1 · project type from classification questionnaire', () => {
    it('total 6–8 → depth', () => {
      expect(deriveTypeAndWeight(8, 1, 0).type).toBe('depth');
      expect(deriveTypeAndWeight(7, 1, 0).type).toBe('depth');
      expect(deriveTypeAndWeight(6, 2, 1).type).toBe('depth');
    });

    it('total 3–5 → hybrid (fixes prior unreachability defect)', () => {
      expect(deriveTypeAndWeight(5, 1, 0).type).toBe('hybrid');
      expect(deriveTypeAndWeight(4, 2, 1).type).toBe('hybrid');
      expect(deriveTypeAndWeight(3, 1, 2).type).toBe('hybrid');
    });

    it('total 0–2 → breadth', () => {
      expect(deriveTypeAndWeight(2, 0, 2).type).toBe('breadth');
      expect(deriveTypeAndWeight(1, 0, 1).type).toBe('breadth');
      expect(deriveTypeAndWeight(0, 0, 2).type).toBe('breadth');
    });

    it('null classification falls back to counts — coreCount=0 → breadth', () => {
      expect(deriveTypeAndWeight(null, 0, 1).type).toBe('breadth');
      expect(deriveTypeAndWeight(null, 0, 2).type).toBe('breadth');
    });

    it('null classification falls back to counts — coreCount>=1 → depth', () => {
      expect(deriveTypeAndWeight(null, 1, 0).type).toBe('depth');
      expect(deriveTypeAndWeight(null, 3, 2).type).toBe('depth');
    });

    it('null classification cannot produce hybrid — requires deliberate acknowledgement', () => {
      // Under the two-step model, hybrid is only reachable via the
      // questionnaire. Counts alone never produce hybrid.
      for (let c = 0; c <= 3; c++) {
        for (let o = 0; o <= 2; o++) {
          expect(deriveTypeAndWeight(null, c, o).type).not.toBe('hybrid');
        }
      }
    });
  });

  describe('Step 2 · weight ratio within type — Delphi Round 1 defaults', () => {
    it('depth default is d2_1 (α=0.67) per Round 1', () => {
      expect(deriveTypeAndWeight(6, 1, 1).weight_ratio).toBe('d2_1');
      expect(deriveTypeAndWeight(7, 2, 1).weight_ratio).toBe('d2_1');
      expect(deriveTypeAndWeight(8, 1, 0).weight_ratio).toBe('d2_1');
      expect(deriveTypeAndWeight(null, 2, 0).weight_ratio).toBe('d2_1');
    });

    it('depth escalates to d3_1 only for pure-depth intent (3 Core, 0 Optional)', () => {
      expect(deriveTypeAndWeight(8, 3, 0).weight_ratio).toBe('d3_1');
      expect(deriveTypeAndWeight(null, 3, 0).weight_ratio).toBe('d3_1');
    });

    it('breadth default is b2_1 (β=0.67) per Round 1', () => {
      expect(deriveTypeAndWeight(1, 0, 1).weight_ratio).toBe('b2_1');
      expect(deriveTypeAndWeight(2, 0, 2).weight_ratio).toBe('b2_1');
      expect(deriveTypeAndWeight(null, 0, 1).weight_ratio).toBe('b2_1');
    });

    it('breadth escalates to b3_1 only for pure-breadth intent (0 Core, 3+ Optional)', () => {
      // Note: current UI caps Optional at 2 (form-level). This branch
      // remains for programmatic setters, historical data migrations,
      // and future UI changes that lift the cap.
      expect(deriveTypeAndWeight(0, 0, 3).weight_ratio).toBe('b3_1');
      expect(deriveTypeAndWeight(null, 0, 5).weight_ratio).toBe('b3_1');
    });

    it('hybrid always uses Option A with canonical d1_1 storage form', () => {
      const r = deriveTypeAndWeight(4, 2, 1);
      expect(r.type).toBe('hybrid');
      expect(r.weight_ratio).toBe('d1_1');
      expect(r.hybrid_option).toBe('A');
    });

    it('non-hybrid returns hybrid_option = null', () => {
      expect(deriveTypeAndWeight(8, 1, 0).hybrid_option).toBeNull();
      expect(deriveTypeAndWeight(0, 0, 2).hybrid_option).toBeNull();
    });
  });

  describe('Regression — known prior defects now fixed', () => {
    it('regression · common depth configurations no longer default to d3_1', () => {
      // Prior lookup table produced d3_1 for many moderate splits.
      // The Delphi panel said that was one step too strong.
      expect(deriveTypeAndWeight(6, 1, 2).weight_ratio).toBe('d2_1');
      expect(deriveTypeAndWeight(6, 2, 1).weight_ratio).toBe('d2_1');
      expect(deriveTypeAndWeight(6, 2, 2).weight_ratio).toBe('d2_1');
    });

    it('regression · hybrid is now reachable outside the 3+2 ceiling', () => {
      // Under the prior lookup table only (coreCount=3, optionalCount=2)
      // produced hybrid. Now any questionnaire total 3–5 does.
      expect(deriveTypeAndWeight(4, 0, 0).type).toBe('hybrid');
      expect(deriveTypeAndWeight(3, 1, 0).type).toBe('hybrid');
      expect(deriveTypeAndWeight(5, 2, 2).type).toBe('hybrid');
    });

    it('regression · breadth default is no longer b3_1 for moderate coverage', () => {
      expect(deriveTypeAndWeight(1, 0, 2).weight_ratio).toBe('b2_1');
    });
  });
});
