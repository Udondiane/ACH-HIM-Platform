'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Check, CheckCircle2, X, AlertCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { markAttendanceAction, markSessionDeliveredAction } from '@/lib/training/actions';
import { ATTENDANCE_STATUS_LABELS } from '@/lib/training/schema';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'not_marked';

interface Learner {
  id: string;
  candidate_ref: string;
  given_name?: string | null;
  family_name?: string | null;
  attendance: AttendanceStatus;
}

interface Props {
  sessionId: string;
  roster: Learner[];
  initiallyDelivered?: boolean;
}

// Cycle order — tap through in this order.
const CYCLE: AttendanceStatus[] = ['present', 'late', 'excused', 'absent', 'not_marked'];

function nextStatus(cur: AttendanceStatus): AttendanceStatus {
  const idx = CYCLE.indexOf(cur);
  return CYCLE[(idx + 1) % CYCLE.length];
}

const STATUS_STYLE: Record<AttendanceStatus, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
  present:    { bg: 'bg-emerald-600',   text: 'text-white',      border: 'border-emerald-700',   icon: <CheckCircle2 className="h-4 w-4" />, label: 'Present' },
  late:       { bg: 'bg-amber-500',     text: 'text-white',      border: 'border-amber-600',     icon: <AlertCircle className="h-4 w-4" />,  label: 'Late' },
  excused:    { bg: 'bg-ach-slate-tint', text: 'text-ach-navy',   border: 'border-ach-slate-blue/40', icon: <Circle className="h-4 w-4" />,   label: 'Excused' },
  absent:     { bg: 'bg-[#8B3A4F]',     text: 'text-white',      border: 'border-[#8B3A4F]',     icon: <X className="h-4 w-4" />,            label: 'Absent' },
  not_marked: { bg: 'bg-white',         text: 'text-ach-navy/60', border: 'border-ach-border',    icon: <Circle className="h-4 w-4" />,       label: 'Not marked' },
};

export function AttendanceRegister({ sessionId, roster, initiallyDelivered }: Props) {
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(roster.map(r => [r.id, r.attendance]))
  );
  const [saved, setSaved] = useState(false);
  const [delivered, setDelivered] = useState(!!initiallyDelivered);
  const [pending, startTransition] = useTransition();
  const [pendingMark, setPendingMark] = useState<string | null>(null);

  // Debounced auto-save on every change — persists immediately.
  const timerRef = useRef<number | null>(null);
  const queueRef = useRef<Set<string>>(new Set());

  const flush = () => {
    const pendingIds: string[] = Array.from(queueRef.current);
    if (pendingIds.length === 0) return;
    queueRef.current.clear();
    const payload: { candidate_id: string; status: AttendanceStatus }[] = pendingIds.map(id => ({
      candidate_id: id,
      status: (marks[id] ?? 'not_marked') as AttendanceStatus,
    }));
    startTransition(async () => {
      const res = await markAttendanceAction({ sessionId, marks: payload });
      if (res.ok) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  const tap = (learnerId: string) => {
    const next = nextStatus(marks[learnerId] ?? 'not_marked');
    setMarks(m => ({ ...m, [learnerId]: next }));
    setPendingMark(learnerId);
    queueRef.current.add(learnerId);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { flush(); setPendingMark(null); }, 400);
  };

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    for (const r of roster) next[r.id] = status;
    setMarks(next);
    queueRef.current = new Set(roster.map(r => r.id));
    flush();
  };

  const finalise = () => {
    startTransition(async () => {
      // Ensure any pending marks are flushed first.
      if (queueRef.current.size > 0) {
        const pendingIds: string[] = Array.from(queueRef.current);
        queueRef.current.clear();
        const payload: { candidate_id: string; status: AttendanceStatus }[] = pendingIds.map(id => ({
          candidate_id: id,
          status: (marks[id] ?? 'not_marked') as AttendanceStatus,
        }));
        await markAttendanceAction({ sessionId, marks: payload });
      }
      const res = await markSessionDeliveredAction(sessionId);
      if (res.ok) setDelivered(true);
    });
  };

  const summary: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0, not_marked: 0 };
  for (const r of roster) {
    const s: AttendanceStatus = marks[r.id] ?? 'not_marked';
    summary[s]++;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b-[0.5px] border-ach-border">
        <button onClick={() => markAll('present')} className="text-[11.5px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border-[0.5px] border-emerald-200 hover:bg-emerald-100">Mark all present</button>
        <button onClick={() => markAll('absent')} className="text-[11.5px] px-2.5 py-1 rounded-full bg-ach-rose/10 text-[#8B3A4F] border-[0.5px] border-ach-rose/30 hover:bg-ach-rose/20">Mark all absent</button>
        <button onClick={() => markAll('not_marked')} className="text-[11.5px] px-2.5 py-1 rounded-full bg-ach-page text-ach-navy/70 border-[0.5px] border-ach-border hover:bg-white">Reset</button>
        <div className="ml-auto text-[11.5px] text-ach-navy/60 tabular-nums">
          <span className="text-emerald-700">{summary.present} present</span>
          {summary.late > 0 && <span className="text-amber-700"> · {summary.late} late</span>}
          {summary.excused > 0 && <span> · {summary.excused} excused</span>}
          {summary.absent > 0 && <span className="text-[#8B3A4F]"> · {summary.absent} absent</span>}
          {summary.not_marked > 0 && <span className="text-ach-navy/40"> · {summary.not_marked} not marked</span>}
        </div>
      </div>

      <ul className="space-y-2">
        {roster.map(r => {
          const status: AttendanceStatus = marks[r.id] ?? 'not_marked';
          const style = STATUS_STYLE[status];
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => tap(r.id)}
                className={`w-full flex items-center justify-between rounded-[10px] border-[0.5px] px-3 py-3 sm:py-2.5 text-left transition-all active:scale-[0.99] ${style.bg} ${style.text} ${style.border}`}
                aria-label={`${r.candidate_ref} · ${style.label} — tap to change`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`shrink-0 ${style.text}`}>{style.icon}</div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium truncate">
                      {r.candidate_ref}
                      {(r.given_name || r.family_name) && <span className={`ml-2 font-normal ${status === 'not_marked' ? 'text-ach-navy/55' : 'opacity-85'}`}>{[r.given_name, r.family_name].filter(Boolean).join(' ')}</span>}
                    </div>
                  </div>
                </div>
                <div className={`text-[11.5px] uppercase tracking-[1.2px] shrink-0 ${status === 'not_marked' ? 'text-ach-navy/50' : 'opacity-90'}`}>
                  {style.label}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t-[0.5px] border-ach-border pt-3">
        <div className="text-[11.5px] text-ach-navy/60 flex items-center gap-1.5">
          {saved && <><Check className="h-3.5 w-3.5 text-emerald-700" /><span className="text-emerald-800">Saved</span></>}
          {!saved && pending && <span>Saving…</span>}
          {!saved && !pending && <span>Auto-saves as you tap</span>}
        </div>
        <Button
          type="button"
          onClick={finalise}
          disabled={pending || delivered}
        >
          {delivered ? 'Session delivered' : (pending ? 'Working…' : 'Mark session delivered')}
        </Button>
      </div>
    </div>
  );
}
