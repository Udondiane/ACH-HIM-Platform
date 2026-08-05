'use client';

import { useState, useTransition } from 'react';
import { Copy, Check, UserPlus, Ban, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  invitePartnerUserAction,
  revokePartnerInvitationAction,
  resendInvitationEmailAction,
} from '@/lib/partner-access/actions';

interface InvitationRow {
  id: string;
  invited_email: string;
  invited_display_name: string | null;
  role: 'partner-admin' | 'partner-viewer';
  provider: 'entra-b2b' | 'entra-external-id-otp' | 'legacy-token';
  status: 'pending' | 'redeemed' | 'revoked' | 'failed';
  invited_at: string;
  redeemed_at: string | null;
  redeem_url: string | null;
  last_error: string | null;
}

interface Props {
  partnerId: string;
  initial: InvitationRow[];
  externalIdEnabled: boolean;
}

export function PartnerInvitations({ partnerId, initial, externalIdEnabled }: Props) {
  const [rows, setRows] = useState<InvitationRow[]>(initial);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'partner-admin' | 'partner-viewer'>('partner-viewer');
  const [provider, setProvider] = useState<'entra-b2b' | 'entra-external-id-otp'>('entra-b2b');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const invite = () => {
    setError(null);
    startTransition(async () => {
      const res = await invitePartnerUserAction({
        partner_id: partnerId,
        invited_email: email.trim(),
        invited_display_name: name.trim() || undefined,
        role,
        provider,
        send_message: true,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEmail('');
      setName('');
      // Optimistic: add a pending row; server truth arrives on next revalidate.
      setRows((prev) => [
        {
          id: res.id,
          invited_email: email.trim(),
          invited_display_name: name.trim() || null,
          role,
          provider,
          status: 'pending',
          invited_at: new Date().toISOString(),
          redeemed_at: null,
          redeem_url: res.redeemUrl,
          last_error: null,
        },
        ...prev,
      ]);
    });
  };

  const revoke = (id: string) => {
    if (!confirm('Revoke this invitation? The partner user will lose access on their next request.')) return;
    startTransition(async () => {
      const res = await revokePartnerInvitationAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'revoked' as const } : r)),
      );
    });
  };

  const resend = (id: string) => {
    startTransition(async () => {
      const res = await resendInvitationEmailAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.redeemUrl) {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, redeem_url: res.redeemUrl, last_error: null } : r)),
        );
      }
    });
  };

  const copy = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-ach-navy">Invite partner staff</h3>
        <p className="text-xs text-ach-navy/60 mt-0.5">
          Each partner staff member gets their own sign-in — either via their work
          Microsoft account (B2B) or via email one-time code (External ID).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="sarah.jones@ikea.com"
          className="rounded border border-ach-navy/20 px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name (optional)"
          className="rounded border border-ach-navy/20 px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          className="rounded border border-ach-navy/20 px-3 py-2 text-sm"
        >
          <option value="partner-viewer">Partner viewer</option>
          <option value="partner-admin">Partner admin (can invite colleagues)</option>
        </select>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as any)}
          className="rounded border border-ach-navy/20 px-3 py-2 text-sm"
        >
          <option value="entra-b2b">Microsoft work account (B2B)</option>
          <option value="entra-external-id-otp" disabled={!externalIdEnabled}>
            Email one-time code (External ID)
            {externalIdEnabled ? '' : ' — not configured'}
          </option>
        </select>
      </div>

      <Button
        variant="primary"
        onClick={invite}
        disabled={pending || !email}
      >
        <UserPlus className="w-4 h-4 mr-1.5" />
        Send invitation
      </Button>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="border-t border-ach-navy/10 pt-4">
        <h3 className="text-sm font-medium text-ach-navy mb-2">Current invitations</h3>
        {rows.length === 0 ? (
          <p className="text-xs text-ach-navy/60">No partner staff invited yet.</p>
        ) : (
          <div className="divide-y divide-ach-navy/10 border border-ach-navy/10 rounded">
            {rows.map((r) => (
              <div key={r.id} className="p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-ach-navy">
                      {r.invited_display_name || r.invited_email}
                    </span>
                    <StatusBadge status={r.status} />
                    <RoleBadge role={r.role} />
                    <ProviderBadge provider={r.provider} />
                  </div>
                  <div className="text-xs text-ach-navy/60 mt-0.5">
                    {r.invited_display_name ? r.invited_email + ' • ' : ''}
                    invited {new Date(r.invited_at).toLocaleDateString()}
                    {r.redeemed_at ? ` • redeemed ${new Date(r.redeemed_at).toLocaleDateString()}` : ''}
                  </div>
                  {r.last_error && (
                    <div className="text-[11px] text-red-700 mt-1">{r.last_error}</div>
                  )}
                  {r.redeem_url && r.status === 'pending' && (
                    <button
                      className="text-[11px] text-ach-navy/70 hover:text-ach-navy mt-1 inline-flex items-center gap-1"
                      onClick={() => copy(r.redeem_url!, r.id)}
                    >
                      {copied === r.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === r.id ? 'Copied' : 'Copy redeem link'}
                    </button>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {r.status === 'pending' && r.provider === 'entra-b2b' && (
                    <Button
                      variant="ghost"
                      onClick={() => resend(r.id)}
                      disabled={pending}
                      title="Resend invitation email"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  )}
                  {(r.status === 'pending' || r.status === 'redeemed') && (
                    <Button
                      variant="ghost"
                      onClick={() => revoke(r.id)}
                      disabled={pending}
                      title="Revoke access"
                    >
                      <Ban className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: InvitationRow['status'] }) {
  const map = {
    pending: 'bg-amber-100 text-amber-800',
    redeemed: 'bg-emerald-100 text-emerald-800',
    revoked: 'bg-ach-navy/10 text-ach-navy/60',
    failed: 'bg-red-100 text-red-800',
  } as const;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${map[status]}`}>{status}</span>;
}

function RoleBadge({ role }: { role: InvitationRow['role'] }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-ach-navy/5 text-ach-navy/70">
      {role === 'partner-admin' ? 'admin' : 'viewer'}
    </span>
  );
}

function ProviderBadge({ provider }: { provider: InvitationRow['provider'] }) {
  const label = {
    'entra-b2b': 'Microsoft',
    'entra-external-id-otp': 'Email OTP',
    'legacy-token': 'Legacy token',
  }[provider];
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border border-ach-navy/15 text-ach-navy/60">
      {label}
    </span>
  );
}
