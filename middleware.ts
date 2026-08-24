import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';
import { createClient } from '@/lib/supabase/server';

/**
 * Sticky "view as partner" cookie. When ?as=<uuid> hits any partner
 * route we persist it so layout + sidebar (which can't read
 * searchParams) can resolve the current partner on every subsequent
 * request.
 *
 * Hardened after §17 review:
 *   - Only ach_staff can set this cookie. Historically anyone could
 *     hit any URL with ?as=<uuid> and set the cookie — the read side
 *     (resolveCurrentPartner) checks role, but a future oversight of
 *     that guard would silently open partner-impersonation.
 *   - httpOnly: true so client-side JS can't read the cookie either
 *     (only the middleware / server code needs it).
 */
export async function middleware(request: NextRequest) {
  const asParam = request.nextUrl.searchParams.get('as');
  if (asParam && /^[0-9a-fA-F-]{36}$/.test(asParam)) {
    const response = await updateSession(request);

    // Only set the impersonation cookie for ach_staff users. Anyone
    // else appending ?as=<uuid> silently gets nothing set.
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: role } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        const isStaff = (role as { role?: string } | null)?.role === 'ach_staff';
        if (isStaff) {
          response.cookies.set('ach_view_as', asParam, {
            path: '/',
            sameSite: 'lax',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24, // 24h sticky session
          });
        }
      }
    } catch {
      // If auth lookup fails, don't set the cookie. Fail closed.
    }
    return response;
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next internals)
     * - favicon, robots, image files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
