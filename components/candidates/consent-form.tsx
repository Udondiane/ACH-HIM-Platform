'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { recordConsentAction } from '@/lib/candidates/actions';

export function ConsentForm({ candidateId }: { candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const [flags, setFlags] = useState({
    may_be_named: false,
    may_be_quoted: false,
    may_appear_in_case_study: false,
    may_share_career_goal_with_partner: false,
  });
  const [notes, setNotes] = useState('');

  const submit = () => {
    startTransition(async () => {
      await recordConsentAction(candidateId, flags, notes);
      setFlags({
        may_be_named: false, may_be_quoted: false,
        may_appear_in_case_study: false, may_share_career_goal_with_partner: false,
      });
      setNotes('');
    });
  };

  const Toggle = ({ k, label, hint }: { k: keyof typeof flags; label: string; hint?: string }) => (
    <label className="flex items-start gap-2.5 text-[13px] text-ach-navy/80 cursor-pointer">
      <input
        type="checkbox"
        checked={flags[k]}
        onChange={e => setFlags({ ...flags, [k]: e.target.checked })}
        className="mt-0.5 h-4 w-4 rounded border-ach-border text-ach-navy focus:ring-ach-navy/40"
      />
      <span>
        <span className="text-ach-navy font-medium">{label}</span>
        {hint && <span className="block text-ach-navy/60 mt-0.5 text-[12px]">{hint}</span>}
      </span>
    </label>
  );

  return (
    <div className="space-y-3">
      <Toggle k="may_be_named"    label="May be named"
        hint="Use real name in reports, press, or marketing." />
      <Toggle k="may_be_quoted"   label="May be quoted (anonymised)"
        hint="Quotes can appear without personally-identifying detail." />
      <Toggle k="may_appear_in_case_study" label="May appear in a case study"
        hint="Story may be developed into a longer narrative case study." />
      <Toggle k="may_share_career_goal_with_partner" label="May share career goal with sponsoring partner"
        hint="Off by default — partner sees only aggregated capability data otherwise." />

      <Textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        placeholder="Optional notes — e.g. signed form reference, conditions, expiry."
      />

      <Button onClick={submit} disabled={pending}>
        {pending ? 'Recording…' : 'Record consent decision'}
      </Button>
    </div>
  );
}
