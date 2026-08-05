/**
 * Post-signin sync: when an invited partner user signs in for the first
 * time (or on every subsequent sign-in) we upsert them into
 * `partner_users` so RLS + the app can resolve their partner_id from
 * their Entra oid alone.
 *
 * Called from the NextAuth `jwt` callback (see lib/azure/entra.ts).
 */

import { createServiceClient } from '@/lib/supabase/server';

interface SigninProfile {
  oid: string;
  email: string;
  displayName?: string;
}

export async function syncPartnerUserFromSignin(profile: SigninProfile): Promise<{
  partnerId: string | null;
  role: string | null;
}> {
  if (!profile.email) return { partnerId: null, role: null };
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const emailLower = profile.email.toLowerCase();

  // 1. Is this user already in partner_users?
  const { data: existing } = await supabase
    .from('partner_users')
    .select('id, partner_id, role, disabled_at')
    .eq('entra_oid', profile.oid)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; partner_id: string; role: string; disabled_at: string | null };
    if (row.disabled_at) return { partnerId: null, role: null };
    await supabase
      .from('partner_users')
      .update({ last_signed_in_at: now, email: profile.email } as never)
      .eq('id', row.id);
    return { partnerId: row.partner_id, role: row.role };
  }

  // 2. First sign-in: look up a pending invitation by email.
  const { data: inv } = await supabase
    .from('partner_invitations')
    .select('id, partner_id, role, status')
    .ilike('invited_email', emailLower)
    .eq('status', 'pending')
    .order('invited_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!inv) return { partnerId: null, role: null };
  const invitation = inv as { id: string; partner_id: string; role: string; status: string };

  // 3. Redeem + create partner_users row atomically-ish.
  const { data: created, error: createErr } = await supabase
    .from('partner_users')
    .insert({
      partner_id: invitation.partner_id,
      entra_oid: profile.oid,
      email: profile.email,
      display_name: profile.displayName ?? null,
      role: invitation.role,
      invitation_id: invitation.id,
      first_signed_in_at: now,
      last_signed_in_at: now,
    } as never)
    .select('id')
    .single();

  if (createErr) {
    // Fall through — user still signs in, just without partner scope.
    return { partnerId: null, role: null };
  }
  void created; // referenced for future audit chain

  await supabase
    .from('partner_invitations')
    .update({ status: 'redeemed', redeemed_at: now } as never)
    .eq('id', invitation.id);

  return { partnerId: invitation.partner_id, role: invitation.role };
}
