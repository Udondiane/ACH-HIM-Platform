'use client';

import { useState, useTransition } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { withdrawCandidateAction } from '@/lib/candidates/actions';

const REASON_OPTS = [
  { value: '', label: '— pick a reason —' },
  { value: 'candidate_ceased_contact', label: 'Candidate ceased contact' },
  { value: 'moved_on_to_other_role', label: 'Moved on to another role' },
  { value: 'programme_not_a_fit', label: 'Programme not a fit' },
  { value: 'personal_circumstances', label: 'Personal circumstances' },
  { value: 'other', label: 'Other' },
];

interface Props {
  candidateId: string;
}

export function WithdrawForm({ candidateId }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!reason) { setError('Please pick a reason.'); return; }
    setError(null);
    startTransition(async () => {
      await withdrawCandidateAction(candidateId, {
        exitReason: reason,
        exitNotes: notes || null,
        exitDate: new Date().toISOString().slice(0, 10),
      });
    });
  };

  if (!showForm) {
    return (
      <Button variant="danger" type="button" onClick={() => setShowForm(true)}>
        <Trash2 className="h-3.5 w-3.5" />Mark withdrawn
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">Reason for withdrawal</div>
        <select
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
        >
          {REASON_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">Notes (optional)</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Any context you want to preserve for reporting."
          className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[12.5px] text-[#8B3A4F]">
          <AlertCircle className="h-3.5 w-3.5" />{error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="danger" type="button" onClick={submit} disabled={pending}>
          <Trash2 className="h-3.5 w-3.5" />{pending ? 'Withdrawing…' : 'Confirm withdrawal'}
        </Button>
        <Button variant="secondary" type="button" onClick={() => { setShowForm(false); setReason(''); setNotes(''); setError(null); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
