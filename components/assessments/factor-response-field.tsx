'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Mic, Square, Loader2, AlertCircle, Volume2 } from 'lucide-react';
import { saveFactorResponseAction } from '@/lib/assessments/actions';
import { uploadAssessmentAttachmentAction } from '@/lib/attachments/actions';

type CapturedVia = 'typed' | 'voice' | 'voice_edited';

interface InitialResponse {
  response_text: string | null;
  captured_via: CapturedVia;
  spoken_language: string | null;
  audio_attachment_id: string | null;
}

interface Props {
  assessmentId: string;
  factorId: string;
  factorName: string;
  initial?: InitialResponse | null;
  candidateLanguage?: string | null;
  consentToRecord: boolean;
  locked?: boolean;
}

export function FactorResponseField({
  assessmentId, factorId, factorName, initial, candidateLanguage, consentToRecord, locked,
}: Props) {
  const [text, setText] = useState(initial?.response_text ?? '');
  const [capturedVia, setCapturedVia] = useState<CapturedVia>(initial?.captured_via ?? 'typed');
  const [language, setLanguage] = useState(initial?.spoken_language ?? candidateLanguage ?? null);
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

  // Save text on blur and after voice transcription
  const persist = (newText: string, via: CapturedVia, lang: string | null, audioId: string | null) => {
    if (locked) return;
    startTransition(async () => {
      const res = await saveFactorResponseAction(assessmentId, factorId, newText || null, via, lang, audioId);
      if (res.ok) setSavedAt(new Date());
    });
  };

  const onBlur = () => {
    const via = capturedVia === 'voice' && text !== (initial?.response_text ?? '') ? 'voice_edited' : capturedVia;
    if (via !== capturedVia) setCapturedVia(via);
    persist(text, via, language, initial?.audio_attachment_id ?? null);
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
      if (blob.size === 0) {
        setError('Recording was empty.');
        return;
      }

      // 1. Upload audio as an attachment so we have an audit-grade copy
      const attachmentForm = new FormData();
      const fileName = `factor-${factorId}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extFor(blob.type)}`;
      attachmentForm.append('file', new File([blob], fileName, { type: blob.type }));
      const upRes = await uploadAssessmentAttachmentAction(assessmentId, attachmentForm);
      const audioId = upRes.ok ? upRes.id : null;
      if (!upRes.ok) setError(`Audio upload failed: ${upRes.error}`);

      // 2. Send audio to Whisper for transcription
      const transcribeForm = new FormData();
      transcribeForm.append('audio', blob);
      if (candidateLanguage) transcribeForm.append('language', candidateLanguage);
      const tRes = await fetch('/api/ai/transcribe', { method: 'POST', body: transcribeForm });
      const tBody = await tRes.json().catch(() => ({ ok: false, error: 'Bad response' }));
      if (!tBody.ok) {
        setError(`Transcription failed: ${tBody.error ?? 'unknown'}`);
        // Still persist the recording metadata so the audio isn't lost
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

  // Cleanup if unmounted mid-recording
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (tickRef.current) window.clearInterval(tickRef.current);
  }, []);

  const canRecord = consentToRecord && !locked && !recording && !transcribing;

  return (
    <div className="mb-3 rounded-[10px] border-[0.5px] border-ach-border bg-white p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">
          Candidate&apos;s response
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
                Record
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
        rows={3}
        disabled={!!locked || recording || transcribing}
        placeholder={
          consentToRecord
            ? `Press Record while ${factorName.toLowerCase()} is being discussed, or type the candidate's response here.`
            : `Type the candidate's response in their own words.`
        }
        className="w-full rounded-[8px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40 disabled:bg-ach-page disabled:text-ach-navy/55"
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
