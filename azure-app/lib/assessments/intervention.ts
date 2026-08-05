// Helpers for intervention timing + baseline window enforcement.
//
// Effective intervention start date for a candidate:
//   - cohort_candidates.intervention_start_date if set (always wins),
//   - else cohorts.intervention_start_date,
//   - else null (window can't be enforced).
//
// Baseline window state for that candidate:
//   - 'before-start': today is before the effective start; baseline can be recorded any time
//   - 'in-window':    today is within [start, start + windowDays]; baseline can still be recorded
//   - 'after-window': today is past the window; baseline LOCKED. Candidate reports as no-valid-baseline.
//   - 'no-start':     no effective start date set; baseline allowed (legacy / unset).

export type BaselineWindowState = 'before-start' | 'in-window' | 'after-window' | 'no-start';

export interface InterventionContext {
  cohortStart: string | null;
  candidateStart: string | null;
  windowDays: number;
}

export function effectiveInterventionStart(ctx: InterventionContext): string | null {
  return ctx.candidateStart ?? ctx.cohortStart ?? null;
}

export function baselineWindowState(ctx: InterventionContext, today: Date = new Date()): {
  state: BaselineWindowState;
  start: string | null;
  windowEnd: string | null;
  daysRemaining: number | null;
} {
  const start = effectiveInterventionStart(ctx);
  if (!start) {
    return { state: 'no-start', start: null, windowEnd: null, daysRemaining: null };
  }
  const startDate = new Date(`${start}T00:00:00`);
  const windowEnd = new Date(startDate);
  windowEnd.setDate(windowEnd.getDate() + ctx.windowDays);
  const windowEndStr = windowEnd.toISOString().slice(0, 10);

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (todayMidnight < startDate) {
    return { state: 'before-start', start, windowEnd: windowEndStr, daysRemaining: null };
  }
  if (todayMidnight <= windowEnd) {
    const ms = windowEnd.getTime() - todayMidnight.getTime();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return { state: 'in-window', start, windowEnd: windowEndStr, daysRemaining: days };
  }
  return { state: 'after-window', start, windowEnd: windowEndStr, daysRemaining: 0 };
}

export const BASELINE_WINDOW_STATE_LABELS: Record<BaselineWindowState, string> = {
  'before-start': 'Pre-start — baseline can be recorded',
  'in-window':    'Baseline window open',
  'after-window': 'Baseline window closed',
  'no-start':     'No intervention start set',
};
