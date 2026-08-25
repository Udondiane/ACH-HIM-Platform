'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  Mic, Square, Loader2, AlertCircle, CheckCircle2, Send,
} from 'lucide-react';
import { submitSelfAssessmentAction, type FactorScoreInput } from '@/lib/self-assessment/actions';

type CapturedVia = 'typed' | 'voice' | 'voice_edited';

/**
 * A single scoreable factor as it lives inside this form. The public
 * page projects the framework tables (factors + indicators + domains)
 * down to this shape before handing off to the client — one row per
 * indicator the beneficiary needs to self-score, with a beneficiary-
 * friendly wording of the prompt.
 */
export interface SelfAssessmentFactor {
  indicatorId: string;
  factorName: string;
  domainId: string;
  domainLabel: string;
  question: string;                 // beneficiary-facing wording (measurement_question preferred)
  low: string;                      // description of a "1" — for the Likert legend
  high: string;                     // description of a "5" — for the Likert legend
}

interface Props {
  token: string;
  reflectionPrompt: string;
  activityContext: string | null;
  candidateLanguage: string | null;
  factors: SelfAssessmentFactor[];
  timepointLabel: string;
}

/**
 * Full self-assessment form. Beneficiary works through their assigned
 * factor questions (1–5 Likert per factor, grouped by domain), writes
 * a closing reflection, ticks consent, submits.
 *
 * Design choices:
 *
 *   - One long scroll (not a carousel). Mobile phones + patchy networks
 *     mean pagination between questions loses answers if the browser
 *     tab is backgrounded. The whole form lives in one document.
 *   - Progress bar at the top updates as factors get scored.
 *   - localStorage draft state (keyed by token) so a beneficiary who
 *     closes the page can come back and continue where they left off.
 *   - Voice input on the reflection field (Whisper via /api/ai/transcribe),
 *     same shape as the baseline reflection-only form.
 *   - Consent checkbox is a hard gate before Submit is enabled.
 *
 * The submit calls submitSelfAssessmentAction with factorResponses[]
 * populated; the action tags each response is_self_scored=true and
 * marks assessments.assessment_source='candidate_self'.
 */
export function SelfAssessmentFactorForm({
  token, reflectionPrompt, activityContext, candidateLanguage, factors, timepointLabel,
}: Props) {
  const draftKey = `self-assess:${token}`;
  const [scores, setScores] = useState<Record<string, number>>({});
  const [reflection, setReflection] = useState('');
  const [capturedVia, setCapturedVia] = useState<CapturedVia>('typed');
  const [language, setLanguage] = useState<string | null>(candidateLanguage);
  const [consented, setConsented] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Voice recording state (mirrors the baseline form)
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);

  // ── Draft hydrate ──────────────────────────────────
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null;
      if (!raw) return;
      const draft = JSON.parse(raw) as { scores?: Record<string, number>; reflection?: string };
      if (draft.scores) setScores(draft.scores);
      if (draft.reflection) setReflection(draft.reflection);
    } catch {
      // If storage is blocked or the draft is corrupted, ignore — the
      // beneficiary just starts fresh. Never surface the storage error.
    }
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draft persist (debounced by React batching) ────
  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ scores, reflection }));
    } catch {
      // Storage full or blocked — draft won't survive a reload but
      // the flow still works. No user-visible error.
    }
  }, [draftKey, scores, reflection]);

  // ── Progress ───────────────────────────────────────
  const totalFactors = factors.length;
  const answeredCount = useMemo(
    () => factors.filter(f => scores[f.indicatorId] != null).length,
    [factors, scores],
  );
  const percent = totalFactors === 0 ? 0 : Math.round((answeredCount / totalFactors) * 100);

  // ── Group factors by domain for readability ───────
  const grouped = useMemo(() => {
    const groups = new Map<string, { label: string; items: SelfAssessmentFactor[] }>();
    for (const f of factors) {
      const g = groups.get(f.domainId) ?? { label: f.domainLabel, items: [] };
      g.items.push(f);
      groups.set(f.domainId, g);
    }
    return Array.from(groups.entries()).map(([domainId, g]) => ({ domainId, ...g }));
  }, [factors]);

  // ── Voice recorder plumbing (mirrors baseline form) ─
  const startRecording = async () => {
    if (recording) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicReady(true);
      const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = onRecordingStop;
      recorder.start();
      setRecording(true);
      setElapsed(0);
      tickRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);
    } catch {
      setMicReady(false);
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    setRecording(false);
  };

  const onRecordingStop = async () => {
    setTranscribing(true);
    try {
      const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType ?? 'audio/webm' });
      if (blob.size === 0) return;
      const fd = new FormData();
      fd.append('audio', blob);
      if (candidateLanguage) fd.append('language', candidateLanguage);
      const res = await fetch('/api/ai/transcribe', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({ ok: false, error: 'Bad response' }));
      if (!body.ok) {
        setError('Sorry, we couldn\'t transcribe that recording. Please try again, or type your answer instead.');
        return;
      }
      const newText = reflection.trim().length === 0 ? body.text : `${reflection}\n\n${body.text}`;
      setReflection(newText);
      setCapturedVia('voice');
      setLanguage(body.language ?? language);
    } finally {
      setTranscribing(false);
      chunksRef.current = [];
    }
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (tickRef.current) window.clearInterval(tickRef.current);
  }, []);

  // ── Submit ─────────────────────────────────────────
  const canSubmit = (
    answeredCount === totalFactors
    && reflection.trim().length >= 3
    && consented
    && !pending
    && !transcribing
  );

  const onSubmit = () => {
    setError(null);
    if (answeredCount < totalFactors) {
      const remaining = totalFactors - answeredCount;
      setError(`Please answer the ${remaining} remaining question${remaining === 1 ? '' : 's'} before submitting.`);
      return;
    }
    if (reflection.trim().length < 3) {
      setError('Please share a short reflection at the end before submitting.');
      return;
    }
    if (!consented) {
      setError('Please tick the consent box before submitting your answers.');
      return;
    }

    const factorResponses: FactorScoreInput[] = factors.map(f => ({
      indicatorId: f.indicatorId,
      numericValue: scores[f.indicatorId],
    }));

    const via: CapturedVia = capturedVia === 'voice' && reflection.length > 0 ? 'voice' : capturedVia;

    startTransition(async () => {
      const res = await submitSelfAssessmentAction({
        token,
        responseText: reflection,
        capturedVia: via,
        spokenLanguage: language,
        factorResponses,
        consented: true,
      });
      if (res.ok) {
        setSubmitted(true);
        try { window.localStorage.removeItem(draftKey); } catch { /* ignore */ }
      } else {
        setError(res.error);
      }
    });
  };

  // ── Success state ──────────────────────────────────
  if (submitted) {
    return (
      <div className="rounded-[12px] border-[0.5px] border-emerald-200 bg-emerald-50/60 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-700 mx-auto mb-3" />
        <div className="text-[17px] font-medium text-ach-navy mb-2">Thank you!</div>
        <p className="text-[13.5px] text-ach-navy/75 leading-relaxed">
          Your {timepointLabel} check-in has been shared with ACH. Nothing more you need to do.
        </p>
        <p className="text-[12px] text-ach-navy/55 mt-4">
          You can safely close this page.
        </p>
      </div>
    );
  }

  // ── The form ───────────────────────────────────────
  return (
    <div>
      {/* Sticky progress ---------------------------------------- */}
      <div className="sticky top-0 z-10 -mx-5 px-5 py-2 bg-ach-page/95 backdrop-blur border-b-[0.5px] border-ach-border">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="text-[11.5px] text-ach-navy/70">
            <span className="font-medium">{answeredCount}</span>
            <span className="text-ach-navy/45"> of {totalFactors}</span>
          </div>
          <div className="flex-1 h-1.5 rounded-full bg-ach-border overflow-hidden">
            <div
              className="h-full bg-ach-navy transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50 font-mono">
            {timepointLabel}
          </div>
        </div>
      </div>

      {activityContext && (
        <p className="mt-4 text-[12.5px] text-ach-navy/60 italic">
          You&apos;re answering about your time on {activityContext}.
        </p>
      )}

      {/* Intro card -------------------------------------------- */}
      <div className="mt-4 rounded-[12px] border-[0.5px] border-ach-border bg-white p-5">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-mono mb-3">
          How this works
        </div>
        <ol className="text-[13.5px] text-ach-navy/80 space-y-1.5 list-decimal pl-4">
          <li>For each question, tap the number that fits best — <strong>1 is low, 5 is high</strong>.</li>
          <li>At the end, share a short reflection in your own words.</li>
          <li>Tick the consent box and submit. You can pause any time — your answers save on this phone.</li>
        </ol>
      </div>

      {/* Factor groups, by domain ----------------------------- */}
      <div className="mt-6 space-y-8">
        {grouped.map(group => (
          <section key={group.domainId}>
            <h2 className="text-[10.5px] uppercase tracking-[1.4px] text-ach-navy/55 font-mono mb-3">
              {group.label}
            </h2>
            <div className="space-y-3">
              {group.items.map((f, idx) => {
                const value = scores[f.indicatorId] ?? null;
                return (
                  <div
                    key={f.indicatorId}
                    className={`rounded-[12px] border-[0.5px] p-4 bg-white transition-colors ${
                      value ? 'border-emerald-200/70' : 'border-ach-border'
                    }`}
                  >
                    <p className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50 font-mono mb-2">
                      {f.factorName}
                    </p>
                    <p className="text-[15px] text-ach-navy leading-snug mb-4">
                      {f.question}
                    </p>

                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setScores(s => ({ ...s, [f.indicatorId]: n }))}
                          disabled={pending}
                          className={`h-11 rounded-[8px] text-[16px] font-medium border-[0.5px] transition-colors focus:outline-none focus:ring-2 focus:ring-ach-navy/40 ${
                            value === n
                              ? 'bg-ach-navy text-ach-cream border-ach-navy'
                              : 'bg-white text-ach-navy border-ach-border hover:bg-ach-page'
                          }`}
                          aria-pressed={value === n}
                          aria-label={`${n} of 5`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>

                    <div className="mt-2 flex justify-between text-[10.5px] text-ach-navy/50 font-mono">
                      <span>1 · {f.low}</span>
                      <span>5 · {f.high}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Reflection --------------------------------------------- */}
      <div className="mt-10 rounded-[12px] border-[0.5px] border-ach-border bg-white p-5">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-mono mb-3">
          A short reflection
        </div>
        <p className="text-[15px] text-ach-navy leading-snug font-serif italic mb-4">
          &ldquo;{reflectionPrompt}&rdquo;
        </p>

        <textarea
          value={reflection}
          onChange={e => setReflection(e.target.value)}
          onFocus={() => { if (!recording && !transcribing && !micReady) void startRecording(); }}
          onBlur={() => { if (recording) stopRecording(); if (capturedVia === 'voice') setCapturedVia('voice_edited'); }}
          rows={6}
          placeholder="Tap here and start typing. Or if your phone allows the microphone, just start speaking."
          className="w-full rounded-[8px] border-[0.5px] border-ach-border bg-white px-3 py-2.5 text-[15px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40 resize-y"
          disabled={pending || transcribing}
          autoCapitalize="sentences"
          autoCorrect="on"
        />

        <div className="flex items-center justify-between mt-3 gap-2">
          {!micReady ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={pending || transcribing}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-ach-navy/70 hover:text-ach-navy disabled:opacity-50"
            >
              <Mic className="h-4 w-4" />
              Tap to record voice
            </button>
          ) : recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#8B3A4F] text-ach-cream text-[13px] font-medium animate-pulse"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop · {fmtSec(elapsed)}
            </button>
          ) : transcribing ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ach-navy/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcribing…
            </span>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-ach-navy/70 hover:text-ach-navy"
            >
              <Mic className="h-4 w-4" />
              Record again
            </button>
          )}
          {capturedVia !== 'typed' && (
            <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/45">
              {capturedVia === 'voice' ? 'Voice' : 'Voice · edited'}
            </span>
          )}
        </div>
      </div>

      {/* Consent gate ----------------------------------------- */}
      <label className="mt-6 flex items-start gap-3 rounded-[12px] border-[0.5px] border-ach-border bg-white p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={consented}
          onChange={e => setConsented(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-ach-navy shrink-0"
          disabled={pending}
        />
        <span className="text-[13px] text-ach-navy/80 leading-relaxed">
          I understand that my answers will be stored securely by ACH
          and used to measure the impact of the programme I&apos;m on.
          I have read the privacy note below.
        </span>
      </label>

      {/* Errors ----------------------------------------------- */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-[8px] border-[0.5px] border-[#8B3A4F]/30 bg-[#8B3A4F]/5 p-3 text-[13px] text-[#8B3A4F]">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit ---------------------------------------------- */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-[12px] bg-ach-navy text-ach-cream px-5 py-3.5 text-[15px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Share with ACH
          </>
        )}
      </button>
    </div>
  );
}

// ── local utils (duplicated from the baseline form so it can be
//    lifted out later if the two forms converge again) ──
function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'audio/webm';
}

function fmtSec(n: number): string {
  const m = Math.floor(n / 60);
  const s = (n % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
