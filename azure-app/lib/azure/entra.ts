/**
 * NextAuth v5 · Microsoft Entra ID.
 *
 * Env vars required in production:
 *   AUTH_SECRET
 *   AUTH_MICROSOFT_ENTRA_ID_ID       — Application (client) ID
 *   AUTH_MICROSOFT_ENTRA_ID_SECRET   — client secret from App Registration
 *   AUTH_MICROSOFT_ENTRA_ID_ISSUER   — https://login.microsoftonline.com/<TENANT_GUID>/v2.0
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

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
  pages: { signIn: '/sign-in' },
};

export const { handlers, auth: nextAuthGetSession, signIn, signOut } = NextAuth(authConfig);
