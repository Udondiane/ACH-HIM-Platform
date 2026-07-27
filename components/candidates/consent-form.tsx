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
    may_ai_analyse_transcript: false,
    may_be_recontacted_for_followup: false,
  });
  const [notes, setNotes] = useState('');

  const submit = () => {
    startTransition(async () => {
      await recordConsentAction(candidateId, flags, notes);
      setFlags({
        may_be_named: false, may_be_quoted: false,
        may_appear_in_case_study: false, may_ai_analyse_transcript: false,
        may_be_recontacted_for_followup: false,
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
      <Toggle k="may_ai_analyse_transcript" label="AI may analyse assessment transcripts"
        hint="Interview transcripts may be reviewed by an AI to produce a comparison score. Used only to support assessor calibration; the assessor's judgement remains the final decision." />
      <Toggle k="may_be_recontacted_for_followup" label="May be recontacted for 12-month follow-up"
        hint="ACH may reach out a year after programme end to capture retention outcomes and impact evidence for funder reporting." />

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
