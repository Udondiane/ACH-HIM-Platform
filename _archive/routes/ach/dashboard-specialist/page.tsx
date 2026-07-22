import Link from 'next/link';
import { Briefcase, MessageSquare, AlertTriangle, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoleSelector } from '@/components/dashboard/role-selector';

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

function daysFromNow(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function SpecialistDashboardPage() {
  const supabase = createClient();
  const today = TODAY_ISO();
  const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoIso = fourteenDaysAgo.toISOString().slice(0, 10);

  const [openMilestonesRes, recentInterviewsRes, activePlacementsRes, candidatesNeedingPlacementRes] = await Promise.all([
    supabase
      .from('placement_milestones')
      .select('id, kind, amount, due_on, state, placements(id, candidate_id, partner_id, role_title, start_date, status, candidates(candidate_ref, given_name), partners(name))')
      .in('state', ['pending'])
      .order('due_on', { ascending: true })
      .limit(50),
    supabase
      .from('candidate_interviews')
      .select('id, candidate_id, kind, outcome, scheduled_for, conducted_on, candidates(candidate_ref, given_name), partners(name)')
      .gte('conducted_on', fourteenDaysAgoIso)
      .order('conducted_on', { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from('placements')
      .select('id, candidate_id, partner_id, role_title, salary_band, start_date, status, candidates(candidate_ref, given_name), partners(name)')
      .in('status', ['offered', 'started', 'active'])
      .order('start_date', { ascending: false })
      .limit(20),
    // Candidates with status=placed but no placement row (data gap to surface)
    supabase
      .from('candidates')
      .select('id, candidate_ref, given_name, status, exit_reason, exit_date')
      .in('status', ['placed', 'completed'])
      .order('exit_date', { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  const milestones = (openMilestonesRes.data as any[]) ?? [];
  const interviews = (recentInterviewsRes.data as any[]) ?? [];
  const placements = (activePlacementsRes.data as any[]) ?? [];
  const placedCandidates = (candidatesNeedingPlacementRes.data as any[]) ?? [];

  const overdueMilestones = milestones.filter(m => m.due_on && m.due_on < today);
  const dueSoonMilestones = milestones.filter(m => {
    const d = daysFromNow(m.due_on);
    return d !== null && d >= 0 && d <= 30;
  });

  // Candidates marked placed/completed but no active placement row — likely
  // a data-entry gap an employment specialist should close.
  const placementCandidateIds = new Set(placements.map(p => p.candidate_id));
  const missingPlacement = placedCandidates.filter(c => c.status === 'placed' && !placementCandidateIds.has(c.id));

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Dashboard"
        title="Employment specialist"
        description="Interviews, active placements, retention milestones."
        actions={
          <Link href="/milestones"><Button variant="secondary"><Briefcase className="h-3.5 w-3.5" />All milestones</Button></Link>
        }
      />

      <RoleSelector activeRole="specialist" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Active placements" value={placements.length} />
        <StatCard label="Milestones overdue" value={overdueMilestones.length} tone={overdueMilestones.length > 0 ? 'rose' : 'navy'} />
        <StatCard label="Due in next 30d" value={dueSoonMilestones.length} />
        <StatCard label="Interviews last 14d" value={interviews.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Retention milestones to action */}
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />Retention milestones to action
            </div>
            <div className="text-[12px] text-ach-navy/60 mt-0.5">
              6 and 12-month check-ins that are pending. Click through to update placement status.
            </div>
          </CardHeader>
          <CardContent>
            {overdueMilestones.length === 0 && dueSoonMilestones.length === 0 ? (
              <div className="text-[13px] text-ach-navy/60">No retention milestones due.</div>
            ) : (
              <div className="space-y-1.5">
                {[...overdueMilestones, ...dueSoonMilestones].slice(0, 10).map(m => {
                  const days = daysFromNow(m.due_on);
                  const over = days != null && days < 0;
                  const p = m.placements;
                  return (
                    <Link
                      key={m.id}
                      href={p ? `/candidates/${p.candidate_id}` : '/milestones'}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-[10px] border-[0.5px] hover:bg-ach-page transition-colors ${over ? 'border-ach-rose/30 bg-ach-rose/5' : 'border-ach-border bg-white'}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {over && <AlertTriangle className="h-3.5 w-3.5 text-[#8B3A4F] shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-ach-navy truncate">
                            {p?.candidates?.candidate_ref ?? '—'} · {p?.candidates?.given_name ?? ''}
                          </div>
                          <div className="text-[11.5px] text-ach-navy/65 truncate">
                            {milestoneLabel(m.kind)} · {p?.partners?.name ?? '—'} · £{m.amount}
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

        {/* Recent interviews */}
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />Interview activity — last 14 days
            </div>
          </CardHeader>
          <CardContent>
            {interviews.length === 0 ? (
              <div className="text-[13px] text-ach-navy/60">No interviews conducted in the past 14 days.</div>
            ) : (
              <div className="space-y-1.5">
                {interviews.slice(0, 10).map(i => (
                  <Link
                    key={i.id}
                    href={`/candidates/${i.candidate_id}/interviews`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-[10px] hover:bg-ach-page transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-ach-navy truncate">
                        {i.candidates?.candidate_ref ?? '—'} · {i.candidates?.given_name ?? ''}
                      </div>
                      <div className="text-[11.5px] text-ach-navy/65 truncate">
                        {i.kind === 'ach_selection' ? 'ACH selection' : 'Partner interview'} · {i.partners?.name ?? '—'} · {i.conducted_on ?? 'unscheduled'}
                      </div>
                    </div>
                    <OutcomePill outcome={i.outcome} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active placements */}
      <Card className="mt-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
            <Briefcase className="h-3 w-3" />Active placements
          </div>
        </CardHeader>
        <CardContent>
          {placements.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60">No active placements.</div>
          ) : (
            <div className="space-y-1.5">
              {placements.slice(0, 15).map(p => (
                <Link
                  key={p.id}
                  href={`/candidates/${p.candidate_id}`}
                  className="grid grid-cols-[140px_1fr_140px_120px_auto] items-center gap-3 p-2.5 rounded-[10px] hover:bg-ach-page transition-colors"
                >
                  <span className="text-[12.5px] font-medium text-ach-navy truncate">
                    {p.candidates?.candidate_ref ?? '—'}
                  </span>
                  <span className="text-[12.5px] text-ach-navy/85 truncate">
                    {p.role_title}
                  </span>
                  <span className="text-[11.5px] text-ach-navy/65 truncate">
                    {p.partners?.name ?? '—'}
                  </span>
                  <span className="text-[11.5px] text-ach-navy/55 tabular-nums">
                    {p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                  </span>
                  <PlacementStatusPill status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {missingPlacement.length > 0 && (
        <Card className="mt-4 border-amber-200">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-amber-800">Marked &quot;placed&quot; but no placement record</div>
            <div className="text-[12px] text-ach-navy/65 mt-0.5">
              {missingPlacement.length} candidate{missingPlacement.length === 1 ? '' : 's'} marked placed without a placement row. Capture the role, employer, salary band, and start date so retention milestones can fire.
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {missingPlacement.slice(0, 8).map(c => (
                <Link
                  key={c.id}
                  href={`/candidates/${c.id}`}
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

function milestoneLabel(kind: string): string {
  const m: Record<string, string> = {
    placement: 'Placement payment',
    retention_6mo: '6-month retention',
    retention_12mo: '12-month retention',
  };
  return m[kind] ?? kind;
}

function OutcomePill({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/45">Pending</span>;
  const map: Record<string, { label: string; classes: string; icon?: any }> = {
    proceed:  { label: 'Selected',     classes: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
    reject:   { label: 'Not selected', classes: 'bg-ach-page text-ach-navy/60 border-ach-border' },
    no_show:  { label: 'No show',      classes: 'bg-ach-rose/10 text-[#8B3A4F] border-ach-rose/30' },
  };
  const m = map[outcome] ?? { label: outcome, classes: 'bg-ach-page text-ach-navy/60 border-ach-border' };
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[1.2px] font-medium rounded-full px-2 py-0.5 border-[0.5px] shrink-0 ${m.classes}`}>
      {m.icon && <m.icon className="h-3 w-3" />}{m.label}
    </span>
  );
}

function PlacementStatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    offered:        { cls: 'bg-amber-50 text-amber-900 border-amber-200',       label: 'Offered' },
    started:        { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', label: 'Started' },
    active:         { cls: 'bg-emerald-50 text-emerald-900 border-emerald-200', label: 'Active' },
    completed_12mo: { cls: 'bg-emerald-100 text-emerald-900 border-emerald-300', label: 'Sustained 12mo' },
    left_pre_6mo:   { cls: 'bg-ach-rose/10 text-[#8B3A4F] border-ach-rose/30',  label: 'Left < 6mo' },
    left_6_to_12mo: { cls: 'bg-ach-rose/10 text-[#8B3A4F] border-ach-rose/30',  label: 'Left 6–12mo' },
    left_post_12mo: { cls: 'bg-ach-page text-ach-navy/70 border-ach-border',    label: 'Left after 12mo' },
  };
  const m = map[status] ?? { cls: 'bg-ach-page text-ach-navy/60 border-ach-border', label: status };
  return (
    <span className={`inline-flex items-center text-[10.5px] uppercase tracking-[1.2px] font-medium rounded-full px-2 py-0.5 border-[0.5px] ${m.cls}`}>
      {m.label}
    </span>
  );
}

function StatCard({ label, value, tone = 'navy' }: { label: string; value: number; tone?: 'navy' | 'rose' }) {
  const toneCls = tone === 'rose' ? 'border-ach-rose/30' : 'border-ach-border';
  return (
    <div className={`rounded-[10px] bg-white border-[0.5px] p-3 ${toneCls}`}>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy mt-1 leading-none">{value}</div>
    </div>
  );
}
