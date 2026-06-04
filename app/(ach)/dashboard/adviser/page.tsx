import Link from 'next/link';
import { Compass, Clock, AlertTriangle, ArrowRight, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/dashboard/role-selector';
import { SUPPORT_KIND_LABELS } from '@/lib/support/schema';

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return dateStr < TODAY_ISO();
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function AdviserDashboardPage() {
  const supabase = createClient();

  // Pull this week's window: 7 days back to 7 days forward.
  const today = new Date();
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 7);
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  const [iagThisWeekRes, allWithFollowupRes, iagOnlyCohortsRes, candidatesWithoutGoalRes] = await Promise.all([
    supabase
      .from('candidate_support')
      .select('id, candidate_id, kind, provided_on, summary, next_action, next_action_by, caseworker, candidates(candidate_ref, given_name)')
      .eq('kind', 'iag_session')
      .gte('provided_on', weekStartIso)
      .order('provided_on', { ascending: false })
      .limit(50),
    supabase
      .from('candidate_support')
      .select('id, candidate_id, kind, next_action, next_action_by, summary, candidates(candidate_ref, given_name, status)')
      .not('next_action_by', 'is', null)
      .order('next_action_by', { ascending: true })
      .limit(100),
    supabase
      .from('cohorts')
      .select('id, cohort_ref, name, status, intervention_start_date, start_date, is_rolling')
      .eq('service_type', 'iag_only')
      .neq('status', 'cancelled')
      .order('start_date', { ascending: false }),
    supabase
      .from('candidates')
      .select('id, candidate_ref, given_name, career_goal_summary, status')
      .is('career_goal_summary', null)
      .in('status', ['applicant', 'enrolled', 'in_programme'])
      .limit(20),
  ]);

  const iagThisWeek = (iagThisWeekRes.data as any[]) ?? [];
  const followups = ((allWithFollowupRes.data as any[]) ?? []).filter(s => {
    // Only surface follow-ups for candidates still in programme
    return s.candidates?.status && !['withdrawn', 'completed', 'placed'].includes(s.candidates.status);
  });
  const overdue = followups.filter(s => isOverdue(s.next_action_by));
  const dueSoon = followups.filter(s => {
    const d = daysUntil(s.next_action_by);
    return d !== null && d >= 0 && d <= 14;
  });
  const iagCohorts = (iagOnlyCohortsRes.data as any[]) ?? [];
  const candidatesWithoutGoal = (candidatesWithoutGoalRes.data as any[]) ?? [];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Dashboard"
        title="Careers adviser"
        description="IAG sessions logged, follow-ups due, candidates without a career goal."
        actions={
          <Link href="/candidates"><Button variant="secondary"><Compass className="h-3.5 w-3.5" />Browse candidates</Button></Link>
        }
      />

      <RoleSelector activeRole="adviser" />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="IAG sessions this week" value={iagThisWeek.length} tone="navy" />
        <StatCard label="Follow-ups overdue" value={overdue.length} tone={overdue.length > 0 ? 'rose' : 'navy'} />
        <StatCard label="Due in next 14 days" value={dueSoon.length} tone="slate" />
        <StatCard label="Active IAG cohorts" value={iagCohorts.length} tone="navy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Overdue + due-soon follow-ups */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />Next actions due
                </div>
                <div className="text-[12px] text-ach-navy/60 mt-0.5">
                  Follow-ups recorded on the candidate's support log. Click through to record what happened.
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {overdue.length === 0 && dueSoon.length === 0 ? (
              <div className="text-[13px] text-ach-navy/60 py-3">No follow-ups due. Nice and clear.</div>
            ) : (
              <div className="space-y-1.5">
                {[...overdue, ...dueSoon].slice(0, 12).map(s => {
                  const days = daysUntil(s.next_action_by);
                  const over = isOverdue(s.next_action_by);
                  return (
                    <Link
                      key={s.id}
                      href={`/candidates/${s.candidate_id}/support`}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-[10px] border-[0.5px] hover:bg-ach-page transition-colors ${over ? 'border-ach-rose/30 bg-ach-rose/5' : 'border-ach-border bg-white'}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {over && <AlertTriangle className="h-3.5 w-3.5 text-[#8B3A4F] shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-ach-navy truncate">
                            {s.candidates?.candidate_ref ?? '—'} · {s.candidates?.given_name ?? ''}
                          </div>
                          <div className="text-[11.5px] text-ach-navy/65 truncate">
                            {s.next_action || s.summary}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[11px] tabular-nums shrink-0 ${over ? 'text-[#8B3A4F] font-medium' : 'text-ach-navy/55'}`}>
                        {days != null ? (days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`) : '—'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active IAG cohorts */}
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Active IAG cohorts</div>
            <div className="text-[12px] text-ach-navy/60 mt-0.5">
              IAG-only programmes that are recruiting or in progress.
            </div>
          </CardHeader>
          <CardContent>
            {iagCohorts.length === 0 ? (
              <div className="text-[13px] text-ach-navy/60">No IAG-only cohorts yet.</div>
            ) : (
              <div className="space-y-1.5">
                {iagCohorts.slice(0, 8).map(c => (
                  <Link
                    key={c.id}
                    href={`/cohorts/${c.id}`}
                    className="flex items-center justify-between gap-2 p-2 rounded-[8px] hover:bg-ach-page transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-ach-navy truncate">
                        {c.cohort_ref}
                        {c.is_rolling && <span className="ml-1.5 text-[10px] uppercase tracking-[1.2px] text-ach-navy/55">Rolling</span>}
                      </div>
                      <div className="text-[11px] text-ach-navy/60 truncate">{c.name}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-ach-navy/40 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* IAG sessions logged this week */}
      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />IAG sessions — last 7 days
              </div>
              <div className="text-[12px] text-ach-navy/60 mt-0.5">
                Every session logged on a candidate's support page in the past week.
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {iagThisWeek.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60">No IAG sessions logged this week yet.</div>
          ) : (
            <div className="space-y-1.5">
              {iagThisWeek.slice(0, 15).map(s => (
                <Link
                  key={s.id}
                  href={`/candidates/${s.candidate_id}/support`}
                  className="grid grid-cols-[80px_140px_1fr_auto] items-center gap-3 p-2.5 rounded-[10px] hover:bg-ach-page transition-colors"
                >
                  <span className="text-[11.5px] text-ach-navy/60 tabular-nums">
                    {new Date(s.provided_on).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="text-[12.5px] font-medium text-ach-navy truncate">
                    {s.candidates?.candidate_ref} · {s.candidates?.given_name}
                  </span>
                  <span className="text-[12px] text-ach-navy/70 truncate">{s.summary}</span>
                  <span className="text-[11px] text-ach-navy/45 shrink-0">
                    {s.caseworker ?? '—'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Candidates without career goal */}
      {candidatesWithoutGoal.length > 0 && (
        <Card className="mt-4 border-amber-200">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-amber-800">Career goal missing</div>
            <div className="text-[12px] text-ach-navy/65 mt-0.5">
              {candidatesWithoutGoal.length} active candidate{candidatesWithoutGoal.length === 1 ? '' : 's'} without a career goal captured yet. Set one to anchor their journey.
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {candidatesWithoutGoal.slice(0, 10).map(c => (
                <Link
                  key={c.id}
                  href={`/candidates/${c.id}/edit`}
                  className="flex items-center justify-between gap-2 p-2 rounded-[8px] hover:bg-ach-page transition-colors border-[0.5px] border-ach-border"
                >
                  <span className="text-[12.5px] text-ach-navy truncate">
                    {c.candidate_ref} · {c.given_name}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-ach-navy/40 shrink-0" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'navy' | 'slate' | 'olive' | 'rose' }) {
  const toneClasses = {
    navy:  'border-ach-border',
    slate: 'border-ach-slate-blue/20',
    olive: 'border-[#3C6B47]/20',
    rose:  'border-ach-rose/30',
  }[tone];
  return (
    <div className={`rounded-[10px] bg-white border-[0.5px] p-3 ${toneClasses}`}>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy mt-1 leading-none">{value}</div>
    </div>
  );
}
