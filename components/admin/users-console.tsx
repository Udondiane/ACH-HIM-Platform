'use client';

import { useState, useTransition } from 'react';
import { UserPlus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  inviteUserAction,
  updateTeamRoleAction,
  deactivateUserAction,
  type ActionResult,
} from '@/lib/admin/users-actions';
import {
  TEAM_ROLE_LABELS,
  TEAM_ROLE_DESCRIPTIONS,
  ALL_TEAM_ROLES,
} from '@/lib/auth/capabilities';
import type { AchTeamRole } from '@/lib/supabase/types';

type UserRow = {
  user_id: string;
  email: string | null;
  team_role: AchTeamRole | null;
  created_at: string;
  last_sign_in_at: string | null;
};

type Props = {
  users: UserRow[];
  currentUserId: string;
};

export function UsersConsole({ users, currentUserId }: Props) {
  return (
    <div className="space-y-8">
      <InviteBlock />
      <UsersTable users={users} currentUserId={currentUserId} />
    </div>
  );
}

// ------------------------------------------------------------
// Invite
// ------------------------------------------------------------

function InviteBlock() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <section>
      <h2 className="text-[16px] font-medium text-ach-navy mb-1">Invite a new user</h2>
      <p className="text-[12.5px] text-ach-navy/60 mb-4">
        The invitee receives a sign-in link by email. Their access is scoped to the team role assigned here.
      </p>

      <form
        action={fd => {
          startTransition(async () => {
            const r = await inviteUserAction(null, fd);
            setResult(r);
            if (r.ok) (document.getElementById('invite-form') as HTMLFormElement | null)?.reset();
          });
        }}
        id="invite-form"
        className="rounded-[12px] border-[0.5px] border-ach-border bg-white p-5 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3">
          <label className="block">
            <span className="mini-label block mb-2">Email address</span>
            <input
              type="email"
              name="email"
              required
              placeholder="name@ach.org.uk"
              className="w-full"
            />
          </label>

          <label className="block">
            <span className="mini-label block mb-2">Team role</span>
            <select name="team_role" required defaultValue="" className="w-full">
              <option value="" disabled>Select a team role…</option>
              {ALL_TEAM_ROLES.map(r => (
                <option key={r} value={r}>{TEAM_ROLE_LABELS[r]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11.5px] text-ach-navy/55">
            Sign-in links expire after 60 minutes. Users can request a new one at any time.
          </p>
          <button type="submit" disabled={pending} className="btn-primary">
            <UserPlus className="h-4 w-4" />
            {pending ? 'Sending…' : 'Send invitation'}
          </button>
        </div>

        {result && <ResultBanner result={result} />}
      </form>
    </section>
  );
}

// ------------------------------------------------------------
// User list
// ------------------------------------------------------------

function UsersTable({ users, currentUserId }: Props) {
  return (
    <section>
      <h2 className="text-[16px] font-medium text-ach-navy mb-1">Current users</h2>
      <p className="text-[12.5px] text-ach-navy/60 mb-4">
        {users.length} user{users.length === 1 ? '' : 's'} with access to HIM. Change a role from the dropdown; deactivate to revoke access.
      </p>

      {users.length === 0 ? (
        <div className="rounded-[12px] border-[0.5px] border-ach-border bg-white p-6 text-[13px] text-ach-navy/60">
          No users yet. Use the invite form above to add the first user.
        </div>
      ) : (
        <div className="rounded-[12px] border-[0.5px] border-ach-border bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50 border-b-[0.5px] border-ach-border">
                <th className="text-left px-5 py-3 font-medium">Email</th>
                <th className="text-left px-5 py-3 font-medium">Team role</th>
                <th className="text-left px-5 py-3 font-medium">Last sign-in</th>
                <th className="text-right px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <UserRow key={u.user_id} user={u} isSelf={u.user_id === currentUserId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function UserRow({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [rowResult, setRowResult] = useState<ActionResult | null>(null);

  return (
    <>
      <tr className="border-b-[0.5px] border-ach-border/70 last:border-b-0">
        <td className="px-5 py-3.5 text-ach-navy">
          {user.email ?? <span className="text-ach-navy/50 italic">no email on record</span>}
          {isSelf && <span className="ml-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50">You</span>}
        </td>
        <td className="px-5 py-3.5">
          <form
            action={fd => {
              startTransition(async () => {
                fd.set('user_id', user.user_id);
                const r = await updateTeamRoleAction(null, fd);
                setRowResult(r);
              });
            }}
            className="flex items-center gap-2"
          >
            <select
              name="team_role"
              defaultValue={user.team_role ?? ''}
              disabled={pending}
              className="text-[12.5px]"
              onChange={e => (e.target.form as HTMLFormElement).requestSubmit()}
            >
              {!user.team_role && <option value="" disabled>Unrestricted (legacy)</option>}
              {ALL_TEAM_ROLES.map(r => (
                <option key={r} value={r}>{TEAM_ROLE_LABELS[r]}</option>
              ))}
            </select>
          </form>
          {user.team_role && (
            <div className="text-[11px] text-ach-navy/50 mt-0.5">
              {TEAM_ROLE_DESCRIPTIONS[user.team_role]}
            </div>
          )}
        </td>
        <td className="px-5 py-3.5 text-ach-navy/70">
          {user.last_sign_in_at
            ? new Date(user.last_sign_in_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : <span className="text-ach-navy/40">Never</span>}
        </td>
        <td className="px-5 py-3.5 text-right">
          {isSelf ? (
            <span className="text-[11.5px] text-ach-navy/40">—</span>
          ) : (
            <DeactivateButton userId={user.user_id} email={user.email ?? user.user_id} setResult={setRowResult} />
          )}
        </td>
      </tr>
      {rowResult && (
        <tr>
          <td colSpan={4} className="px-5 pb-3">
            <ResultBanner result={rowResult} compact />
          </td>
        </tr>
      )}
    </>
  );
}

function DeactivateButton({
  userId, email, setResult,
}: {
  userId: string;
  email: string;
  setResult: (r: ActionResult) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const ok = window.confirm(
      `Deactivate ${email}? They will lose access immediately. This can be reversed by re-inviting the same email address.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('user_id', userId);
      const r = await deactivateUserAction(null, fd);
      setResult(r);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-[12px] text-[#8B3A4F] hover:text-[#5B2334] disabled:opacity-50"
    >
      <Trash2 className="inline h-3.5 w-3.5 mr-1" />
      {pending ? 'Deactivating…' : 'Deactivate'}
    </button>
  );
}

// ------------------------------------------------------------
// Shared result banner
// ------------------------------------------------------------

function ResultBanner({ result, compact }: { result: ActionResult; compact?: boolean }) {
  const Icon = result.ok ? CheckCircle2 : AlertCircle;
  const tone = result.ok ? 'text-ach-navy' : 'text-[#8B3A4F]';
  const bg = result.ok ? 'bg-[#E8F0EA]' : 'bg-[#F7E8EA]';
  return (
    <div className={`${bg} rounded-[8px] px-3 py-2 flex items-start gap-2 ${compact ? '' : 'mt-2'}`}>
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${tone}`} />
      <p className={`text-[12.5px] leading-relaxed ${tone}`}>
        {result.ok ? (result.message ?? 'Done.') : result.error}
      </p>
    </div>
  );
}
