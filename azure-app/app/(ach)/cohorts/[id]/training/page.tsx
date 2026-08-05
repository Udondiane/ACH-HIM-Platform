import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GraduationCap, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { COMPLETION_STATUS_LABELS } from '@/lib/training/schema';
import { CohortTrainingRoster } from '@/components/training/cohort-training-roster';

export default async function CohortTrainingPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [cohortRes, candidatesRes, trainingRes] = await Promise.all([
    supabase.from('cohorts').select('id, cohort_ref, name, status, is_rolling, intervention_start_date, start_date, projects(id, name)').eq('id', params.id).maybeSingle(),
    supabase.from('cohort_candidates')
      .select('id, candidate_id, candidates(id, candidate_ref, given_name, family_name, status)')
      .eq('cohort_id', params.id),
    supabase.from('candidate_training')
      .select('id, candidate_id, training_name, trainer, completion_status, attended_sessions, total_sessions, scheduled_start, completion_date, notes')
      .eq('cohort_id', params.id)
      .order('scheduled_start', { ascending: false, nullsFirst: false }),
  ]);

  if (!cohortRes.data) notFound();
  const cohort = cohortRes.data as any;

  const enrolments = ((candidatesRes.data as any[]) ?? []).filter(e => e.candidates);
  const trainingRows = (trainingRes.data as any[]) ?? [];

  // Group training records by candidate for the roster
  const trainingByCandidate = new Map<string, any[]>();
  for (const t of trainingRows) {
    const list = trainingByCandidate.get(t.candidate_id) ?? [];
    list.push(t);
    trainingByCandidate.set(t.candidate_id, list);
  }

  const attendees = enrolments.map(e => ({
    id: e.candidates.id,
    candidate_ref: e.candidates.candidate_ref,
    given_name: e.candidates.given_name,
    family_name: e.candidates.family_name,
    status: e.candidates.status,
    training: trainingByCandidate.get(e.candidates.id) ?? [],
  }));

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref={`/cohorts/${params.id}`}
        backLabel={cohort.cohort_ref}
        miniLabel="Cohort · Training delivery"
        title={`Training roster — ${cohort.name}`}
        description={`${enrolments.length} candidate${enrolments.length === 1 ? '' : 's'} enrolled · ${trainingRows.length} training record${trainingRows.length === 1 ? '' : 's'} for this cohort.`}
      />

      {/* Bulk session log */}
      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
            <GraduationCap className="h-3 w-3" />Log a training session
          </div>
          <div className="text-[12px] text-ach-navy/60 mt-0.5">
            One session, multiple attendees. Tick who attended — a training record is created for each.
          </div>
        </CardHeader>
        <CardContent>
          {attendees.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60">No candidates enrolled in this cohort yet. Enrol candidates first.</div>
          ) : (
            <CohortTrainingRoster
              cohortId={params.id}
              attendees={attendees.map(a => ({
                id: a.id,
                candidate_ref: a.candidate_ref,
                given_name: a.given_name,
                family_name: a.family_name,
              }))}
            />
          )}
        </CardContent>
      </Card>

      {/* Per-candidate roster */}
      <Card>
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Cohort roster</div>
          <div className="text-[12px] text-ach-navy/60 mt-0.5">
            Every candidate in this cohort with their training history.
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {attendees.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60 px-4 py-6">No candidates enrolled.</div>
          ) : (
            <div className="divide-y divide-ach-border">
              {attendees.map(a => (
                <div key={a.id} className="grid grid-cols-[180px_1fr_auto] items-start gap-4 px-4 py-3">
                  <Link href={`/candidates/${a.id}/training`} className="min-w-0">
                    <div className="text-[12.5px] font-medium text-ach-navy truncate">{a.candidate_ref}</div>
                    <div className="text-[11.5px] text-ach-navy/60 truncate identity-name">
                      {a.given_name}{a.family_name ? ` ${a.family_name}` : ''}
                    </div>
                  </Link>
                  <div className="min-w-0">
                    {a.training.length === 0 ? (
                      <div className="text-[12px] text-ach-navy/45 italic">No training records yet</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {a.training.slice(0, 6).map(t => (
                          <TrainingPill key={t.id} t={t} />
                        ))}
                        {a.training.length > 6 && (
                          <span className="text-[11px] text-ach-navy/45 self-center">+{a.training.length - 6} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/candidates/${a.id}/training`}
                    className="inline-flex items-center gap-1 text-[11.5px] text-ach-navy/65 hover:text-ach-navy"
                  >
                    Detail
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrainingPill({ t }: { t: any }) {
  const status = t.completion_status as string;
  const cls = status === 'completed'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : status === 'in_progress'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : status === 'withdrew'
        ? 'bg-ach-rose/10 text-[#8B3A4F] border-ach-rose/30'
        : 'bg-ach-page text-ach-navy/60 border-ach-border';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10.5px] rounded-[6px] px-1.5 py-0.5 border-[0.5px] ${cls}`}
      title={t.trainer ? `${t.training_name} — ${t.trainer}` : t.training_name}
    >
      <span className="font-medium">{t.training_name}</span>
      <span className="opacity-60">· {COMPLETION_STATUS_LABELS[status as keyof typeof COMPLETION_STATUS_LABELS] ?? status}</span>
    </span>
  );
}
