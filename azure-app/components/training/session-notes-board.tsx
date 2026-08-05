'use client';

import { useState, useTransition } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { addSessionNoteAction } from '@/lib/training/actions';
import { NOTE_KIND, NOTE_KIND_LABELS } from '@/lib/training/schema';

interface Learner { id: string; candidate_ref: string; given_name?: string | null; family_name?: string | null }
interface Note {
  id: string;
  candidate_id: string;
  note_kind: string;
  note_text: string;
  created_at: string;
  candidates?: { candidate_ref?: string };
}

interface Props {
  sessionId: string;
  roster: Learner[];
  notes: Note[];
}

export function SessionNotesBoard({ sessionId, roster, notes }: Props) {
  const [open, setOpen] = useState(false);
  const [candidateId, setCandidateId] = useState('');
  const [kind, setKind] = useState<typeof NOTE_KIND[number]>('observation');
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setErr(null);
    if (!candidateId) { setErr('Pick a learner.'); return; }
    if (!text.trim()) { setErr('Note text required.'); return; }
    startTransition(async () => {
      const res = await addSessionNoteAction({ sessionId, candidateId, noteKind: kind, noteText: text });
      if (!res.ok) { setErr(res.error); return; }
      setText(''); setOpen(false);
    });
  };

  return (
    <div>
      {open ? (
        <div className="rounded-[10px] border-[0.5px] border-ach-border bg-white p-3 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={candidateId} onChange={e => setCandidateId(e.target.value)} className="rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy">
              <option value="">— learner —</option>
              {roster.map(r => <option key={r.id} value={r.id}>{r.candidate_ref} {[r.given_name, r.family_name].filter(Boolean).join(' ')}</option>)}
            </select>
            <select value={kind} onChange={e => setKind(e.target.value as typeof NOTE_KIND[number])} className="rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy">
              {NOTE_KIND.map(k => <option key={k} value={k}>{NOTE_KIND_LABELS[k]}</option>)}
            </select>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="What happened?" className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40" />
          {err && <div className="text-[11.5px] text-[#8B3A4F]">{err}</div>}
          <div className="flex items-center gap-2">
            <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : 'Add note'}</Button>
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); setText(''); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" type="button" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />Add learner note
        </Button>
      )}

      {notes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {notes.map(n => (
            <li key={n.id} className="rounded-[10px] border-[0.5px] border-ach-border bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-0.5">{n.candidates?.candidate_ref}</div>
                  <div className="text-[13px] text-ach-navy">{n.note_text}</div>
                </div>
                <Badge>{NOTE_KIND_LABELS[n.note_kind as typeof NOTE_KIND[number]] ?? n.note_kind}</Badge>
              </div>
              <div className="text-[10.5px] text-ach-navy/50 mt-1">
                {new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </li>
          ))}
        </ul>
      )}

      {notes.length === 0 && !open && (
        <div className="mt-2 text-[12.5px] text-ach-navy/50 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />No notes yet.
        </div>
      )}
    </div>
  );
}
