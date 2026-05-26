'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createEvidencePackAction, type ActionResult } from '@/lib/evidence-packs/actions';

export function NewPackForm() {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(createEvidencePackAction, null);

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Title">
        <Input name="title" required placeholder="e.g. National Lottery Community Fund · Bristol Refugees 2026" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Funder">
          <Input name="funder" placeholder="National Lottery / Comic Relief / DLUHC…" />
        </Field>
        <Field label="Funding window">
          <Input name="funding_window" placeholder="2026/27" />
        </Field>
      </div>
      <Field label="Description">
        <Textarea name="description" rows={3} placeholder="Brief internal note about the pack purpose." />
      </Field>
      <Field label="Anonymisation level">
        <Select name="anonymisation_level" defaultValue="standard">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low — named candidates where consent given</SelectItem>
            <SelectItem value="standard">Standard — candidate refs only</SelectItem>
            <SelectItem value="high">High — aggregate-only, no individuals</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {state && !state.ok && (
        <div className="text-[13px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <SubmitBtn />
        <Link href="/evidence-pack"><Button variant="ghost" type="button">Cancel</Button></Link>
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

function SubmitBtn() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create pack'}</Button>;
}
