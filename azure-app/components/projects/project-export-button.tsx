'use client';

import { useTransition } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportProjectJsonAction } from '@/lib/assessments/actions';

export function ProjectExportButton({ projectId, projectRef }: { projectId: string; projectRef: string }) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result = await exportProjectJsonAction(projectId);
      if (!result.ok) {
        alert(`Export failed: ${result.error}`);
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${projectRef}-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <Button type="button" variant="secondary" onClick={onClick} disabled={pending}>
      <Download className="h-3.5 w-3.5" />
      {pending ? 'Exporting…' : 'Export'}
    </Button>
  );
}
