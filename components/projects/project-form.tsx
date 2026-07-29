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
  FUNDING_MODELS, FUNDING_MODEL_LABELS, FUNDING_MODEL_HINTS,
  FUNDING_QUESTION_LABELS,
  CAP_DOMAINS, CAP_DOMAIN_LABELS, CAP_DOMAIN_HINTS,
  deriveTypeAndWeight,
  type FundingModel, type CapAnswer, type CapDomain,
} from '@/lib/projects/schema';
import { PROGRAMME_ACTIVITIES } from '@/lib/activities/definitions';
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

  // Activities the project delivers. Drives which factors get measured
  // AND which training programmes are auto-spawned (isTraining flag).
  const [activitySet, setActivitySet] = useState<Set<string>>(
    new Set<string>(((initial?.activities ?? []) as string[]) || []),
  );
  function toggleActivity(id: string) {
    const next = new Set(activitySet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setActivitySet(next);
  }
  // Activities relevant to selected domains. If no domain is picked yet, the
  // section is hidden so the form doesn't overwhelm new users.
  const selectedDomains = new Set<CapDomain>([...coreSet, ...optionalSet]);
  const relevantActivities = PROGRAMME_ACTIVITIES.filter(a =>
    a.domains.some(d => selectedDomains.has(d as CapDomain)),
  );

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
    if (next.has(d)) {
      next.delete(d);
    } else {
      if (next.size >= 2) return; // hard cap at 2 supporting
      next.add(d);
    }
    setOptionalSet(next);
  }

  const labels = FUNDING_QUESTION_LABELS[fundingModel || 'unset'];

  const isEdit = !!initial?.project_ref;
  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <input type="hidden" name="status" value={initial?.status ?? 'active'} />
      {isEdit && (
        <Field label="Project reference" error={fe('project_ref')}>
          <Input
            name="project_ref"
            defaultValue={initial?.project_ref}
            readOnly
            className="bg-ach-page text-ach-navy/60 cursor-not-allowed"
          />
        </Field>
      )}
      {!isEdit && <input type="hidden" name="project_ref" value="" />}

      <Field label="Name" error={fe('name')}>
        <Input name="name" required defaultValue={initial?.name} placeholder="e.g. Bridge to Employment" />
      </Field>

      <Field label="Description" error={fe('description')}>
        <Textarea name="description" defaultValue={initial?.description ?? ''} rows={2} />
      </Field>

      <div className="pt-5 border-t-[0.5px] border-ach-border">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Funding model</div>
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
        {fundingModel && (() => {
          // Funder field label, placeholder, and hint vary by funding model so
          // the prompt matches the actual counterparty for the project.
          const meta = fundingModel === 'commercial'
            ? {
                label: 'Corporate partner',
                hint: 'The corporate, council procurement team, or other organisation paying for outcomes.',
                placeholder: 'e.g. IKEA Bristol, Bristol Waste, Visit West',
              }
            : fundingModel === 'hybrid'
            ? {
                label: 'Grant funder and corporate partner',
                hint: 'List all funders and corporate partners on this programme.',
                placeholder: 'e.g. Comic Relief (grant) + IKEA (corporate)',
              }
            : {
                label: 'Grant funder',
                hint: 'The trust, foundation, or statutory body funding this work.',
                placeholder: 'e.g. Comic Relief, Esmée Fairbairn, Bristol City Council',
              };
          return (
            <div className="mt-3">
              <Field label={meta.label} error={fe('funder_name')} hint={meta.hint}>
                <Input
                  name="funder_name"
                  defaultValue={initial?.funder_name ?? ''}
                  placeholder={meta.placeholder}
                />
              </Field>
            </div>
          );
        })()}
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
          <div className="text-[11px] text-ach-navy/55 mt-2">
            {optionalSet.size}/2 selected
          </div>
        </div>

        {CAP_DOMAINS.map(d => {
          const v = coreSet.has(d) ? 'primary' : optionalSet.has(d) ? 'supporting' : 'not_addressed';
          return <input key={d} type="hidden" name={`cap_${d}`} value={v} />;
        })}
      </div>

      <div className="pt-5 border-t-[0.5px] border-ach-border">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Programme activities</div>
        <p className="text-[12px] text-ach-navy/60 mb-3">
          Tick the activities this programme delivers. The assessment set is derived from this — you don&apos;t pick individual factors.
        </p>
        {relevantActivities.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-ach-border bg-ach-page/40 px-4 py-6 text-center">
            <p className="text-[12.5px] text-ach-navy/60">
              Pick at least one outcome or impact above to see the relevant activities appear here.
            </p>
            <p className="text-[11.5px] text-ach-navy/45 mt-1">
              Activities are filtered to the domains you selected, so the set stays focused and manageable.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {relevantActivities.map(act => {
                const selected = activitySet.has(act.id);
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => toggleActivity(act.id)}
                    className={`text-left p-3 rounded-[10px] border-[0.5px] transition-colors ${
                      selected
                        ? 'border-ach-navy bg-ach-navy text-ach-cream'
                        : 'border-ach-border bg-white text-ach-navy/80 hover:bg-ach-page'
                    }`}
                    aria-pressed={selected}
                  >
                    <div className="text-[13px] font-medium">{act.label}</div>
                    <div className={`text-[11px] mt-0.5 ${selected ? 'text-ach-cream/75' : 'text-ach-navy/55'}`}>
                      {act.hint}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-ach-navy/55 mt-2">
              {activitySet.size} activit{activitySet.size === 1 ? 'y' : 'ies'} ticked.
            </div>
            {[...activitySet].map(id => (
              <input key={id} type="hidden" name="activities" value={id} />
            ))}
          </>
        )}
      </div>

      {/* Training programmes are auto-created from ticked training activities
          (English, Digital, Customer service, H&S, Cultural awareness,
          Employability coaching). No separate tick section needed. */}

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
