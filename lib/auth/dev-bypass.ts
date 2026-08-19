import type { UserRole, AchTeamRole } from '@/lib/supabase/types';

/**
 * Build-time auth bypass. OFF by default — real Supabase / Entra
 * authentication is required. Explicitly enable ONLY for local demos
 * and pilot walkthroughs by setting NEXT_PUBLIC_AUTH_DISABLED=true.
 * No auth code is removed by this flag — only short-circuited when on.
 *
 * Pre-2026-08 default was reversed (bypass ON by default) to simplify
 * pilot demos. Corrected to secure-by-default per §17 hardening — a
 * missing or misconfigured env var must NEVER open the app to the world.
 */
export const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

/**
 * Synthetic user returned when AUTH_DISABLED is true.
 *
 * `teamRole` is intentionally null → the capability helpers treat
 * that as full-access ach_staff, so pilot demos and training-session
 * walkthroughs can see every surface without needing real user rows.
 */
export const DEV_BYPASS_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@ach.local',
  role: 'ach_staff' as UserRole,
  teamRole: null as AchTeamRole | null,
  partnerId: null as string | null,
  candidateId: null as string | null,
};
