'use client';

import { useState, useTransition } from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { decideTrainingRequestAction } from '@/lib/dev-fund/actions';
import { formatGbpDetailed } from '@/lib/utils/format';

type Request = {
  id: string;
  title: string;
  provider: string;
  cost: number;
  candidateRef: string;
  state: string;
  rationale: string;
  reviewNotes: string;
  stateVariant: NonNullable<BadgeProps['variant']>;
};

export function TrainingRequestRow({ request }: { request: Request }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(request.reviewNotes);
  const [pending, startTransition] = useTransition();

  const decided = request.state === 'approved' || request.state === 'declined' || request.state === 'completed' || request.state === 'withdrawn';

  function decide(decision: 'approved' | 'declined' | 'in_review') {
    startTransition(async () => {
      await decideTrainingRequestAction(request.id, decision, notes);
      setExpanded(false);
    });
  }

  return (
    <div className="rounded-[10px] border-[0.5px] border-ach-border">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-ach-page/50 transition-colors"
        type="button"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[12px] text-ach-navy/60">{request.candidateRef}</span>
            <Badge variant={request.stateVariant}>{request.state.replace('_', ' ')}</Badge>
          </div>
          <div className="text-[13px] text-ach-navy font-medium">{request.title}</div>
          <div className="text-[11px] text-ach-navy/60">{request.provider}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[13px] text-ach-navy tabular-nums">{formatGbpDetailed(request.cost)}</div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t-[0.5px] border-ach-border">
          {request.rationale && (
            <div className="mt-3">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">Candidate rationale</div>
              <p className="text-[12px] text-ach-navy/80 whitespace-pre-wrap">{request.rationale}</p>
            </div>
          )}
          {!decided && (
            <div className="mt-3 space-y-2">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Review notes</div>
              <Textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add reviewer notes — required when declining."
              />
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" type="button" disabled={pending} onClick={() => decide('approved')}>
                  {pending ? '…' : 'Approve'}
                </Button>
                <Button size="sm" variant="ghost" type="button" disabled={pending} onClick={() => decide('declined')}>
                  Decline
                </Button>
                {request.state === 'submitted' && (
                  <Button size="sm" variant="ghost" type="button" disabled={pending} onClick={() => decide('in_review')}>
                    Mark in review
                  </Button>
                )}
              </div>
            </div>
          )}
          {decided && request.reviewNotes && (
            <div className="mt-3">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">Review notes</div>
              <p className="text-[12px] text-ach-navy/80 whitespace-pre-wrap">{request.reviewNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
