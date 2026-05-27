'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PROJECT_TYPES, PROJECT_TYPE_LABELS, WEIGHT_RATIOS, WEIGHT_RATIO_LABELS,
  HYBRID_OPTIONS, HYBRID_OPTION_LABELS, OPTIONAL_SCHEMES, OPTIONAL_SCHEME_LABELS,
  CLASSIFICATION_QUESTIONS,
} from '@/lib/projects/schema';
import type { AdminActionResult } from '@/lib/projects/admin-action';
import { classify } from '@/lib/scoring/classification';

interface Props {
  action: (prev: AdminActionResult | null, fd: FormData) => Promise<AdminActionResult>;
  initial: any;
  cancelHref: string;
}

export function ProjectAdminForm({ action, initial, cancelHref }: Props) {
  const [state, formAction] = useFormState(action, null);

  const [q, setQ] = useState({
    q1: (initial?.classification_q1 ?? '') as 'A'|'B'|'C'|'',
    q2: (initial?.classification_q2 ?? '') as 'A'|'B'|'C'|'',
    q3: (initial?.classification_q3 ?? '') as 'A'|'B'|'C'|'',
    q4: (initial?.classification_q4 ?? '') as 'A'|'B'|'C'|'',
  });
  const allAnswered = q.q1 && q.q2 && q.q3 && q.q4;
  const result = allAnswered ? classify({
    q1_primary_objective: q.q1 as 'A'|'B'|'C',
    q2_participation_intensity: q.q2 as 'A'|'B'|'C',
    q3_service_delivery: q.q3 as 'A'|'B'|'C',
    q4_expected_change_pattern: q.q4 as 'A'|'B'|'C',
  }) : null;

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <div className="space-y-4">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Weighting</div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Project type">
            <Select name="type" defaultValue={initial?.type ?? 'depth'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Weight ratio (α : β)">
            <Select name="weight_ratio" defaultValue={initial?.weight_ratio ?? 'd3_1'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEIGHT_RATIOS.map(r => <SelectItem key={r} value={r}>{WEIGHT_RATIO_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Hybrid option (when type=hybrid)">
            <Select name="hybrid_option" defaultValue={initial?.hybrid_option ?? 'A'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HYBRID_OPTIONS.map(o => <SelectItem key={o} value={o}>{HYBRID_OPTION_LABELS[o]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Optional-score scheme">
            <Select name="optional_scheme" defaultValue={initial?.optional_scheme ?? 'simple_average'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPTIONAL_SCHEMES.map(s => <SelectItem key={s} value={s}>{OPTIONAL_SCHEME_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Stability blend (V2, 0 to 1)">
          <Input
            name="stability_blend" type="number" step="0.01" min={0} max={1}
            defaultValue={initial?.stability_blend ?? 0}
          />
        </Field>
      </div>

      <div className="pt-5 border-t-[0.5px] border-ach-border">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">
          Methodology classification (Q1–Q4)
        </div>
        <p className="text-[12px] text-ach-navy/60 mb-4">
          Optional. The four-question methodology classifier from HIM V2 derives a project type and weight ratio independent of the outcomes picker. Answering it here updates the project's classification_total score for academic reporting.
        </p>

        <div className="space-y-4">
          {CLASSIFICATION_QUESTIONS.map(cq => {
            const k = cq.key.replace('classification_', '') as 'q1'|'q2'|'q3'|'q4';
            return (
              <div key={cq.key} className="space-y-2">
                <Label>{cq.label}</Label>
                <div className="grid grid-cols-1 gap-1.5">
                  {(['A','C','B'] as const).map(letter => (
                    <label key={letter} className="flex items-start gap-2.5 text-[13px] cursor-pointer p-2 rounded-[10px] border-[0.5px] border-ach-border hover:bg-ach-page transition-colors">
                      <input
                        type="radio" name={cq.key} value={letter}
                        checked={q[k] === letter}
                        onChange={() => setQ({ ...q, [k]: letter })}
                        className="mt-0.5 h-4 w-4 border-ach-border text-ach-navy focus:ring-ach-navy/40"
                      />
                      <span>
                        <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mr-2">{letter}</span>
                        <span className="text-ach-navy">{cq.options[letter]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {result && (
          <div className="mt-4 rounded-[12px] bg-ach-page p-4 border-[0.5px] border-ach-border">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Classification suggestion</div>
            <div className="text-[15px] font-medium text-ach-navy mt-1">
              {PROJECT_TYPE_LABELS[result.projectType]} · {WEIGHT_RATIO_LABELS[result.suggestedRatio]}
            </div>
            <div className="text-[12px] text-ach-navy/60 mt-1">
              Total {result.total}/8. Use the dropdowns above to accept or override.
            </div>
          </div>
        )}
      </div>

      {state && !state.ok && (
        <div className="text-[13px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30">
          {state.error}
        </div>
      )}
      {state && state.ok && (
        <div className="text-[13px] text-ach-slate-deep bg-ach-slate-tint rounded-[10px] px-3 py-2 border-[0.5px] border-ach-slate-blue/30">
          Saved.
        </div>
      )}

      <div className="flex items-center gap-2">
        <SubmitBtn>Save changes</SubmitBtn>
        <Link href={cancelHref}><Button variant="ghost" type="button">Cancel</Button></Link>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SubmitBtn({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : children}</Button>;
}
