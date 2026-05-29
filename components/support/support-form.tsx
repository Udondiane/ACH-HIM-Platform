'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SUPPORT_KINDS, SUPPORT_KIND_LABELS } from '@/lib/support/schema';
import type { SupportResult } from '@/lib/support/actions';

interface Props {
  action: (prev: SupportResult | null, fd: FormData) => Promise<SupportResult>;
  candidateId: string;
  cancelHref: string;
  submitLabel?: string;
}

export function SupportForm({ action, candidateId, cancelHref, submitLabel = 'Log support' }: Props) {
  const [state, formAction] = useFormState(action, null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="candidate_id" value={candidateId} />

      <div className="grid grid-cols-3 gap-3">
        <Field label="Kind">
          <select
            name="kind"
            defaultValue="casework_call"
            className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
          >
            {SUPPORT_KINDS.map(k => <option key={k} value={k}>{SUPPORT_KIND_LABELS[k]}</option>)}
          </select>
        </Field>
        <Field label="Provided on">
          <Input name="provided_on" type="date" required defaultValue={today} />
        </Field>
        <Field label="Duration (mins)">
          <Input name="duration_mins" type="number" min={0} placeholder="e.g. 30" />
        </Field>
      </div>

      <Field label="Caseworker">
        <Input name="caseworker" placeholder="e.g. Sarah Patel" />
      </Field>

      <Field label="Summary">
        <Textarea name="summary" required rows={3} placeholder="What was discussed, what support was given." />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Next action">
          <Input name="next_action" placeholder="e.g. Refer to housing officer" />
        </Field>
        <Field label="By when">
          <Input name="next_action_by" type="date" />
        </Field>
      </div>

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
