import Link from 'next/link';
import { Building2, Users, Layers, FolderKanban, Bell, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { computePendingActions, labelFor, type PendingAction } from '@/lib/scoring/pending-actions';

async function loadPendingActions(): Promise<PendingAction[]> {
  const supabase = createClient();
  const [candidatesRes, assessmentsRes, placementsRes] = await Promise.all([
    supabase.from('candidates').select(`
      id, candidate_ref, status, exit_reason, exit_date, at_risk, at_risk_reason,
      cohort_candidates(cohorts(cohort_ref, start_date))
    `),
    supabase.from('assessments').select('candidate_id, timepoint'),
    supabase.from('placements').select('candidate_id, start_date, status'),
  ]);
  const candidates = (candidatesRes.data as any[]) ?? [];
  const assessments = (assessmentsRes.data as any[]) ?? [];
  const placements = (placementsRes.data as any[]) ?? [];
  return computePendingActions(candidates, assessments, placements);
}

async function loadStats() {
  const supabase = createClient();
  const [partners, candidates, cohorts, projects] = await Promise.all([
    supabase.from('partners').select('id', { count: 'exact', head: true }),
    supabase.from('candidates').select('id', { count: 'exact', head: true }),
    supabase.from('cohorts').select('id, status'),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
  ]);
  const cohortsData = (cohorts.data as { id: string; status: string }[] | null) ?? [];
  const cohortsActive = cohortsData.filter(c => c.status === 'in_progress' || c.status === 'recruiting').length;
  return {
    partners: partners.count ?? 0,
    candidates: candidates.count ?? 0,
    cohorts: cohortsData.length,
    cohortsActive,
    projects: projects.count ?? 0,
  };
}

export default async function AchDashboardPage() {
  const stats = await loadStats();
  const pending = await loadPendingActions();
  const atRisk = pending.filter(p => p.kind === 'at_risk_flagged');
  const overdue = pending.filter(p => p.kind !== 'at_risk_flagged' && (p.due_in_days ?? 0) > 14);
  const dueSoon = pending.filter(p => p.kind !== 'at_risk_flagged' && (p.due_in_days ?? 0) <= 14 && (p.due_in_days ?? 0) >= 0);

  const cards = [
    { href: '/partners',   label: 'Partners',   value: stats.partners,    icon: Building2,   subline: 'across three types' },
    { href: '/candidates', label: 'Candidates', value: stats.candidates,  icon: Users,        subline: 'in programme or alumni' },
    { href: '/cohorts',    label: 'Cohorts',    value: stats.cohorts,     icon: Layers,       subline: `${stats.cohortsActive} active` },
    { href: '/projects',   label: 'Projects',   value: stats.projects,    icon: FolderKanban, subline: 'HIM-scored programmes' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Workspace"
        title="ACH staff dashboard"
        description="At-a-glance view of partners, candidates, cohorts, and projects. Click any card to drill in."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Link key={c.href} href={c.href}>
            <Card className="hover:bg-ach-page transition-colors h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
                    {c.label}
                  </div>
                  <c.icon className="h-4 w-4 text-ach-navy/40" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none">
                  {c.value}
                </div>
                <div className="text-[12px] text-ach-navy/60 mt-2">{c.subline}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5"><Bell className="h-3 w-3" />Pending actions</div>
                  <div className="text-[12.5px] text-ach-navy/60 mt-0.5">
                    Stage transitions ACH staff need to action — assessments due, retention checks due, exits unrecorded, at-risk flags.
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11.5px]">
                  {atRisk.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ach-rose/15 text-[#8B3A4F] border-[0.5px] border-ach-rose/30 font-medium">
                      <AlertTriangle className="h-3 w-3" />{atRisk.length} at risk
                    </span>
                  )}
                  {overdue.length > 0 && <span className="text-ach-navy/65"><span className="font-medium text-ach-navy">{overdue.length}</span> overdue &gt;14d</span>}
                  {dueSoon.length > 0 && <span className="text-ach-navy/65"><span className="font-medium text-ach-navy">{dueSoon.length}</span> due soon</span>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                {pending.slice(0, 30).map((a, i) => (
                  <Link key={`${a.candidateId}-${a.kind}-${i}`} href={a.href} className={`flex items-center justify-between gap-3 p-2.5 rounded-[10px] border-[0.5px] hover:bg-ach-page transition-colors ${a.kind === 'at_risk_flagged' ? 'border-ach-rose/30 bg-ach-rose/5' : 'border-ach-border bg-white'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {a.kind === 'at_risk_flagged' && <AlertTriangle className="h-3.5 w-3.5 text-[#8B3A4F] shrink-0" />}
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-ach-navy truncate">{a.candidateRef}{a.cohortRef ? ` · ${a.cohortRef}` : ''}</div>
                        <div className="text-[11.5px] text-ach-navy/65">{labelFor(a.kind)}{a.reason ? ` — ${a.reason}` : ''}</div>
                      </div>
                    </div>
                    {a.due_in_days != null && (
                      <span className={`text-[11px] tabular-nums shrink-0 ${a.due_in_days > 14 ? 'text-[#8B3A4F] font-medium' : 'text-ach-navy/55'}`}>
                        {a.due_in_days >= 0 ? `${a.due_in_days}d` : `${Math.abs(a.due_in_days)}d ahead`}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
              {pending.length > 30 && (
                <div className="text-[11.5px] text-ach-navy/55 mt-3">
                  Showing 30 of {pending.length} pending items.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-4">
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
              Getting started
            </div>
            <div className="text-[15px] font-medium text-ach-navy mt-1">
              Where to begin
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 text-[13px] text-ach-navy/80">
            <p>
              <span className="text-ach-navy font-medium">1.</span> Add your partner organisations on{' '}
              <Link href="/partners" className="underline">Partners</Link> — three types: Capability Investor, Workforce Partner, Training Partner.
            </p>
            <p>
              <span className="text-ach-navy font-medium">2.</span> Add candidates on{' '}
              <Link href="/candidates" className="underline">Candidates</Link> — capture consent as you go.
            </p>
            <p>
              <span className="text-ach-navy font-medium">3.</span> Create a{' '}
              <Link href="/cohorts" className="underline">cohort</Link> and link partners + candidates to it.
            </p>
            <p>
              <span className="text-ach-navy font-medium">4.</span> Set up the{' '}
              <Link href="/projects" className="underline">project</Link> (Core/Optional capabilities, depth or breadth), then run assessments.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
