import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, CalendarDays, UserPlus, Award, LineChart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PROGRAMME_CATEGORY_LABELS,
  PROGRAMME_STATUS_LABELS,
  ENROLMENT_STATUS_LABELS,
} from '@/lib/training/schema';
import { CandidateIdentity } from '@/components/ui/candidate-identity';
import { EnrolCandidatesButton } from '@/components/training/enrol-candidates-button';
import { LearningOutcomeManager } from '@/components/training/learning-outcome-manager';
import { CertificateIssuer } from '@/components/training/certificate-issuer';

export const dynamic = 'force-dynamic';

export default async function ProgrammeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [progRes, sessionsRes, enrolsRes, outcomesRes, factorsRes, mapRes, candidatesRes, attendanceRes, certRes, usedInProjectsRes] = await Promise.all([
    supabase.from('training_programmes').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('training_sessions').select('id, session_number, session_title, scheduled_date, scheduled_start, room, tutor_name, status').eq('programme_id', params.id).order('scheduled_date'),
    supabase.from('training_enrolments').select('id, candidate_id, status, enrolled_date, completed_date, candidates(id, candidate_ref, given_name, family_name)').eq('programme_id', params.id).order('enrolled_date', { ascending: false }),
    supabase.from('training_learning_outcomes').select('*').eq('programme_id', params.id).order('sort_order'),
    supabase.from('factors').select('id, name, conversion_factor_type'),
    supabase.from('training_learning_outcome_map').select('learning_outcome_id, factor_id, evidence_weight'),
    supabase.from('candidates').select('id, candidate_ref, given_name, family_name').eq('status', 'in_programme').order('candidate_ref').limit(200),
    supabase.from('training_attendance').select('candidate_id, status, session_id, training_sessions!inner(programme_id)').eq('training_sessions.programme_id', params.id),
    supabase.from('training_certificates').select('candidate_id').eq('programme_id', params.id),
    supabase.from('project_training_programmes').select('project_id, projects(id, name, project_ref, status)').eq('programme_id', params.id),
  ]);

  if (!progRes.data) notFound();
  const p = progRes.data as any;
  const sessions = (sessionsRes.data as any[]) ?? [];
  const enrolments = (enrolsRes.data as any[]) ?? [];
  const outcomes = (outcomesRes.data as any[]) ?? [];
  const factors = (factorsRes.data as any[]) ?? [];
  const outcomeMap = (mapRes.data as any[]) ?? [];
  const allCandidates = (candidatesRes.data as any[]) ?? [];

  const enrolledIds = new Set(enrolments.map(e => e.candidates?.id).filter(Boolean));
  const available = allCandidates.filter(c => !enrolledIds.has(c.id));

  const enrolled = enrolments.filter(e => e.status === 'enrolled');
  const completed = enrolments.filter(e => e.status === 'completed');
  const withdrawn = enrolments.filter(e => e.status === 'withdrawn');

  // Attendance % per learner across all sessions in this programme.
  const totalSessionsWithAttendance = new Set((attendanceRes.data as any[] ?? []).map(a => a.session_id)).size;
  const presentPerLearner = new Map<string, number>();
  for (const a of (attendanceRes.data as any[]) ?? []) {
    if (a.status === 'present' || a.status === 'late') {
      presentPerLearner.set(a.candidate_id, (presentPerLearner.get(a.candidate_id) ?? 0) + 1);
    }
  }
  const attendancePctByCandidate = new Map<string, number>();
  for (const [cid, present] of presentPerLearner.entries()) {
    if (totalSessionsWithAttendance > 0) {
      attendancePctByCandidate.set(cid, (present / totalSessionsWithAttendance) * 100);
    }
  }

  const alreadyCertified = new Set((certRes.data as any[] ?? []).map(c => c.candidate_id));

  // Eligible = enrolments in 'enrolled' status with >=80% attendance who haven't been certified yet.
  const eligible = enrolled
    .filter(e => !alreadyCertified.has(e.candidates?.id))
    .map(e => {
      const cid = e.candidates?.id;
      const pct = attendancePctByCandidate.get(cid) ?? 0;
      return {
        enrolmentId: e.id,
        candidateId: cid,
        candidateRef: e.candidates?.candidate_ref ?? '—',
        candidateName: [e.candidates?.given_name, e.candidates?.family_name].filter(Boolean).join(' '),
        attendancePct: pct,
      };
    })
    .filter(e => e.attendancePct >= 80);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        backHref="/training"
        backLabel="Training"
        miniLabel={p.code ?? 'Programme'}
        title={p.name}
        description={p.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/training/sessions/new?programme=${p.id}`}>
              <Button variant="secondary"><CalendarDays className="h-3.5 w-3.5" />Schedule session</Button>
            </Link>
            <Link href={`/training/programmes/${p.id}/effectiveness`}>
              <Button variant="secondary"><LineChart className="h-3.5 w-3.5" />Effectiveness</Button>
            </Link>
            <Link href={`/training/programmes/${p.id}/edit`}>
              <Button variant="secondary"><Pencil className="h-3.5 w-3.5" />Edit</Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-4">
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-[13px]">
            <DT label="Category">{p.category ? PROGRAMME_CATEGORY_LABELS[p.category as keyof typeof PROGRAMME_CATEGORY_LABELS] : '—'}</DT>
            <DT label="Status"><Badge>{PROGRAMME_STATUS_LABELS[p.status as keyof typeof PROGRAMME_STATUS_LABELS] ?? p.status}</Badge></DT>
            <DT label="Duration">{p.duration_hours ? `${p.duration_hours} hours` : '—'}</DT>
            <DT label="Sessions">{p.total_sessions ?? '—'}</DT>
          </dl>
        </CardContent>
      </Card>

      {/* Used in projects */}
      {(() => {
        const usedIn = ((usedInProjectsRes.data as any[]) ?? []).map(r => r.projects).filter(Boolean);
        if (usedIn.length === 0) return null;
        return (
          <Card className="mb-4">
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Used as an activity in</div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center flex-wrap gap-2">
                {usedIn.map((proj: any) => (
                  <Link key={proj.id} href={`/projects/${proj.id}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] border-[0.5px] border-ach-border bg-white hover:bg-ach-page text-[12.5px] text-ach-navy">
                    <span className="font-mono text-[11px] text-ach-navy/55">{proj.project_ref}</span>
                    <span>{proj.name}</span>
                    {proj.status && <span className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/45">{proj.status}</span>}
                  </Link>
                ))}
              </div>
              <div className="text-[11.5px] text-ach-navy/55 mt-2">
                Effectiveness for candidates who took this programme as part of these projects can be filtered on the effectiveness page.
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 mb-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Sessions</div>
              <Link href={`/training/sessions/new?programme=${p.id}`} className="text-[11.5px] text-ach-navy/70 underline underline-offset-2">Add</Link>
            </div>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-[12.5px] text-ach-navy/60 py-3">No sessions scheduled.</div>
            ) : (
              <ul className="text-[12.5px] divide-y divide-ach-border">
                {sessions.map(s => (
                  <li key={s.id} className="py-2 flex items-center justify-between">
                    <Link href={`/training/sessions/${s.id}`} className="text-ach-navy hover:underline">
                      <span className="font-medium">{s.session_number ? `#${s.session_number}` : ''} {s.session_title ?? 'Session'}</span>
                      <div className="text-[11px] text-ach-navy/60">
                        {new Date(s.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {s.scheduled_start && ` · ${s.scheduled_start.slice(0, 5)}`}
                        {s.room && ` · ${s.room}`}
                      </div>
                    </Link>
                    <Badge>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Enrolments</div>
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-ach-navy/60">
                  {enrolled.length} enrolled · {completed.length} completed · {withdrawn.length} withdrawn
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <EnrolCandidatesButton programmeId={p.id} available={available} />
            {enrolments.length === 0 ? (
              <div className="text-[12.5px] text-ach-navy/60 py-3">No learners enrolled yet.</div>
            ) : (
              <ul className="text-[12.5px] divide-y divide-ach-border mt-2">
                {enrolments.map(e => (
                  <li key={e.id} className="py-2 flex items-center justify-between">
                    <Link href={`/candidates/${e.candidates?.id}`} className="text-ach-navy hover:underline">
                      <CandidateIdentity candidate={e.candidates} />
                    </Link>
                    <Badge>{ENROLMENT_STATUS_LABELS[e.status as keyof typeof ENROLMENT_STATUS_LABELS] ?? e.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Learning outcomes</div>
          <div className="text-[11.5px] text-ach-navy/55 mt-0.5">
            What learners will demonstrate. Each outcome can be mapped to one or more HIM factors — the map is how training completion becomes evidence for factor scoring.
          </div>
        </CardHeader>
        <CardContent>
          <LearningOutcomeManager
            programmeId={p.id}
            outcomes={outcomes}
            factors={factors}
            outcomeMap={outcomeMap}
          />
        </CardContent>
      </Card>

      {eligible.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-ach-navy/60" />
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Certification</div>
            </div>
            <div className="text-[11.5px] text-ach-navy/55 mt-0.5">
              Learners with ≥80% attendance who don't yet have a certificate. Marks the enrolment as completed on issue.
            </div>
          </CardHeader>
          <CardContent>
            <CertificateIssuer programmeId={p.id} eligible={eligible} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DT({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-0.5">{label}</dt>
      <dd className="text-ach-navy">{children}</dd>
    </div>
  );
}
