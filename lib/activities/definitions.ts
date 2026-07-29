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
