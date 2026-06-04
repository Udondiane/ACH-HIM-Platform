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
  SALARY_BANDS, SALARY_BAND_LABELS,
  PLACEMENT_STATUSES, PLACEMENT_STATUS_LABELS,
} from '@/lib/placements/schema';
import type { ActionResult } from '@/lib/placements/actions';

interface Props {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  candidateId: string;
  candidateRef: string;
  candidateName: string;
  partners: { id: string; name: string }[];
  cohorts: { id: string; cohort_ref: string; name: string }[];
  defaultCohortId?: string | null;
  cancelHref: string;
}

export function PlacementForm({
  action, candidateId, candidateRef, candidateName, partners, cohorts, defaultCohortId, cancelHref,
}: Props) {
  const [state, formAction] = useFormState(action, null);
  const fe = (k: string) => state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <input type="hidden" name="candidate_id" value={candidateId} />

      <div className="rounded-[10px] bg-ach-page border-[0.5px] border-ach-border px-3 py-2.5 text-[12.5px] text-ach-navy/85">
        Recording placement for <span className="font-medium text-ach-navy">{candidateRef}</span> · {candidateName}.
        Milestones (placement / 6-month / 12-month) are created automatically based on salary band.
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Workforce partner" error={fe('partner_id')}>
          <Select name="partner_id">
            <SelectTrigger><SelectValue placeholder="Choose partner" /></SelectTrigger>
            <SelectContent>
              {partners.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cohort (optional)" error={fe('cohort_id')}>
          <Select name="cohort_id" defaultValue={defaultCohortId ?? '__none__'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              {cohorts.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.cohort_ref} · {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Role title" error={fe('role_title')}>
        <Input name="role_title" required placeholder="e.g. Warehouse Operative, Customer Service Adviser" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Salary band" error={fe('salary_band')} hint="Drives the milestone schedule (memo §5 amounts).">
          <Select name="salary_band" defaultValue="standard">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SALARY_BANDS.map(b => (
                <SelectItem key={b} value={b}>{SALARY_BAND_LABELS[b]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Actual salary (£, optional)" error={fe('salary_actual')}>
          <Input name="salary_actual" type="number" min={0} step="100" placeholder="e.g. 24500" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" error={fe('start_date')}>
          <Input name="start_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="Status" error={fe('status')}>
          <Select name="status" defaultValue="started">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLACEMENT_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{PLACEMENT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <label className="flex items-start gap-2.5 text-[13px] text-ach-navy/80 cursor-pointer">
        <input
          type="checkbox"
          name="sponsored_placement"
          defaultChecked
          className="mt-0.5 h-4 w-4 rounded border-ach-border text-ach-navy focus:ring-ach-navy/40"
        />
        <span>
          <span className="text-ach-navy font-medium">Sponsored placement</span>
          <span className="block text-ach-navy/60 mt-0.5 text-[12px]">
            Tick if this employer was the candidate&apos;s sponsoring partner. Untick for placements made through a different employer.
          </span>
        </span>
      </label>

      <Field label="Notes (optional)" error={fe('notes')}>
        <Textarea name="notes" rows={3} placeholder="Onboarding context, line manager, working pattern, anything that matters for retention." />
      </Field>

      {state && !state.ok && state.error && !state.fieldErrors && (
        <div className="text-[13px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <SubmitBtn />
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

function SubmitBtn() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Recording…' : 'Record placement'}</Button>;
}
