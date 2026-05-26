import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/supabase/types';
import { AUTH_DISABLED, DEV_BYPASS_USER } from '@/lib/auth/dev-bypass';

export type SessionUser = {
  id: string;
  email: string | null;
  role: UserRole;
  partnerId: string | null;
  candidateId: string | null;
};

/**
 * Resolves the current user + their role row.
 * Redirects to /sign-in if unauthenticated.
 * If `allowedRoles` is provided and the user's role is not in it, redirects
 * to that role's home.
 */
export async function requireUser(allowedRoles?: UserRole[]): Promise<SessionUser> {
  // Build-time bypass: return synthetic ACH-staff user without touching Supabase.
  if (AUTH_DISABLED) return { ...DEV_BYPASS_USER };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role, partner_id, candidate_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const roleRow = roleData as {
    role: UserRole;
    partner_id: string | null;
    candidate_id: string | null;
  } | null;

  if (!roleRow) {
    // Signed in but no role row → log out / show pending state.
    redirect('/sign-in?pending=true');
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email ?? null,
    role: roleRow.role,
    partnerId: roleRow.partner_id,
    candidateId: roleRow.candidate_id,
  };

  if (allowedRoles && !allowedRoles.includes(sessionUser.role)) {
    if (sessionUser.role === 'ach_staff') redirect('/dashboard');
    if (sessionUser.role === 'partner')   redirect('/partner-dashboard');
    if (sessionUser.role === 'candidate') redirect('/candidate-dashboard');
  }

  return sessionUser;
}
