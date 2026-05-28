import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CapabilityRadar } from '@/components/charts/capability-radar';
import { CapabilityBar } from '@/components/charts/capability-bar';
import { WordCloud } from '@/components/charts/word-cloud';
import { computeUplift, computeFunnel } from '@/lib/scoring/uplift';

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

  // Network funnel across ALL cohorts
  const funnel = computeFunnel(allCohortCands.map((cc: any) => ({
    exit_reason: cc.candidates?.exit_reason ?? null,
    status: cc.candidates?.status ?? 'applicant',
  })));

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
  const barItt = networkUplift.map(u => ({ domain: u.domain, score: u.upliftItt ?? 0, role: 'core' as const }));
  const barCompleters = networkUplift.map(u => ({ domain: u.domain, score: u.upliftCompleters ?? 0, role: 'core' as const }));

  const completionRate = funnel.starters > 0 ? (funnel.completers / funnel.starters) * 100 : 0;
  const placedRate = funnel.starters > 0 ? ((funnel.placedWithPartner + funnel.placedElsewhere) / funnel.starters) * 100 : 0;
  const hasAnyAssessmentData = flatResponses.some(r => r.numeric_value != null);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Reports"
        title="Aggregate dashboard"
        description="Network-wide view across every project and cohort. Cross-project HIM uplift, completion funnel honesty, and total TOMs social value claimed."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Projects" value={String(totalProjects)} sub={`${allProjects.filter((p: any) => p.status === 'active').length} active`} />
        <Kpi label="Cohorts" value={String(totalCohorts)} sub={`${allCohorts.filter((c: any) => c.status === 'in_progress' || c.status === 'recruiting').length} live`} />
        <Kpi label="Candidates" value={String(totalCandidates)} sub={`${totalAssessmentResponses} assessment responses`} />
        <Kpi label="TOMs £ social value" value={`£${Math.round(tomsTotalPence / 100).toLocaleString()}`} sub={`£${Math.round(quantTomsPence / 100).toLocaleString()} quantitative`} />
      </div>

      <Card className="mb-5">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Network completion funnel</div>
          <div className="text-[12.5px] text-ach-navy/60 mt-0.5">All cohorts combined, dropouts visible. {completionRate.toFixed(0)}% completion, {placedRate.toFixed(0)}% placed somewhere.</div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <FunnelStat label="Starters" value={funnel.starters} />
            <FunnelStat label="Completers" value={funnel.completers} sub={`${completionRate.toFixed(0)}%`} />
            <FunnelStat label="Placed (any)" value={funnel.placedWithPartner + funnel.placedElsewhere} sub={`${funnel.placedWithPartner} partner / ${funnel.placedElsewhere} other`} />
            <FunnelStat label="Into education" value={funnel.intoEducation} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FunnelStat label="Health / personal" value={funnel.healthOrPersonal} muted />
            <FunnelStat label="Disengaged" value={funnel.disengaged} muted />
            <FunnelStat label="Followable" value={funnel.followable} muted />
            <FunnelStat label="Still in programme" value={funnel.stillInProgramme} muted />
          </div>
        </CardContent>
      </Card>

      {hasAnyAssessmentData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Network capability radar</div>
              <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Baseline vs Exit across all candidates.</div>
            </CardHeader>
            <CardContent>
              <CapabilityRadar data={radarData} mode="comparison" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Uplift — completers vs ITT</div>
              <div className="text-[11.5px] text-ach-navy/55 mt-0.5">The honest pair: completers basis + intention-to-treat.</div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <div className="text-[10.5px] text-ach-navy/55 text-center mb-1">Completers</div>
                  <CapabilityBar data={barCompleters} height={220} />
                </div>
                <div>
                  <div className="text-[10.5px] text-ach-navy/55 text-center mb-1">ITT</div>
                  <CapabilityBar data={barItt} height={220} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
                  <Th className="text-right">Starters</Th>
                  <Th className="text-right">Avg uplift (completers)</Th>
                  <Th className="text-right">Avg uplift (ITT)</Th>
                  <Th>Funding model</Th>
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
                    <td className="py-2 text-ach-navy/75 capitalize text-[12px]">{r.project.funding_model ?? '—'}</td>
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

function FunnelStat({ label, value, sub, muted }: { label: string; value: number; sub?: string; muted?: boolean }) {
  return (
    <div className={`rounded-[12px] border-[0.5px] p-3 ${muted ? 'border-ach-border bg-ach-page/40' : 'border-ach-border bg-white'}`}>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className={`text-[19px] font-medium tracking-[-0.5px] mt-1 tabular-nums ${muted ? 'text-ach-navy/70' : 'text-ach-navy'}`}>{value}</div>
      {sub && <div className="text-[11px] text-ach-navy/55 mt-0.5">{sub}</div>}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
