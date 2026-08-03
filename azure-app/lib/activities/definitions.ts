// Canonical list of programme activities. Programme Managers tick which
// activities their project delivers; the platform derives which HIM factors
// to measure from these. Mapping from activity → factors is stored in the
// `activity_factors` DB table (migration 037).
//
// Each activity declares which capability domains it touches so the project
// setup form can filter the activity list to only those relevant to the
// domains the user has selected as Core or Supporting.
//
// `isTraining` marks activities that are delivered as formal training
// programmes. When ticked on project setup the app auto-spawns a
// training_programmes row scoped to the project so enrolment, sessions,
// attendance and certification can be captured immediately — no context
// switch to a separate "create training programme" page.

import type { DomainId } from '@/lib/scoring/types';

export interface ProgrammeActivity {
  id: string;
  label: string;
  hint: string;
  /** Domains this activity touches. Used to filter the activity list in the
   *  project setup form based on selected Core + Supporting domains. */
  domains: DomainId[];
  /** True if this activity is delivered as a training programme (sessions,
   *  attendance, certification). Ticking it auto-spawns a training programme. */
  isTraining?: boolean;
}

export const PROGRAMME_ACTIVITIES: ProgrammeActivity[] = [
  {
    id: 'english_training',
    label: 'English language training',
    hint: 'ESOL, workplace English, or vocational English delivery.',
    domains: ['employment', 'education'],
    isTraining: true,
  },
  {
    id: 'digital_skills_training',
    label: 'Digital skills training',
    hint: 'Basic IT, online platforms, workplace tools (scanners, terminals, etc.).',
    domains: ['employment', 'education'],
    isTraining: true,
  },
  {
    id: 'customer_service_training',
    label: 'Customer service training',
    hint: 'Customer-facing skills, complaint handling, service standards.',
    domains: ['employment', 'education'],
    isTraining: true,
  },
  {
    id: 'health_safety_training',
    label: 'Health & safety training',
    hint: 'Workplace H&S basics, hazard awareness, PPE, statutory requirements.',
    domains: ['employment', 'education'],
    isTraining: true,
  },
  {
    id: 'cultural_awareness_training',
    label: 'Cultural awareness training',
    hint: 'UK workplace culture, professional norms, workplace communication.',
    domains: ['employment', 'belonging', 'education'],
    isTraining: true,
  },
  {
    id: 'employability_coaching',
    label: 'Employability coaching / interview prep',
    hint: 'CV writing, mock interviews, workplace norms briefing.',
    domains: ['employment'],
    isTraining: true,
  },
  {
    id: 'career_goal_setting',
    label: 'Career goal-setting / IAG',
    hint: 'Information, advice, and guidance on career direction.',
    domains: ['employment', 'education'],
  },
  {
    id: 'direct_job_placement',
    label: 'Direct job placement with corporate partners',
    hint: 'Programme leads to a placement at a workforce partner.',
    domains: ['employment'],
  },
  {
    id: 'in_work_support',
    label: 'In-work support / retention check-ins',
    hint: 'Ongoing contact with the placed candidate; 6 and 12-month retention checks.',
    domains: ['employment'],
  },
  {
    id: 'mentorship_peer_connection',
    label: 'Mentorship / peer connection',
    hint: 'Formal mentor pairing or peer-network introductions.',
    domains: ['employment', 'belonging'],
  },
  {
    id: 'wraparound_support',
    label: 'Wraparound / wellbeing support',
    hint: 'Pastoral care, mental health check-ins, casework, integration support.',
    domains: ['belonging', 'health'],
  },
  {
    id: 'housing_support',
    label: 'Housing support',
    hint: 'Tenancy advice, accommodation moves, housing crisis intervention.',
    domains: ['housing'],
  },
  {
    id: 'legal_advice',
    label: 'Legal advice / rights education',
    hint: 'Immigration advice, citizenship pathway, rights training.',
    domains: ['rights'],
  },
  {
    id: 'community_participation',
    label: 'Community / civic participation activities',
    hint: 'Group events, volunteering, civic engagement sessions.',
    domains: ['social'],
  },
  {
    id: 'employer_engagement',
    label: 'Employer engagement (changing recruitment practices)',
    hint: 'Working with employers to make their hiring more inclusive.',
    domains: ['employment'],
  },
];

export const PROGRAMME_ACTIVITY_LABELS: Record<string, string> = Object.fromEntries(
  PROGRAMME_ACTIVITIES.map(a => [a.id, a.label]),
);

/** Set of activity IDs that spawn a training programme when ticked. */
export const TRAINING_ACTIVITY_IDS: Set<string> = new Set(
  PROGRAMME_ACTIVITIES.filter(a => a.isTraining).map(a => a.id),
);

/**
 * "Passed X course" outcomes — surfaced only when the matching training
 * activity is ticked on the project. Each is a concrete beneficiary-level
 * result of that training.
 */
export const TRAINING_OUTCOME_LABELS: Record<string, string> = {
  english_training:            'Passed English course',
  digital_skills_training:     'Passed Digital skills course',
  customer_service_training:   'Passed Customer service course',
  health_safety_training:      'Passed Health & Safety course',
  cultural_awareness_training: 'Passed Cultural awareness course',
};

/**
 * Employability and progression outcomes surfaced for every project.
 * Concrete verb-based results — "what happened for the beneficiary".
 * Independent of which activities are ticked because a beneficiary can
 * reach any of these through many routes.
 */
export const FIXED_BENEFICIARY_OUTCOMES: { key: string; label: string }[] = [
  { key: 'got_job_offer',         label: 'Got a job offer' },
  { key: 'got_placement',         label: 'Got placement' },
  { key: 'started_job',           label: 'Started a job' },
  { key: 'started_vocational',    label: 'Started vocational training' },
  { key: 'started_further_ed',    label: 'Started further education' },
  { key: 'started_apprenticeship', label: 'Started apprenticeship' },
  { key: 'retained_6mo',          label: 'Retained in job (6 months+)' },
  { key: 'retained_12mo',         label: 'Retained in job (12 months+)' },
  { key: 'promoted',              label: 'Promoted / moved to a better role' },
];

/**
 * Build the outcome tick-list for a project. Includes:
 *   1. "Passed X course" outcomes for each ticked training activity
 *   2. The fixed employability/progression outcomes
 *   3. An 'other' bucket for unexpected outcomes
 */
export function outcomesForActivities(activityIds: string[]): { key: string; label: string }[] {
  const list: { key: string; label: string }[] = [];
  for (const id of activityIds) {
    const label = TRAINING_OUTCOME_LABELS[id];
    if (label) list.push({ key: id, label });
  }
  list.push(...FIXED_BENEFICIARY_OUTCOMES);
  list.push({ key: 'other', label: 'Other outcome (specify in notes)' });
  return list;
}

/** Retained for backward compatibility with the outcomes report page. */
export const ACTIVITY_OUTCOME_LABELS: Record<string, string> = TRAINING_OUTCOME_LABELS;
