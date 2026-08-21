'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Mic, Square, Loader2, AlertCircle, Volume2, Quote } from 'lucide-react';
import { saveClosingReflectionAction } from '@/lib/assessments/actions';
import { uploadAssessmentAttachmentAction } from '@/lib/attachments/actions';

type CapturedVia = 'typed' | 'voice' | 'voice_edited';

interface InitialReflection {
  closing_reflection_text: string | null;
  closing_reflection_captured_via: CapturedVia | null;
  closing_reflection_language: string | null;
  closing_reflection_audio_id: string | null;
}

interface Props {
  assessmentId: string;
  prompt: string;                    // dynamic, generated from activities + timepoint
  activityContext: string | null;    // one-line context for the assessor (e.g. "English classes, interview prep")
  initial?: InitialReflection | null;
  candidateLanguage?: string | null;
  consentToRecord: boolean;
  locked?: boolean;
}

/**
 * Closing reflection — the one open-ended question rendered as the final
 * card of every assessment. Guarantees at least one candidate-voice line
 * per assessment for outcomes reports. Voice-capable via Whisper, same
 * pattern as FactorResponseField but scoped to a single answer that
 * belongs to the assessment itself (not a factor).
 */
export function ClosingReflectionField({
  assessmentId, prompt, activityContext, initial, candidateLanguage, consentToRecord, locked: _locked,
}: Props) {
  // Demo mode: mirror FactorResponseField — keep the field editable.
  const locked = false;
  const [text, setText] = useState(initial?.closing_reflection_text ?? '');
  const [capturedVia, setCapturedVia] = useState<CapturedVia>(initial?.closing_reflection_captured_via ?? 'typed');
  const [language, setLanguage] = useState(initial?.closing_reflection_language ?? candidateLanguage ?? null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [_, startTransition] = useTransition();

  // Recording state
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);

  const persist = (newText: string, via: CapturedVia, lang: string | null, audioId: string | null) => {
    if (locked) return;
    startTransition(async () => {
      const res = await saveClosingReflectionAction(assessmentId, newText || null, via, lang, audioId);
      if (res.ok) setSavedAt(new Date());
    });
  };

  const onBlur = () => {
    const via = capturedVia === 'voice' && text !== (initial?.closing_reflection_text ?? '') ? 'voice_edited' : capturedVia;
    if (via !== capturedVia) setCapturedVia(via);
    persist(text, via, language, initial?.closing_reflection_audio_id ?? null);
  };

  const startRecording = async () => {
    if (locked || recording) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
      setError(`Microphone permission denied or unavailable: ${(e as Error).message}`);
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
      if (blob.size === 0) { setError('Recording was empty.'); return; }

      // 1. Upload audio as an attachment (audit-grade copy)
      const attachmentForm = new FormData();
      const fileName = `closing-reflection-${new Date().toISOString().replace(/[:.]/g, '-')}.${extFor(blob.type)}`;
      attachmentForm.append('file', new File([blob], fileName, { type: blob.type }));
      const upRes = await uploadAssessmentAttachmentAction(assessmentId, attachmentForm);
      const audioId = upRes.ok ? upRes.id : null;
      if (!upRes.ok) setError(`Audio upload failed: ${upRes.error}`);

      // 2. Send audio to Whisper
      const transcribeForm = new FormData();
      transcribeForm.append('audio', blob);
      if (candidateLanguage) transcribeForm.append('language', candidateLanguage);
      const tRes = await fetch('/api/ai/transcribe', { method: 'POST', body: transcribeForm });
      const tBody = await tRes.json().catch(() => ({ ok: false, error: 'Bad response' }));
      if (!tBody.ok) {
        setError(`Transcription failed: ${tBody.error ?? 'unknown'}`);
        if (audioId) persist(text, 'voice', language, audioId);
        return;
      }

      // 3. Append (or replace if empty) the transcript
      const newText = text.trim().length === 0 ? tBody.text : `${text}\n\n${tBody.text}`;
      setText(newText);
      setCapturedVia('voice');
      setLanguage(tBody.language ?? language);
      persist(newText, 'voice', tBody.language ?? language, audioId);
    } finally {
      setTranscribing(false);
      chunksRef.current = [];
    }
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (tickRef.current) window.clearInterval(tickRef.current);
  }, []);

  const canRecord = consentToRecord && !locked && !recording && !transcribing;

  return (
    <div className="rounded-[12px] border-[0.5px] border-ach-border bg-[#FBF2E0]/50 p-4">
      <div className="flex items-start gap-2.5 mb-3">
        <Quote className="h-4 w-4 mt-0.5 text-ach-navy/60 shrink-0" />
        <div className="flex-1">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">
            Closing reflection — asked on every assessment
          </div>
          <div className="text-[14px] italic text-ach-navy leading-snug">
            &ldquo;{prompt}&rdquo;
          </div>
          {activityContext && (
            <div className="text-[11.5px] text-ach-navy/55 mt-1">
              Context anchor: {activityContext}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">
          Candidate&apos;s response — verbatim
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {capturedVia === 'voice' && (
            <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">
              <Volume2 className="h-3 w-3" /> Voice
            </span>
          )}
          {capturedVia === 'voice_edited' && (
            <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">
              <Volume2 className="h-3 w-3" /> Voice · edited
            </span>
          )}
          {language && (
            <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/45">
              {language}
            </span>
          )}

          {consentToRecord ? (
            recording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#8B3A4F] text-ach-cream text-[11.5px] font-medium border-[0.5px] border-[#8B3A4F] animate-pulse"
                title="Stop recording"
              >
                <Square className="h-3 w-3 fill-current" />
                {fmtSec(elapsed)}
              </button>
            ) : transcribing ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] text-ach-navy/60">
                <Loader2 className="h-3 w-3 animate-spin" />
                Transcribing…
              </span>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={!canRecord}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-white text-ach-navy text-[11.5px] font-medium border-[0.5px] border-ach-border hover:bg-ach-page transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Record candidate response"
              >
                <Mic className="h-3 w-3" />
                Record answer
              </button>
            )
          ) : (
            <span className="text-[10.5px] text-ach-navy/45" title="Audio recording requires explicit candidate consent on their profile.">
              Voice consent off
            </span>
          )}
        </div>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={onBlur}
        rows={4}
        disabled={recording || transcribing}
        placeholder="Capture what the candidate says in their own words — even a single sentence. This becomes the human voice in your outcomes report."
        className="w-full rounded-[8px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40 disabled:bg-ach-page disabled:text-ach-navy/55"
      />

      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-[11.5px] text-[#8B3A4F]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {savedAt && !error && (
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/40 mt-1.5">
          Saved {savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {!error && !savedAt && text.trim().length === 0 && (
        <div className="text-[11px] text-ach-navy/50 mt-1.5">
          Optional but strongly encouraged — a captured quote per assessment powers the featured-quotes library and the outcomes report narrative.
        </div>
      )}
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

function extFor(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('mp3') || mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

function fmtSec(n: number): string {
  const m = Math.floor(n / 60);
  const s = (n % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
