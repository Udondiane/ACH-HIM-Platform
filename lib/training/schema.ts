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
  notes:              z.string().trim().max(2000).optional().or(z.literal('')),
});

export type TrainingInput = z.infer<typeof trainingSchema>;
