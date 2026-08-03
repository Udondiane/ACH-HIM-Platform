import { z } from 'zod';

export const SALARY_BANDS = ['volume', 'standard', 'premium'] as const;
export type SalaryBand = typeof SALARY_BANDS[number];
export const SALARY_BAND_LABELS: Record<SalaryBand, string> = {
  volume:   'Volume (£20–23k)',
  standard: 'Standard (£23–28k)',
  premium:  'Premium (£28k+)',
};

export const PLACEMENT_STATUSES = [
  'offered', 'started', 'active', 'completed_12mo',
  'left_pre_6mo', 'left_6_to_12mo', 'left_post_12mo',
] as const;
export type PlacementStatus = typeof PLACEMENT_STATUSES[number];
export const PLACEMENT_STATUS_LABELS: Record<PlacementStatus, string> = {
  offered:        'Offered',
  started:        'Started',
  active:         'Active',
  completed_12mo: 'Sustained 12 months',
  left_pre_6mo:   'Left before 6 months',
  left_6_to_12mo: 'Left between 6 and 12 months',
  left_post_12mo: 'Left after 12 months',
};

export const placementSchema = z.object({
  candidate_id:        z.string().uuid(),
  partner_id:          z.string().uuid('Pick a workforce partner.'),
  cohort_id:           z.string().uuid().optional().or(z.literal('')).or(z.literal('__none__')),
  role_title:          z.string().trim().min(1, 'Role title required').max(200),
  salary_band:         z.enum(SALARY_BANDS),
  salary_actual:       z.coerce.number().min(0).max(1_000_000).optional().or(z.literal('')),
  start_date:          z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date required'),
  status:              z.enum(PLACEMENT_STATUSES).default('started'),
  sponsored_placement: z.preprocess(v => v === 'on' || v === true || v === 'true', z.boolean()).default(true),
  notes:               z.string().trim().max(2000).optional().or(z.literal('')),
});

export type PlacementInput = z.infer<typeof placementSchema>;
