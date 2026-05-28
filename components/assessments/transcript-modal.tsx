'use client';

import { useState, useTransition } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyAiSuggestionsAction } from '@/lib/assessments/actions';

interface Suggestion {
  indicatorId: string;
  numericValue: number | null;
  observableChanges: string;
  practices: string;
  confidence: 'low' | 'medium' | 'high';
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   'bg-ach-slate-tint text-ach-slate-deep border-ach-slate-blue/30',
  medium: 'bg-ach-page text-ach-navy/70 border-ach-border',
  low:    'bg-ach-rose/10 text-[#8B3A4F] border-ach-rose/30',
};

export function TranscriptModal({
  assessmentId,
  indicatorLabels,
}: {
  assessmentId: string;
  indicatorLabels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setError(null);
    setAnalyzing(true);
    setSuggestions(null);
    try {
      const r = await fetch('/api/ai/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId, transcript, scope: 'all' }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error ?? 'Analysis failed');
      setSuggestions(data.suggestions);
      const acc: Record<string, boolean> = {};
      for (const s of data.suggestions as Suggestion[]) {
        if (s.numericValue != null) acc[s.indicatorId] = true;
      }
      setAccepted(acc);
    } catch (e: any) {
      setError(e?.message ?? 'Unexpected error');
    } finally {
      setAnalyzing(false);
    }
  };

  const apply = () => {
    if (!suggestions) return;
    const selected = suggestions.filter(s => accepted[s.indicatorId]);
    startTransition(async () => {
      await applyAiSuggestionsAction(assessmentId, selected);
      setOpen(false);
      window.location.reload();
    });
  };

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5" />Analyse transcript
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-ach-navy/40 flex items-center justify-center p-4" onClick={() => !analyzing && !pending && setOpen(false)}>
          <div className="bg-white rounded-[16px] max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b-[0.5px] border-ach-border flex items-center justify-between">
              <div>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">AI assistance</div>
                <div className="text-[16px] font-medium text-ach-navy">Analyse interview transcript</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-ach-navy/55 hover:text-ach-navy">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {!suggestions && (
                <>
                  <p className="text-[12.5px] text-ach-navy/75">
                    Paste the candidate interview transcript below. Gemini will read it and propose scores + observable changes + practices for each relevant indicator. You review and accept or reject each suggestion before it is saved.
                  </p>
                  <textarea
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    rows={12}
                    placeholder="Paste the full interview transcript here…"
                    className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
                  />
                  <div className="text-[11px] text-ach-navy/55">
                    Up to 30,000 characters. Transcript content leaves your platform only during this request and is not retained by Gemini for training.
                  </div>
                </>
              )}

              {suggestions && (
                <>
                  <div className="text-[12.5px] text-ach-navy/75 mb-2">
                    {suggestions.filter(s => s.numericValue != null).length} of {suggestions.length} indicators received an AI suggestion. Untick anything you do not want applied.
                  </div>
                  <div className="space-y-2">
                    {suggestions.map(s => {
                      if (s.numericValue == null && !s.observableChanges && !s.practices) return null;
                      const label = indicatorLabels[s.indicatorId] ?? s.indicatorId;
                      return (
                        <label key={s.indicatorId} className="block p-3 rounded-[10px] border-[0.5px] border-ach-border hover:bg-ach-page/40 cursor-pointer">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={!!accepted[s.indicatorId]}
                              onChange={e => setAccepted(prev => ({ ...prev, [s.indicatorId]: e.target.checked }))}
                              className="mt-1 h-4 w-4 rounded border-ach-border text-ach-navy focus:ring-ach-navy/40"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[13px] font-medium text-ach-navy">{label}</div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {s.numericValue != null && (
                                    <span className="text-[11px] font-medium bg-ach-navy text-ach-cream px-2 py-0.5 rounded-full">{s.numericValue}/5</span>
                                  )}
                                  <span className={`text-[10px] uppercase tracking-[1.2px] font-medium px-2 py-0.5 rounded-full border-[0.5px] ${CONFIDENCE_COLOR[s.confidence]}`}>
                                    {s.confidence}
                                  </span>
                                </div>
                              </div>
                              {s.observableChanges && <div className="text-[12px] text-ach-navy/75 mt-1.5"><span className="font-medium">Observable: </span>{s.observableChanges}</div>}
                              {s.practices && <div className="text-[12px] text-ach-navy/75 mt-1"><span className="font-medium">Practices: </span>{s.practices}</div>}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}

              {error && (
                <div className="text-[12.5px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30">
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t-[0.5px] border-ach-border flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={analyzing || pending}>
                Cancel
              </Button>
              {!suggestions ? (
                <Button type="button" onClick={runAnalysis} disabled={analyzing || transcript.trim().length < 50}>
                  {analyzing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analysing…</> : <><Sparkles className="h-3.5 w-3.5" />Run analysis</>}
                </Button>
              ) : (
                <Button type="button" onClick={apply} disabled={pending || Object.values(accepted).every(v => !v)}>
                  {pending ? 'Saving…' : `Apply ${Object.values(accepted).filter(Boolean).length} suggestion${Object.values(accepted).filter(Boolean).length === 1 ? '' : 's'}`}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
