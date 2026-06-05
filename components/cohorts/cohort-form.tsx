'use client';

import { useState, useEffect, useMemo } from 'react';
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
  COHORT_STRUCTURES, COHORT_STRUCTURE_LABELS,
  COHORT_SERVICE_TYPES, COHORT_SERVICE_TYPE_LABELS, COHORT_SERVICE_TYPE_HINTS,
} from '@/lib/cohorts/schema';
import type { ActionResult } from '@/lib/cohorts/actions';

interface Props {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  initial?: any;
  cancelHref: string;
  submitLabel?: string;
  projects?: { id: string; name: string; project_ref: string }[];
}

/** Project name fragment that toggles the IAG / Full-programme picker on.
 *  Service type is only meaningful for Bridge to Employment cohorts where
 *  someone might enrol IAG-only without entering the full pipeline. Other
 *  projects don't have that distinction.
 */
const BRIDGE_TO_EMPLOYMENT_MARKER = /bridge.+employment/i;

/** Cohort ref slug from a project name — first three uppercase initials of
 *  the project name's words, falling back to first three letters if needed. */
function projectSlug(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'PRJ';
  const initials = words.map(w => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '');
  if (initials.length >= 3) return initials.slice(0, 3);
  return name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
}

/** Generate a sensible cohort_ref client-side. Server reconciles uniqueness
 *  on save by appending an incrementing tail if a collision is detected. */
function generateCohortRef(projectName: string | null, today: Date = new Date()): string {
  const slug = projectName ? projectSlug(projectName) : 'COH';
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${slug}-${year}-Q${quarter}`;
}

/** Auto-derived display name from project + quarter. */
function generateCohortName(projectName: string | null, today: Date = new Date()): string {
  if (!projectName) return '';
  const year = today.getFullYear();
  const quarter = Math.ceil((today.getMonth() + 1) / 3);
  return `${projectName} — Q${quarter} ${year}`;
}

function weeksBetween(startIso: string, endIso: string): number | '' {
  if (!startIso || !endIso) return '';
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return '';
  return Math.round(diff / (1000 * 60 * 60 * 24 * 7));
}

export function CohortForm({ action, initial, cancelHref, submitLabel = 'Save cohort', projects = [] }: Props) {
  const [state, formAction] = useFormState(action, null);
  const fe = (k: string) => state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;

  const [projectId, setProjectId] = useState<string>(initial?.project_id ?? '__none__');
  const selectedProject = useMemo(
    () => projects.find(p => p.id === projectId) ?? null,
    [projects, projectId],
  );
  const isBridgeToEmployment = !!selectedProject && BRIDGE_TO_EMPLOYMENT_MARKER.test(selectedProject.name);

  const [startDate, setStartDate] = useState<string>(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState<string>(initial?.end_date ?? '');
  const autoWeeks = weeksBetween(startDate, endDate);
  const [serviceType, setServiceType] = useState<string>(initial?.service_type ?? 'full_programme');

  // Auto-derived ref + name update when project changes (unless we're editing
  // an existing cohort, where the saved ref/name win).
  const [cohortRef, setCohortRef] = useState<string>(
    initial?.cohort_ref ?? generateCohortRef(null),
  );
  const [cohortName, setCohortName] = useState<string>(
    initial?.name ?? '',
  );
  useEffect(() => {
    if (initial?.cohort_ref || initial?.name) return; // edit mode — leave saved values
    if (!selectedProject) return;
    setCohortRef(generateCohortRef(selectedProject.name));
    setCohortName(generateCohortName(selectedProject.name));
  }, [selectedProject, initial?.cohort_ref, initial?.name]);

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      {/* status auto-set to 'planned' on create — no field required */}
      <input type="hidden" name="status" value={initial?.status ?? 'planned'} />

      <Field label="Project" error={fe('project_id')}>
        <Select name="project_id" value={projectId} onValueChange={setProjectId}>
          <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None (unlinked) —</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.project_ref} · {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Reference" error={fe('cohort_ref')} hint="Auto-generated from project + quarter.">
          <Input
            name="cohort_ref"
            required
            value={cohortRef}
            onChange={e => setCohortRef(e.target.value)}
          />
        </Field>
        <Field label="Name" error={fe('name')} hint="Auto-filled from project.">
          <Input
            name="name"
            required
            value={cohortName}
            onChange={e => setCohortName(e.target.value)}
            placeholder="Auto"
          />
        </Field>
      </div>

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

      {isBridgeToEmployment ? (
        <Field
          label="Programme type"
          error={fe('service_type')}
          hint={COHORT_SERVICE_TYPE_HINTS[serviceType as typeof COHORT_SERVICE_TYPES[number]]}
        >
          <Select name="service_type" value={serviceType} onValueChange={setServiceType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COHORT_SERVICE_TYPES.map(s => <SelectItem key={s} value={s}>{COHORT_SERVICE_TYPE_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="service_type" value="full_programme" />
      )}

      <Field label="Sector focus" error={fe('sector_focus')}>
        <Input name="sector_focus" defaultValue={initial?.sector_focus ?? ''} placeholder="Hospitality, Retail, Construction" />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Start date" error={fe('start_date')}>
          <Input
            name="start_date"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="End date" error={fe('end_date')}>
          <Input
            name="end_date"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </Field>
        <Field label="Programme weeks" error={fe('programme_weeks')} hint="Auto from dates.">
          <Input
            name="programme_weeks"
            type="number"
            min={0}
            max={104}
            value={autoWeeks === '' ? '' : autoWeeks}
            readOnly
            className="bg-ach-page text-ach-navy/70 cursor-not-allowed"
          />
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
