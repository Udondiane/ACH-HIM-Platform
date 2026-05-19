import { z } from 'zod';

export const PARTNER_TYPES = ['capability_investor', 'workforce_partner', 'training_partner'] as const;
export const PARTNER_STATUSES = ['prospect', 'active', 'paused', 'closed'] as const;

export const PARTNER_TYPE_LABELS: Record<typeof PARTNER_TYPES[number], string> = {
  capability_investor: 'Capability Investor',
  workforce_partner:   'Workforce Partner',
  training_partner:    'Training Partner',
};

export const PARTNER_STATUS_LABELS: Record<typeof PARTNER_STATUSES[number], string> = {
  prospect: 'Prospect',
  active:   'Active',
  paused:   'Paused',
  closed:   'Closed',
};

export const partnerSchema = z.object({
  name: z.string().trim().min(1, 'Name required').max(200),
  type: z.enum(PARTNER_TYPES),
  status: z.enum(PARTNER_STATUSES).default('prospect'),
  sector: z.string().trim().max(120).optional().or(z.literal('')),
  region: z.string().trim().max(120).optional().or(z.literal('')),
  website: z.string().trim().max(300).optional().or(z.literal('')),
  employee_count: z.coerce.number().int().min(0).max(2_000_000).optional().or(z.literal('')),
  notes: z.string().trim().max(4000).optional().or(z.literal('')),
  consent_public_listing: z.coerce.boolean().default(false),
});

export type PartnerInput = z.infer<typeof partnerSchema>;
