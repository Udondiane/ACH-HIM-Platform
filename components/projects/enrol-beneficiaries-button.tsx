'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { UserPlus, Check, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enrolBeneficiariesToProjectAction } from '@/lib/projects/actions';

interface Candidate {
  id: string;
  candidate_ref: string;
  given_name?: string | null;
  family_name?: string | null;
}

interface Props {
  projectId: string;
  available: Candidate[];
}

export function EnrolBeneficiariesButton({ projectId, available }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = query
    ? available.filter(c =>
        c.candidate_ref.toLowerCase().includes(query.toLowerCase()) ||
        (c.given_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (c.family_name ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : available;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const submit = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await enrolBeneficiariesToProjectAction(projectId, Array.from(selected));
      if (!res.ok) { setMsg(res.error); return; }
      setMsg(`Enrolled ${res.count} beneficiar${res.count === 1 ? 'y' : 'ies'}.`);
      setSelected(new Set());
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <div className="inline-flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" />Enrol beneficiaries
        </Button>
        {msg && <span className="text-[11.5px] text-emerald-800">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border-[0.5px] border-ach-border bg-white p-3 min-w-[360px] shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Enrol beneficiaries</div>
        <button onClick={() => setOpen(false)} className="text-ach-navy/60 hover:text-ach-navy"><X className="h-3.5 w-3.5" /></button>
      </div>
      <Link
        href={`/candidates/import?projectId=${projectId}`}
        className="flex items-center gap-2 rounded-[10px] border border-dashed border-ach-border bg-ach-page/40 px-3 py-2 mb-3 text-[12.5px] text-ach-navy hover:bg-ach-page transition-colors"
      >
        <Upload className="h-3.5 w-3.5 text-ach-navy/70" />
        <span>Have a list already? <span className="underline underline-offset-2">Upload CSV or Excel →</span></span>
      </Link>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Or pick from existing beneficiaries</div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by name or reference…"
        className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40 mb-2"
      />
      <div className="max-h-64 overflow-y-auto border-[0.5px] border-ach-border rounded-[8px] mb-3">
        {filtered.length === 0 ? (
          <div className="text-[12.5px] text-ach-navy/55 p-3">No matching candidates.</div>
        ) : filtered.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center justify-between border-b-[0.5px] border-ach-border last:border-0 ${
              selected.has(c.id) ? 'bg-ach-navy/5' : 'hover:bg-ach-page/50'
            }`}
          >
            <div>
              <span className="text-ach-navy identity-ref">{c.candidate_ref}</span>
              <span className="text-ach-navy/60 ml-2 identity-name">
                {[c.given_name, c.family_name].filter(Boolean).join(' ')}
              </span>
            </div>
            {selected.has(c.id) && <Check className="h-3.5 w-3.5 text-ach-navy" />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={submit} disabled={pending || selected.size === 0}>
          {pending ? 'Enrolling…' : `Enrol ${selected.size}`}
        </Button>
        <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <div className="text-[11px] text-ach-navy/50 mt-2">
        A cohort will be created automatically if this project has none.
      </div>
    </div>
  );
}
