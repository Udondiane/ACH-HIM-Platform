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
 * Generate the closing reflection question.
 *
 * Universal + neutral by design: activity-derived variants read as
 * scripted and long in practice, and the beneficiary answers the same
 * whether we mention the programme structure or not. One short human
 * question per timepoint. Activity list is still surfaced separately
 * in the UI (as a subdued context anchor for the assessor) so the
 * project shape isn't lost — it just doesn't clutter the prompt read
 * aloud to the beneficiary.
 */
export function closingReflectionPrompt(
  timepoint: ReflectionTimepoint,
  activityIds: string[],
): { prompt: string; context: string | null } {
  const labels = activityLabels(activityIds);
  const context = labels.length > 0 ? labels.join(' · ') : null;

  switch (timepoint) {
    case 'baseline':
      return {
        prompt: 'What are you hoping joining the ACH programme will change in your life?',
        context,
      };
    case 'mid_3mo':
      return {
        prompt: 'How has joining the ACH programme changed things for you so far?',
        context,
      };
    case 'exit_6mo':
      return {
        prompt: 'How has joining the ACH programme changed your life?',
        context,
      };
    case 'followup_12mo':
      return {
        prompt: 'A year on — how has joining the ACH programme changed your life?',
        context,
      };
    default:
      return {
        prompt: 'How has joining the ACH programme changed things for you?',
        context,
      };
  }
}
