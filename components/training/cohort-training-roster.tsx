'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { bulkLogTrainingSessionAction } from '@/lib/training/actions';

type CompletionStatus = 'not_started' | 'in_progress' | 'completed';

interface Attendee {
  id: string;
  candidate_ref: string;
  given_name: string;
  family_name: string | null;
}

interface Props {
  cohortId: string;
  attendees: Attendee[];
}

export function CohortTrainingRoster({ cohortId, attendees }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [trainingName, setTrainingName] = useState('');
  const [trainer, setTrainer] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [topic, setTopic] = useState('');
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus>('completed');
  const [checked, setChecked] = useState<Set<string>>(() => new Set(attendees.map(a => a.id)));
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null);

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setAll = (val: boolean) => {
    setChecked(val ? new Set(attendees.map(a => a.id)) : new Set());
  };

  const submit = () => {
    setFeedback(null);
    if (!trainingName.trim()) {
      setFeedback({ kind: 'error', msg: 'Training name is required.' });
      return;
    }
    if (checked.size === 0) {
      setFeedback({ kind: 'error', msg: 'Tick at least one attendee.' });
      return;
    }
    startTransition(async () => {
      const res = await bulkLogTrainingSessionAction({
        cohortId,
        candidateIds: Array.from(checked),
        trainingName,
        trainer: trainer || null,
        sessionDate,
        topic: topic || null,
        completionStatus,
      });
      if (res.ok) {
        setFeedback({ kind: 'ok', msg: `Logged training for ${res.count} attendee${res.count === 1 ? '' : 's'}.` });
        setTrainingName('');
        setTrainer('');
        setTopic('');
        setChecked(new Set(attendees.map(a => a.id)));
        router.refresh();
      } else {
        setFeedback({ kind: 'error', msg: res.error });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_160px] gap-3">
        <div className="space-y-1.5">
          <Label>Training name</Label>
          <Input
            value={trainingName}
            onChange={e => setTrainingName(e.target.value)}
            placeholder="e.g. Workplace English — Module 3"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Trainer</Label>
          <Input
            value={trainer}
            onChange={e => setTrainer(e.target.value)}
            placeholder="Trainer name (optional)"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Session date</Label>
          <Input
            type="date"
            value={sessionDate}
            onChange={e => setSessionDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3">
        <div className="space-y-1.5">
          <Label>Topic / notes (optional)</Label>
          <Textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            rows={2}
            placeholder="What did this session cover? Concrete topics, exercises, materials."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status to record</Label>
          <select
            value={completionStatus}
            onChange={e => setCompletionStatus(e.target.value as CompletionStatus)}
            className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
          >
            <option value="completed">Completed</option>
            <option value="in_progress">In progress</option>
            <option value="not_started">Not started</option>
          </select>
        </div>
      </div>

      <div className="rounded-[10px] border-[0.5px] border-ach-border bg-white p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-ach-navy/60" />
            <span className="text-[12.5px] font-medium text-ach-navy">
              Attendees ({checked.size} of {attendees.length} ticked)
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11.5px]">
            <button type="button" onClick={() => setAll(true)} className="text-ach-navy underline">All</button>
            <span className="text-ach-navy/40">·</span>
            <button type="button" onClick={() => setAll(false)} className="text-ach-navy underline">None</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-[260px] overflow-y-auto">
          {attendees.map(a => (
            <label
              key={a.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-[8px] cursor-pointer border-[0.5px] ${
                checked.has(a.id) ? 'bg-ach-navy/5 border-ach-navy/30' : 'bg-white border-ach-border hover:bg-ach-page'
              }`}
            >
              <input
                type="checkbox"
                checked={checked.has(a.id)}
                onChange={() => toggle(a.id)}
                className="h-4 w-4 rounded border-ach-border text-ach-navy focus:ring-ach-navy/40"
              />
              <span className="text-[12px] text-ach-navy truncate">
                <span className="font-medium">{a.candidate_ref}</span>
                <span className="text-ach-navy/60"> · {a.given_name}{a.family_name ? ` ${a.family_name}` : ''}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {feedback && (
        <div className={`flex items-start gap-2 text-[12.5px] rounded-[10px] px-3 py-2 border-[0.5px] ${
          feedback.kind === 'ok'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-ach-rose/10 text-[#8B3A4F] border-ach-rose/30'
        }`}>
          {feedback.kind === 'ok' ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={submit} disabled={pending || checked.size === 0}>
          {pending ? 'Logging…' : `Log session for ${checked.size} attendee${checked.size === 1 ? '' : 's'}`}
        </Button>
      </div>
    </div>
  );
}
