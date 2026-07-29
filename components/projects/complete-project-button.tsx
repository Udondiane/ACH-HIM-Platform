'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { markProjectCompletedAction } from '@/lib/projects/actions';

interface Props {
  projectId: string;
  isCompleted: boolean;
  initial?: {
    what_worked?: string | null;
    challenges?: string | null;
    unexpected?: string | null;
  };
}

export function CompleteProjectButton({ projectId, isCompleted, initial }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!open) {
    return (
      <Button
        type="button"
        variant={isCompleted ? 'secondary' : 'primary'}
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {isCompleted ? 'Update completion narrative' : 'Mark project completed'}
      </Button>
    );
  }

  const submit = (fd: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await markProjectCompletedAction(projectId, {
        what_worked: String(fd.get('what_worked') ?? ''),
        challenges: String(fd.get('challenges') ?? ''),
        unexpected: String(fd.get('unexpected') ?? ''),
      });
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      router.push(`/projects/${projectId}/outcomes-report`);
    });
  };

  return (
    <div className="rounded-[12px] border-[0.5px] border-ach-border bg-white p-4 min-w-[420px] shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Close-out narrative</div>
        <button onClick={() => setOpen(false)} className="text-ach-navy/60 hover:text-ach-navy"><X className="h-3.5 w-3.5" /></button>
      </div>
      <p className="text-[12px] text-ach-navy/60 mb-3">
        Three short answers that go into the outcomes report alongside the quantitative HIM data.
        Skip a field if there's nothing to say.
      </p>
      <form action={submit} className="space-y-3">
        <Field label="What worked well">
          <textarea
            name="what_worked"
            defaultValue={initial?.what_worked ?? ''}
            rows={3}
            className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
          />
        </Field>
        <Field label="Challenges encountered">
          <textarea
            name="challenges"
            defaultValue={initial?.challenges ?? ''}
            rows={3}
            className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
          />
        </Field>
        <Field label="Anything unexpected">
          <textarea
            name="unexpected"
            defaultValue={initial?.unexpected ?? ''}
            rows={3}
            className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
          />
        </Field>
        {error && <div className="text-[11.5px] text-[#8B3A4F]">{error}</div>}
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save and generate report'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium block">{label}</label>
      {children}
    </div>
  );
}
