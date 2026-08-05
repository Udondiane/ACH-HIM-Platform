'use client';

import { useState, useTransition } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  action: () => void | Promise<void>;
  projectName: string;
  projectRef: string;
  cohortCount: number;
  assessmentCount: number;
}

export function DeleteProjectButton({
  action, projectName, projectRef, cohortCount, assessmentCount,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [pending, startTransition] = useTransition();

  const expected = projectRef;
  const canDelete = confirmInput.trim() === expected;

  if (!confirming) {
    return (
      <Button variant="danger" type="button" onClick={() => setConfirming(true)}>
        <Trash2 className="h-3.5 w-3.5" />Delete project
      </Button>
    );
  }

  return (
    <div className="rounded-[10px] border-[0.5px] border-ach-rose/40 bg-ach-rose/5 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-5 w-5 text-[#8B3A4F] shrink-0 mt-0.5" />
        <div className="text-[13px] text-ach-navy/85 space-y-1.5">
          <p className="font-medium text-ach-navy">Permanently delete &ldquo;{projectName}&rdquo;?</p>
          <p>
            This removes the project and its capability mix. {cohortCount} linked cohort{cohortCount === 1 ? '' : 's'} and{' '}
            {assessmentCount} assessment{assessmentCount === 1 ? '' : 's'} will be preserved but unlinked from the project.
          </p>
          <p className="text-[12px] text-ach-navy/70 pt-1">
            To confirm, type the project reference <code className="bg-white px-1.5 py-0.5 rounded text-[11.5px] border-[0.5px] border-ach-border">{expected}</code> below.
          </p>
        </div>
      </div>

      <input
        type="text"
        value={confirmInput}
        onChange={e => setConfirmInput(e.target.value)}
        placeholder={expected}
        className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-rose/40"
        autoFocus
      />

      <div className="flex items-center gap-2">
        <Button
          variant="danger"
          type="button"
          disabled={!canDelete || pending}
          onClick={() => {
            if (!canDelete) return;
            startTransition(async () => { await action(); });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {pending ? 'Deleting…' : 'Yes, delete permanently'}
        </Button>
        <Button
          variant="ghost"
          type="button"
          disabled={pending}
          onClick={() => { setConfirming(false); setConfirmInput(''); }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
