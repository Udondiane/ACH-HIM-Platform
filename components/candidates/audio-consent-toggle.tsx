'use client';

import { useState, useTransition } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { setAudioConsentAction } from '@/lib/candidates/actions';

interface Props {
  candidateId: string;
  initialConsent: boolean;
  initialDate: string | null;
}

export function AudioConsentToggle({ candidateId, initialConsent, initialDate }: Props) {
  const [consent, setConsent] = useState(initialConsent);
  const [date, setDate] = useState(initialDate);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !consent;
    setConsent(next);
    startTransition(async () => {
      const res = await setAudioConsentAction(candidateId, next);
      if (res.ok) {
        setDate(next ? new Date().toISOString().slice(0, 10) : null);
      } else {
        setConsent(consent); // rollback
      }
    });
  };

  return (
    <div className="mt-3 pt-3 border-t-[0.5px] border-ach-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-ach-navy flex items-center gap-1.5">
            {consent ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5 text-ach-navy/40" />}
            Audio recording during assessments
          </div>
          <div className="text-[11.5px] text-ach-navy/60 mt-0.5">
            {consent
              ? `Consented ${date ? `on ${new Date(date).toLocaleDateString('en-GB')}` : ''}. Recordings stored securely in UK; used only to support caseworker notes; withdrawable any time.`
              : 'Off. Caseworker must type candidate responses. Toggle on after confirming verbal consent with the candidate.'}
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={consent}
          className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
            consent ? 'bg-ach-navy' : 'bg-ach-border'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              consent ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
