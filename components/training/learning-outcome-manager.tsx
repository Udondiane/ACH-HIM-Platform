'use client';

import { useState, useTransition } from 'react';
import { Plus, Link2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  addLearningOutcomeAction,
  mapOutcomeToFactorAction,
  unmapOutcomeFromFactorAction,
} from '@/lib/training/actions';

interface Outcome { id: string; outcome_code: string | null; outcome_text: string; sort_order: number }
interface Factor { id: string; name: string; conversion_factor_type: string }
interface Mapping { learning_outcome_id: string; factor_id: string; evidence_weight: number }

interface Props {
  programmeId: string;
  outcomes: Outcome[];
  factors: Factor[];
  outcomeMap: Mapping[];
}

export function LearningOutcomeManager({ programmeId, outcomes, factors, outcomeMap }: Props) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const factorsByOutcome = new Map<string, string[]>();
  for (const m of outcomeMap) {
    if (!factorsByOutcome.has(m.learning_outcome_id)) factorsByOutcome.set(m.learning_outcome_id, []);
    factorsByOutcome.get(m.learning_outcome_id)!.push(m.factor_id);
  }

  const addOutcome = () => {
    setErr(null);
    if (!text.trim()) { setErr('Outcome text required.'); return; }
    startTransition(async () => {
      const fd = new FormData();
      fd.append('programme_id', programmeId);
      fd.append('outcome_code', code);
      fd.append('outcome_text', text);
      fd.append('sort_order', String(outcomes.length));
      const res = await addLearningOutcomeAction(null, fd);
      if (!res.ok) { setErr(res.error); return; }
      setCode(''); setText(''); setAdding(false);
    });
  };

  const linkFactor = (outcomeId: string, factorId: string) => {
    startTransition(async () => {
      await mapOutcomeToFactorAction({ learningOutcomeId: outcomeId, programmeId, factorId });
    });
  };

  const unlink = (outcomeId: string, factorId: string) => {
    startTransition(async () => {
      await unmapOutcomeFromFactorAction({ learningOutcomeId: outcomeId, factorId, programmeId });
    });
  };

  return (
    <div className="space-y-3">
      {outcomes.length === 0 && !adding && (
        <div className="text-[12.5px] text-ach-navy/60">No learning outcomes yet.</div>
      )}
      {outcomes.map(o => {
        const linkedFactorIds = factorsByOutcome.get(o.id) ?? [];
        const linkedFactors = factors.filter(f => linkedFactorIds.includes(f.id));
        const unlinked = factors.filter(f => !linkedFactorIds.includes(f.id));
        return (
          <div key={o.id} className="rounded-[10px] border-[0.5px] border-ach-border bg-white p-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                {o.outcome_code && <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-0.5">{o.outcome_code}</div>}
                <div className="text-[13px] text-ach-navy">{o.outcome_text}</div>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">
                <Link2 className="h-3 w-3 inline mr-1" />HIM factors this evidences
              </div>
              {linkedFactors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {linkedFactors.map(f => (
                    <button
                      key={f.id}
                      onClick={() => unlink(o.id, f.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] bg-ach-navy text-ach-cream hover:bg-ach-navy/85"
                    >
                      {f.name}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                </div>
              )}
              <select
                onChange={e => { if (e.target.value) { linkFactor(o.id, e.target.value); e.target.value = ''; } }}
                disabled={pending || unlinked.length === 0}
                className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-1.5 text-[12px] text-ach-navy"
              >
                <option value="">— add a factor —</option>
                {unlinked.map(f => <option key={f.id} value={f.id}>{f.name} ({f.conversion_factor_type})</option>)}
              </select>
            </div>
          </div>
        );
      })}

      {adding ? (
        <div className="rounded-[10px] border-[0.5px] border-ach-border bg-white p-3 space-y-2">
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Code"
              className="rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy"
            />
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Learners will be able to…"
              className="rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy"
            />
          </div>
          {err && <div className="text-[11.5px] text-[#8B3A4F]">{err}</div>}
          <div className="flex items-center gap-2">
            <Button onClick={addOutcome} disabled={pending}>{pending ? 'Saving…' : 'Add'}</Button>
            <Button type="button" variant="secondary" onClick={() => { setAdding(false); setCode(''); setText(''); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" type="button" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />Add learning outcome
        </Button>
      )}
    </div>
  );
}
