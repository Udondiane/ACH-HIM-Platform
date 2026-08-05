'use client';

import { useTransition, useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateCohortReportAction, type CohortReportType } from '@/lib/cohort-reports/actions';

export function SnapshotButton({
  cohortId,
  snapshot,
  reportType,
}: {
  cohortId: string;
  snapshot: Record<string, unknown>;
  reportType: CohortReportType;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const snap = () => {
    startTransition(async () => {
      setMsg(null);
      const r = await generateCohortReportAction({
        cohort_id: cohortId,
        report_type: reportType,
        snapshot,
      });
      setMsg(r.ok ? 'Snapshot saved to the report register.' : `Could not save: ${r.error}`);
    });
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Button onClick={snap} disabled={pending} size="sm">
        <Camera className="h-3.5 w-3.5 mr-1" />
        {pending ? 'Saving snapshot…' : 'Snapshot for funder'}
      </Button>
      {msg && <span className="text-[11.5px] text-ach-navy/70">{msg}</span>}
    </div>
  );
}
