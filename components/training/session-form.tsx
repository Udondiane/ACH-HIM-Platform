'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SESSION_STATUS, SESSION_STATUS_LABELS } from '@/lib/training/schema';

type Result = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

interface Props {
  action: (prev: Result | null, fd: FormData) => Promise<Result>;
  programmes: { id: string; name: string }[];
  cohorts: { id: string; cohort_ref: string; name: string }[];
  initialProgrammeId?: string;
  initial?: Record<string, unknown> | null;
  submitLabel?: string;
  cancelHref?: string;
}

export function SessionForm({ action, programmes, cohorts, initialProgrammeId, initial, submitLabel = 'Save session', cancelHref }: Props) {
  const [state, formAction] = useFormState(action, null);
  const i = (initial ?? {}) as Record<string, string | number | null>;

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <div className="flex items-center gap-2 text-[12.5px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30">
          <AlertCircle className="h-3.5 w-3.5" />{state.error}
        </div>
      )}

      <SelectField label="Programme" name="programme_id" required defaultValue={initialProgrammeId ?? (i.programme_id as string) ?? ''} options={[{ v: '', l: '— select —' }, ...programmes.map(p => ({ v: p.id, l: p.name }))]} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Session number" name="session_number" type="number" defaultValue={String(i.session_number ?? '')} hint="e.g. 3 (of 12)" />
        <Field label="Session title" name="session_title" defaultValue={i.session_title as string ?? ''} hint="Topic covered" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" name="scheduled_date" type="date" required defaultValue={(i.scheduled_date as string) ?? new Date().toISOString().slice(0, 10)} />
        <SelectField label="Cohort (optional)" name="cohort_id" defaultValue={i.cohort_id as string ?? ''} options={[{ v: '', l: '— none —' }, ...cohorts.map(c => ({ v: c.id, l: `${c.cohort_ref} — ${c.name}` }))]} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start time" name="scheduled_start" type="time" defaultValue={(i.scheduled_start as string) ?? ''} />
        <Field label="End time" name="scheduled_end" type="time" defaultValue={(i.scheduled_end as string) ?? ''} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Room" name="room" defaultValue={i.room as string ?? ''} />
        <Field label="Tutor name" name="tutor_name" defaultValue={i.tutor_name as string ?? ''} hint="Free text until SSO wires ACH staff accounts." />
      </div>

      <SelectField label="Status" name="status" defaultValue={(i.status as string) ?? 'scheduled'} options={SESSION_STATUS.map(s => ({ v: s, l: SESSION_STATUS_LABELS[s] }))} />

      <div className="flex items-center gap-2 pt-2">
        <SubmitButton label={submitLabel} />
        {cancelHref && <a href={cancelHref}><Button type="button" variant="secondary">Cancel</Button></a>}
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue, type = 'text', required, hint }: { label: string; name: string; defaultValue?: string; type?: string; required?: boolean; hint?: string }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">{label}{required && <span className="text-[#8B3A4F]"> *</span>}</label>
      <input name={name} type={type} defaultValue={defaultValue} required={required} className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40" />
      {hint && <div className="text-[11px] text-ach-navy/55 mt-1">{hint}</div>}
    </div>
  );
}

function SelectField({ label, name, defaultValue, options, required }: { label: string; name: string; defaultValue?: string; options: { v: string; l: string }[]; required?: boolean }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">{label}{required && <span className="text-[#8B3A4F]"> *</span>}</label>
      <select name={name} defaultValue={defaultValue} required={required} className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : label}</Button>;
}
