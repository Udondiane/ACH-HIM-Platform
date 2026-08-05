/**
 * NextAuth v5 · Microsoft Entra ID (workforce + External ID).
 *
 * Two provider tracks:
 *
 * 1. `microsoft-entra-id`  — ACH staff and partner staff whose employer
 *                            has Microsoft 365. Sign-in ends up as a
 *                            member of the ACH tenant (staff) or a B2B
 *                            guest (partner).
 *
 * 2. `entra-external-id`   — partners without Microsoft. Sign in with
 *                            email + one-time passcode against an
 *                            External ID tenant that ACH stands up
 *                            alongside the workforce tenant. Enabled
 *                            when AUTH_MICROSOFT_EXTERNAL_ID_ISSUER is
 *                            set.
 *
 * Env vars required in production:
 *   AUTH_SECRET
 *   AUTH_MICROSOFT_ENTRA_ID_ID           — App (client) ID (workforce)
 *   AUTH_MICROSOFT_ENTRA_ID_SECRET       — client secret (workforce)
 *   AUTH_MICROSOFT_ENTRA_ID_ISSUER       — https://login.microsoftonline.com/<TENANT_GUID>/v2.0
 *
 * Optional (enables External ID track):
 *   AUTH_MICROSOFT_EXTERNAL_ID_ID
 *   AUTH_MICROSOFT_EXTERNAL_ID_SECRET
 *   AUTH_MICROSOFT_EXTERNAL_ID_ISSUER    — https://<TENANT>.ciamlogin.com/<TENANT_GUID>/v2.0
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig, Provider } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { syncPartnerUserFromSignin } from '@/lib/partner-access/post-signin';

const providers: Provider[] = [
  MicrosoftEntraID({
    id: 'microsoft-entra-id',
    name: 'Microsoft (work / school)',
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
  }),
];

// External ID track — activated when configured. Same provider module,
// different issuer / clientId. Partners can sign in with any email via
// the OTP flow configured on the External ID user flow.
if (process.env.AUTH_MICROSOFT_EXTERNAL_ID_ISSUER) {
  providers.push(
    MicrosoftEntraID({
      id: 'entra-external-id',
      name: 'Email one-time code (partners)',
      clientId: process.env.AUTH_MICROSOFT_EXTERNAL_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_EXTERNAL_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_EXTERNAL_ID_ISSUER,
    }),
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, profile, account, trigger }) {
      if (profile) {
        token.oid = (profile as any).oid ?? (profile as any).sub;
        token.email = profile.email ?? token.email;
        token.name = (profile as any).name ?? token.name;
      }
      // On first sign-in (account is present), resolve partner scope.
      // Cached on the JWT so we don't hit the DB on every request.
      if ((trigger === 'signIn' || trigger === 'signUp') && token.oid) {
        try {
          const scope = await syncPartnerUserFromSignin({
            oid: String(token.oid),
            email: String(token.email ?? ''),
            displayName: token.name ? String(token.name) : undefined,
          });
          if (scope.partnerId) {
            (token as any).partnerId = scope.partnerId;
            (token as any).partnerRole = scope.role;
          }
        } catch {
          // Never block sign-in on scope resolution failure.
        }
      }
      // Retain provider for downstream awareness.
      if (account?.provider) (token as any).provider = account.provider;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.oid ?? token.sub;
        (session.user as any).partnerId = (token as any).partnerId ?? null;
        (session.user as any).partnerRole = (token as any).partnerRole ?? null;
        (session.user as any).provider = (token as any).provider ?? null;
      }
      return session;
    },
  },
  pages: { signIn: '/sign-in' },
};

export const { handlers, auth: nextAuthGetSession, signIn, signOut } = NextAuth(authConfig);
