import Link from 'next/link';
import { FileText, Info, Quote } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CapabilityRadar } from '@/components/charts/capability-radar';
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

// Human-readable funding model labels — replaces the raw enum values
// ("funded", "commercial", "hybrid") that read as jargon to ACH staff.
const FUNDING_MODEL_LABEL: Record<string, string> = {
  funded: 'Grant funded',
  commercial: 'Paid by employer',
  hybrid: 'Grant + employer',
};

export default async function AggregateDashboardPage() {
  const supabase = createClient();
  const [projects, cohorts, candidates, cohortCandidates, responses, tomsClaims, tomsCodes] = await Promise.all([
    supabase.from('projects').select('id, project_ref, name, status, funding_model').order('project_ref'),
    supabase.from('cohorts').select('id, cohort_ref, name, project_id, status, start_date'),
    supabase.from('candidates').select('id, status, exit_reason'),
    supabase.from('cohort_candidates').select('cohort_id, candidate_id, candidates(id, status, exit_reason)'),
    supabase.from('assessment_responses').select(`
      numeric_value,
      assessments!inner(id, candidate_id, timepoint, project_id, cohort_id),
      indicators(factors(factor_domains(domain_id)))
    `),
    supabase.from('cohort_toms_claims').select('cohort_id, toms_code, quantity'),
    supabase.from('toms_codes').select('id, proxy_value_pence, play'),
  ]);

  const allProjects = (projects.data as any[]) ?? [];
  const allCohorts = (cohorts.data as any[]) ?? [];
  const allCandidates = (candidates.data as any[]) ?? [];
  const allCohortCands = (cohortCandidates.data as any[]) ?? [];
  const allResponses = (responses.data as any[]) ?? [];
  const allClaims = (tomsClaims.data as any[]) ?? [];
  const allCodes = (tomsCodes.data as any[]) ?? [];

  // KPIs
  const totalProjects = allProjects.length;
  const totalCohorts = allCohorts.length;
  const totalCandidates = allCandidates.length;
  const withdrawn = allCandidates.filter((c: any) => c.status === 'withdrawn').length;
  const activeBeneficiaries = totalCandidates - withdrawn;
  const totalAssessmentResponses = allResponses.length;
  const codeMap = new Map(allCodes.map(c => [c.id, c]));
  const tomsTotalPence = allClaims.reduce((s, c) => {
    const code = codeMap.get(c.toms_code);
    if (!code?.proxy_value_pence) return s;
    return s + Number(c.quantity) * code.proxy_value_pence;
  }, 0);
  const quantTomsPence = allClaims.reduce((s, c) => {
    const code = codeMap.get(c.toms_code);
    if (!code?.proxy_value_pence || code.play !== 'QUANT') return s;
    return s + Number(c.quantity) * code.proxy_value_pence;
  }, 0);

  // Per-project uplift, ITT basis, headline KPI
  const projectRows = allProjects.map(p => {
    const projectCohorts = allCohorts.filter((c: any) => c.project_id === p.id);
    const cohortIds = new Set(projectCohorts.map((c: any) => c.id));
    const starters = allCohortCands
      .filter(cc => cohortIds.has(cc.cohort_id))
      .map(cc => cc.candidate_id);

    const projectResponses = allResponses
      .filter(r => cohortIds.has(r.assessments?.cohort_id))
      .flatMap(r => {
        const domains = r.indicators?.factors?.factor_domains ?? [];
        return domains.map((fd: any) => ({
          candidate_id: r.assessments?.candidate_id,
          assessment_id: r.assessments?.id,
          timepoint: r.assessments?.timepoint,
          domain: fd.domain_id,
          numeric_value: r.numeric_value,
        }));
      })
      .filter((r: any) => r.candidate_id);

    const uplift = computeUplift(projectResponses, starters, ALL_DOMAINS);
    const meanItt = uplift.filter(u => u.upliftItt != null).reduce((s, u) => s + (u.upliftItt ?? 0), 0)
      / Math.max(1, uplift.filter(u => u.upliftItt != null).length);
    const meanCompleters = uplift.filter(u => u.upliftCompleters != null).reduce((s, u) => s + (u.upliftCompleters ?? 0), 0)
      / Math.max(1, uplift.filter(u => u.upliftCompleters != null).length);

    return {
      project: p,
      cohortCount: projectCohorts.length,
      starterCount: starters.length,
      meanUpliftItt: isFinite(meanItt) && meanItt !== 0 ? meanItt : null,
      meanUpliftCompleters: isFinite(meanCompleters) && meanCompleters !== 0 ? meanCompleters : null,
    };
  });

  // Network-level radar combining ALL responses
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
        title="Aggregate dashboard"
        description="A single view across every project, cohort, and beneficiary. Use this to spot which projects are driving the biggest capability change, then jump into that project's outcomes report."
        actions={
          <Link href="/featured-quotes">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ach-navy hover:text-ach-navy/70 underline underline-offset-2">
              <Quote className="h-3.5 w-3.5" />
              Featured quotes library
            </span>
          </Link>
        }
      />

      {/* Jargon buster — one card that explains the three shorthand
          columns down in the per-project table before staff hit them.
          Static and small; disappears on print. */}
      <div className="rounded-[10px] border-[0.5px] border-ach-border bg-ach-page/50 p-4 mb-5 print:hidden">
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 mt-0.5 text-ach-navy/60 shrink-0" />
          <div className="text-[12.5px] text-ach-navy/80 space-y-1.5 flex-1">
            <p><strong>How to read the table below:</strong></p>
            <p>
              <strong>Capability change (finishers)</strong> — for beneficiaries who
              made it to the exit assessment, how much their average HIM score moved
              between baseline and exit. Higher is better.
            </p>
            <p>
              <strong>Capability change (everyone who started)</strong> — the same
              number, but including people who withdrew (counted as zero change).
              This is the honest headline for funders — it counts dropouts against
              you.
            </p>
            <p>
              <strong>How it&apos;s paid for</strong> — grant funded, paid by an
              employer, or a mix of both.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Projects" value={String(totalProjects)} sub={`${allProjects.filter((p: any) => p.status === 'active').length} active`} />
        <Kpi label="Cohorts" value={String(totalCohorts)} sub={`${allCohorts.filter((c: any) => c.status === 'in_progress' || c.status === 'recruiting').length} live`} />
        <Kpi label="Beneficiaries" value={String(activeBeneficiaries)} sub={withdrawn > 0 ? `${withdrawn} withdrawn` : undefined} />
        <Kpi label="TOMs £ social value" value={`£${Math.round(tomsTotalPence / 100).toLocaleString()}`} sub={`£${Math.round(quantTomsPence / 100).toLocaleString()} quantitative`} />
      </div>

      {hasAnyAssessmentData && (
        <Card className="mb-5">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Network capability radar</div>
            <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Baseline vs Exit across all beneficiaries.</div>
          </CardHeader>
          <CardContent>
            <CapabilityRadar data={radarData} mode="comparison" />
          </CardContent>
        </Card>
      )}

      <Card className="mb-5">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Per-project breakdown</div>
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
                  <Th className="text-right">Capability change<br /><span className="text-[10px] text-ach-navy/50 tracking-normal normal-case">Finishers only</span></Th>
                  <Th className="text-right">Capability change<br /><span className="text-[10px] text-ach-navy/50 tracking-normal normal-case">Everyone who started</span></Th>
                  <Th>How it&apos;s paid for</Th>
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
                    <td className="py-2 text-right tabular-nums text-ach-navy/75">{r.starterCount}</td>
                    <td className={`py-2 text-right tabular-nums font-medium ${r.meanUpliftCompleters != null && r.meanUpliftCompleters > 0 ? 'text-[#5E7A3C]' : 'text-ach-navy/55'}`}>
                      {r.meanUpliftCompleters != null ? (r.meanUpliftCompleters >= 0 ? '+' : '') + r.meanUpliftCompleters.toFixed(2) : '—'}
                    </td>
                    <td className={`py-2 text-right tabular-nums font-medium ${r.meanUpliftItt != null && r.meanUpliftItt > 0 ? 'text-[#5E7A3C]' : 'text-ach-navy/55'}`}>
                      {r.meanUpliftItt != null ? (r.meanUpliftItt >= 0 ? '+' : '') + r.meanUpliftItt.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 text-ach-navy/75 text-[12px]">
                      {r.project.funding_model ? (FUNDING_MODEL_LABEL[r.project.funding_model] ?? r.project.funding_model) : '—'}
                    </td>
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
