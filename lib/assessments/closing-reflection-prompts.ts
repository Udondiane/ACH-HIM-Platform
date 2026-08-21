/**
 * Dynamic prompt text for the closing reflection card on every assessment.
 * Generated from the project's ticked activities + the assessment timepoint
 * so the question is always contextual to what the beneficiary has
 * actually been doing. Falls back gracefully when no activities are on
 * the project.
 *
 * Kept as a pure function (no DB / no server-only imports) so it can be
 * used in server pages, client components, or unit tests interchangeably.
 */

import { PROGRAMME_ACTIVITIES } from '@/lib/activities/definitions';

export type ReflectionTimepoint = 'baseline' | 'mid_3mo' | 'exit_6mo' | 'followup_12mo';

/** Human-readable labels for the ticked activities on the project. */
export function activityLabels(activityIds: string[]): string[] {
  if (activityIds.length === 0) return [];
  const byId = new Map(PROGRAMME_ACTIVITIES.map(a => [a.id, a.label]));
  return activityIds.map(id => byId.get(id) ?? id).filter(Boolean);
}

/** "English classes, interview prep and cultural awareness training" */
export function joinActivityLabels(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0].toLowerCase();
  if (labels.length === 2) return `${labels[0].toLowerCase()} and ${labels[1].toLowerCase()}`;
  return `${labels.slice(0, -1).map(l => l.toLowerCase()).join(', ')} and ${labels[labels.length - 1].toLowerCase()}`;
}

/**
 * Generate the closing reflection question. Timepoint sets the frame,
 * activity list makes it concrete. Both fall back cleanly if either
 * piece is missing.
 */
export function closingReflectionPrompt(
  timepoint: ReflectionTimepoint,
  activityIds: string[],
): { prompt: string; context: string | null } {
  const labels = activityLabels(activityIds);
  const activityPhrase = joinActivityLabels(labels);
  const context = labels.length > 0 ? labels.join(' · ') : null;

  switch (timepoint) {
    case 'baseline':
      return {
        prompt: activityPhrase
          ? `You're about to start ${activityPhrase} with us. In your own words — what matters most to you as you begin? What are you hoping this will change for you?`
          : `You're about to start this programme with us. In your own words — what matters most to you as you begin? What are you hoping this will change for you?`,
        context,
      };
    case 'mid_3mo':
      return {
        prompt: activityPhrase
          ? `You've been part of ${activityPhrase} for a few months now. In your own words — what's changed for you? What's the moment or thing that's mattered most so far?`
          : `You've been on the programme for a few months now. In your own words — what's changed for you? What's the moment or thing that's mattered most so far?`,
        context,
      };
    case 'exit_6mo':
      return {
        prompt: activityPhrase
          ? `Looking back on your time with ${activityPhrase}, in your own words — what shifted for you? What's the one thing you'd most want us to remember about your experience?`
          : `Looking back on your time with us, in your own words — what shifted for you? What's the one thing you'd most want us to remember?`,
        context,
      };
    case 'followup_12mo':
      return {
        prompt: activityPhrase
          ? `It's been a year since ${activityPhrase} finished. In your own words — what's stayed with you? What's still true for you today because of it?`
          : `It's been a year since your programme finished. In your own words — what's stayed with you? What's still true for you today?`,
        context,
      };
    default:
      return {
        prompt: `In your own words — what matters most to you right now, and what's changed for you?`,
        context,
      };
  }
}
