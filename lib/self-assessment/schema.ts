import { z } from 'zod';

export const SELF_ASSESSMENT_TIMEPOINTS = ['mid_3mo', 'exit_6mo', 'followup_12mo'] as const;
export type SelfAssessmentTimepoint = typeof SELF_ASSESSMENT_TIMEPOINTS[number];

export const SELF_ASSESSMENT_TIMEPOINT_LABELS: Record<SelfAssessmentTimepoint, string> = {
  mid_3mo:       '3 months',
  exit_6mo:      '6 months',
  followup_12mo: '12 months',
};

export const createTokenSchema = z.object({
  candidate_id: z.string().uuid(),
  project_id:   z.string().uuid(),
  timepoint:    z.enum(SELF_ASSESSMENT_TIMEPOINTS),
});

export const factorResponseSchema = z.object({
  factor_id:    z.string(),
  score:        z.number().min(1).max(5).nullable(),
  narrative:    z.string().trim().max(2000).optional().or(z.literal('')),
});

export const submitSchema = z.object({
  token:        z.string().min(16),
  responses:    z.array(factorResponseSchema).min(1),
  reflection:   z.string().trim().max(5000).optional().or(z.literal('')),
});
