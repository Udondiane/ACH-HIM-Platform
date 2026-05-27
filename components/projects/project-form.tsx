'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  PROJECT_TYPE_LABELS, WEIGHT_RATIO_LABELS,
  FUNDING_MODELS, FUNDING_MODEL_LABELS, FUNDING_MODEL_HINTS,
  FUNDING_QUESTION_LABELS,
  CAP_DOMAINS, CAP_DOMAIN_LABELS, CAP_DOMAIN_HINTS,
  deriveTypeAndWeight,
  type FundingModel, type CapAnswer, type CapDomain,
} from '@/lib/projects/schema';
import type { ActionResult } from '@/lib/projects/actions';

interface Props {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  initial?: any;
  cancelHref: string;
  submitLabel?: string;
}

export function ProjectForm({ action, initial, cancelHref, submitLabel = 'Save project' }: Props) {
  const [state, formAction] = useFormState(action, null);
  const fe = (k: string) => state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;

  const [fundingModel, setFundingModel] = useState<FundingModel | ''>(
    (initial?.funding_model ?? '') as FundingModel | ''
  );

  const initialCapsRaw = (initial?.capability_questionnaire ?? {}) as Record<string, CapAnswer | null>;
  const initialCore = new Set<CapDomain>(
    CAP_DOMAINS.filter(d => initialCapsRaw[d] === 'primary'),
  );
  const initialOptional = new Set<CapDomain>(
    CAP_DOMAINS.filter(d => initialCapsRaw[d] === 'supporting'),
  );
  const [coreSet, setCoreSet] = useState<Set<CapDomain>>(initialCore);
  const [optionalSet, setOptionalSet] = useState<Set<CapDomain>>(initialOptional);

  const derived = deriveTypeAndWeight(coreSet.size, optionalSet.size);
  const [typeValue, setTypeValue] = useState<string>(initial?.type ?? derived.type);
  const [ratioValue, setRatioValue] = useState<string>(initial?.weight_ratio ?? derived.weight_ratio);
  // Re-sync type/ratio when capability selection changes — Admin overrides
  // taken AFTER selection still win because they live in their own Select.
  const prevDerivedRef = useState<{ type: string; weight_ratio: string }>(derived)[0];
  if (prevDerivedRef.type !== derived.type) {
    prevDerivedRef.type = derived.type;
    if (typeValue !== derived.type) setTimeout(() => setTypeValue(derived.type), 0);
  }
  if (prevDerivedRef.weight_ratio !== derived.weight_ratio) {
    prevDerivedRef.weight_ratio = derived.weight_ratio;
    if (ratioValue !== derived.weight_ratio) setTimeout(() => setRatioValue(derived.weight_ratio), 0);
  }

  function toggleCore(d: CapDomain) {
    const next = new Set(coreSet);
    if (next.has(d)) next.delete(d);
    else {
      if (next.size >= 3) return; // hard cap at 3 cores
      next.add(d);
      // moving to core removes from optional
      const opt = new Set(optionalSet); opt.delete(d); setOptionalSet(opt);
    }
    setCoreSet(next);
  }
  function toggleOptional(d: CapDomain) {
    if (coreSet.has(d)) return; // can't be both
    const next = new Set(optionalSet);
    if (next.has(d)) next.delete(d); else next.add(d);
    setOptionalSet(next);
  }

  const labels = FUNDING_QUESTION_LABELS[fundingModel || 'unset'];

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Project reference" error={fe('project_ref')}>
          <Input name="project_ref" required defaultValue={initial?.project_ref} placeholder="PRJ-2026-B2E-Q3" />
        </Field>
        <Field label="Status" error={fe('status')}>
          <Input name="status" defaultValue={initial?.status ?? 'active'} />
        </Field>
      </div>

      <Field label="Name" error={fe('name')}>
        <Input name="name" required defaultValue={initial?.name} />
      </Field>

      <Field label="Description" error={fe('description')}>
        <Textarea name="description" defaultValue={initial?.description ?? ''} rows={2} />
      </Field>

      <div className="pt-5 border-t-[0.5px] border-ach-border">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Funding model</div>
        <p className="text-[12px] text-ach-navy/60 mb-4">
          How is this project paid for? Drives sustainability reporting and the transition narrative for funders.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {FUNDING_MODELS.map(fm => (
            <label
              key={fm}
              className={`flex items-start gap-2.5 text-[13px] cursor-pointer p-3 rounded-[10px] border-[0.5px] transition-colors ${
                fundingModel === fm ? 'border-ach-navy bg-ach-page' : 'border-ach-border hover:bg-ach-page'
              }`}
            >
              <input
                type="radio"
                name="funding_model"
                value={fm}
                checked={fundingModel === fm}
                onChange={() => setFundingModel(fm)}
                className="mt-0.5 h-4 w-4 border-ach-border text-ach-navy focus:ring-ach-navy/40"
              />
              <span>
                <span className="text-ach-navy font-medium">{FUNDING_MODEL_LABELS[fm]}</span>
                <span className="block text-ach-navy/60 mt-0.5 text-[12px]">{FUNDING_MODEL_HINTS[fm]}</span>
              </span>
            </label>
          ))}
        </div>
        {fundingModel && fundingModel !== 'commercial' && (
          <div className="mt-3">
            <Field label="Funder" error={fe('funder_name')} hint="The trust, foundation or statutory body funding this work.">
              <Input
                name="funder_name"
                defaultValue={initial?.funder_name ?? ''}
                placeholder="e.g. Comic Relief, Esmée Fairbairn, Bristol City Council"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" error={fe('start_date')}>
          <Input name="start_date" type="date" defaultValue={initial?.start_date ?? ''} />
        </Field>
        <Field label="End date" error={fe('end_date')}>
          <Input name="end_date" type="date" defaultValue={initial?.end_date ?? ''} />
        </Field>
      </div>

      <div className="pt-5 border-t-[0.5px] border-ach-border">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Outcomes</div>

        <div className="space-y-2 mb-5">
          <div>
            <Label>{labels.core}</Label>
            <div className="text-[11.5px] text-ach-navy/55 mt-0.5">{labels.coreHint}</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {CAP_DOMAINS.map(d => {
              const selected = coreSet.has(d);
              const disabled = !selected && coreSet.size >= 3;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleCore(d)}
                  disabled={disabled}
                  className={`text-left p-3 rounded-[10px] border-[0.5px] transition-colors ${
                    selected
                      ? 'border-ach-navy bg-ach-navy text-ach-cream'
                      : disabled
                        ? 'border-ach-border bg-ach-page/40 text-ach-navy/30 cursor-not-allowed'
                        : 'border-ach-border bg-white text-ach-navy/80 hover:bg-ach-page'
                  }`}
                  aria-pressed={selected}
                >
                  <div className="text-[13px] font-medium">{CAP_DOMAIN_LABELS[d]}</div>
                  <div className={`text-[11px] mt-0.5 ${selected ? 'text-ach-cream/75' : 'text-ach-navy/55'}`}>
                    {CAP_DOMAIN_HINTS[d]}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-ach-navy/55 mt-2">
            {coreSet.size}/3 selected
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <Label>{labels.optional}</Label>
            <div className="text-[11.5px] text-ach-navy/55 mt-0.5">{labels.optionalHint}</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {CAP_DOMAINS.map(d => {
              const isCore = coreSet.has(d);
              const selected = optionalSet.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleOptional(d)}
                  disabled={isCore}
                  className={`text-left p-3 rounded-[10px] border-[0.5px] transition-colors ${
                    isCore
                      ? 'border-ach-border bg-ach-page/40 text-ach-navy/40 cursor-not-allowed'
                      : selected
                        ? 'border-ach-slate-blue bg-ach-slate-tint text-ach-slate-deep'
                        : 'border-ach-border bg-white text-ach-navy/80 hover:bg-ach-page'
                  }`}
                  aria-pressed={selected}
                >
                  <div className="text-[13px] font-medium">{CAP_DOMAIN_LABELS[d]}</div>
                  <div className={`text-[11px] mt-0.5 ${selected ? 'text-ach-slate-deep/80' : 'text-ach-navy/55'}`}>
                    {isCore ? 'Already selected as a primary outcome' : CAP_DOMAIN_HINTS[d]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {(coreSet.size > 0 || optionalSet.size > 0) && (
          <div className="mt-5 rounded-[12px] bg-ach-slate-tint/40 p-4 border-[0.5px] border-ach-slate-blue/30">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-slate-deep">Auto-derived</div>
            <div className="text-[14.5px] font-medium text-ach-navy mt-1.5">
              {PROJECT_TYPE_LABELS[derived.type]} · {WEIGHT_RATIO_LABELS[derived.weight_ratio].split(' — ')[0]}
            </div>
            <div className="text-[12px] text-ach-navy/65 mt-1">
              Core ({coreSet.size}): {coreSet.size === 0 ? '—' : Array.from(coreSet).map(d => CAP_DOMAIN_LABELS[d]).join(', ')}
              {' · '}
              Optional ({optionalSet.size}): {optionalSet.size === 0 ? '—' : Array.from(optionalSet).map(d => CAP_DOMAIN_LABELS[d]).join(', ')}
            </div>
            <div className="text-[11px] text-ach-navy/50 mt-1.5">
              The capability mix and weight ratio above are auto-set from your picks. Open Admin below to override.
            </div>
          </div>
        )}

        {CAP_DOMAINS.map(d => {
          const v = coreSet.has(d) ? 'primary' : optionalSet.has(d) ? 'supporting' : 'not_addressed';
          return <input key={d} type="hidden" name={`cap_${d}`} value={v} />;
        })}
      </div>

      <input type="hidden" name="type" value={typeValue} />
      <input type="hidden" name="weight_ratio" value={ratioValue} />
      <input type="hidden" name="hybrid_option" value={initial?.hybrid_option ?? 'A'} />
      <input type="hidden" name="optional_scheme" value={initial?.optional_scheme ?? 'simple_average'} />
      <input type="hidden" name="stability_blend" value={initial?.stability_blend ?? 0} />
      {initial?.classification_q1 && <input type="hidden" name="classification_q1" value={initial.classification_q1} />}
      {initial?.classification_q2 && <input type="hidden" name="classification_q2" value={initial.classification_q2} />}
      {initial?.classification_q3 && <input type="hidden" name="classification_q3" value={initial.classification_q3} />}
      {initial?.classification_q4 && <input type="hidden" name="classification_q4" value={initial.classification_q4} />}

      {state && !state.ok && state.error && !state.fieldErrors && (
        <div className="text-[13px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <SubmitBtn>{submitLabel}</SubmitBtn>
        <Link href={cancelHref}><Button variant="ghost" type="button">Cancel</Button></Link>
      </div>
    </form>
  );
}

function Field({ label, error, children, hint }: { label: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <div className="text-[11px] text-ach-navy/55">{hint}</div>}
      {error && <div className="text-[12px] text-[#8B3A4F]">{error}</div>}
    </div>
  );
}
function SubmitBtn({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : children}</Button>;
}
