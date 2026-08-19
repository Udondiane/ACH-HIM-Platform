import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './types';
import { AUTH_DISABLED } from '@/lib/auth/dev-bypass';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Build-time bypass: skip auth gate entirely. See lib/auth/dev-bypass.ts.
  if (AUTH_DISABLED) return response;

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not write any logic between createServerClient and getUser.
  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Public routes. Kept explicit rather than sniffing for a dot in the
  // path — the old `path.includes('.')` check let `/candidates/foo.bar`
  // skip the gate. Static asset paths are excluded via the matcher below.
  const isPublic =
    path === '/' ||
    path.startsWith('/sign-in') ||
    path.startsWith('/auth/callback') ||   // Supabase OTP code exchange
    path.startsWith('/report/') ||         // tokenised partner report surface
    path.startsWith('/api/public') ||
    path.startsWith('/api/cron') ||        // guarded by CRON_SECRET inside
    path.startsWith('/api/health') ||      // health endpoint for uptime checks
    path.startsWith('/_next');

  if (!user && !isPublic) {
    url.pathname = '/sign-in';
    // Preserve the destination so sign-in can bounce back to it.
    if (path.startsWith('/') && !path.startsWith('//')) {
      url.searchParams.set('next', path);
    } else {
      url.search = '';
    }
    return NextResponse.redirect(url);
  }

  return response;
}
