import { z } from 'zod';

export const SUPPORT_KINDS = [
  'iag_session',
  'casework_call',
  'in_person_visit',
  'referral',
  'document_help',
  'mental_health_check',
  'follow_up',
  'other',
] as const;
export type SupportKind = typeof SUPPORT_KINDS[number];
export const SUPPORT_KIND_LABELS: Record<SupportKind, string> = {
  iag_session:           'IAG session',
  casework_call:         'Casework call',
  in_person_visit:       'In-person visit',
  referral:              'Referral made',
  document_help:         'Document help',
  mental_health_check:   'Mental health check',
  follow_up:             'Follow-up contact',
  other:                 'Other',
};

export const supportSchema = z.object({
  candidate_id:   z.string().uuid(),
  kind:           z.enum(SUPPORT_KINDS),
  provided_on:    z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration_mins:  z.coerce.number().int().min(0).max(1440).optional().or(z.literal('')),
  caseworker:     z.string().trim().max(200).optional().or(z.literal('')),
  summary:        z.string().trim().min(1, 'Summary required').max(4000),
  next_action:    z.string().trim().max(2000).optional().or(z.literal('')),
  next_action_by: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().or(z.literal('')),
});

export type SupportInput = z.infer<typeof supportSchema>;
