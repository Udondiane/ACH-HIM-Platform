/**
 * Microsoft Graph client (application-permission, client-credentials).
 *
 * Used to raise Entra B2B guest invitations from server actions. This
 * DOES NOT act as a user — it's the HIM Platform itself calling Graph
 * with its own app identity. The app registration in Entra must have
 * the `User.Invite.All` application permission granted with admin
 * consent by the ACH tenant admin.
 *
 * Env vars:
 *   AUTH_MICROSOFT_ENTRA_ID_ID       — same App Registration client ID
 *   AUTH_MICROSOFT_ENTRA_ID_SECRET   — same client secret
 *   AZURE_TENANT_ID                  — ACH's Entra tenant GUID
 *
 * If any of these are missing the client throws on first use with a
 * descriptive error so misconfigurations surface loudly.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_TTL_MS = 55 * 60 * 1000; // refresh 5 min before expiry

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getGraphAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      '[graph] Missing AZURE_TENANT_ID / AUTH_MICROSOFT_ENTRA_ID_ID / AUTH_MICROSOFT_ENTRA_ID_SECRET. ' +
      'Cannot mint Graph token — B2B invitations will fail until Entra app registration is configured.',
    );
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>');
    throw new Error(`[graph] Token request failed ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: now + Math.min(TOKEN_TTL_MS, json.expires_in * 1000 - 60_000),
  };
  return json.access_token;
}

export interface CreateInvitationInput {
  invitedUserEmailAddress: string;
  invitedUserDisplayName?: string;
  inviteRedirectUrl: string;      // where the invitee lands after redemption
  sendInvitationMessage?: boolean;
  customMessageBody?: string;
}

export interface CreateInvitationResult {
  id: string;                     // Graph invitation id
  inviteRedeemUrl: string;
  invitedUser?: { id: string };
  status: string;                 // "PendingAcceptance" | ...
}

/**
 * Create a B2B invitation. Returns the redeem URL — this is what gets
 * emailed to the invitee (either by Graph if sendInvitationMessage=true
 * or by our own mail flow if we want branded copy).
 */
export async function createB2BInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const token = await getGraphAccessToken();

  const body = {
    invitedUserEmailAddress: input.invitedUserEmailAddress,
    invitedUserDisplayName: input.invitedUserDisplayName,
    inviteRedirectUrl: input.inviteRedirectUrl,
    sendInvitationMessage: input.sendInvitationMessage ?? true,
    invitedUserMessageInfo: input.customMessageBody
      ? { customizedMessageBody: input.customMessageBody }
      : undefined,
  };

  const res = await fetch(`${GRAPH_BASE}/invitations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>');
    throw new Error(`[graph] createB2BInvitation failed ${res.status}: ${text}`);
  }

  return (await res.json()) as CreateInvitationResult;
}

/**
 * Best-effort revocation: disable the guest user in the ACH directory.
 * Graph does not provide "cancel invitation" for pending ones — the
 * recommended pattern is to disable the guest user object once created.
 */
export async function disableGuestUser(userId: string): Promise<void> {
  const token = await getGraphAccessToken();
  const res = await fetch(`${GRAPH_BASE}/users/${userId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accountEnabled: false }),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '<no body>');
    throw new Error(`[graph] disableGuestUser failed ${res.status}: ${text}`);
  }
}
