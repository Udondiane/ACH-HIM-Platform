import type { UserRole } from '@/lib/supabase/types';

/**
 * Build-time auth bypass. OFF by default — real Supabase / Entra
 * authentication is required. Explicitly enable ONLY for local demos
 * and pilot walkthroughs by setting NEXT_PUBLIC_AUTH_DISABLED=true.
 * No auth code is removed by this flag — only short-circuited when on.
 *
 * PROD-SAFE GUARD (added after §17 codebase review): if this flag is ever
 * set true in a production build, refuse to enable it. A single env-var
 * flip in Vercel (or accidental inheritance from CI) would otherwise
 * turn the whole app into an unauthenticated service-role RPC over the
 * internet. Local + preview deployments are still allowed to bypass.
 */
const RAW_BYPASS_FLAG = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

const IS_PROD_BUILD =
  process.env.NODE_ENV === 'production' &&
  // Vercel sets VERCEL_ENV=production for the live production deployment
  // and 'preview'/'development' otherwise. Bypass is only safe on the latter.
  process.env.VERCEL_ENV !== 'preview' &&
  process.env.VERCEL_ENV !== 'development';

if (RAW_BYPASS_FLAG && IS_PROD_BUILD) {
  // Deliberately loud: this MUST not silently pass through in prod.
  // Boot fails so the deploy visibly breaks instead of quietly opening
  // the door to the DB.
  throw new Error(
    '[auth] NEXT_PUBLIC_AUTH_DISABLED=true is set in a PRODUCTION build. ' +
    'This would bypass authentication and expose the database. ' +
    'Refusing to boot. Remove the env var from the Vercel production ' +
    'environment before redeploying.',
  );
}

export const AUTH_DISABLED = RAW_BYPASS_FLAG && !IS_PROD_BUILD;

export const DEV_BYPASS_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@ach.local',
  role: 'ach_staff' as UserRole,
  partnerId: null as string | null,
  candidateId: null as string | null,
};
