import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Route by role
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
      if (role === 'candidate') return NextResponse.redirect(`${origin}/candidate-dashboard`);
    }
  } catch {
    // fall through
  }

  return NextResponse.redirect(`${origin}/`);
}
