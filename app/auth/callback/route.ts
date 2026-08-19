import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const flow = searchParams.get('flow'); // 'reset' | 'invite' | null

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  // Route: password-reset flow lands on /reset-password (user is now
  // signed in via the reset token, needs to set a new password).
  if (flow === 'reset') {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  // Route: first-time invitee still needs to set a password.
  const meta = user.user_metadata as { needs_password_setup?: boolean };
  if (meta?.needs_password_setup) {
    return NextResponse.redirect(`${origin}/set-password`);
  }

  // Route by role for regular sign-ins.
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    const role = (data as { role?: string } | null)?.role;
    if (role === 'ach_staff') return NextResponse.redirect(`${origin}/dashboard`);
    if (role === 'partner')   return NextResponse.redirect(`${origin}/partner-dashboard`);
  } catch {
    // fall through
  }

  return NextResponse.redirect(`${origin}/`);
}
