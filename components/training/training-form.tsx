'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { COMPLETION_STATUSES, COMPLETION_STATUS_LABELS } from '@/lib/training/schema';
import type { TrainingResult } from '@/lib/training/actions';

interface Props {
  action: (prev: TrainingResult | null, fd: FormData) => Promise<TrainingResult>;
  candidateId: string;
  cohortId?: string;
  initial?: any;
  cancelHref: string;
  submitLabel?: string;
}

export function TrainingForm({ action, candidateId, cohortId, initial, cancelHref, submitLabel = 'Save' }: Props) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="candidate_id" value={candidateId} />
      {cohortId && <input type="hidden" name="cohort_id" value={cohortId} />}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Training name">
          <Input name="training_name" required defaultValue={initial?.training_name ?? ''} placeholder="e.g. B2E Pre-placement 1-week intensive" />
        </Field>
        <Field label="Trainer">
          <Input name="trainer" defaultValue={initial?.trainer ?? ''} placeholder="e.g. ACH IAG team" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Scheduled start">
          <Input name="scheduled_start" type="date" defaultValue={initial?.scheduled_start ?? ''} />
        </Field>
        <Field label="Scheduled end">
          <Input name="scheduled_end" type="date" defaultValue={initial?.scheduled_end ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Sessions attended">
          <Input name="attended_sessions" type="number" min={0} defaultValue={initial?.attended_sessions ?? ''} />
        </Field>
        <Field label="Total sessions">
          <Input name="total_sessions" type="number" min={0} defaultValue={initial?.total_sessions ?? ''} />
        </Field>
        <Field label="Status">
          <select
            name="completion_status"
            defaultValue={initial?.completion_status ?? 'not_started'}
            className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
          >
            {COMPLETION_STATUSES.map(s => <option key={s} value={s}>{COMPLETION_STATUS_LABELS[s]}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Completion date">
          <Input name="completion_date" type="date" defaultValue={initial?.completion_date ?? ''} />
        </Field>
        <Field label="Certificate URL">
          <Input name="certificate_url" defaultValue={initial?.certificate_url ?? ''} placeholder="https://…" />
        </Field>
      </div>

      <Field label="Notes">
        <Textarea name="notes" defaultValue={initial?.notes ?? ''} rows={2} />
      </Field>

      {state && !state.ok && (
        <div className="text-[12.5px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <SubmitBtn>{submitLabel}</SubmitBtn>
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
