import { z } from 'zod';

export const QUOTE_TRACKS = [
  'capability_investor',
  'workforce_partner',
  'training_partner',
  'direct_hirer',
] as const;

export const QUOTE_TRACK_LABELS: Record<(typeof QUOTE_TRACKS)[number], string> = {
  capability_investor: 'Capability Investor',
  workforce_partner: 'Workforce Partner',
  training_partner: 'Training Partner',
  direct_hirer: 'Direct hirer',
};

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'] as const;

export const quoteSchema = z.object({
  partner_id: z.string().uuid().optional().nullable(),
  cohort_id: z.string().uuid().optional().nullable(),
  track: z.enum(QUOTE_TRACKS),
  candidate_count: z.coerce.number().int().min(0),
  expected_hires_volume: z.coerce.number().int().min(0),
  expected_hires_standard: z.coerce.number().int().min(0),
  expected_hires_premium: z.coerce.number().int().min(0),
  retention_6mo_rate: z.coerce.number().min(0).max(1),
  retention_12mo_rate: z.coerce.number().min(0).max(1),
  tender_pack_fee: z.coerce.number().min(0),
  valid_until: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
