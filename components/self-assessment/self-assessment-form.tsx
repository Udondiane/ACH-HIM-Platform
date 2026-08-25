'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Mic, Square, Loader2, AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { submitSelfAssessmentAction } from '@/lib/self-assessment/actions';

type CapturedVia = 'typed' | 'voice' | 'voice_edited';

interface Props {
  token: string;
  prompt: string;
  activityContext: string | null;
  candidateLanguage: string | null;
}

/**
 * Beneficiary-facing mini-assessment form. Runs on their phone (or
 * any browser). One question, text or voice, submit. Consent is
 * implicit at capture — the beneficiary is submitting their own voice.
 *
 * Voice via MediaRecorder + Whisper transcription, same server API
 * as the staff-side FactorResponseField / ClosingReflectionField.
 * Auto-arms on textarea focus if the browser gives mic permission —
 * beneficiary can just tap the field and speak.
 */
export function SelfAssessmentForm({ token, prompt, activityContext, candidateLanguage }: Props) {
  const [text, setText] = useState('');
  const [capturedVia, setCapturedVia] = useState<CapturedVia>('typed');
  const [language, setLanguage] = useState<string | null>(candidateLanguage);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);

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
    } catch (e) {
      // Silent — user probably denied mic. They can still type.
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

      const transcribeForm = new FormData();
      transcribeForm.append('audio', blob);
      if (candidateLanguage) transcribeForm.append('language', candidateLanguage);
      const tRes = await fetch('/api/ai/transcribe', { method: 'POST', body: transcribeForm });
      const tBody = await tRes.json().catch(() => ({ ok: false, error: 'Bad response' }));
      if (!tBody.ok) {
        setError('Sorry, we couldn\'t transcribe that recording. Please try again, or type your answer instead.');
        return;
      }
      const newText = text.trim().length === 0 ? tBody.text : `${text}\n\n${tBody.text}`;
      setText(newText);
      setCapturedVia('voice');
      setLanguage(tBody.language ?? language);
    } finally {
      setTranscribing(false);
      chunksRef.current = [];
    }
  };

  const onFocus = () => {
    // Best-effort auto-arm; if the browser prompts for mic permission
    // and beneficiary declines, they just type. No error surfaced.
    if (!recording && !transcribing && !micReady) {
      void startRecording();
    }
  };

  const onBlur = () => {
    if (recording) { stopRecording(); return; }
    // If the user typed after voice, mark as voice_edited so the
    // provenance stays honest for reporting.
    if (capturedVia === 'voice') setCapturedVia('voice_edited');
  };

  const onSubmit = () => {
    setError(null);
    if (text.trim().length < 3) {
      setError('Please write at least a short answer before submitting.');
      return;
    }
    const via: CapturedVia = capturedVia === 'voice' && text.length > 0 ? 'voice' : capturedVia;
    startTransition(async () => {
      const res = await submitSelfAssessmentAction({
        token,
        responseText: text,
        capturedVia: via,
        spokenLanguage: language,
        // Reflection-only flow: implicit consent — the beneficiary has
        // read the privacy note on the page and is voluntarily
        // submitting their own words. Factor-scoring flow surfaces an
        // explicit checkbox instead.
        consented: true,
      });
      if (res.ok) setSubmitted(true);
      else setError(res.error);
    });
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (tickRef.current) window.clearInterval(tickRef.current);
  }, []);

  if (submitted) {
    return (
      <div className="rounded-[12px] border-[0.5px] border-emerald-200 bg-emerald-50/60 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-700 mx-auto mb-3" />
        <div className="text-[17px] font-medium text-ach-navy mb-2">Thank you!</div>
        <p className="text-[13.5px] text-ach-navy/75 leading-relaxed">
          Your reflection has been shared with ACH. Nothing more you need to do.
        </p>
        <p className="text-[12px] text-ach-navy/55 mt-4">
          You can safely close this page.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-[12px] border-[0.5px] border-ach-border bg-white p-5 mb-4">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-mono mb-3">
          The question
        </div>
        <p className="text-[17px] text-ach-navy leading-snug font-serif italic">
          &ldquo;{prompt}&rdquo;
        </p>
      </div>

      <div className="rounded-[12px] border-[0.5px] border-ach-border bg-white p-4">
        <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-2 block">
          Your answer — in your own words
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          rows={7}
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

        {error && (
          <div className="mt-3 flex items-start gap-1.5 text-[12.5px] text-[#8B3A4F]">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || transcribing || text.trim().length < 3}
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
