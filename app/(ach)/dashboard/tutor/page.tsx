import Link from 'next/link';
import { GraduationCap, Users, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/dashboard/role-selector';
import { COMPLETION_STATUS_LABELS } from '@/lib/training/schema';

export default async function TutorDashboardPage() {
  const supabase = createClient();

  const [activeCohortsRes, recentTrainingRes, inProgressRes, completedThisMonthRes] = await Promise.all([
    supabase
      .from('cohorts')
      .select('id, cohort_ref, name, status, service_type, start_date, intervention_start_date, is_rolling')
      .in('status', ['recruiting', 'in_progress'])
      .order('intervention_start_date', { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from('candidate_training')
      .select('id, candidate_id, cohort_id, training_name, trainer, completion_status, completion_date, attended_sessions, total_sessions, candidates(candidate_ref, given_name), cohorts(cohort_ref)')
      .order('completion_date', { ascending: false, nullsFirst: false })
      .limit(30),
    supabase
      .from('candidate_training')
      .select('id', { count: 'exact', head: true })
      .eq('completion_status', 'in_progress'),
    supabase
      .from('candidate_training')
      .select('id', { count: 'exact', head: true })
      .eq('completion_status', 'completed')
      .gte('completion_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
  ]);

  const activeCohorts = (activeCohortsRes.data as any[]) ?? [];
  const recentTraining = (recentTrainingRes.data as any[]) ?? [];
  const inProgressCount = inProgressRes.count ?? 0;
  const completedThisMonth = completedThisMonthRes.count ?? 0;

  // Count training per cohort for the roster card
  const trainingByCohort = new Map<string, number>();
  for (const t of recentTraining) {
    if (t.cohort_id) trainingByCohort.set(t.cohort_id, (trainingByCohort.get(t.cohort_id) ?? 0) + 1);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Workspace · Role view"
        title="Tutor"
        description="Cohorts you're delivering against, training in progress, and per-cohort training rosters."
        actions={
          <Link href="/cohorts"><Button variant="secondary"><Users className="h-3.5 w-3.5" />All cohorts</Button></Link>
        }
      />

      <RoleSelector activeRole="tutor" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Active cohorts" value={activeCohorts.length} />
        <StatCard label="Training in progress" value={inProgressCount} />
        <StatCard label="Completed this month" value={completedThisMonth} />
        <StatCard label="Recent training records" value={recentTraining.length} />
      </div>

      {/* Per-cohort training entry points */}
      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
            <Users className="h-3 w-3" />Cohort training rosters
          </div>
          <div className="text-[12px] text-ach-navy/60 mt-0.5">
            Open a cohort to see all its candidates side-by-side and add training records in bulk.
          </div>
        </CardHeader>
        <CardContent>
          {activeCohorts.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60">No active cohorts.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activeCohorts.map(c => (
                <Link
                  key={c.id}
                  href={`/cohorts/${c.id}/training`}
                  className="flex items-center justify-between gap-3 p-3 rounded-[10px] border-[0.5px] border-ach-border bg-white hover:bg-ach-page transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ach-navy truncate">
                      {c.cohort_ref}
                      {c.is_rolling && <span className="ml-1.5 text-[10px] uppercase tracking-[1.2px] text-ach-navy/55">Rolling</span>}
                    </div>
                    <div className="text-[11.5px] text-ach-navy/60 truncate mt-0.5">{c.name}</div>
                    <div className="text-[11px] text-ach-navy/50 mt-1">
                      {trainingByCohort.get(c.id) ?? 0} training record{(trainingByCohort.get(c.id) ?? 0) === 1 ? '' : 's'}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-ach-navy/40 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent training */}
      <Card>
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
            <GraduationCap className="h-3 w-3" />Recent training records
          </div>
        </CardHeader>
        <CardContent>
          {recentTraining.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60">No training recorded yet.</div>
          ) : (
            <div className="space-y-1.5">
              {recentTraining.slice(0, 20).map(t => {
                const ratio = t.total_sessions && t.total_sessions > 0
                  ? `${t.attended_sessions ?? 0}/${t.total_sessions}`
                  : null;
                return (
                  <Link
                    key={t.id}
                    href={`/candidates/${t.candidate_id}/training`}
                    className="grid grid-cols-[140px_1fr_120px_100px_auto] items-center gap-3 p-2.5 rounded-[10px] hover:bg-ach-page transition-colors"
                  >
                    <span className="text-[12.5px] font-medium text-ach-navy truncate">
                      {t.candidates?.candidate_ref ?? '—'}
                    </span>
                    <span className="text-[12.5px] text-ach-navy/85 truncate">
                      {t.training_name}
                      {t.trainer && <span className="text-ach-navy/55"> · {t.trainer}</span>}
                    </span>
                    <span className="text-[11.5px] text-ach-navy/60 truncate">
                      {t.cohorts?.cohort_ref ?? '—'}
                    </span>
                    <span className="text-[11px] text-ach-navy/55 tabular-nums">
                      {ratio ?? '—'}
                    </span>
                    <StatusPill status={t.completion_status} />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = COMPLETION_STATUS_LABELS[status as keyof typeof COMPLETION_STATUS_LABELS] ?? status;
  const classes = status === 'completed'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : status === 'in_progress'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : status === 'withdrew'
        ? 'bg-ach-rose/10 text-[#8B3A4F] border-ach-rose/30'
        : 'bg-ach-page text-ach-navy/60 border-ach-border';
  const Icon = status === 'completed' ? CheckCircle2 : status === 'in_progress' ? Loader2 : null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[1.2px] font-medium rounded-full px-2 py-0.5 border-[0.5px] ${classes}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] bg-white border-[0.5px] border-ach-border p-3">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy mt-1 leading-none">{value}</div>
    </div>
  );
}
