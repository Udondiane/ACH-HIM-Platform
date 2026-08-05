'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { savePlacementRetentionCheckAction } from '@/lib/partner-timepoints/actions';

interface Props {
  placementId: string;
  timepoint: 'retention_6mo' | 'retention_12mo';
  initial: Record<string, unknown> | null;
  showProgression?: boolean;
}

export function RetentionCheckForm({ placementId, timepoint, initial, showProgression }: Props) {
  const r = (initial ?? {}) as Record<string, string | boolean | null>;

  const [stillEmployed, setStillEmployed] = useState<string>(
    r.still_employed === true ? 'yes' : r.still_employed === false ? 'no' : ''
  );
  const [roleAtCheck, setRoleAtCheck]     = useState<string>((r.role_at_check as string) ?? '');
  const [leavingDate, setLeavingDate]     = useState<string>((r.leaving_date as string) ?? '');
  const [leavingReason, setLeavingReason] = useState<string>((r.leaving_reason as string) ?? '');
  const [progression, setProgression]     = useState<string>((r.progression_note as string) ?? '');

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await savePlacementRetentionCheckAction({
        placementId,
        timepoint,
        stillEmployed: stillEmployed === 'yes' ? true : stillEmployed === 'no' ? false : null,
        roleAtCheck: stillEmployed === 'yes' ? (roleAtCheck || null) : null,
        leavingDate: stillEmployed === 'no' ? (leavingDate || null) : null,
        leavingReason: stillEmployed === 'no' ? (leavingReason || null) : null,
        progressionNote: showProgression ? (progression || null) : null,
      });
      if (!res.ok) { setMsg({ ok: false, text: res.error }); return; }
      setMsg({ ok: true, text: 'Saved.' });
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Still employed?</div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input type="radio" name={`emp-${timepoint}`} value="yes" checked={stillEmployed === 'yes'} onChange={e => setStillEmployed(e.target.value)} />
            Yes
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input type="radio" name={`emp-${timepoint}`} value="no" checked={stillEmployed === 'no'} onChange={e => setStillEmployed(e.target.value)} />
            No
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input type="radio" name={`emp-${timepoint}`} value="" checked={stillEmployed === ''} onChange={e => setStillEmployed(e.target.value)} />
            Unknown
          </label>
        </div>
      </div>

      {stillEmployed === 'yes' && (
        <div>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Current role</div>
          <input
            value={roleAtCheck}
            onChange={e => setRoleAtCheck(e.target.value)}
            placeholder="Role title at this check (if changed from placement role)"
            className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
          />
        </div>
      )}

      {stillEmployed === 'no' && (
        <>
          <div>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Leaving date</div>
            <input
              type="date"
              value={leavingDate}
              onChange={e => setLeavingDate(e.target.value)}
              className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
            />
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Reason for leaving</div>
            <textarea
              value={leavingReason}
              onChange={e => setLeavingReason(e.target.value)}
              rows={2}
              placeholder="Voluntary, restructure, moved on to another role, etc."
              className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
            />
          </div>
        </>
      )}

      {showProgression && (
        <div>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Progression note (12-month final)</div>
          <textarea
            value={progression}
            onChange={e => setProgression(e.target.value)}
            rows={3}
            placeholder="Any promotion, pay change, new responsibilities, training completed, or forward trajectory observed."
            className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
          />
        </div>
      )}

      {msg && (
        <div className={`flex items-center gap-2 text-[12.5px] ${msg.ok ? 'text-emerald-800' : 'text-[#8B3A4F]'}`}>
          {msg.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {msg.text}
        </div>
      )}

      <div className="pt-1">
        <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : 'Save check'}</Button>
      </div>
    </div>
  );
}
