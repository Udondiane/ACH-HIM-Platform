'use client';

import { useState, useTransition } from 'react';
import { Quote, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  createFeaturedQuoteAction,
  markResponseFeatureWorthyAction,
  setCandidateVoiceAction,
} from '@/lib/featured-quotes/actions';

interface Props {
  responseId: string;
  candidateId: string;
  cohortId?: string | null;
  initialCandidateVoice?: string | null;
  initialFeatureWorthy?: boolean;
}

export function QuoteMarker({
  responseId,
  candidateId,
  cohortId,
  initialCandidateVoice,
  initialFeatureWorthy,
}: Props) {
  const [open, setOpen]                 = useState(false);
  const [voice, setVoice]               = useState(initialCandidateVoice ?? '');
  const [featureWorthy, setFeatureWorthy] = useState(!!initialFeatureWorthy);
  const [featureNow, setFeatureNow]     = useState(false);
  const [context, setContext]           = useState('');
  const [msg, setMsg]                   = useState<string | null>(null);
  const [pending, startTransition]      = useTransition();

  const save = () => {
    startTransition(async () => {
      setMsg(null);
      const trimmed = voice.trim();

      if (trimmed !== (initialCandidateVoice ?? '')) {
        const r = await setCandidateVoiceAction({
          response_id: responseId,
          candidate_id: candidateId,
          candidate_voice: trimmed,
        });
        if (!r.ok) { setMsg(r.error); return; }
      }
      if (featureWorthy !== !!initialFeatureWorthy) {
        const r = await markResponseFeatureWorthyAction({
          response_id: responseId,
          candidate_id: candidateId,
          feature_worthy: featureWorthy,
        });
        if (!r.ok) { setMsg(r.error); return; }
      }
      if (featureNow && trimmed) {
        const r = await createFeaturedQuoteAction({
          candidate_id: candidateId,
          cohort_id: cohortId ?? null,
          source_type: 'assessment',
          source_ref: responseId,
          speaker_type: 'candidate',
          quote_text: trimmed,
          context: context || null,
        });
        if (!r.ok) { setMsg(r.error); return; }
        setFeatureNow(false);
        setContext('');
      }
      setMsg('Saved.');
    });
  };

  return (
    <div className="mt-2 rounded-[8px] border border-dashed border-ach-border/70 bg-ach-page/50">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11.5px] text-ach-navy/70 hover:text-ach-navy"
      >
        <span className="inline-flex items-center gap-1.5">
          <Quote className="h-3 w-3" />
          Candidate voice{voice ? ' (captured)' : ''}{featureWorthy ? ' · flagged for feature' : ''}
        </span>
        <span className="text-[10.5px]">{open ? 'Hide' : 'Add'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <Textarea
            value={voice}
            onChange={e => setVoice(e.target.value)}
            rows={2}
            placeholder="Candidate’s own words on this indicator, verbatim if possible."
            className="text-[12.5px]"
          />
          <label className="flex items-center gap-2 text-[11.5px] text-ach-navy/80">
            <input
              type="checkbox"
              checked={featureWorthy}
              onChange={e => setFeatureWorthy(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-ach-border text-ach-navy focus:ring-ach-navy/40"
            />
            Flag this response as feature-worthy
          </label>
          <label className="flex items-center gap-2 text-[11.5px] text-ach-navy/80">
            <input
              type="checkbox"
              checked={featureNow}
              onChange={e => setFeatureNow(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-ach-border text-ach-navy focus:ring-ach-navy/40"
            />
            Also add to the quotes library now
          </label>
          {featureNow && (
            <input
              type="text"
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Optional: what was being discussed?"
              className="w-full text-[12px] px-2 py-1 rounded border border-ach-border/60 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
            />
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={pending}>
              <Sparkles className="h-3 w-3 mr-1" />
              {pending ? 'Saving…' : 'Save'}
            </Button>
            {msg && <span className="text-[11px] text-ach-navy/70">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
