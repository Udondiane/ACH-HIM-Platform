/**
 * Delphi consensus — V2 (spec §5).
 *
 * Two consensus rules (either suffices):
 *   Rule A: ≥70% of experts converge on a single option (modal agreement).
 *   Rule B: interquartile range of numeric ratings ≤ 1 scale point.
 *
 * Rule B applies when the panel rates on a numeric scale (e.g. weight ratio
 * indices 1–5). Rule A applies when the panel selects among discrete options.
 *
 * Both rules are computed; the higher-confidence one wins. If neither holds,
 * the panel returns to a Round 2 with anonymised round-1 results disclosed.
 */

export type DelphiInput = {
  /** Map option → count of votes (Rule A). */
  optionCounts: Record<string, number>;
  /** Optional numeric ratings if Rule B applies (must align across experts). */
  numericRatings?: number[];
};

export type DelphiResult = {
  consensus: boolean;
  rule?: 'agreement_70' | 'iqr_one_scale';
  winningOption?: string;
  agreementPct?: number;
  iqr?: number;
  totalVotes: number;
};

export function evaluateDelphi(input: DelphiInput): DelphiResult {
  const totalVotes = Object.values(input.optionCounts).reduce((s, n) => s + n, 0);

  // Rule A — agreement ≥ 70%
  let winningOption: string | undefined;
  let topCount = 0;
  for (const [opt, n] of Object.entries(input.optionCounts)) {
    if (n > topCount) { topCount = n; winningOption = opt; }
  }
  const agreementPct = totalVotes === 0 ? 0 : topCount / totalVotes;

  if (agreementPct >= 0.70 && winningOption !== undefined) {
    return {
      consensus: true,
      rule: 'agreement_70',
      winningOption,
      agreementPct,
      totalVotes,
    };
  }

  // Rule B — IQR ≤ 1 scale point
  if (input.numericRatings && input.numericRatings.length >= 4) {
    const iqr = interquartileRange(input.numericRatings);
    if (iqr <= 1) {
      return {
        consensus: true,
        rule: 'iqr_one_scale',
        winningOption,
        agreementPct,
        iqr,
        totalVotes,
      };
    }
    return { consensus: false, agreementPct, iqr, totalVotes };
  }

  return { consensus: false, agreementPct, totalVotes };
}

function interquartileRange(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return q3 - q1;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo  = Math.floor(pos);
  const hi  = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}
