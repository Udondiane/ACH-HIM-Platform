'use client';

import { useState, useTransition } from 'react';
import { UserPlus, Check, X } from 'lucide-react';
import { shortlistForPartnerAction, withdrawFromShortlistAction } from '@/lib/partner-shortlist/actions';

interface Partner { id: string; name: string; }
interface ShortlistEntry { partner_id: string; withdrawn_at: string | null; notes: string | null; }

export function ShortlistForPartner({
  candidateId,
  availablePartners,
  currentShortlists,
}: {
  candidateId: string;
  availablePartners: Partner[];
  currentShortlists: ShortlistEntry[];
}) {
  const activeIds = new Set(currentShortlists.filter(s => !s.withdrawn_at).map(s => s.partner_id));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (partnerId: string) => {
    const isActive = activeIds.has(partnerId);
    startTransition(async () => {
      const res = isActive
        ? await withdrawFromShortlistAction({ partnerId, candidateId })
        : await shortlistForPartnerAction({ partnerId, candidateId });
      if (!res.ok) setMsg(res.error);
      else setMsg(isActive ? 'Withdrawn from shortlist.' : 'Shortlisted.');
    });
  };

  if (availablePartners.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Shortlist for workforce partner</div>
      <div className="flex flex-wrap gap-2">
        {availablePartners.map(p => {
          const on = activeIds.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={pending}
              onClick={() => toggle(p.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] border-[0.5px] transition-colors ${
                on
                  ? 'bg-ach-navy text-ach-cream border-ach-navy'
                  : 'bg-white text-ach-navy/70 border-ach-border hover:bg-ach-page'
              }`}
              title={on ? `Click to withdraw from ${p.name}` : `Click to shortlist for ${p.name}`}
            >
              {on ? <Check className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
              {p.name}
            </button>
          );
        })}
      </div>
      {msg && <div className="text-[11.5px] text-ach-navy/60">{msg}</div>}
    </div>
  );
}
