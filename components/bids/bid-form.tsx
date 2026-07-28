'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const DOMAINS = [
  { key: 'employment',  label: 'Employment' },
  { key: 'housing',     label: 'Housing' },
  { key: 'education',   label: 'Education & Skills' },
  { key: 'health',      label: 'Health & Wellbeing' },
  { key: 'belonging',   label: 'Belonging & Identity' },
  { key: 'social',      label: 'Social Participation' },
  { key: 'rights',      label: 'Rights & Citizenship' },
];

type ActionResult = { ok: true; id?: string } | { ok: false; error: string } | null;

export function BidForm({
  action,
  initial,
  frameworks,
  projects,
  cohorts,
  quotes,
  cancelHref,
  submitLabel = 'Save bid',
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  initial?: any;
  frameworks: Array<{ key: string; label: string }>;
  projects: Array<{ id: string; name: string; project_ref?: string }>;
  cohorts: Array<{ id: string; name: string }>;
  quotes: Array<{ id: string; quote_text: string; speaker_type?: string }>;
  cancelHref: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action as any, null);

  const [focusSet, setFocusSet] = useState<Set<string>>(new Set((initial?.focus_domains ?? []) as string[]));
  const [projectSet, setProjectSet] = useState<Set<string>>(new Set((initial?.scoped_project_ids ?? []) as string[]));
  const [cohortSet, setCohortSet] = useState<Set<string>>(new Set((initial?.scoped_cohort_ids ?? []) as string[]));
  const [quoteSet, setQuoteSet] = useState<Set<string>>(new Set((initial?.featured_quote_ids ?? []) as string[]));

  const toggle = (setter: (v: Set<string>) => void, current: Set<string>, id: string) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  return (
    <form action={formAction} className="space-y-6">
      {state && !state.ok && (
        <div className="rounded-[8px] border-[0.5px] border-red-300 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
          {(state as any).error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">Bid name</label>
          <input name="name" required defaultValue={initial?.name ?? ''}
            className="flex h-9 w-full rounded-[10px] border-[0.5px] border-ach-border px-3 text-[13px]" />
        </div>
        <div>
          <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">Funder</label>
          <input name="funder_name" defaultValue={initial?.funder_name ?? ''}
            className="flex h-9 w-full rounded-[10px] border-[0.5px] border-ach-border px-3 text-[13px]" />
        </div>
        <div>
          <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">Ask (£)</label>
          <input name="ask_amount_gbp" type="number" step="0.01" defaultValue={initial?.ask_amount_gbp ?? ''}
            className="flex h-9 w-full rounded-[10px] border-[0.5px] border-ach-border px-3 text-[13px]" />
        </div>
        <div>
          <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">Deadline</label>
          <input name="deadline" type="date" defaultValue={initial?.deadline ?? ''}
            className="flex h-9 w-full rounded-[10px] border-[0.5px] border-ach-border px-3 text-[13px]" />
        </div>
      </div>

      <div>
        <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-2">Focus domains</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DOMAINS.map(d => {
            const selected = focusSet.has(d.key);
            return (
              <button key={d.key} type="button"
                onClick={() => toggle(setFocusSet, focusSet, d.key)}
                className={`text-left p-2.5 rounded-[8px] border-[0.5px] text-[12.5px] transition-colors ${
                  selected ? 'border-ach-navy bg-ach-navy text-ach-cream' : 'border-ach-border bg-white text-ach-navy hover:bg-ach-page'
                }`}>
                {d.label}
              </button>
            );
          })}
        </div>
        {[...focusSet].map(k => <input key={k} type="hidden" name="focus_domains" value={k} />)}
      </div>

      <div>
        <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">Financial impact framework</label>
        <select name="framework_key" defaultValue={initial?.framework_key ?? ''}
          className="flex h-9 w-full rounded-[10px] border-[0.5px] border-ach-border px-3 text-[13px]">
          <option value="">Select a framework…</option>
          {frameworks.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <p className="text-[11.5px] text-ach-navy/55 mt-1">Determines the £ proxy values used to monetise impact evidence.</p>
      </div>

      <div>
        <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-2">Scope to projects (optional)</label>
        {projects.length === 0 ? (
          <div className="text-[12px] text-ach-navy/55 italic">No projects yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {projects.map(p => {
              const selected = projectSet.has(p.id);
              return (
                <button key={p.id} type="button"
                  onClick={() => toggle(setProjectSet, projectSet, p.id)}
                  className={`text-left p-2.5 rounded-[8px] border-[0.5px] text-[12.5px] transition-colors ${
                    selected ? 'border-ach-navy bg-ach-navy text-ach-cream' : 'border-ach-border bg-white text-ach-navy hover:bg-ach-page'
                  }`}>
                  {p.project_ref && <span className="font-mono text-[10.5px] opacity-70 mr-1.5">{p.project_ref}</span>}
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
        {[...projectSet].map(id => <input key={id} type="hidden" name="scoped_project_ids" value={id} />)}
      </div>

      <div>
        <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-2">Featured quotes to include (optional)</label>
        {quotes.length === 0 ? (
          <div className="text-[12px] text-ach-navy/55 italic">No featured quotes yet.</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {quotes.map(q => {
              const selected = quoteSet.has(q.id);
              return (
                <button key={q.id} type="button"
                  onClick={() => toggle(setQuoteSet, quoteSet, q.id)}
                  className={`w-full text-left p-2.5 rounded-[8px] border-[0.5px] text-[12.5px] transition-colors ${
                    selected ? 'border-ach-navy bg-ach-navy/5' : 'border-ach-border bg-white hover:bg-ach-page'
                  }`}>
                  <span className={`font-serif italic ${selected ? 'text-ach-navy' : 'text-ach-navy/80'}`}>&ldquo;{q.quote_text}&rdquo;</span>
                  <span className="block text-[10.5px] text-ach-navy/50 mt-1">{q.speaker_type ?? ''}</span>
                </button>
              );
            })}
          </div>
        )}
        {[...quoteSet].map(id => <input key={id} type="hidden" name="featured_quote_ids" value={id} />)}
      </div>

      <div>
        <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">Executive summary</label>
        <Textarea name="executive_summary" rows={3} defaultValue={initial?.executive_summary ?? ''}
          placeholder="2-3 sentence funder-facing summary of what this bid is asking for and why." />
      </div>
      <div>
        <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">What we will do</label>
        <Textarea name="what_we_will_do" rows={3} defaultValue={initial?.what_we_will_do ?? ''}
          placeholder="Delivery narrative for the funder." />
      </div>
      <div>
        <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">What change looks like</label>
        <Textarea name="what_change_looks_like" rows={3} defaultValue={initial?.what_change_looks_like ?? ''}
          placeholder="Outcome narrative. Ties back to the HIM evidence in the pack." />
      </div>
      <div>
        <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">Methodology note</label>
        <Textarea name="methodology_note" rows={2} defaultValue={initial?.methodology_note ?? ''}
          placeholder="How HIM measures this. Included in the pack for funder assurance." />
      </div>

      {initial && (
        <div className="grid grid-cols-3 gap-4 pt-4 border-t-[0.5px] border-ach-border">
          <div>
            <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">Status</label>
            <select name="status" defaultValue={initial?.status ?? 'draft'}
              className="flex h-9 w-full rounded-[10px] border-[0.5px] border-ach-border px-3 text-[13px]">
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">Submitted on</label>
            <input name="submitted_at" type="date" defaultValue={initial?.submitted_at ?? ''}
              className="flex h-9 w-full rounded-[10px] border-[0.5px] border-ach-border px-3 text-[13px]" />
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block mb-1">Outcome notes</label>
            <input name="outcome_notes" defaultValue={initial?.outcome_notes ?? ''}
              className="flex h-9 w-full rounded-[10px] border-[0.5px] border-ach-border px-3 text-[13px]" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-4 border-t-[0.5px] border-ach-border">
        <Button type="submit">{submitLabel}</Button>
        <Link href={cancelHref} className="text-[12.5px] text-ach-navy/70 hover:text-ach-navy">Cancel</Link>
      </div>
    </form>
  );
}
