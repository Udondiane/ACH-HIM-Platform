import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';
import { AUTH_DISABLED } from '@/lib/auth/dev-bypass';

export function createClient() {
  // When the auth bypass is on AND the service-role key is available,
  // use it so every read/write bypasses RLS — the synthetic user is
  // treated as ACH-staff at the app layer, so the DB layer needs to
  // match. Without this, RLS policies (is_ach_staff(), current_partner_id())
  // would silently filter every query to empty.
  if (AUTH_DISABLED && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return []; },
          setAll() { /* noop */ },
        },
      },
    );
  }

  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware will refresh the session.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Use only in server-side admin paths
 * (e.g. seed scripts, post-signup role assignment, internal jobs).
 * Bypasses RLS — never expose to the browser.
 */
export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() { /* noop */ },
      },
    },
  );
}
