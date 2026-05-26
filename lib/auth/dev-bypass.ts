import type { UserRole } from '@/lib/supabase/types';

/**
 * Build-time auth bypass. ON by default — every request renders as the
 * synthetic ACH-staff user below, no Supabase session required. To turn
 * the magic-link sign-in flow back on, set NEXT_PUBLIC_AUTH_DISABLED=false
 * in .env.local (or in Vercel Project → Environment Variables). No auth
 * code is removed — only short-circuited.
 */
export const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED !== 'false';

export const DEV_BYPASS_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@ach.local',
  role: 'ach_staff' as UserRole,
  partnerId: null as string | null,
  candidateId: null as string | null,
};
