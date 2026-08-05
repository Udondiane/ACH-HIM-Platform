import { z } from 'zod';

export const invitePartnerUserSchema = z.object({
  partner_id: z.string().uuid(),
  invited_email: z.string().email().max(320),
  invited_display_name: z.string().max(120).optional().or(z.literal('')),
  role: z.enum(['partner-admin', 'partner-viewer']).default('partner-viewer'),
  provider: z.enum(['entra-b2b', 'entra-external-id-otp']).default('entra-b2b'),
  send_message: z.boolean().optional().default(true),
});

export type InvitePartnerUserInput = z.infer<typeof invitePartnerUserSchema>;
