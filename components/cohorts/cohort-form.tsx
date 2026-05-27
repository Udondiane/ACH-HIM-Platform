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
  COHORT_STRUCTURES, COHORT_STRUCTURE_LABELS, COHORT_STATUSES, COHORT_STATUS_LABELS,
} from '@/lib/cohorts/schema';
import type { ActionResult } from '@/lib/cohorts/actions';

interface Props {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  initial?: any;
  cancelHref: string;
  submitLabel?: string;
  projects?: { id: string; name: string; project_ref: string }[];
}

export function CohortForm({ action, initial, cancelHref, submitLabel = 'Save cohort', projects = [] }: Props) {
  const [state, formAction] = useFormState(action, null);
  const fe = (k: string) => state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Reference" error={fe('cohort_ref')}>
          <Input name="cohort_ref" required defaultValue={initial?.cohort_ref} placeholder="BRI-2026-Q3" />
        </Field>
        <Field label="Status" error={fe('status')}>
          <Select name="status" defaultValue={initial?.status ?? 'planned'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COHORT_STATUSES.map(s => <SelectItem key={s} value={s}>{COHORT_STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Project" error={fe('project_id')} hint="The intervention design this cohort runs. Sets the Core/Optional capability mix used in HIM scoring.">
        <Select name="project_id" defaultValue={initial?.project_id ?? ''}>
          <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">— None (unlinked) —</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.project_ref} · {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Name" error={fe('name')}>
        <Input name="name" required defaultValue={initial?.name} placeholder="Bridge to Employment — Bristol Q3 2026" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Structure" error={fe('structure')}>
          <Select name="structure" defaultValue={initial?.structure ?? 'multi_partner'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COHORT_STRUCTURES.map(s => <SelectItem key={s} value={s}>{COHORT_STRUCTURE_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Location" error={fe('location')}>
          <Input name="location" defaultValue={initial?.location ?? ''} placeholder="Bristol" />
        </Field>
      </div>

      <Field label="Sector focus" error={fe('sector_focus')}>
        <Input name="sector_focus" defaultValue={initial?.sector_focus ?? ''} placeholder="Hospitality, Retail, Construction" />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Start date" error={fe('start_date')}>
          <Input name="start_date" type="date" defaultValue={initial?.start_date ?? ''} />
        </Field>
        <Field label="End date" error={fe('end_date')}>
          <Input name="end_date" type="date" defaultValue={initial?.end_date ?? ''} />
        </Field>
        <Field label="Programme weeks" error={fe('programme_weeks')}>
          <Input name="programme_weeks" type="number" min={0} max={104} defaultValue={initial?.programme_weeks ?? ''} placeholder="12" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Target cohort size" error={fe('target_size')}>
          <Input name="target_size" type="number" min={0} defaultValue={initial?.target_size ?? ''} placeholder="11" />
        </Field>
        <Field label="Delivery cost (internal)" error={fe('delivery_cost')}>
          <Input name="delivery_cost" type="number" step="0.01" min={0} defaultValue={initial?.delivery_cost ?? ''} placeholder="17570.00" />
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
