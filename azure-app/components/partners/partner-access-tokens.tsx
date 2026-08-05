'use client';

import { useState, useTransition } from 'react';
import { Copy, Check, KeyRound, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generatePartnerAccessTokenAction, revokePartnerAccessTokenAction } from '@/lib/partner-timepoints/actions';

interface TokenRow {
  id: string;
  token: string;
  label: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

interface Props {
  partnerId: string;
  initialTokens: TokenRow[];
  originHref: string;
}

export function PartnerAccessTokens({ partnerId, initialTokens, originHref }: Props) {
  const [tokens, setTokens] = useState<TokenRow[]>(initialTokens);
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    setError(null);
    setFreshToken(null);
    startTransition(async () => {
      const res = await generatePartnerAccessTokenAction({
        partnerId,
        label: label || null,
        expiresAt: expiresAt || null,
      });
      if (!res.ok) { setError(res.error); return; }
      setFreshToken(res.token);
      setLabel('');
      setExpiresAt('');
      setTokens(prev => [
        {
          id: 'pending-' + res.token.slice(0, 8),
          token: res.token,
          label: label || null,
          created_at: '',
          expires_at: expiresAt || null,
          revoked_at: null,
          last_used_at: null,
        },
        ...prev,
      ]);
    });
  };

  const revoke = (tokenId: string) => {
    if (!confirm('Revoke this token? The partner will lose access immediately.')) return;
    startTransition(async () => {
      const res = await revokePartnerAccessTokenAction(tokenId, partnerId);
      if (!res.ok) { setError(res.error); return; }
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, revoked_at: new Date().toISOString() } : t));
    });
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="text-[12.5px] text-ach-navy/70">
        Generate a per-partner access link. Share the URL with a named contact — they'll see only this partner's placements and the current timepoint report to fill in.
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label (e.g. Anna — IKEA Bristol store manager)"
          className="rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
        />
        <input
          type="date"
          value={expiresAt}
          onChange={e => setExpiresAt(e.target.value)}
          placeholder="Expires (optional)"
          className="rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
        />
        <Button onClick={generate} disabled={pending}>
          <KeyRound className="h-3.5 w-3.5" />
          {pending ? 'Generating…' : 'Generate token'}
        </Button>
      </div>

      {error && <div className="text-[12.5px] text-[#8B3A4F]">{error}</div>}

      {freshToken && (
        <div className="rounded-[10px] border-[0.5px] border-ach-border bg-ach-page px-3 py-3">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">One-time — copy now</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-[6px] bg-white px-2 py-1 text-[12px] text-ach-navy border-[0.5px] border-ach-border">
              {originHref}/report/{freshToken}
            </code>
            <Button variant="secondary" onClick={() => copy(`${originHref}/report/${freshToken}`)}>
              {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
            </Button>
          </div>
          <div className="text-[11.5px] text-ach-navy/60 mt-2">
            The token above will not appear again. Share by email to the named contact only.
          </div>
        </div>
      )}

      {tokens.length > 0 && (
        <div className="pt-2">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Existing tokens</div>
          <ul className="text-[12.5px] space-y-2">
            {tokens.map(t => {
              const isRevoked = !!t.revoked_at;
              const isExpired = t.expires_at ? new Date(t.expires_at) < new Date() : false;
              return (
                <li key={t.id} className="flex items-center justify-between border-b-[0.5px] border-ach-border pb-2 last:border-0">
                  <div>
                    <div className="text-ach-navy">{t.label ?? '(no label)'}</div>
                    <div className="text-[11px] text-ach-navy/55">
                      {t.created_at ? `Created ${new Date(t.created_at).toLocaleDateString('en-GB')}` : 'Just created'}
                      {t.expires_at && <> · Expires {new Date(t.expires_at).toLocaleDateString('en-GB')}</>}
                      {t.last_used_at && <> · Last used {new Date(t.last_used_at).toLocaleDateString('en-GB')}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isRevoked ? <Badge>revoked</Badge> : isExpired ? <Badge>expired</Badge> : <Badge>active</Badge>}
                    {!isRevoked && (
                      <button
                        onClick={() => revoke(t.id)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 text-[11.5px] text-[#8B3A4F] hover:underline"
                      >
                        <Ban className="h-3 w-3" />Revoke
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
