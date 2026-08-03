/**
 * NextAuth v5 · Microsoft Entra ID (Azure AD) provider.
 *
 * Every ACH staff member with an M365 mailbox in ACH's Entra tenant can
 * sign in — no per-user licence. This is the "unlimited users" pitch
 * that makes HIM cheaper per useful login than any per-seat SaaS.
 *
 * Env vars (set in Azure App Configuration or Key Vault):
 *   AUTH_SECRET
 *   AUTH_MICROSOFT_ENTRA_ID_ID
 *   AUTH_MICROSOFT_ENTRA_ID_SECRET
 *   AUTH_MICROSOFT_ENTRA_ID_ISSUER  https://login.microsoftonline.com/<TENANT_GUID>/v2.0
 *
 * Dev bypass: set AUTH_DISABLED=true to run without a real login (only
 * for local dev and non-prod demos). All server code that reads
 * `getUser()` gets a synthetic ACH staff user.
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

export const AUTH_DISABLED = process.env.AUTH_DISABLED === 'true';

export const authConfig: NextAuthConfig = {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) token.oid = (profile as any).oid ?? (profile as any).sub;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).id = token.oid ?? token.sub;
      return session;
    },
  },
  pages: { signIn: '/signin' },
};

export const { handlers, auth: nextAuthGetSession, signIn, signOut } = NextAuth(authConfig);

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

const DEMO_USER: CurrentUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'demo@ach.internal',
  name: 'Demo User (AUTH_DISABLED)',
};

/** Server-side helper — returns the signed-in user or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (AUTH_DISABLED) return DEMO_USER;
  const session = await nextAuthGetSession();
  if (!session?.user) return null;
  return {
    id: (session.user as any).id ?? 'unknown',
    email: session.user.email ?? '',
    name: session.user.name ?? '',
  };
}
