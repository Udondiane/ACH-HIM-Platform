/**
 * Auth adapter matching Supabase's client.auth surface. HIM only uses
 * .getUser() and .getSession() — everything else stubs a "not supported
 * under Entra" error so any stray call surfaces loudly instead of
 * silently succeeding.
 *
 * Backing implementation: NextAuth v5 · Microsoft Entra ID provider.
 * When AUTH_DISABLED=true a synthetic demo user is returned so demos
 * and local dev work without hitting a real M365 login.
 */

import { AUTH_DISABLED } from '@/lib/auth/dev-bypass';

interface UserRecord {
  id: string;
  email: string;
  role?: string;
  aud?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

const DEMO_USER: UserRecord = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'demo@ach.internal',
  role: 'authenticated',
  aud: 'authenticated',
  app_metadata: { provider: 'demo' },
  user_metadata: { name: 'Demo User (AUTH_DISABLED)' },
};

async function nextAuthSession() {
  // Lazy import so pages that never touch auth don't drag NextAuth into
  // the bundle. NextAuth is instantiated in lib/entra.ts.
  const { nextAuthGetSession } = await import('./entra');
  return nextAuthGetSession();
}

export const authApi = {
  async getUser() {
    if (AUTH_DISABLED) return { data: { user: DEMO_USER }, error: null };
    try {
      const session = await nextAuthSession();
      if (!session?.user) return { data: { user: null }, error: null };
      const u: UserRecord = {
        id: (session.user as any).id ?? (session.user as any).oid ?? 'unknown',
        email: session.user.email ?? '',
        role: 'authenticated',
        aud: 'authenticated',
        app_metadata: { provider: 'entra' },
        user_metadata: { name: session.user.name },
      };
      return { data: { user: u }, error: null };
    } catch (e: any) {
      return { data: { user: null }, error: { message: e?.message ?? String(e) } };
    }
  },
  async getSession() {
    const { data, error } = await this.getUser();
    if (!data.user) return { data: { session: null }, error };
    return { data: { session: { user: data.user, access_token: 'entra-managed' } }, error: null };
  },
  async signInWithPassword() {
    return { data: null, error: { message: 'Password sign-in is not supported under Entra ID. Use /api/auth/signin.' } };
  },
  async signInWithOAuth() {
    return { data: null, error: { message: 'Use /api/auth/signin?provider=microsoft-entra-id instead.' } };
  },
  async signOut() {
    return { error: null };
  },
  onAuthStateChange() {
    // NextAuth handles session in cookie/JWT — client components use the
    // `useSession()` hook rather than this listener. Return a no-op
    // unsubscribe so any stray caller doesn't crash.
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};
