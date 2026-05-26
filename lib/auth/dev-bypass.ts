import type { UserRole } from '@/lib/supabase/types';

/**
 * Build-time auth bypass. Set NEXT_PUBLIC_AUTH_DISABLED=true in .env.local to
 * skip every login/role check and render every page as the synthetic ACH-staff
 * user below. Unset (or set to anything other than "true") to restore the
 * normal magic-link sign-in flow. No auth code is removed — only short-circuited.
 */
export const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

export const DEV_BYPASS_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@ach.local',
  role: 'ach_staff' as UserRole,
  partnerId: null as string | null,
  candidateId: null as string | null,
};
