import { z } from 'zod';

export const INTERVIEW_KINDS = ['ach_selection', 'partner_interview', 'follow_up'] as const;
export type InterviewKind = typeof INTERVIEW_KINDS[number];

export const INTERVIEW_KIND_LABELS: Record<InterviewKind, string> = {
  ach_selection:     'ACH selection interview',
  partner_interview: 'Partner interview',
  follow_up:         'Follow-up',
};

export const INTERVIEW_OUTCOMES = ['pending', 'proceed', 'hold', 'reject', 'no_show'] as const;
export type InterviewOutcome = typeof INTERVIEW_OUTCOMES[number];

export const INTERVIEW_OUTCOME_LABELS: Record<InterviewOutcome, string> = {
  pending:  'Pending decision',
  proceed:  'Proceed',
  hold:     'Hold for review',
  reject:   'Do not proceed',
  no_show:  'No show',
};

export const JOURNEY_STAGES = [
  'eoi_received',
  'shortlisted',
  'ach_interview_done',
  'partner_interview_done',
  'training',
  'placement',
  'hired',
  'progressed_other',
  'not_hired',
  'withdrawn',
] as const;

export const JOURNEY_STAGE_LABELS: Record<typeof JOURNEY_STAGES[number], string> = {
  eoi_received:           'EOI received',
  shortlisted:            'Shortlisted',
  ach_interview_done:     'ACH interview done',
  partner_interview_done: 'Partner interview done',
  training:               'In training',
  placement:              'On placement',
  hired:                  'Hired',
  progressed_other:       'Progressed elsewhere',
  not_hired:              'Not hired',
  withdrawn:              'Withdrawn',
};

export const interviewSchema = z.object({
  candidate_id:      z.string().uuid(),
  cohort_id:         z.string().uuid().optional().or(z.literal('')),
  partner_id:        z.string().uuid().optional().or(z.literal('')),
  kind:              z.enum(INTERVIEW_KINDS),
  scheduled_for:     z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().or(z.literal('')),
  conducted_on:      z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().or(z.literal('')),
  interviewer_name:  z.string().trim().max(200).optional().or(z.literal('')),
  interviewer_role:  z.string().trim().max(200).optional().or(z.literal('')),
  outcome:           z.enum(INTERVIEW_OUTCOMES).default('pending'),
  fit_score:         z.coerce.number().int().min(1).max(5).optional().or(z.literal('')),
  strengths:         z.string().trim().max(4000).optional().or(z.literal('')),
  development_areas: z.string().trim().max(4000).optional().or(z.literal('')),
  general_feedback:  z.string().trim().max(4000).optional().or(z.literal('')),
  notes_internal:    z.string().trim().max(4000).optional().or(z.literal('')),
});

export type InterviewInput = z.infer<typeof interviewSchema>;
