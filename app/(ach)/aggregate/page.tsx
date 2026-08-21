import Link from 'next/link';
import { FileText, Quote } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CapabilityRadar } from '@/components/charts/capability-radar';
import { PrintButton } from '@/components/ui/print-button';
import { computeUplift } from '@/lib/scoring/uplift';

const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  housing:    'Housing',
  education:  'Education & Skills',
  health:     'Health & Wellbeing',
  belonging:  'Belonging & Identity',
  social:     'Social Participation',
  rights:     'Rights & Citizenship',
};

const ALL_DOMAINS = ['employment','housing','education','health','belonging','social','rights'];

// Fully dynamic — every hit re-queries the DB. Combined with the
// revalidatePath calls in every mutation action across the app this
// guarantees the aggregate reflects reality at page-load time.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AggregateDashboardPage() {
  const supabase = createClient();
  const [
    projects, cohorts, candidates, cohortCandidates, responses,
    placements, beneficiaryOutcomes, featuredQuotes,
  ] = await Promise.all([
    supabase.from('projects').select('id, project_ref, name, status').order('project_ref'),
    supabase.from('cohorts').select('id, project_id, status'),
    supabase.from('candidates').select('id, status'),
    supabase.from('cohort_candidates').select('cohort_id, candidate_id, candidates(id, status)'),
    supabase.from('assessment_responses').select(`
      numeric_value,
      assessments!inner(id, candidate_id, timepoint, project_id, cohort_id),
      indicators(factors(factor_domains(domain_id)))
    `),
    supabase.from('placements').select('id, candidate_id, salary_pence, status'),
    supabase.from('beneficiary_outcomes').select('project_id, candidate_id, outcome_key'),
    supabase.from('featured_quotes').select('id').is('archived_at', null),
  ]);

  const allProjects       = (projects.data as any[]) ?? [];
  const allCohorts        = (cohorts.data as any[]) ?? [];
  const allCandidates     = (candidates.data as any[]) ?? [];
  const allCohortCands    = (cohortCandidates.data as any[]) ?? [];
  const allResponses      = (responses.data as any[]) ?? [];
  const allPlacements     = (placements.data as any[]) ?? [];
  const allOutcomes       = (beneficiaryOutcomes.data as any[]) ?? [];
  const allQuotes         = (featuredQuotes.data as any[]) ?? [];

  // Network-wide totals — same shape as each project's outcomes report
  // hero card, so the aggregate reads as a network-scale roll-up of what
  // funders see per project.
  const enrolledCandidateIds = new Set(allCohortCands.map(cc => cc.candidate_id));
  const enrolledCount   = enrolledCandidateIds.size;
  const completedCount  = allCandidates.filter((c: any) =>
    enrolledCandidateIds.has(c.id) &&
    c.status !== 'withdrawn' && c.status !== 'applicant',
  ).length;
  const withdrawnCount  = allCandidates.filter((c: any) => c.status === 'withdrawn').length;

  const activePlacements = allPlacements.filter(p => p.status !== 'cancelled');
  const placedCount = activePlacements.length;
  const totalSalary = activePlacements.reduce((s, p) => s + (p.salary_pence ?? 0), 0) / 100;
  const outcomesReached = allOutcomes.length;
  const featuredQuotesCount = allQuotes.length;

  // Per-project row: just the numbers each project's outcomes report
  // headlines. No jargon columns, no ITT/completers split — the outcomes
  // report itself handles that if a funder needs to see it.
  const projectRows = allProjects.map(p => {
    const projectCohorts = allCohorts.filter((c: any) => c.project_id === p.id);
    const cohortIds = new Set(projectCohorts.map((c: any) => c.id));
    const enrolledIds = new Set(
      allCohortCands.filter(cc => cohortIds.has(cc.cohort_id)).map(cc => cc.candidate_id),
    );
    const placedForProject = allPlacements.filter(pl =>
      pl.status !== 'cancelled' && enrolledIds.has(pl.candidate_id),
    ).length;
    const outcomesForProject = allOutcomes.filter(o => o.project_id === p.id).length;
    const quotesForProject = allQuotes.length;   // quotes aren't project-scoped in the query; keep for symmetry
    return {
      project: p,
      cohortCount: projectCohorts.length,
      enrolled: enrolledIds.size,
      placed: placedForProject,
      outcomesReached: outcomesForProject,
      quotesReady: quotesForProject,
    };
  });

  // Network-level radar + per-domain change table (unchanged from before)
  const allStarters = allCohortCands.map(cc => cc.candidate_id);
  const flatResponses = allResponses.flatMap(r => {
    const domains = r.indicators?.factors?.factor_domains ?? [];
    return domains.map((fd: any) => ({
      candidate_id: r.assessments?.candidate_id,
      assessment_id: r.assessments?.id,
      timepoint: r.assessments?.timepoint,
      domain: fd.domain_id,
      numeric_value: r.numeric_value,
    }));
  }).filter((r: any) => r.candidate_id);

  const networkUplift = computeUplift(flatResponses, allStarters, ALL_DOMAINS);
  const radarData = networkUplift.map(u => ({
    domain: u.domain,
    baseline: u.baselineAvg,
    exit: u.exitAvgCompleters,
    current: u.exitAvgCompleters,
  }));
  const hasAnyAssessmentData = flatResponses.some(r => r.numeric_value != null);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Reports"
        title="Aggregate impact report"
        description="A network-wide roll-up of what every project's outcomes report shows. Print or save as PDF for a funder or board pack. Click any project below to open its full outcomes report."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/featured-quotes">
              <span className="inline-flex items-center gap-1.5 text-[12px] text-ach-navy hover:text-ach-navy/70 underline underline-offset-2">
                <Quote className="h-3.5 w-3.5" />
                Featured quotes library
              </span>
            </Link>
            <PrintButton />
          </div>
        }
      />

      {/* Top row — mirrors the hero card on each project's outcomes
          report, scaled up to the whole network. Every metric here is
          also headlined on the individual reports so the numbers read
          as consistent between "one project" and "all projects". */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi
          label="Beneficiaries enrolled"
          value={String(enrolledCount)}
          sub={completedCount > 0 && enrolledCount > 0
            ? `${completedCount} completed · ${Math.round((completedCount/enrolledCount)*100)}%`
            : withdrawnCount > 0 ? `${withdrawnCount} withdrawn` : undefined}
        />
        <Kpi
          label="Placed in work"
          value={String(placedCount)}
          sub={placedCount > 0 && enrolledCount > 0
            ? `${Math.round((placedCount/enrolledCount)*100)}% of enrolled`
            : undefined}
        />
        <Kpi
          label="Salary secured"
          value={totalSalary > 0 ? `£${Math.round(totalSalary / 1000)}k` : '—'}
          sub={totalSalary > 0 && placedCount > 0
            ? `£${Math.round(totalSalary / placedCount / 1000)}k average · into local economy`
            : undefined}
        />
        <Kpi
          label="Outcomes ticked"
          value={String(outcomesReached)}
          sub={featuredQuotesCount > 0 ? `${featuredQuotesCount} featured quote${featuredQuotesCount === 1 ? '' : 's'} in library` : undefined}
        />
      </div>

      {/* Radar renders only when there's data — a radar with no points
          reads as broken rather than empty. Fine because the domain
          bar-chart card below always renders and communicates the same
          shape without needing every domain populated. */}
      {hasAnyAssessmentData && (
        <Card className="mb-5">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Network capability radar</div>
            <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Baseline vs exit across all beneficiaries — visual view.</div>
          </CardHeader>
          <CardContent>
            <CapabilityRadar data={radarData} mode="comparison" />
          </CardContent>
        </Card>
      )}

      {/* Change by capability domain — always renders. Domains with no
          data show a dashed "Awaiting assessment data" row rather than
          disappearing, so the seven-domain frame is always visible and
          readers understand the shape of what will fill in over time. */}
      <Card className="mb-5">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Change by capability domain</div>
          <div className="text-[11.5px] text-ach-navy/55 mt-0.5">
            Mean HIM score per domain — baseline to exit — averaged across every assessment on the platform. Bars are on the 0–5 scale.
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {networkUplift.map(u => {
            const b = u.baselineAvg ?? 0;
            const e = u.exitAvgCompleters ?? b;
            const delta = (u.baselineAvg !== null && u.exitAvgCompleters !== null)
              ? u.exitAvgCompleters - u.baselineAvg : null;
            const label = DOMAIN_LABELS[u.domain] ?? u.domain;
            const hasAny = u.baselineAvg !== null || u.exitAvgCompleters !== null;
            return (
              <div key={u.domain} className="grid grid-cols-[160px_1fr_160px] gap-4 items-center max-md:grid-cols-[120px_1fr_120px]">
                <div className="text-[13px] text-ach-navy">{label}</div>
                {hasAny ? (
                  <>
                    <div className="relative h-5 bg-ach-page rounded-[3px] overflow-hidden border-[0.5px] border-ach-border/70">
                      {u.baselineAvg !== null && (
                        <div className="absolute inset-y-0 left-0 bg-ach-navy/25" style={{ width: `${(b / 5) * 100}%` }} />
                      )}
                      {u.exitAvgCompleters !== null && (
                        <div className="absolute inset-y-0 left-0 bg-[#B8843C]" style={{ width: `${(e / 5) * 100}%` }} />
                      )}
                    </div>
                    <div className="text-[12px] font-mono tabular-nums text-right text-ach-navy/60">
                      {u.baselineAvg !== null ? u.baselineAvg.toFixed(1) : '—'}
                      {' → '}
                      {u.exitAvgCompleters !== null ? u.exitAvgCompleters.toFixed(1) : '—'}
                      {delta !== null && (
                        <strong className={`ml-1.5 font-semibold ${delta >= 0 ? 'text-[#1B6D6A]' : 'text-[#8B3A4F]'}`}>
                          {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
                        </strong>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-5 rounded-[3px] border-[0.5px] border-dashed border-ach-border bg-ach-page/40 flex items-center px-2.5">
                      <span className="text-[11px] italic text-ach-navy/50">Awaiting assessment data across the network.</span>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-right text-ach-navy/40">—</div>
                  </>
                )}
              </div>
            );
          })}
          <div className="pt-2 text-[11px] text-ach-navy/50 border-t-[0.5px] border-ach-border mt-3">
            Navy bar = baseline mean · Gold bar = exit mean · Green delta = capability rose · Rose delta = capability fell.
          </div>
        </CardContent>
      </Card>

      {/* Per-project breakdown — only the numbers every funder wants at
          a glance, plus a link into the full outcomes report for depth. */}
      <Card className="mb-5">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Per-project breakdown</div>
          <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Same shape as each project&apos;s outcomes report. Open a project for the full report with quotes, capability change per domain, and outcomes ladder.</div>
        </CardHeader>
        <CardContent>
          {projectRows.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60">No projects yet.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <Th>Project</Th>
                  <Th className="text-right">Cohorts</Th>
                  <Th className="text-right">Enrolled</Th>
                  <Th className="text-right">Placed</Th>
                  <Th className="text-right">Outcomes ticked</Th>
                  <Th className="text-right">Report</Th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map(r => (
                  <tr key={r.project.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <td className="py-2">
                      <Link href={`/projects/${r.project.id}`} className="text-ach-navy font-medium hover:underline">{r.project.name}</Link>
                      <div className="text-[11px] text-ach-navy/55">{r.project.project_ref}</div>
                    </td>
                    <td className="py-2 text-right tabular-nums text-ach-navy/75">{r.cohortCount}</td>
                    <td className="py-2 text-right tabular-nums text-ach-navy/75">{r.enrolled}</td>
                    <td className="py-2 text-right tabular-nums text-ach-navy/75">{r.placed}</td>
                    <td className="py-2 text-right tabular-nums text-ach-navy/75">{r.outcomesReached}</td>
                    <td className="py-2 text-right">
                      <Link
                        href={`/projects/${r.project.id}/outcomes-report`}
                        className="inline-flex items-center gap-1 text-[11.5px] text-ach-navy underline underline-offset-2 hover:text-ach-navy/70"
                      >
                        <FileText className="h-3 w-3" />
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
        <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2 tabular-nums">{value}</div>
        {sub && <div className="text-[11.5px] text-ach-navy/55 mt-1.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
