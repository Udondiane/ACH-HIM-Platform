import Link from 'next/link';
import { Building2, Users, Layers, FolderKanban, AlertTriangle, Clock, Sparkles, ArrowRight, Library, LayoutDashboard, Quote, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { computePendingActions, labelFor, type PendingAction } from '@/lib/scoring/pending-actions';
import { FollowUpExceptions } from '@/components/dashboard/follow-up-exceptions';
import { scoreToLevel, relativeGainPct } from '@/lib/scoring/interpret';

export const dynamic = 'force-dynamic';

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

async function loadImpactSnapshot() {
  const supabase = createClient();
  const [assessments, responses] = await Promise.all([
    supabase.from('assessments').select('id, candidate_id, timepoint').limit(2000),
    supabase.from('assessment_responses').select('assessment_id, numeric_value').limit(5000),
  ]);
  const asList = (assessments.data as any[]) ?? [];
  const rsList = (responses.data as any[]) ?? [];
  const tpByAsm = new Map(asList.map((a: any) => [a.id, a.timepoint]));

  const baselines: number[] = [];
  const exits: number[] = [];
  const candidatesWithBoth = new Set<string>();
  const candidatesBaselined = new Set<string>();
  const candidatesExited = new Set<string>();

  for (const r of rsList) {
    if (typeof r.numeric_value !== 'number') continue;
    const asm = asList.find((a: any) => a.id === r.assessment_id);
    if (!asm) continue;
    if (asm.timepoint === 'baseline') {
      baselines.push(Number(r.numeric_value));
      candidatesBaselined.add(asm.candidate_id);
    } else if (asm.timepoint === 'mid_3mo' || asm.timepoint === 'exit_6mo' || asm.timepoint === 'followup_12mo') {
      exits.push(Number(r.numeric_value));
      candidatesExited.add(asm.candidate_id);
    }
  }
  for (const c of candidatesBaselined) {
    if (candidatesExited.has(c)) candidatesWithBoth.add(c);
  }

  const mean = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
  return {
    meanBaseline: mean(baselines),
    meanExit: mean(exits),
    candidatesWithBoth: candidatesWithBoth.size,
    candidatesBaselined: candidatesBaselined.size,
  };
}

async function loadOutputs() {
  const supabase = createClient();
  const [cohortReports, quotes, cohorts] = await Promise.all([
    supabase.from('cohort_reports').select('id, cohort_id, report_type, generated_at, cohorts(name)').order('generated_at', { ascending: false }).limit(3),
    supabase.from('featured_quotes').select('id').is('archived_at', null),
    supabase.from('cohorts').select('id, name').order('created_at', { ascending: false }).limit(1),
  ]);
  return {
    recentReports: (cohortReports.data as any[]) ?? [],
    quoteCount:    ((quotes.data as any[]) ?? []).length,
    latestCohort:  ((cohorts.data as any[]) ?? [])[0] ?? null,
  };
}

export default async function AchDashboardPage() {
  const [stats, pending, impact, outputs] = await Promise.all([
    loadStats(),
    loadPendingActions(),
    loadImpactSnapshot(),
    loadOutputs(),
  ]);
  const atRisk = pending.filter(p => p.kind === 'at_risk_flagged');
  const overdue = pending.filter(p => p.kind !== 'at_risk_flagged' && (p.due_in_days ?? 0) > 14);
  const dueSoon = pending.filter(p => p.kind !== 'at_risk_flagged' && (p.due_in_days ?? 0) <= 14 && (p.due_in_days ?? 0) >= 0);
  const nothingPending = atRisk.length === 0 && overdue.length === 0 && dueSoon.length === 0;

  const cards = [
    { href: '/partners',   label: 'Partners',   value: stats.partners,    icon: Building2,   subline: 'across three types' },
    { href: '/candidates', label: 'Candidates', value: stats.candidates,  icon: Users,        subline: 'in programme or alumni' },
    { href: '/cohorts',    label: 'Cohorts',    value: stats.cohorts,     icon: Layers,       subline: `${stats.cohortsActive} active` },
    { href: '/projects',   label: 'Projects',   value: stats.projects,    icon: FolderKanban, subline: 'HIM-scored programmes' },
  ];

  const uplift = (impact.meanBaseline !== null && impact.meanExit !== null)
    ? impact.meanExit - impact.meanBaseline
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Workspace"
        title="ACH staff dashboard"
        description="What HIM is doing today. Drill into any card, or start from the operational focus below."
      />

      {/* 1 — KPI cards */}
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

      {/* 2 — Follow-up exceptions (only renders if there's data) */}
      <div className="mt-4">
        <FollowUpExceptions />
      </div>

      {/* 3 — Today's focus (pending actions) */}
      <div className="mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Today&rsquo;s focus</div>
                <div className="text-[15px] font-medium text-ach-navy mt-1">What needs attention</div>
              </div>
              {!nothingPending && (
                <Link href="/candidates" className="text-[11.5px] text-ach-navy/70 underline underline-offset-2 hover:text-ach-navy">See all</Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {nothingPending ? (
              <div className="text-[13px] text-ach-navy/60 italic">
                Nothing to action right now. HIM will flag candidates automatically as timepoints come due, follow-ups are missed, or at-risk rules trigger.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FocusTile
                  icon={AlertTriangle}
                  tone="alert"
                  count={atRisk.length}
                  label="At risk"
                  hint="flagged by rule or by hand"
                />
                <FocusTile
                  icon={Clock}
                  tone="warn"
                  count={overdue.length}
                  label="Overdue actions"
                  hint="assessments or timepoints past due"
                />
                <FocusTile
                  icon={Clock}
                  tone="focus"
                  count={dueSoon.length}
                  label="Due within 14 days"
                  hint="upcoming timepoints"
                />
              </div>
            )}
            {!nothingPending && pending.length > 0 && (
              <div className="mt-4 pt-3 border-t border-ach-border">
                <div className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/55 mb-2">Top items</div>
                <div className="space-y-1.5">
                  {pending.slice(0, 4).map((p, i) => (
                    <Link key={i} href={p.href} className="flex items-center justify-between gap-3 text-[12.5px] text-ach-navy hover:bg-ach-page rounded-[6px] px-2 py-1.5">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-ach-navy/55">{p.candidateRef}</span>
                        <span>{labelFor(p.kind)}</span>
                      </span>
                      <ArrowRight className="h-3 w-3 text-ach-navy/40" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4 — Network impact snapshot */}
      <div className="mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Network impact snapshot</div>
                <div className="text-[15px] font-medium text-ach-navy mt-1">
                  <Sparkles className="inline h-3.5 w-3.5 mr-1 text-ach-navy/50" />
                  What HIM says about ACH&rsquo;s network right now
                </div>
              </div>
              <Link href="/impact-library" className="text-[11.5px] text-ach-navy/70 underline underline-offset-2 hover:text-ach-navy">Open impact library</Link>
            </div>
          </CardHeader>
          <CardContent>
            {uplift === null || impact.meanBaseline === null || impact.meanExit === null ? (
              <div className="text-[13px] text-ach-navy/60 italic">
                Impact evidence populates once candidates have both baseline and exit assessments recorded.
              </div>
            ) : (
              <>
                <div className="text-[15px] text-ach-navy leading-relaxed">
                  Across <span className="font-medium">{impact.candidatesWithBoth} candidates</span> with baseline and exit data,
                  mean capability moved from <span className="font-medium">{impact.meanBaseline.toFixed(2)}</span>{' '}
                  (Level {scoreToLevel(impact.meanBaseline).level} · {scoreToLevel(impact.meanBaseline).label}) to{' '}
                  <span className="font-medium">{impact.meanExit.toFixed(2)}</span>{' '}
                  (Level {scoreToLevel(impact.meanExit).level} · {scoreToLevel(impact.meanExit).label})
                  — <span className={`font-medium ${uplift >= 0 ? 'text-ach-navy' : 'text-red-700'}`}>
                    {relativeGainPct(impact.meanBaseline, impact.meanExit) >= 0 ? '+' : ''}
                    {relativeGainPct(impact.meanBaseline, impact.meanExit)}% on baseline
                  </span>.
                </div>
                <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-ach-border">
                  <SnapshotStat label="Baselined" value={String(impact.candidatesBaselined)} />
                  <SnapshotStat label="With before + after" value={String(impact.candidatesWithBoth)} />
                  <SnapshotStat label="Mean baseline" value={impact.meanBaseline.toFixed(2)} />
                  <SnapshotStat label="Mean exit" value={impact.meanExit.toFixed(2)} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5 — HIM outputs */}
      <div className="mt-4">
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">What HIM is producing</div>
            <div className="text-[15px] font-medium text-ach-navy mt-1">Reports, evidence, voices</div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <OutputTile
                href="/impact-library"
                icon={Library}
                label="Impact library"
                sub="grab evidence for a bid"
              />
              <OutputTile
                href="/aggregate"
                icon={LayoutDashboard}
                label="Network view"
                sub="funnel + capability radar"
              />
              <OutputTile
                href="/featured-quotes"
                icon={Quote}
                label="Featured voices"
                sub={outputs.quoteCount === 0 ? 'none captured yet' : `${outputs.quoteCount} tagged`}
              />
              <OutputTile
                href={outputs.latestCohort ? `/cohorts/${outputs.latestCohort.id}/close-out` : '/cohorts'}
                icon={FileText}
                label="Latest close-out"
                sub={outputs.latestCohort?.name ?? 'no cohorts yet'}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FocusTile({ icon: Icon, tone, count, label, hint }: {
  icon: any; tone: 'alert' | 'warn' | 'focus'; count: number; label: string; hint: string;
}) {
  const colour = tone === 'alert' ? 'text-[#8B3E52]' : tone === 'warn' ? 'text-[#B8862C]' : 'text-ach-navy';
  return (
    <div className="rounded-[8px] bg-white border border-ach-border/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 ${colour}`} />
        <div className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/60">{label}</div>
      </div>
      <div className={`text-[22px] font-serif ${colour}`}>{count}</div>
      <div className="text-[10.5px] text-ach-navy/55">{hint}</div>
    </div>
  );
}

function SnapshotStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{label}</div>
      <div className="text-[18px] font-serif text-ach-navy">{value}</div>
    </div>
  );
}

function OutputTile({ href, icon: Icon, label, sub }: {
  href: string; icon: any; label: string; sub: string;
}) {
  return (
    <Link href={href} className="rounded-[10px] border border-ach-border/60 bg-white px-3 py-3 hover:bg-ach-page transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-ach-navy/60" />
        <div className="text-[12.5px] font-medium text-ach-navy">{label}</div>
      </div>
      <div className="text-[11px] text-ach-navy/55">{sub}</div>
    </Link>
  );
}
