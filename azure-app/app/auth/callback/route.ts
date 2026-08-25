import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Post-authentication router.
 *
 * On Azure the OAuth callback itself is handled by NextAuth at
 * /api/auth/callback/microsoft-entra-id (see lib/azure/entra.ts). This
 * route survives only as a post-signin *router* — after NextAuth has
 * established the session, we redirect the user to the surface that
 * matches their role.
 *
 * The Supabase-era `supabase.auth.exchangeCodeForSession(code)` call
 * that used to live here is removed: it does not exist on the Azure
 * auth adapter (the code exchange happens inside NextAuth before this
 * route ever runs), and calling it would crash the callback.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      const role = (data as { role?: string } | null)?.role;
      if (role === 'ach_staff') return NextResponse.redirect(`${origin}/dashboard`);
      if (role === 'partner')   return NextResponse.redirect(`${origin}/partner-dashboard`);
    }
  } catch {
    // Fall through to home if role lookup fails — auth itself is not
    // in doubt here (NextAuth has already signed the user in), just
    // the role routing.
  }

  return NextResponse.redirect(`${origin}/`);
}
