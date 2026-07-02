'use client';

import { useEffect, useState, useTransition } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { adjustScoreAfterAiReviewAction } from '@/lib/assessments/actions';

type Confidence = 'low' | 'medium' | 'high';
type Status = 'idle' | 'running' | 'completed' | 'skipped_no_consent' | 'skipped_no_transcript' | 'failed';

interface AiSuggestion {
  suggested_score: number | null;
  rationale: string;
  evidence_quotes: string[];
  indicators_not_evidenced: string[];
  confidence: Confidence;
}

interface Props {
  assessmentId: string;
  indicatorId: string;
  factorId: string;
  assessorScore: number | null;
  onScoreAdjusted: (newScore: number) => void;
}

const REASON_CATEGORIES: { value: string; label: string }[] = [
  { value: 'assessor_observed_more',      label: 'Assessor observed something not in the transcript' },
  { value: 'ai_missed_cultural_context',  label: 'AI missed cultural context' },
  { value: 'ai_missed_language_nuance',   label: 'AI missed language nuance' },
  { value: 'assessor_error_corrected',    label: 'Assessor error — correcting my own score' },
  { value: 'other',                       label: 'Other' },
];

/**
 * AI Review panel — the assessor sees the AI's independent score AFTER
 * they've made their own. Encourages consensus checks + explicit adjustment
 * decisions. Adjustments require a reason. See migration 039.
 */
export function AiReviewPanel({
  assessmentId, indicatorId, factorId, assessorScore, onScoreAdjusted,
}: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [newScore, setNewScore] = useState<number | null>(null);
  const [reasonCategory, setReasonCategory] = useState<string>('assessor_observed_more');
  const [reasonText, setReasonText] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustPending, startAdjust] = useTransition();
  const [adjusted, setAdjusted] = useState(false);

  // Only run AI when the assessor has actually scored. Kicks off in the
  // background — non-blocking on the assessor's flow.
  useEffect(() => {
    if (assessorScore === null || status !== 'idle' || adjusted) return;
    let cancelled = false;
    setStatus('running');
    (async () => {
      try {
        const res = await fetch('/api/ai/score-factor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assessmentId, factorId, assessorScore }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setStatus('failed');
          return;
        }
        if (data.status === 'skipped_no_consent')     { setStatus('skipped_no_consent'); return; }
        if (data.status === 'skipped_no_transcript')  { setStatus('skipped_no_transcript'); return; }
        setSuggestion(data.suggestion as AiSuggestion);
        setStatus('completed');
      } catch {
        if (!cancelled) setStatus('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [assessorScore, assessmentId, factorId, status, adjusted]);

  if (assessorScore === null) return null;

  if (status === 'idle' || status === 'running') {
    return (
      <div className="mt-2 flex items-center gap-2 text-[11px] text-ach-navy/50">
        <Sparkles className="h-3 w-3 animate-pulse" />
        <span>AI review running…</span>
      </div>
    );
  }

  if (status === 'skipped_no_consent') {
    return (
      <div className="mt-2 flex items-center gap-2 text-[11px] text-ach-navy/50">
        <Sparkles className="h-3 w-3" />
        <span>AI review not available — candidate has not consented to transcript analysis</span>
      </div>
    );
  }

  if (status === 'skipped_no_transcript') {
    return (
      <div className="mt-2 flex items-center gap-2 text-[11px] text-ach-navy/50">
        <Sparkles className="h-3 w-3" />
        <span>AI review skipped — no narrative captured for this factor</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="mt-2 flex items-center gap-2 text-[11px] text-[#8B3A4F]">
        <AlertCircle className="h-3 w-3" />
        <span>AI review failed. Assessor score is unaffected.</span>
      </div>
    );
  }

  if (!suggestion) return null;

  const aiScore = suggestion.suggested_score;
  const matches = aiScore !== null && Math.round(aiScore) === Math.round(assessorScore);
  const delta = aiScore !== null ? aiScore - assessorScore : null;

  return (
    <div className={`mt-3 rounded-[10px] border-[0.5px] px-3 py-2 ${
      matches ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'
    }`}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 text-[11.5px]">
          {matches ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-amber-800" />
          )}
          <span className="font-medium text-ach-navy">AI review</span>
          <span className="text-ach-navy/60">
            You: {assessorScore} · AI: {aiScore ?? '—'}
            {delta !== null && !matches && ` (${delta > 0 ? '+' : ''}${delta.toFixed(1)})`}
          </span>
          <span className="text-[10px] uppercase tracking-[1px] text-ach-navy/45">
            confidence: {suggestion.confidence}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-ach-navy/50" /> : <ChevronDown className="h-3.5 w-3.5 text-ach-navy/50" />}
      </button>

      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t-[0.5px] border-ach-navy/10 space-y-2 text-[12px] text-ach-navy/80">
          {suggestion.rationale && (
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-0.5">AI rationale</div>
              <p>{suggestion.rationale}</p>
            </div>
          )}
          {suggestion.evidence_quotes.length > 0 && (
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-0.5">Evidence from transcript</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {suggestion.evidence_quotes.map((q, i) => (
                  <li key={i} className="italic">&ldquo;{q}&rdquo;</li>
                ))}
              </ul>
            </div>
          )}
          {suggestion.indicators_not_evidenced.length > 0 && (
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-0.5">Not evidenced</div>
              <ul className="list-disc pl-4 space-y-0.5 text-ach-navy/60">
                {suggestion.indicators_not_evidenced.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}

          {!matches && !adjusted && !showAdjust && (
            <div className="pt-1.5">
              <button
                type="button"
                onClick={() => { setShowAdjust(true); setNewScore(aiScore); }}
                className="text-[11.5px] font-medium text-ach-navy underline underline-offset-2"
              >
                Adjust my score
              </button>
              <span className="text-[10.5px] text-ach-navy/55 ml-2">
                Keep original if you stand by it — no action needed
              </span>
            </div>
          )}

          {showAdjust && !adjusted && (
            <div className="mt-2 rounded-[8px] bg-white border-[0.5px] border-ach-border p-2.5 space-y-2">
              <div>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">New score</div>
                <div className="flex items-center gap-1.5">
                  {[0,1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNewScore(n)}
                      className={`h-7 min-w-[30px] px-2 rounded-[6px] text-[12px] font-medium border-[0.5px] ${
                        newScore === n ? 'bg-ach-navy text-ach-cream border-ach-navy' : 'bg-white text-ach-navy/60 border-ach-border hover:bg-ach-page'
                      }`}
                    >{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">Reason</div>
                <select
                  value={reasonCategory}
                  onChange={e => setReasonCategory(e.target.value)}
                  className="w-full rounded-[8px] border-[0.5px] border-ach-border bg-white px-2 py-1.5 text-[12px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
                >
                  {REASON_CATEGORIES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <textarea
                  value={reasonText}
                  onChange={e => setReasonText(e.target.value)}
                  rows={2}
                  placeholder="Explain why (required)…"
                  className="mt-1.5 w-full rounded-[8px] border-[0.5px] border-ach-border bg-white px-2 py-1.5 text-[12px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
                />
              </div>
              {adjustError && (
                <div className="text-[11.5px] text-[#8B3A4F]">{adjustError}</div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={adjustPending || newScore === null}
                  onClick={() => {
                    setAdjustError(null);
                    if (newScore === null) { setAdjustError('Pick a new score.'); return; }
                    if (!reasonText.trim()) { setAdjustError('A reason is required.'); return; }
                    startAdjust(async () => {
                      const res = await adjustScoreAfterAiReviewAction({
                        assessmentId,
                        indicatorId,
                        newScore,
                        originalScore: assessorScore,
                        reasonCategory: reasonCategory as never,
                        reasonText,
                      });
                      if (!res.ok) { setAdjustError(res.error); return; }
                      setAdjusted(true);
                      setShowAdjust(false);
                      onScoreAdjusted(newScore);
                    });
                  }}
                  className="rounded-[8px] bg-ach-navy text-ach-cream px-3 py-1.5 text-[12px] font-medium disabled:opacity-50"
                >
                  {adjustPending ? 'Saving…' : 'Save adjustment'}
                </button>
                <button
                  type="button"
                  disabled={adjustPending}
                  onClick={() => { setShowAdjust(false); setAdjustError(null); }}
                  className="rounded-[8px] bg-white border-[0.5px] border-ach-border text-ach-navy/70 px-3 py-1.5 text-[12px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {adjusted && (
            <div className="text-[11.5px] text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Score adjusted and reason logged.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
