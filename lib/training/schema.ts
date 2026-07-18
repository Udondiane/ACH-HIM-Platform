import { z } from 'zod';

export const COMPLETION_STATUSES = ['not_started', 'in_progress', 'completed', 'withdrew'] as const;
export type CompletionStatus = typeof COMPLETION_STATUSES[number];
export const COMPLETION_STATUS_LABELS: Record<CompletionStatus, string> = {
  not_started:  'Not started',
  in_progress:  'In progress',
  completed:    'Completed',
  withdrew:     'Withdrew',
};

export const trainingSchema = z.object({
  candidate_id:       z.string().uuid(),
  cohort_id:          z.string().uuid().optional().or(z.literal('')),
  training_name:      z.string().trim().min(1, 'Training name required').max(200),
  trainer:            z.string().trim().max(200).optional().or(z.literal('')),
  scheduled_start:    z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().or(z.literal('')),
  scheduled_end:      z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().or(z.literal('')),
  attended_sessions:  z.coerce.number().int().min(0).max(1000).optional().or(z.literal('')),
  total_sessions:     z.coerce.number().int().min(0).max(1000).optional().or(z.literal('')),
  completion_status:  z.enum(COMPLETION_STATUSES).default('not_started'),
  completion_date:    z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().or(z.literal('')),
  certificate_url:    z.string().trim().max(500).optional().or(z.literal('')),
  skills_learnt:      z.string().trim().max(2000).optional().or(z.literal('')),
  notes:              z.string().trim().max(2000).optional().or(z.literal('')),
});

export type TrainingInput = z.infer<typeof trainingSchema>;

// ============================================================
// Training subsystem (migration 043) — programmes, sessions,
// attendance, enrolments, certificates, LO ↔ HIM factor bridge.
// ============================================================

export const PROGRAMME_STATUS = ['active', 'archived', 'draft'] as const;
export const PROGRAMME_STATUS_LABELS: Record<typeof PROGRAMME_STATUS[number], string> = {
  active:   'Active',
  archived: 'Archived',
  draft:    'Draft',
};

export const SESSION_STATUS = ['scheduled', 'delivered', 'cancelled'] as const;
export const SESSION_STATUS_LABELS: Record<typeof SESSION_STATUS[number], string> = {
  scheduled: 'Scheduled',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ENROLMENT_STATUS = ['enrolled', 'completed', 'withdrawn', 'waiting_list', 'deferred'] as const;
export const ENROLMENT_STATUS_LABELS: Record<typeof ENROLMENT_STATUS[number], string> = {
  enrolled:     'Enrolled',
  completed:    'Completed',
  withdrawn:    'Withdrawn',
  waiting_list: 'Waiting list',
  deferred:     'Deferred',
};

export const ATTENDANCE_STATUS = ['present', 'absent', 'late', 'excused', 'not_marked'] as const;
export const ATTENDANCE_STATUS_LABELS: Record<typeof ATTENDANCE_STATUS[number], string> = {
  present:    'Present',
  absent:     'Absent',
  late:       'Late',
  excused:    'Excused',
  not_marked: 'Not marked',
};

export const NOTE_KIND = ['observation', 'concern', 'achievement', 'follow_up'] as const;
export const NOTE_KIND_LABELS: Record<typeof NOTE_KIND[number], string> = {
  observation: 'Observation',
  concern:     'Concern',
  achievement: 'Achievement',
  follow_up:   'Follow-up',
};

export const PROGRAMME_CATEGORIES = [
  'esol', 'employability', 'digital_skills', 'vocational', 'wellbeing', 'iag', 'other',
] as const;
export const PROGRAMME_CATEGORY_LABELS: Record<typeof PROGRAMME_CATEGORIES[number], string> = {
  esol:           'ESOL / language',
  employability:  'Employability',
  digital_skills: 'Digital skills',
  vocational:     'Vocational training',
  wellbeing:      'Wellbeing',
  iag:            'IAG / careers',
  other:          'Other',
};

export const programmeSchema = z.object({
  name:                 z.string().trim().min(1, 'Programme name required').max(200),
  code:                 z.string().trim().max(60).optional().or(z.literal('')),
  description:          z.string().trim().max(2000).optional().or(z.literal('')),
  category:             z.enum(PROGRAMME_CATEGORIES).optional().or(z.literal('')),
  duration_hours:       z.coerce.number().int().min(0).max(1000).optional(),
  total_sessions:       z.coerce.number().int().min(0).max(500).optional(),
  certificate_template: z.string().trim().max(200).optional().or(z.literal('')),
  status:               z.enum(PROGRAMME_STATUS).default('active'),
});
export type ProgrammeInput = z.infer<typeof programmeSchema>;

export const sessionSchema = z.object({
  programme_id:    z.string().uuid('Programme required'),
  cohort_id:       z.string().uuid().optional().or(z.literal('')),
  session_number:  z.coerce.number().int().min(1).max(500).optional(),
  session_title:   z.string().trim().max(200).optional().or(z.literal('')),
  scheduled_date:  z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date required'),
  scheduled_start: z.string().trim().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  scheduled_end:   z.string().trim().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  room:            z.string().trim().max(120).optional().or(z.literal('')),
  tutor_id:        z.string().uuid().optional().or(z.literal('')),
  tutor_name:      z.string().trim().max(200).optional().or(z.literal('')),
  status:          z.enum(SESSION_STATUS).default('scheduled'),
  session_notes:   z.string().trim().max(4000).optional().or(z.literal('')),
});
export type SessionInput = z.infer<typeof sessionSchema>;

export const enrolmentSchema = z.object({
  candidate_id: z.string().uuid(),
  programme_id: z.string().uuid(),
  cohort_id:    z.string().uuid().optional().or(z.literal('')),
  status:       z.enum(ENROLMENT_STATUS).default('enrolled'),
  notes:        z.string().trim().max(1000).optional().or(z.literal('')),
});
export type EnrolmentInput = z.infer<typeof enrolmentSchema>;

export interface AttendanceMark {
  candidate_id: string;
  status: typeof ATTENDANCE_STATUS[number];
  notes?: string | null;
}

export const learningOutcomeSchema = z.object({
  programme_id: z.string().uuid(),
  outcome_code: z.string().trim().max(60).optional().or(z.literal('')),
  outcome_text: z.string().trim().min(1, 'Outcome text required').max(500),
  sort_order:   z.coerce.number().int().min(0).default(0),
});
export type LearningOutcomeInput = z.infer<typeof learningOutcomeSchema>;
