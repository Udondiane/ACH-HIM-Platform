/**
 * API-route auth helpers.
 *
 * `requireUser()` in `lib/supabase/auth.ts` is designed for RSC / server
 * components — it `redirect()`s on failure. That's the wrong response
 * shape for API routes, which should return a JSON 401 instead. These
 * helpers mirror the same logic but return NextResponse errors.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/supabase/types';
import { AUTH_DISABLED, DEV_BYPASS_USER } from '@/lib/auth/dev-bypass';

export type ApiSessionUser = {
  id: string;
  email: string | null;
  role: UserRole;
  partnerId: string | null;
  candidateId: string | null;
};

export type ApiAuthResult =
  | { ok: true; user: ApiSessionUser }
  | { ok: false; response: NextResponse };

/**
 * Verify the caller is signed in and (optionally) has one of the given roles.
 * Returns either a resolved user or a ready-to-return JSON error response.
 *
 * Usage inside an API route:
 *
 *   const auth = await requireApiUser(['ach_staff']);
 *   if (!auth.ok) return auth.response;
 *   const user = auth.user;
 */
export async function requireApiUser(allowedRoles?: UserRole[]): Promise<ApiAuthResult> {
  if (AUTH_DISABLED) {
    return { ok: true, user: { ...DEV_BYPASS_USER } };
  }

  const supabase = createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Unauthorised — sign in required.' },
        { status: 401 },
      ),
    };
  }

  const { data: roleData, error: roleErr } = await supabase
    .from('user_roles')
    .select('role, partner_id, candidate_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (roleErr) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Role lookup failed.' },
        { status: 500 },
      ),
    };
  }
  const roleRow = roleData as {
    role: UserRole;
    partner_id: string | null;
    candidate_id: string | null;
  } | null;
  if (!roleRow) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Account has no assigned role. Ask an ICT admin.' },
        { status: 403 },
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(roleRow.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Forbidden — insufficient role.' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email ?? null,
      role: roleRow.role,
      partnerId: roleRow.partner_id,
      candidateId: roleRow.candidate_id,
    },
  };
}
