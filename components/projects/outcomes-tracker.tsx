'use client';

import { useState, useTransition } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setBeneficiaryOutcomeAction } from '@/lib/beneficiary-outcomes/actions';

interface Beneficiary {
  id: string;
  candidate_ref: string;
  given_name?: string | null;
  family_name?: string | null;
}

interface OutcomeDef { key: string; label: string; }

interface OutcomeRow {
  candidate_id: string;
  outcome_key: string;
  outcome_label: string | null;
  notes: string | null;
}

interface Props {
  projectId: string;
  beneficiaries: Beneficiary[];
  outcomes: OutcomeDef[];      // includes 'other' at the end
  recorded: OutcomeRow[];
}

/**
 * Interim outcomes tracker. Presents one row per beneficiary, one column
 * per outcome type (derived from the project's ticked activities), and lets
 * ACH staff tick outcomes as beneficiaries reach them. Ticks + unticks
 * persist immediately.
 */
export function OutcomesTracker({ projectId, beneficiaries, outcomes, recorded }: Props) {
  const [pending, startTransition] = useTransition();
  const [otherModal, setOtherModal] = useState<{ candidateId: string; label: string } | null>(null);
  const [otherText, setOtherText] = useState('');

  // Build a quick lookup: candidateId -> Set of outcome_keys that are ticked
  const [tickedMap, setTickedMap] = useState<Record<string, Set<string>>>(() => {
    const m: Record<string, Set<string>> = {};
    for (const r of recorded) {
      if (r.outcome_key === 'other') continue; // 'other' isn't a simple tick
      if (!m[r.candidate_id]) m[r.candidate_id] = new Set();
      m[r.candidate_id].add(r.outcome_key);
    }
    return m;
  });

  const [otherEntries, setOtherEntries] = useState<Record<string, { label: string; notes: string | null }[]>>(() => {
    const m: Record<string, { label: string; notes: string | null }[]> = {};
    for (const r of recorded) {
      if (r.outcome_key !== 'other') continue;
      if (!m[r.candidate_id]) m[r.candidate_id] = [];
      m[r.candidate_id].push({ label: r.outcome_label ?? 'Other', notes: r.notes });
    }
    return m;
  });

  const toggle = (candidateId: string, outcome: OutcomeDef) => {
    if (outcome.key === 'other') {
      setOtherModal({ candidateId, label: outcome.label });
      setOtherText('');
      return;
    }
    const isTicked = tickedMap[candidateId]?.has(outcome.key) ?? false;
    // Optimistic update
    setTickedMap(prev => {
      const next = { ...prev };
      if (!next[candidateId]) next[candidateId] = new Set();
      const s = new Set(next[candidateId]);
      if (isTicked) s.delete(outcome.key); else s.add(outcome.key);
      next[candidateId] = s;
      return next;
    });
    startTransition(async () => {
      await setBeneficiaryOutcomeAction(projectId, candidateId, outcome.key, outcome.label, !isTicked);
    });
  };

  const saveOther = () => {
    if (!otherModal) return;
    const label = otherText.trim();
    if (!label) return;
    const cid = otherModal.candidateId;
    setOtherEntries(prev => {
      const next = { ...prev };
      if (!next[cid]) next[cid] = [];
      next[cid] = [...next[cid], { label, notes: null }];
      return next;
    });
    startTransition(async () => {
      await setBeneficiaryOutcomeAction(projectId, cid, 'other', label, true);
    });
    setOtherModal(null);
    setOtherText('');
  };

  if (beneficiaries.length === 0) {
    return (
      <div className="rounded-[10px] border-[0.5px] border-dashed border-ach-border bg-ach-page/40 px-4 py-6 text-center">
        <div className="text-[13px] text-ach-navy font-medium">No beneficiaries enrolled on this project yet</div>
        <div className="text-[12px] text-ach-navy/60 mt-1">
          Once you enrol candidates (use <span className="font-mono text-[11.5px]">Enrol candidates</span> above, or bulk-upload from <span className="font-mono text-[11.5px]">/candidates/import</span>), a row per beneficiary appears here with one tick-column per outcome derived from your project&apos;s activities.
        </div>
      </div>
    );
  }

  const nonOther = outcomes.filter(o => o.key !== 'other');
  const other = outcomes.find(o => o.key === 'other');

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b-[0.5px] border-ach-border">
              <th className="text-left py-2 pr-3 font-medium text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/60">Beneficiary</th>
              {nonOther.map(o => (
                <th
                  key={o.key}
                  // Multi-line, top-aligned, capped at a sensible column
                  // width so long outcome names ("Started vocational
                  // training") stack cleanly instead of pushing the row
                  // off-screen. Bottom-hug tick circles align to the row
                  // baseline via vertical-align:bottom on this cell.
                  className="text-center align-bottom py-2 px-1.5 font-medium text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/60 leading-[1.25] max-w-[110px] min-w-[76px] [overflow-wrap:break-word]"
                >
                  {o.label}
                </th>
              ))}
              {other && (
                <th className="text-center py-2 px-2 font-medium text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/60">Other</th>
              )}
            </tr>
          </thead>
          <tbody>
            {beneficiaries.map(b => {
              const ticks = tickedMap[b.id] ?? new Set<string>();
              const others = otherEntries[b.id] ?? [];
              return (
                <tr key={b.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/40">
                  <td className="py-2 pr-3">
                    <span className="text-ach-navy identity-ref font-mono text-[11.5px]">{b.candidate_ref}</span>
                    <span className="text-ach-navy/70 ml-2 identity-name">{[b.given_name, b.family_name].filter(Boolean).join(' ')}</span>
                  </td>
                  {nonOther.map(o => (
                    <td key={o.key} className="text-center py-2 px-2">
                      <button
                        type="button"
                        onClick={() => toggle(b.id, o)}
                        disabled={pending}
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-[0.5px] transition-colors ${
                          ticks.has(o.key)
                            ? 'bg-ach-navy border-ach-navy text-ach-cream'
                            : 'bg-white border-ach-border text-ach-navy/30 hover:text-ach-navy hover:border-ach-navy'
                        }`}
                        aria-pressed={ticks.has(o.key)}
                      >
                        {ticks.has(o.key) && <Check className="h-3 w-3" />}
                      </button>
                    </td>
                  ))}
                  {other && (
                    <td className="text-center py-2 px-2">
                      <button
                        type="button"
                        onClick={() => toggle(b.id, other)}
                        className="inline-flex items-center justify-center gap-1 text-[11px] text-ach-navy/70 hover:text-ach-navy px-2 py-1 rounded-full border-[0.5px] border-ach-border hover:bg-ach-page"
                      >
                        <Plus className="h-3 w-3" /> Add {others.length > 0 && <span className="text-ach-navy/50 tabular-nums">· {others.length}</span>}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Small legend: unexpected outcomes recorded */}
      {Object.entries(otherEntries).length > 0 && (
        <div className="mt-4 pt-4 border-t-[0.5px] border-ach-border">
          <div className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/60 mb-1.5">Unexpected outcomes recorded</div>
          <ul className="space-y-1 text-[12px] text-ach-navy/75">
            {beneficiaries.flatMap(b => {
              const others = otherEntries[b.id] ?? [];
              return others.map((entry, i) => (
                <li key={`${b.id}-${i}`}>
                  <span className="font-mono text-[11px] identity-ref">{b.candidate_ref}</span>{' — '}<span className="italic">{entry.label}</span>
                </li>
              ));
            })}
          </ul>
        </div>
      )}

      {otherModal && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center z-50" onClick={() => setOtherModal(null)}>
          <div className="bg-white rounded-[12px] p-5 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Enter an unexpected outcome</div>
              <button onClick={() => setOtherModal(null)} className="text-ach-navy/60 hover:text-ach-navy"><X className="h-4 w-4" /></button>
            </div>
            <textarea
              value={otherText}
              onChange={e => setOtherText(e.target.value)}
              rows={3}
              className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40 mb-3"
            />
            <div className="flex items-center gap-2">
              <Button onClick={saveOther} disabled={!otherText.trim()}>Save</Button>
              <Button variant="ghost" onClick={() => setOtherModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
