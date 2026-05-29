'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  INTERVIEW_KINDS, INTERVIEW_KIND_LABELS,
  INTERVIEW_OUTCOMES, INTERVIEW_OUTCOME_LABELS,
  type InterviewKind,
} from '@/lib/interviews/schema';
import type { InterviewResult } from '@/lib/interviews/actions';

interface Props {
  action: (prev: InterviewResult | null, fd: FormData) => Promise<InterviewResult>;
  candidateId: string;
  cohortId?: string;
  partnerId?: string;
  initial?: any;
  /** When true, the kind is locked to partner_interview and not editable
      (used in the partner portal where IKEA's HR is recording their
      own interview). */
  partnerSide?: boolean;
  cancelHref: string;
  submitLabel?: string;
}

export function InterviewForm({
  action, candidateId, cohortId, partnerId, initial, partnerSide, cancelHref, submitLabel = 'Save interview',
}: Props) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <input type="hidden" name="candidate_id" value={candidateId} />
      {cohortId && <input type="hidden" name="cohort_id" value={cohortId} />}
      {(partnerId || partnerSide) && <input type="hidden" name="partner_id" value={partnerId ?? initial?.partner_id ?? ''} />}
      {partnerSide && <input type="hidden" name="kind" value="partner_interview" />}

      {!partnerSide && (
        <Field label="Interview type">
          <select
            name="kind"
            defaultValue={initial?.kind ?? 'ach_selection'}
            className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
          >
            {INTERVIEW_KINDS.map(k => (
              <option key={k} value={k}>{INTERVIEW_KIND_LABELS[k]}</option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Interviewer name">
          <Input name="interviewer_name" defaultValue={initial?.interviewer_name ?? ''} placeholder={partnerSide ? 'e.g. Linnea Bergström' : 'e.g. Sarah Patel'} />
        </Field>
        <Field label="Interviewer role">
          <Input name="interviewer_role" defaultValue={initial?.interviewer_role ?? ''} placeholder={partnerSide ? 'e.g. Store Manager, HR Lead' : 'e.g. ACH IAG Caseworker'} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Scheduled for">
          <Input name="scheduled_for" type="date" defaultValue={initial?.scheduled_for ?? ''} />
        </Field>
        <Field label="Conducted on">
          <Input name="conducted_on" type="date" defaultValue={initial?.conducted_on ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Outcome">
          <select
            name="outcome"
            defaultValue={initial?.outcome ?? 'pending'}
            className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
          >
            {INTERVIEW_OUTCOMES.map(o => (
              <option key={o} value={o}>{INTERVIEW_OUTCOME_LABELS[o]}</option>
            ))}
          </select>
        </Field>
        <Field label="Fit score (1–5)" hint="Optional. 1 = poor fit · 5 = excellent fit.">
          <Input name="fit_score" type="number" min={1} max={5} defaultValue={initial?.fit_score ?? ''} />
        </Field>
      </div>

      <Field label="Strengths">
        <Textarea name="strengths" defaultValue={initial?.strengths ?? ''} rows={3} placeholder="What stood out positively?" />
      </Field>

      <Field label="Development areas">
        <Textarea name="development_areas" defaultValue={initial?.development_areas ?? ''} rows={3} placeholder="Where would they need support?" />
      </Field>

      <Field label="General feedback / decision rationale">
        <Textarea name="general_feedback" defaultValue={initial?.general_feedback ?? ''} rows={3} />
      </Field>

      {!partnerSide && (
        <Field label="Internal notes (ACH staff only)" hint="Not shared with the candidate or the partner.">
          <Textarea name="notes_internal" defaultValue={initial?.notes_internal ?? ''} rows={2} />
        </Field>
      )}

      {state && !state.ok && (
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

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <div className="text-[11px] text-ach-navy/55">{hint}</div>}
    </div>
  );
}

function SubmitBtn({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : children}</Button>;
}
