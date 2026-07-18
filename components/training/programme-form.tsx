'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PROGRAMME_STATUS,
  PROGRAMME_STATUS_LABELS,
  PROGRAMME_CATEGORIES,
  PROGRAMME_CATEGORY_LABELS,
} from '@/lib/training/schema';

type Result = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

interface Props {
  action: (prev: Result | null, fd: FormData) => Promise<Result>;
  initial?: Record<string, unknown> | null;
  submitLabel?: string;
  cancelHref?: string;
}

export function ProgrammeForm({ action, initial, submitLabel = 'Save programme', cancelHref }: Props) {
  const [state, formAction] = useFormState(action, null);
  const i = (initial ?? {}) as Record<string, string | number | null>;

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <div className="flex items-center gap-2 text-[12.5px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30">
          <AlertCircle className="h-3.5 w-3.5" />{state.error}
        </div>
      )}

      <Field label="Programme name" name="name" defaultValue={i.name as string ?? ''} required errors={state && !state.ok ? state.fieldErrors?.name : undefined} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Code (optional)" name="code" defaultValue={i.code as string ?? ''} hint="e.g. ESOL-L1" />
        <SelectField label="Category" name="category" defaultValue={i.category as string ?? ''} options={[{ v: '', l: '— select —' }, ...PROGRAMME_CATEGORIES.map(c => ({ v: c, l: PROGRAMME_CATEGORY_LABELS[c] }))]} />
      </div>

      <TextAreaField label="Description" name="description" defaultValue={i.description as string ?? ''} rows={3} hint="What learners will get out of this programme." />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration (hours)" name="duration_hours" type="number" defaultValue={String(i.duration_hours ?? '')} />
        <Field label="Total sessions" name="total_sessions" type="number" defaultValue={String(i.total_sessions ?? '')} />
      </div>

      <Field label="Certificate template name (optional)" name="certificate_template" defaultValue={i.certificate_template as string ?? ''} hint="Reference for the certificate template. Default template used if empty." />

      <SelectField label="Status" name="status" defaultValue={(i.status as string) ?? 'active'} options={PROGRAMME_STATUS.map(s => ({ v: s, l: PROGRAMME_STATUS_LABELS[s] }))} />

      <div className="flex items-center gap-2 pt-2">
        <SubmitButton label={submitLabel} />
        {cancelHref && <a href={cancelHref}><Button type="button" variant="secondary">Cancel</Button></a>}
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue, type = 'text', required, hint, errors }: { label: string; name: string; defaultValue?: string; type?: string; required?: boolean; hint?: string; errors?: string[] }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">{label}{required && <span className="text-[#8B3A4F]"> *</span>}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
      />
      {hint && <div className="text-[11px] text-ach-navy/55 mt-1">{hint}</div>}
      {errors?.map((e, i) => <div key={i} className="text-[11.5px] text-[#8B3A4F] mt-1">{e}</div>)}
    </div>
  );
}

function TextAreaField({ label, name, defaultValue, rows = 3, hint }: { label: string; name: string; defaultValue?: string; rows?: number; hint?: string }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">{label}</label>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
      />
      {hint && <div className="text-[11px] text-ach-navy/55 mt-1">{hint}</div>}
    </div>
  );
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue?: string; options: { v: string; l: string }[] }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
      >
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : label}</Button>;
}
