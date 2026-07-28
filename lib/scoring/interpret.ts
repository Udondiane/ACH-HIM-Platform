/**
 * Turn HIM scores into language a decision-maker can actually use.
 *
 * A raw uplift of +1.19 on a 0-5 scale means nothing to a funder or
 * commissioner. These helpers turn scores into % change, level bands,
 * and plain-English narrative.
 */

/**
 * The five anchor bands HIM's scoring anchors use. Kept short so they
 * work as domain-level labels even though the factor-level anchors go
 * deeper.
 */
export const LEVEL_LABELS: Record<number, string> = {
  1: 'cannot do / avoids',
  2: 'with support',
  3: 'independently',
  4: 'confidently',
  5: 'teaches / leads',
};

/** Map a 0-5 mean score to the nearest whole level and its short label. */
export function scoreToLevel(score: number): { level: number; label: string } {
  const level = Math.max(1, Math.min(5, Math.round(score)));
  return { level, label: LEVEL_LABELS[level] };
}

/** Uplift as a percentage of possible improvement from baseline to ceiling. */
export function upliftPct(baseline: number, exit: number): number {
  const room = 5 - baseline;
  if (room <= 0) return 0;
  return Math.round(((exit - baseline) / room) * 100);
}

/** Uplift as a percentage of the baseline itself. */
export function relativeGainPct(baseline: number, exit: number): number {
  if (baseline <= 0) return 0;
  return Math.round(((exit - baseline) / baseline) * 100);
}

/**
 * Plain-English narrative for a baseline → exit change. Used in reports
 * so decision-makers don't have to translate a raw uplift number.
 */
export function upliftNarrative(baseline: number, exit: number): string {
  if (baseline === 0 && exit === 0) return 'No score data yet.';
  const from = scoreToLevel(baseline);
  const to = scoreToLevel(exit);
  if (from.level === to.level) {
    return `Candidates remained roughly at Level ${from.level} (${from.label}). Movement within the level is real but does not cross the threshold to the next.`;
  }
  const rel = relativeGainPct(baseline, exit);
  return `Candidates moved on average from Level ${from.level} (${from.label}) to Level ${to.level} (${to.label}) — a ${rel > 0 ? '+' : ''}${rel}% change on baseline.`;
}
