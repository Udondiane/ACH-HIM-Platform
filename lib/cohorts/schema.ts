import { z } from 'zod';

export const COHORT_STRUCTURES = ['multi_partner', 'single_partner'] as const;
export const COHORT_STRUCTURE_LABELS: Record<typeof COHORT_STRUCTURES[number], string> = {
  multi_partner:  'Multi-partner',
  single_partner: 'Single-partner',
};

export const COHORT_STATUSES = ['planned','recruiting','in_progress','completed','cancelled'] as const;
export const COHORT_STATUS_LABELS: Record<typeof COHORT_STATUSES[number], string> = {
  planned:     'Planned',
  recruiting:  'Recruiting',
  in_progress: 'In progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

export const COHORT_SERVICE_TYPES = ['full_programme', 'iag_only'] as const;
export const COHORT_SERVICE_TYPE_LABELS: Record<typeof COHORT_SERVICE_TYPES[number], string> = {
  full_programme: 'Full programme',
  iag_only:       'IAG only',
};
export const COHORT_SERVICE_TYPE_HINTS: Record<typeof COHORT_SERVICE_TYPES[number], string> = {
  full_programme: 'Standard delivery — assessments, training, placement support, follow-up.',
  iag_only:       'Information, advice and guidance only. Candidates receive support but do not enter the placement pipeline.',
};

const dateOrEmpty = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().or(z.literal(''));

export const cohortSchema = z.object({
  cohort_ref:      z.string().trim().min(1, 'Reference required').max(60),
  name:            z.string().trim().min(1, 'Name required').max(200),
  project_id:      z.string().uuid().optional().or(z.literal('')).or(z.literal('__none__')),
  structure:       z.enum(COHORT_STRUCTURES),
  service_type:    z.enum(COHORT_SERVICE_TYPES).default('full_programme'),
  status:          z.enum(COHORT_STATUSES).default('planned'),
  location:        z.string().trim().max(120).optional().or(z.literal('')),
  sector_focus:    z.string().trim().max(200).optional().or(z.literal('')),
  start_date:      dateOrEmpty,
  end_date:        dateOrEmpty,
  intervention_start_date: dateOrEmpty,
  is_rolling:      z.preprocess(v => v === 'on' || v === true || v === 'true', z.boolean()).default(false),
  programme_weeks: z.coerce.number().int().min(0).max(104).optional().or(z.literal('')),
  target_size:     z.coerce.number().int().min(0).max(200).optional().or(z.literal('')),
  delivery_cost:   z.coerce.number().min(0).max(1_000_000).optional().or(z.literal('')),
  notes:           z.string().trim().max(4000).optional().or(z.literal('')),
}).superRefine((val, ctx) => {
  // A non-rolling (cohorted) intake should anchor to a known start. Without it
  // baseline gating can't be enforced, so flag it.
  if (!val.is_rolling && !val.intervention_start_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['intervention_start_date'],
      message: 'Required for cohorted intakes. Tick "Rolling enrolment" if candidates start on different dates.',
    });
  }
});

export type CohortInput = z.infer<typeof cohortSchema>;
