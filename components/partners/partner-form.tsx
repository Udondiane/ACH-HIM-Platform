'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PARTNER_TYPES, PARTNER_TYPE_LABELS, PARTNER_STATUSES, PARTNER_STATUS_LABELS } from '@/lib/partners/schema';
import type { ActionResult } from '@/lib/partners/actions';

interface Props {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  initial?: {
    name?: string;
    type?: typeof PARTNER_TYPES[number];
    status?: typeof PARTNER_STATUSES[number];
    sector?: string | null;
    region?: string | null;
    website?: string | null;
    employee_count?: number | null;
  };
  cancelHref: string;
  submitLabel?: string;
}

export function PartnerForm({ action, initial, cancelHref, submitLabel = 'Save partner' }: Props) {
  const [state, formAction] = useFormState(action, null);

  const fe = (k: string) => state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <Field label="Name" error={fe('name')}>
        <Input
          name="name"
          required
          defaultValue={initial?.name}
          placeholder="e.g. Burges Salmon"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Type" error={fe('type')}>
          <Select name="type" defaultValue={initial?.type ?? 'workforce_partner'}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {PARTNER_TYPES.map(t => (
                <SelectItem key={t} value={t}>{PARTNER_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Status" error={fe('status')}>
          <Select name="status" defaultValue={initial?.status ?? 'prospect'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PARTNER_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{PARTNER_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Sector" error={fe('sector')}>
          <Input name="sector" defaultValue={initial?.sector ?? ''} placeholder="Legal, Hospitality…" />
        </Field>
        <Field label="Region" error={fe('region')}>
          <Input name="region" defaultValue={initial?.region ?? ''} placeholder="Bristol, Birmingham…" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Website" error={fe('website')}>
          <Input name="website" defaultValue={initial?.website ?? ''} placeholder="https://…" />
        </Field>
        <Field label="Employee count" error={fe('employee_count')}>
          <Input
            name="employee_count"
            type="number"
            min={0}
            defaultValue={initial?.employee_count ?? ''}
            placeholder="e.g. 750"
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
        <Link href={cancelHref}>
          <Button variant="ghost" type="button">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <div className="text-[12px] text-[#8B3A4F]">{error}</div>}
    </div>
  );
}

function SubmitBtn({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : children}</Button>;
}
