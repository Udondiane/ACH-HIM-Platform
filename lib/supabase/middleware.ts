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

  // Public routes
  const isPublic =
    path === '/' ||
    path.startsWith('/sign-in') ||
    path.startsWith('/api/public') ||
    path.startsWith('/_next') ||
    path.includes('.');

  if (!user && !isPublic) {
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  return response;
}
