'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PARTNER_TYPES, PARTNER_TYPE_LABELS, PARTNER_STATUSES, PARTNER_STATUS_LABELS, type PartnerType } from '@/lib/partners/schema';
import type { ActionResult } from '@/lib/partners/actions';

interface Props {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  initial?: {
    name?: string;
    type?: PartnerType;
    types?: PartnerType[];
    status?: typeof PARTNER_STATUSES[number];
    sector?: string | null;
    region?: string | null;
    website?: string | null;
    employee_count?: number | null;
  };
  cancelHref: string;
  submitLabel?: string;
}

const TYPE_HINTS: Record<PartnerType, string> = {
  workforce_partner:   'Hires candidates into roles. Pays placement fees.',
  capability_investor: 'Sponsors cohorts financially. Receives capability uplift reporting.',
  training_partner:    'Pays ACH to deliver ED&I or cultural-awareness training to their staff.',
};

export function PartnerForm({ action, initial, cancelHref, submitLabel = 'Save partner' }: Props) {
  const [state, formAction] = useFormState(action, null);
  const fe = (k: string) => state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;

  // initial.types takes precedence; fall back to wrapping the legacy single type.
  const initialTypes: PartnerType[] = initial?.types && initial.types.length > 0
    ? initial.types
    : initial?.type ? [initial.type] : [];

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

      <div>
        <Label>Partner type{state && !state.ok && fe('types') && (
          <span className="text-[12px] text-[#8B3A4F] ml-2 font-normal">{fe('types')}</span>
        )}</Label>
        <div className="text-[11.5px] text-ach-navy/70 mt-0.5 mb-2">
          Tick every relationship that applies — they overlap freely. A Workforce Partner can also be a
          Capability Investor (e.g. an employer that hires candidates AND sponsors cohorts), and a
          Training Partner can also be a Workforce Partner (e.g. a firm that commissions ED&amp;I training
          AND hires through ACH). Pick all that apply.
        </div>
        <div className="space-y-2">
          {PARTNER_TYPES.map(t => (
            <label
              key={t}
              className="flex items-start gap-2.5 text-[13px] cursor-pointer p-3 rounded-[10px] border-[0.5px] border-ach-border hover:bg-ach-page transition-colors"
            >
              <input
                type="checkbox"
                name="types"
                value={t}
                defaultChecked={initialTypes.includes(t)}
                className="mt-0.5 h-4 w-4 rounded border-ach-border text-ach-navy focus:ring-ach-navy/40"
              />
              <span>
                <span className="text-ach-navy font-medium">{PARTNER_TYPE_LABELS[t]}</span>
                <span className="block text-ach-navy/60 mt-0.5 text-[12px]">{TYPE_HINTS[t]}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

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
