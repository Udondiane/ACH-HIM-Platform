'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CANDIDATE_STATUSES, CANDIDATE_STATUS_LABELS, LOCALES, LOCALE_NAMES,
  EXIT_REASONS, EXIT_REASON_LABELS,
} from '@/lib/candidates/schema';
import type { ActionResult } from '@/lib/candidates/actions';

interface Props {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  initial?: any;
  cancelHref: string;
  submitLabel?: string;
  /** When true, the candidate_ref field is read-only (edit mode). */
  refLocked?: boolean;
}

export function CandidateForm({ action, initial, cancelHref, submitLabel = 'Save candidate', refLocked = false }: Props) {
  const [state, formAction] = useFormState(action, null);
  const fe = (k: string) => state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;
  const isEdit = !!initial?.candidate_ref;

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Candidate reference" error={fe('candidate_ref')} hint={!isEdit ? 'Leave blank to auto-generate (e.g. C-2026-012)' : undefined}>
          <Input
            name="candidate_ref"
            defaultValue={initial?.candidate_ref}
            placeholder="Auto"
            readOnly={refLocked}
            className={refLocked ? 'bg-ach-page text-ach-navy/60 cursor-not-allowed' : undefined}
          />
        </Field>
        <Field label="Status" error={fe('status')}>
          <Select name="status" defaultValue={initial?.status ?? 'applicant'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CANDIDATE_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{CANDIDATE_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Given name" error={fe('given_name')}>
          <Input name="given_name" required defaultValue={initial?.given_name} />
        </Field>
        <Field label="Family name" error={fe('family_name')}>
          <Input name="family_name" defaultValue={initial?.family_name ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Preferred language" error={fe('preferred_locale')}>
          <Select name="preferred_locale" defaultValue={initial?.preferred_locale ?? 'en'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOCALES.map(l => (
                <SelectItem key={l} value={l}>{LOCALE_NAMES[l]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Country of origin" error={fe('country_of_origin')}>
          <Input name="country_of_origin" defaultValue={initial?.country_of_origin ?? ''} />
        </Field>
        <Field label="Arrival year" error={fe('arrival_year')}>
          <Input name="arrival_year" type="number" min={1980} max={2100} defaultValue={initial?.arrival_year ?? ''} />
        </Field>
      </div>

      <Field label="English level" error={fe('english_level')}>
        <Input name="english_level" defaultValue={initial?.english_level ?? ''} placeholder="A1, A2, B1, B2, C1, C2" />
      </Field>

      <label className="flex items-start gap-2.5 text-[13px] text-ach-navy/80 cursor-pointer">
        <input
          type="checkbox"
          name="is_ach_tenant"
          defaultChecked={!!initial?.is_ach_tenant}
          className="mt-0.5 h-4 w-4 rounded border-ach-border text-ach-navy focus:ring-ach-navy/40"
        />
        <span>
          <span className="text-ach-navy font-medium">Currently an ACH tenant</span>
          <span className="block text-ach-navy/60 mt-0.5">
            Tick if this candidate also rents accommodation from ACH. Used for housing-linked outcome reporting and integrated support pathways.
          </span>
        </span>
      </label>

      <div className="pt-3 border-t-[0.5px] border-ach-border">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">
          Private — staff only
        </div>
        <p className="text-[12px] text-ach-navy/60 mb-3">
          The fields below are visible to ACH staff and to the candidate. They are <span className="font-medium">never</span> shown to partners
          unless the candidate has explicitly consented (Consent panel on the detail page).
        </p>

        <div className="space-y-4">
          <Field label="Career goal summary" error={fe('career_goal_summary')}>
            <Textarea name="career_goal_summary" defaultValue={initial?.career_goal_summary ?? ''} rows={3} />
          </Field>
          <Field label="Development plan" error={fe('development_plan')}>
            <Textarea name="development_plan" defaultValue={initial?.development_plan ?? ''} rows={4} />
          </Field>
        </div>
      </div>

      <div className="pt-3 border-t-[0.5px] border-ach-border">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">
          Exit (if applicable)
        </div>
        <p className="text-[12px] text-ach-navy/60 mb-3">
          When a candidate leaves the programme, capture WHY. The platform reports cohort outcomes both ways — completers basis AND intention-to-treat (dropouts held at baseline) — so leavers stay in the analysis. &quot;Got a job&quot; is a programme WIN, not a loss.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <Field label="Exit reason" error={fe('exit_reason')}>
            <select
              name="exit_reason"
              defaultValue={initial?.exit_reason ?? ''}
              className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
            >
              <option value="">— Not exited —</option>
              {EXIT_REASONS.map(r => <option key={r} value={r}>{EXIT_REASON_LABELS[r]}</option>)}
            </select>
          </Field>
          <Field label="Exit date" error={fe('exit_date')}>
            <Input name="exit_date" type="date" defaultValue={initial?.exit_date ?? ''} />
          </Field>
        </div>
        <Field label="Exit notes" error={fe('exit_notes')} hint="Concrete detail for the cohort funnel — name of employer, course title, follow-up plan, etc.">
          <Textarea name="exit_notes" defaultValue={initial?.exit_notes ?? ''} rows={2} />
        </Field>
      </div>

      <Field label="Internal notes" error={fe('notes')}>
        <Textarea name="notes" defaultValue={initial?.notes ?? ''} rows={3} />
      </Field>

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
      {hint && !error && <div className="text-[11px] text-ach-navy/50">{hint}</div>}
      {error && <div className="text-[12px] text-[#8B3A4F]">{error}</div>}
    </div>
  );
}

function SubmitBtn({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : children}</Button>;
}
