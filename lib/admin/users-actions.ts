'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { canManageUsers, ALL_TEAM_ROLES } from '@/lib/auth/capabilities';
import type { AchTeamRole } from '@/lib/supabase/types';

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function assertIctAdmin() {
  const user = await requireUser(['ach_staff']);
  if (!canManageUsers(user)) {
    throw new Error('User administration requires the ICT administrator team role.');
  }
  return user;
}

function isValidTeamRole(v: unknown): v is AchTeamRole {
  return typeof v === 'string' && (ALL_TEAM_ROLES as string[]).includes(v);
}

/**
 * Invite a new user by email.
 *
 * Uses Supabase Auth's admin invite: sends a sign-in link to the address
 * and creates the auth.users row. The corresponding user_roles row is
 * created immediately with the requested team_role so the user has
 * scoped access the moment they sign in.
 */
export async function inviteUserAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await assertIctAdmin();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Not authorised.' };
  }

  const email = String(fd.get('email') ?? '').trim();
  const teamRoleRaw = fd.get('team_role');

  if (!email) return { ok: false, error: 'An email address is required.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'That email address does not look valid.' };
  }
  if (!isValidTeamRole(teamRoleRaw)) {
    return { ok: false, error: 'A team role must be selected.' };
  }
  const teamRole = teamRoleRaw as AchTeamRole;

  const supabase = createServiceClient();

  // 1. Send the invite. If the user already exists in auth.users this
  //    returns an error; we handle that path below.
  const { data: inviteData, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(email);

  let userId: string | null = inviteData?.user?.id ?? null;

  if (inviteError) {
    // Common case: user already exists. Look them up so we can still
    // set their team_role.
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
      return { ok: false, error: `Could not invite ${email}: ${inviteError.message}` };
    }
    userId = existing.id;
  }

  if (!userId) {
    return { ok: false, error: 'Invite completed but no user id was returned.' };
  }

  // 2. Upsert the user_roles row. Everyone invited here is ach_staff
  //    with an assigned team_role. Partners/candidates are onboarded
  //    through their own flows (partner detail page, tokenised report).
  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert(
      {
        user_id: userId,
        role: 'ach_staff',
        team_role: teamRole,
        partner_id: null,
        candidate_id: null,
      } as never,
      { onConflict: 'user_id' },
    );

  if (roleError) {
    return { ok: false, error: `User created but role assignment failed: ${roleError.message}` };
  }

  revalidatePath('/admin/users');
  return { ok: true, message: `Invitation sent to ${email}.` };
}

/** Change an existing user's team role. */
export async function updateTeamRoleAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await assertIctAdmin();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Not authorised.' };
  }

  const userId = String(fd.get('user_id') ?? '');
  const teamRoleRaw = fd.get('team_role');

  if (!userId) return { ok: false, error: 'Missing user id.' };
  if (!isValidTeamRole(teamRoleRaw)) {
    return { ok: false, error: 'Invalid team role.' };
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('user_roles')
    .update({ team_role: teamRoleRaw as AchTeamRole } as never)
    .eq('user_id', userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/users');
  return { ok: true, message: 'Team role updated.' };
}

/**
 * Deactivate a user: removes the user_roles row (so they can no longer
 * sign in with meaningful access) and bans the auth.users record.
 *
 * We deliberately do NOT delete the auth.users row — this preserves
 * the audit trail on rows created by that user (created_by FKs remain
 * resolvable).
 */
export async function deactivateUserAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await assertIctAdmin();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Not authorised.' };
  }

  const userId = String(fd.get('user_id') ?? '');
  if (!userId) return { ok: false, error: 'Missing user id.' };

  const supabase = createServiceClient();

  const { error: roleError } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId);

  if (roleError) return { ok: false, error: `Could not remove role: ${roleError.message}` };

  // Ban the auth account so any residual session is invalidated.
  // Using a 100-year ban acts as an indefinite deactivation while
  // preserving the row for audit continuity.
  const { error: banError } =
    await supabase.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
  if (banError) {
    // Non-fatal — the role row is already gone, so the user has no
    // scoped access. Just log for ICT visibility.
    console.warn('[admin] auth ban failed (non-fatal):', banError.message);
  }

  revalidatePath('/admin/users');
  return { ok: true, message: 'User deactivated.' };
}
