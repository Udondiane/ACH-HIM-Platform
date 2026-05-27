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
  PROJECT_TYPES, PROJECT_TYPE_LABELS, WEIGHT_RATIOS, WEIGHT_RATIO_LABELS,
  HYBRID_OPTIONS, HYBRID_OPTION_LABELS, OPTIONAL_SCHEMES, OPTIONAL_SCHEME_LABELS,
  CLASSIFICATION_QUESTIONS,
  FUNDING_MODELS, FUNDING_MODEL_LABELS, FUNDING_MODEL_HINTS,
  CAP_DOMAINS, CAP_DOMAIN_LABELS, CAP_DOMAIN_HINTS,
  CAP_ANSWERS, CAP_ANSWER_LABELS,
  type FundingModel, type CapAnswer, type CapDomain,
} from '@/lib/projects/schema';
import type { ActionResult } from '@/lib/projects/actions';
import { classify } from '@/lib/scoring/classification';

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
  const [caps, setCaps] = useState<Record<CapDomain, CapAnswer | ''>>({
    employment: (initialCapsRaw.employment ?? '') as CapAnswer | '',
    education:  (initialCapsRaw.education  ?? '') as CapAnswer | '',
    belonging:  (initialCapsRaw.belonging  ?? '') as CapAnswer | '',
    social:     (initialCapsRaw.social     ?? '') as CapAnswer | '',
    health:     (initialCapsRaw.health     ?? '') as CapAnswer | '',
  });

  // Live classification — updates as user picks answers
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
                placeholder={fundingModel === 'hybrid' ? 'e.g. Comic Relief (transitioning out Oct 2026)' : 'e.g. Comic Relief, Esmée Fairbairn, Bristol City Council'}
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
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Capability domains</div>
        <p className="text-[12px] text-ach-navy/60 mb-4">
          For each capability area, indicate how this project relates to it. The system uses these to auto-select Core and Optional domains for HIM scoring — you can fine-tune the selection later if needed.
        </p>
        <div className="space-y-3">
          {CAP_DOMAINS.map(d => (
            <div key={d} className="space-y-1.5">
              <div>
                <Label>{CAP_DOMAIN_LABELS[d]}</Label>
                <div className="text-[11px] text-ach-navy/55 mt-0.5">{CAP_DOMAIN_HINTS[d]}</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CAP_ANSWERS.map(ans => (
                  <label
                    key={ans}
                    className={`flex items-center justify-center gap-1.5 text-[12px] cursor-pointer px-2 py-1.5 rounded-[8px] border-[0.5px] transition-colors text-center ${
                      caps[d] === ans
                        ? ans === 'primary'   ? 'border-ach-navy bg-ach-navy text-ach-cream'
                        : ans === 'supporting' ? 'border-ach-navy bg-ach-page text-ach-navy'
                                                : 'border-ach-border bg-ach-page/60 text-ach-navy/60'
                        : 'border-ach-border bg-white text-ach-navy/70 hover:bg-ach-page'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`cap_${d}`}
                      value={ans}
                      checked={caps[d] === ans}
                      onChange={() => setCaps({ ...caps, [d]: ans })}
                      className="sr-only"
                    />
                    {CAP_ANSWER_LABELS[ans]}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-ach-navy/55">
          Primary focus → Core domain · Supporting outcome → Optional domain · Not addressed → excluded from scoring.
        </div>
      </div>

      {/* Classification questionnaire */}
      <div className="pt-5 border-t-[0.5px] border-ach-border">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">
          Classification (V2)
        </div>
        <p className="text-[12px] text-ach-navy/60 mb-4">
          Answering these four questions derives the project type and suggests a weight ratio.
          You can override the suggestion below.
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
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
              Classification suggestion
            </div>
            <div className="text-[15px] font-medium text-ach-navy mt-1">
              {PROJECT_TYPE_LABELS[result.projectType]} · {WEIGHT_RATIO_LABELS[result.suggestedRatio]}
            </div>
            <div className="text-[12px] text-ach-navy/60 mt-1">
              Total {result.total}/8. Use the dropdowns below to accept or override.
            </div>
          </div>
        )}
      </div>

      {/* Weighting */}
      <div className="pt-5 border-t-[0.5px] border-ach-border space-y-4">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Weighting</div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Project type" error={fe('type')}>
            <Select name="type" defaultValue={initial?.type ?? result?.projectType ?? 'depth'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Weight ratio (α : β)" error={fe('weight_ratio')}>
            <Select name="weight_ratio" defaultValue={initial?.weight_ratio ?? result?.suggestedRatio ?? 'd3_1'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEIGHT_RATIOS.map(r => <SelectItem key={r} value={r}>{WEIGHT_RATIO_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Hybrid option (when type=hybrid)" error={fe('hybrid_option')}>
            <Select name="hybrid_option" defaultValue={initial?.hybrid_option ?? 'A'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HYBRID_OPTIONS.map(o => <SelectItem key={o} value={o}>{HYBRID_OPTION_LABELS[o]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Optional-score scheme" error={fe('optional_scheme')}>
            <Select name="optional_scheme" defaultValue={initial?.optional_scheme ?? 'simple_average'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPTIONAL_SCHEMES.map(s => <SelectItem key={s} value={s}>{OPTIONAL_SCHEME_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Stability blend (V2, 0 to 1)" error={fe('stability_blend')}>
          <Input
            name="stability_blend" type="number" step="0.01" min={0} max={1}
            defaultValue={initial?.stability_blend ?? 0}
          />
        </Field>
      </div>

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
