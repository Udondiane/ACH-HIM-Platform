'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, MessageCircle, Mic, Square, Loader2, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  recordFollowUpResponseAction,
  markDispatchAttemptedAction,
  closeDispatchAction,
} from '@/lib/follow-ups/actions';

type Channel = 'whatsapp' | 'phone_call' | 'sms' | 'email' | 'in_person';

interface Props {
  dispatchId: string;
  candidateId: string;
  cohortId?: string | null;
  placementId?: string | null;
  timepoint: string;
  isRetention: boolean;
  is12mo: boolean;
  initialResponse?: string;
}

export function FollowUpResponseForm(props: Props) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>('phone_call');
  const [text, setText] = useState(props.initialResponse ?? '');
  const [notes, setNotes] = useState('');
  const [stillEmployed, setStillEmployed] = useState<'yes' | 'no' | ''>('');
  const [progressionNote, setProgressionNote] = useState('');
  const [featureWorthy, setFeatureWorthy] = useState(false);
  const [quoteContext, setQuoteContext] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeBlob(blob);
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setRecording(true);
    } catch (err: any) {
      setMsg(`Could not start microphone: ${err?.message ?? err}`);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const transcribeBlob = async (blob: Blob) => {
    setTranscribing(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'recording.webm');
      const res = await fetch('/api/ai/transcribe', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
      const data = await res.json();
      const transcript = data.text ?? data.transcript ?? '';
      if (transcript) {
        setText(t => (t ? `${t}\n\n${transcript}` : transcript));
      } else {
        setMsg('Transcript came back empty.');
      }
    } catch (err: any) {
      setMsg(`Transcription failed: ${err?.message ?? err}`);
    } finally {
      setTranscribing(false);
    }
  };

  const submit = () => {
    startTransition(async () => {
      setMsg(null);
      const r = await recordFollowUpResponseAction({
        dispatch_id: props.dispatchId,
        channel,
        response_text: text,
        candidate_still_employed:
          props.isRetention && stillEmployed ? stillEmployed === 'yes' : null,
        progression_note: props.is12mo ? progressionNote : null,
        feature_worthy: featureWorthy,
        quote_context: quoteContext || null,
        notes: notes || null,
      });
      if (r.ok) {
        setMsg('Response captured. Redirecting to queue.');
        setTimeout(() => router.push('/follow-ups'), 800);
      } else {
        setMsg(`Could not save: ${r.error}`);
      }
    });
  };

  const attempted = () => {
    startTransition(async () => {
      const r = await markDispatchAttemptedAction(props.dispatchId, 'Attempt recorded, no response.');
      setMsg(r.ok ? 'Marked as attempted.' : `Error: ${(r as any).error}`);
      if (r.ok) setTimeout(() => router.push('/follow-ups'), 600);
    });
  };

  const close = () => {
    startTransition(async () => {
      const r = await closeDispatchAction(props.dispatchId);
      setMsg(r.ok ? 'Closed.' : `Error: ${(r as any).error}`);
      if (r.ok) setTimeout(() => router.push('/follow-ups'), 600);
    });
  };

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        {/* Channel */}
        <div>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-2">Channel used</div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['phone_call', 'whatsapp', 'sms', 'email', 'in_person'] as Channel[]).map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={`text-[12px] px-3 py-1.5 rounded-[8px] border transition-colors ${
                  channel === c
                    ? 'bg-ach-navy text-ach-cream border-ach-navy'
                    : 'bg-white text-ach-navy border-ach-border hover:bg-ach-page'
                }`}
              >
                {c.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Voice capture + text */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">Candidate response</div>
            <div className="flex items-center gap-2">
              {!recording && !transcribing && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-[6px] border border-ach-border text-ach-navy hover:bg-ach-page"
                >
                  <Mic className="h-3 w-3" /> Record
                </button>
              )}
              {recording && (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-[6px] bg-[#8B3E52] text-white hover:opacity-90"
                >
                  <Square className="h-3 w-3" /> Stop &amp; transcribe
                </button>
              )}
              {transcribing && (
                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ach-navy/70">
                  <Loader2 className="h-3 w-3 animate-spin" /> Transcribing…
                </span>
              )}
            </div>
          </div>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={7}
            placeholder="What did the candidate say? Voice recording appends here after transcription."
          />
        </div>

        {/* Retention structured question */}
        {props.isRetention && (
          <div>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-2">Still employed?</div>
            <div className="flex items-center gap-2">
              {[
                { v: 'yes', label: 'Yes' },
                { v: 'no',  label: 'No' },
                { v: '',    label: 'Not confirmed' },
              ].map(o => (
                <button
                  key={o.v || 'na'}
                  type="button"
                  onClick={() => setStillEmployed(o.v as any)}
                  className={`text-[12px] px-3 py-1.5 rounded-[8px] border transition-colors ${
                    stillEmployed === o.v
                      ? 'bg-ach-navy text-ach-cream border-ach-navy'
                      : 'bg-white text-ach-navy border-ach-border hover:bg-ach-page'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-ach-navy/55 mt-1.5 italic">
              Populates the placement retention check automatically.
            </div>
          </div>
        )}

        {/* 12-month progression narrative */}
        {props.is12mo && (
          <div>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-2">Progression narrative (optional)</div>
            <Textarea
              value={progressionNote}
              onChange={e => setProgressionNote(e.target.value)}
              rows={3}
              placeholder="Promotion, role change, salary bump, etc. Feeds the 12-month impact report."
            />
          </div>
        )}

        {/* Feature this response */}
        <div className="rounded-[8px] border border-ach-border/70 bg-ach-page/40 p-3 space-y-2">
          <label className="flex items-center gap-2 text-[12.5px] text-ach-navy">
            <input
              type="checkbox"
              checked={featureWorthy}
              onChange={e => setFeatureWorthy(e.target.checked)}
              className="h-4 w-4 rounded border-ach-border text-ach-navy focus:ring-ach-navy/40"
            />
            <span className="font-medium">Feature this response as a quote</span>
          </label>
          {featureWorthy && (
            <>
              <div className="text-[11.5px] text-ach-navy/60">
                Consent is checked automatically. Only added to the library if the candidate has granted quoting consent.
              </div>
              <input
                type="text"
                value={quoteContext}
                onChange={e => setQuoteContext(e.target.value)}
                placeholder="Short context, e.g. Reflecting on the placement"
                className="w-full text-[12.5px] px-2.5 py-1.5 rounded border border-ach-border/60 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
              />
            </>
          )}
        </div>

        {/* Notes */}
        <div>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-2">Staff notes (not shared)</div>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything relevant for the case worker, not for the report."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          <Button onClick={submit} disabled={pending || !text.trim()}>
            <Send className="h-3.5 w-3.5 mr-1" />
            {pending ? 'Saving…' : 'Save response'}
          </Button>
          <Button variant="secondary" onClick={attempted} disabled={pending}>
            <Phone className="h-3.5 w-3.5 mr-1" />
            Attempted, no response
          </Button>
          <Button variant="secondary" onClick={close} disabled={pending}>
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Close without response
          </Button>
          {msg && <span className="text-[12px] text-ach-navy/70 ml-auto">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
