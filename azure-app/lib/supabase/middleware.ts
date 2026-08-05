/**
 * No-op session refresher under the Entra ID rewire.
 *
 * NextAuth handles session refresh through its own /api/auth/* routes,
 * so the old Supabase pattern of refreshing on every request is
 * unnecessary. This file is kept only so any lingering
 * `import { updateSession } from '@/lib/supabase/middleware'` resolves.
 */

import { NextResponse, type NextRequest } from 'next/server';

export function updateSession(_request: NextRequest) {
  return NextResponse.next();
}
