import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Sticky "view as partner" cookie. When ?as=<uuid> hits any partner route
  // we persist it so layout + sidebar (which can't read searchParams) can
  // resolve the current partner on every subsequent request.
  const asParam = request.nextUrl.searchParams.get('as');
  if (asParam && /^[0-9a-fA-F-]{36}$/.test(asParam)) {
    const response = await updateSession(request);
    response.cookies.set('ach_view_as', asParam, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      maxAge: 60 * 60 * 24, // 24h sticky session
    });
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
