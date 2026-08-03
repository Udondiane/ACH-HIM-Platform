'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteProgrammeAction } from '@/lib/training/actions';

interface Props {
  programmeId: string;
  programmeName: string;
  enrolmentCount: number;
  sessionCount: number;
}

export function DeleteProgrammeButton({ programmeId, programmeName, enrolmentCount, sessionCount }: Props) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    const parts: string[] = [];
    if (enrolmentCount > 0) parts.push(`${enrolmentCount} enrolment${enrolmentCount === 1 ? '' : 's'}`);
    if (sessionCount > 0) parts.push(`${sessionCount} session${sessionCount === 1 ? '' : 's'}`);
    const tail = parts.length > 0
      ? `\n\nThis will also delete ${parts.join(' and ')}. This can't be undone.`
      : '\n\nThis can\'t be undone.';
    if (!window.confirm(`Delete "${programmeName}"?${tail}`)) return;
    startTransition(async () => {
      await deleteProgrammeAction(programmeId);
    });
  };

  return (
    <Button variant="danger" type="button" onClick={onClick} disabled={pending}>
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? 'Deleting…' : 'Delete'}
    </Button>
  );
}
