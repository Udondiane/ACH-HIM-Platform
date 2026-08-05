'use client';

import { useState, useTransition } from 'react';
import { Award, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bulkIssueCertificatesAction } from '@/lib/training/actions';

interface Eligible {
  enrolmentId: string;
  candidateId: string;
  candidateRef: string;
  candidateName: string;
  attendancePct: number | null;
}

interface Props {
  programmeId: string;
  eligible: Eligible[];
}

export function CertificateIssuer({ programmeId, eligible }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(eligible.map(e => e.enrolmentId)));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (eligible.length === 0) return null;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const submit = () => {
    setMsg(null);
    const rows = eligible.filter(e => selected.has(e.enrolmentId));
    startTransition(async () => {
      const res = await bulkIssueCertificatesAction({
        programmeId,
        enrolments: rows.map(r => ({ enrolmentId: r.enrolmentId, candidateId: r.candidateId, attendancePct: r.attendancePct })),
      });
      if (!res.ok) { setMsg({ ok: false, text: res.error }); return; }
      setMsg({ ok: true, text: `Issued ${res.count} certificate${res.count === 1 ? '' : 's'}.` });
    });
  };

  return (
    <div className="rounded-[10px] border-[0.5px] border-ach-border bg-white p-3">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">
        <Award className="h-3.5 w-3.5 inline mr-1" />Issue certificates
      </div>
      <ul className="text-[12.5px] divide-y divide-ach-border mb-3 max-h-48 overflow-y-auto">
        {eligible.map(e => (
          <li key={e.enrolmentId}>
            <label className="flex items-center gap-2 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(e.enrolmentId)}
                onChange={() => toggle(e.enrolmentId)}
              />
              <span className="text-ach-navy">{e.candidateRef}</span>
              <span className="text-ach-navy/60">{e.candidateName}</span>
              {e.attendancePct !== null && <span className="ml-auto text-ach-navy/50">{e.attendancePct.toFixed(0)}% attendance</span>}
            </label>
          </li>
        ))}
      </ul>
      {msg && (
        <div className={`text-[12.5px] mb-2 flex items-center gap-1.5 ${msg.ok ? 'text-emerald-800' : 'text-[#8B3A4F]'}`}>
          {msg.ok && <Check className="h-3.5 w-3.5" />}{msg.text}
        </div>
      )}
      <Button onClick={submit} disabled={pending || selected.size === 0}>
        {pending ? 'Issuing…' : `Issue ${selected.size} certificate${selected.size === 1 ? '' : 's'}`}
      </Button>
    </div>
  );
}
