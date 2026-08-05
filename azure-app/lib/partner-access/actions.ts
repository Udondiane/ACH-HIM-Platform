'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createB2BInvitation, disableGuestUser } from '@/lib/azure/graph';
import { invitePartnerUserSchema } from './schema';

export type InviteResult =
  | { ok: true; id: string; redeemUrl: string | null }
  | { ok: false; error: string };

const REDIRECT_PATH = '/partner-dashboard';

function appUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
  );
}

export async function invitePartnerUserAction(
  raw: unknown,
): Promise<InviteResult> {
  const parsed = invitePartnerUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join('; ') };
  }
  const data = parsed.data;
  const supabase = createClient();

  // 1. Insert the invitation row first (pending) so we've got an audit
  //    trail even if Graph fails.
  const { data: row, error: insertErr } = await supabase
    .from('partner_invitations')
    .insert({
      partner_id: data.partner_id,
      invited_email: data.invited_email,
      invited_display_name: data.invited_display_name || null,
      role: data.role,
      provider: data.provider,
      status: 'pending',
    } as never)
    .select('id')
    .single();

  if (insertErr || !row) {
    return { ok: false, error: insertErr?.message ?? 'Could not create invitation' };
  }
  const invitationId = (row as { id: string }).id;

  // 2. For Entra External ID OTP flow, no Graph call needed — the user
  //    self-serves at the External ID sign-in page and matches on email.
  if (data.provider === 'entra-external-id-otp') {
    revalidatePath(`/partners/${data.partner_id}`);
    return { ok: true, id: invitationId, redeemUrl: null };
  }

  // 3. For B2B guest flow, call Microsoft Graph to raise the invitation.
  try {
    const invite = await createB2BInvitation({
      invitedUserEmailAddress: data.invited_email,
      invitedUserDisplayName: data.invited_display_name || undefined,
      inviteRedirectUrl: `${appUrl()}${REDIRECT_PATH}`,
      sendInvitationMessage: data.send_message,
      customMessageBody:
        "You've been invited to access ACH's HIM Platform as a partner. " +
        'Sign in with your work Microsoft account to see your placements, ' +
        'candidate outcomes, and workforce reports.',
    });

    await supabase
      .from('partner_invitations')
      .update({
        graph_invitation_id: invite.id,
        redeem_url: invite.inviteRedeemUrl,
      } as never)
      .eq('id', invitationId);

    revalidatePath(`/partners/${data.partner_id}`);
    return { ok: true, id: invitationId, redeemUrl: invite.inviteRedeemUrl };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await supabase
      .from('partner_invitations')
      .update({ status: 'failed', last_error: msg } as never)
      .eq('id', invitationId);
    return { ok: false, error: msg };
  }
}

export async function revokePartnerInvitationAction(
  invitationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();

  // Look up which Entra guest user (if any) was created for this invitation.
  const { data: inv } = await supabase
    .from('partner_invitations')
    .select('id, partner_id, graph_invitation_id')
    .eq('id', invitationId)
    .maybeSingle();

  if (!inv) return { ok: false, error: 'Invitation not found' };
  const row = inv as { id: string; partner_id: string; graph_invitation_id: string | null };

  // Best-effort disable in Entra. Failure to reach Graph shouldn't
  // stop the DB-side revocation — surface the error but still mark
  // revoked so partners can't sign in via cached tokens.
  let disableErr: string | null = null;
  if (row.graph_invitation_id) {
    try {
      // The Graph invitation id doubles as the invitedUser id in most
      // tenants; if not, the vendor's day-one config swap handles this.
      await disableGuestUser(row.graph_invitation_id);
    } catch (e: any) {
      disableErr = e?.message ?? String(e);
    }
  }

  const { error } = await supabase
    .from('partner_invitations')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      last_error: disableErr,
    } as never)
    .eq('id', invitationId);

  if (error) return { ok: false, error: error.message };

  // Also disable any live partner_users tied to this invitation so their
  // next request loses partner scope.
  await supabase
    .from('partner_users')
    .update({ disabled_at: new Date().toISOString() } as never)
    .eq('invitation_id', invitationId);

  revalidatePath(`/partners/${row.partner_id}`);
  return { ok: true };
}

export async function resendInvitationEmailAction(
  invitationId: string,
): Promise<{ ok: true; redeemUrl: string | null } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data } = await supabase
    .from('partner_invitations')
    .select('id, partner_id, invited_email, invited_display_name, provider, role, status')
    .eq('id', invitationId)
    .maybeSingle();

  if (!data) return { ok: false, error: 'Invitation not found' };
  const inv = data as {
    id: string;
    partner_id: string;
    invited_email: string;
    invited_display_name: string | null;
    provider: 'entra-b2b' | 'entra-external-id-otp' | 'legacy-token';
    role: 'partner-admin' | 'partner-viewer';
    status: string;
  };

  if (inv.status === 'redeemed') return { ok: false, error: 'Already redeemed' };
  if (inv.status === 'revoked') return { ok: false, error: 'Invitation was revoked' };
  if (inv.provider !== 'entra-b2b') {
    return { ok: true, redeemUrl: null };
  }

  try {
    const invite = await createB2BInvitation({
      invitedUserEmailAddress: inv.invited_email,
      invitedUserDisplayName: inv.invited_display_name || undefined,
      inviteRedirectUrl: `${appUrl()}${REDIRECT_PATH}`,
      sendInvitationMessage: true,
      customMessageBody:
        'Resent invitation to ACH HIM Platform. Sign in with your work Microsoft account.',
    });
    await supabase
      .from('partner_invitations')
      .update({
        graph_invitation_id: invite.id,
        redeem_url: invite.inviteRedeemUrl,
        last_error: null,
      } as never)
      .eq('id', inv.id);
    revalidatePath(`/partners/${inv.partner_id}`);
    return { ok: true, redeemUrl: invite.inviteRedeemUrl };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}
