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

const dateOrEmpty = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().or(z.literal(''));

export const cohortSchema = z.object({
  cohort_ref:      z.string().trim().min(1, 'Reference required').max(60),
  name:            z.string().trim().min(1, 'Name required').max(200),
  structure:       z.enum(COHORT_STRUCTURES),
  status:          z.enum(COHORT_STATUSES).default('planned'),
  location:        z.string().trim().max(120).optional().or(z.literal('')),
  sector_focus:    z.string().trim().max(200).optional().or(z.literal('')),
  start_date:      dateOrEmpty,
  end_date:        dateOrEmpty,
  programme_weeks: z.coerce.number().int().min(0).max(104).optional().or(z.literal('')),
  target_size:     z.coerce.number().int().min(0).max(200).optional().or(z.literal('')),
  delivery_cost:   z.coerce.number().min(0).max(1_000_000).optional().or(z.literal('')),
  notes:           z.string().trim().max(4000).optional().or(z.literal('')),
});

export type CohortInput = z.infer<typeof cohortSchema>;
