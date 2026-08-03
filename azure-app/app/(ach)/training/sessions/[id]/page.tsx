import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, CalendarDays, MapPin, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AttendanceRegister } from '@/components/training/attendance-register';
import { SessionNotesBoard } from '@/components/training/session-notes-board';

export const dynamic = 'force-dynamic';

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: sess } = await supabase
    .from('training_sessions')
    .select('*, training_programmes(id, name, code)')
    .eq('id', params.id)
    .maybeSingle();

  if (!sess) notFound();
  const s = sess as any;

  const [enrolRes, attRes, notesRes] = await Promise.all([
    supabase
      .from('training_enrolments')
      .select('candidate_id, status, candidates(id, candidate_ref, given_name, family_name)')
      .eq('programme_id', s.programme_id)
      .in('status', ['enrolled', 'completed']),
    supabase
      .from('training_attendance')
      .select('candidate_id, status, notes')
      .eq('session_id', s.id),
    supabase
      .from('training_session_notes')
      .select('id, candidate_id, note_kind, note_text, created_at, candidates(candidate_ref)')
      .eq('session_id', s.id)
      .order('created_at', { ascending: false }),
  ]);

  const enrolments = (enrolRes.data as any[]) ?? [];
  const attendance = (attRes.data as any[]) ?? [];
  const notes = (notesRes.data as any[]) ?? [];

  const attByCandidate = new Map(attendance.map(a => [a.candidate_id, a]));
  const roster = enrolments.map(e => ({
    id: e.candidates.id,
    candidate_ref: e.candidates.candidate_ref,
    given_name: e.candidates.given_name,
    family_name: e.candidates.family_name,
    attendance: (attByCandidate.get(e.candidates.id)?.status ?? 'not_marked') as 'present' | 'absent' | 'late' | 'excused' | 'not_marked',
  }));

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        backHref={`/training/programmes/${s.programme_id}`}
        backLabel={s.training_programmes?.name ?? 'Programme'}
        miniLabel={`Session ${s.session_number ? `#${s.session_number}` : ''}`}
        title={s.session_title || (s.training_programmes?.name ?? 'Session')}
        description={
          [
            new Date(s.scheduled_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
            s.scheduled_start && `${s.scheduled_start.slice(0, 5)}${s.scheduled_end ? '–' + s.scheduled_end.slice(0, 5) : ''}`,
            s.room && s.room,
            s.tutor_name && `Tutor: ${s.tutor_name}`,
          ].filter(Boolean).join(' · ')
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge>{s.status}</Badge>
          </div>
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Attendance</div>
              <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Tap each learner to cycle Present → Late → Excused → Absent → Not marked. Saves as you go.</div>
            </div>
            <div className="text-[11.5px] text-ach-navy/60">{roster.length} enrolled</div>
          </div>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <div className="text-[12.5px] text-ach-navy/60 py-3">
              No learners enrolled in this programme yet. <Link href={`/training/programmes/${s.programme_id}`} className="underline">Enrol learners</Link>.
            </div>
          ) : (
            <AttendanceRegister sessionId={s.id} roster={roster} initiallyDelivered={s.status === 'delivered'} />
          )}
        </CardContent>
      </Card>

      {roster.length > 0 && (
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Session notes</div>
            <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Quick observations, concerns, achievements — per learner or general.</div>
          </CardHeader>
          <CardContent>
            <SessionNotesBoard
              sessionId={s.id}
              roster={roster.map(r => ({ id: r.id, candidate_ref: r.candidate_ref, given_name: r.given_name, family_name: r.family_name }))}
              notes={notes}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
