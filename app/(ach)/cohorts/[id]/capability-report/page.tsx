import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CapabilityRadar } from '@/components/charts/capability-radar';
import { CapabilityBar } from '@/components/charts/capability-bar';
import { computeUplift, computeFunnel } from '@/lib/scoring/uplift';
import { CohortTomsCalculator } from '@/components/toms/cohort-toms-calculator';

const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  housing:    'Housing',
  education:  'Education & Skills',
  health:     'Health & Wellbeing',
  belonging:  'Belonging & Identity',
  social:     'Social Participation',
  rights:     'Rights & Citizenship',
};

const EXIT_REASON_LABELS: Record<string, string> = {
  got_job_with_partner: 'Placed with partner',
  got_job_elsewhere:    'Got job elsewhere',
  education_training:   'Education / training',
  health:               'Health / personal',
  disengaged:           'Disengaged',
  followable:           'Followable',
  other:                'Other',
};

export default async function CapabilityInvestorReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [
    cohortRes, candidatesRes, responsesRes, projectCapsRes,
    tomsCodesRes, tomsClaimsRes,
  ] = await Promise.all([
    supabase.from('cohorts').select('*, projects(id, project_ref, name, capability_questionnaire)').eq('id', params.id).maybeSingle(),
    supabase.from('cohort_candidates').select('candidate_id, candidates(id, candidate_ref, given_name, country_of_origin, status, exit_reason, exit_date, exit_notes)').eq('cohort_id', params.id),
    supabase.from('assessment_responses').select(`
      numeric_value,
      assessments!inner(id, candidate_id, timepoint, cohort_id),
      indicators(factors(factor_domains(domain_id)))
    `).eq('assessments.cohort_id', params.id),
    supabase.from('project_capabilities').select('domain, role'),
    supabase.from('toms_codes').select('*').order('sort_order'),
    supabase.from('cohort_toms_claims').select('toms_code, quantity, notes').eq('cohort_id', params.id),
  ]);

  if (!cohortRes.data) notFound();
  const cohort = cohortRes.data as any;
  const projectCaps = ((projectCapsRes.data as any[]) ?? [])
    .filter((c: any) => c.project_id === cohort.project_id);

  const candidateRows = ((candidatesRes.data as any[]) ?? []).map(r => r.candidates).filter(Boolean);
  const starterIds = candidateRows.map((c: any) => c.id);
  const responses = ((responsesRes.data as any[]) ?? []).flatMap(r => {
    const domains = r.indicators?.factors?.factor_domains ?? [];
    return domains.map((fd: any) => ({
      candidate_id: r.assessments?.candidate_id,
      assessment_id: r.assessments?.id,
      timepoint: r.assessments?.timepoint,
      domain: fd.domain_id,
      numeric_value: r.numeric_value,
    }));
  }).filter((r: any) => r.candidate_id);

  const allDomains = ['employment','housing','education','health','belonging','social','rights'];
  const domainsForCohort = projectCaps.length > 0 ? projectCaps.map((c: any) => c.domain) : allDomains;

  const uplift = computeUplift(responses, starterIds, domainsForCohort);
  const funnel = computeFunnel(candidateRows.map((c: any) => ({ exit_reason: c.exit_reason, status: c.status })));

  const radarData = uplift.map(u => ({
    domain: u.domain,
    baseline: u.baselineAvg,
    exit: u.exitAvgCompleters,
    current: u.exitAvgCompleters,
  }));
  const barCompleters = uplift.map(u => ({
    domain: u.domain,
    score: u.upliftCompleters ?? 0,
    role: (projectCaps.find((c: any) => c.domain === u.domain)?.role ?? 'optional') as 'core' | 'optional',
  }));
  const barItt = uplift.map(u => ({
    domain: u.domain,
    score: u.upliftItt ?? 0,
    role: (projectCaps.find((c: any) => c.domain === u.domain)?.role ?? 'optional') as 'core' | 'optional',
  }));

  const tomsCodes = (tomsCodesRes.data as any[]) ?? [];
  const tomsClaims = (tomsClaimsRes.data as any[]) ?? [];
  const tomsTotal = tomsClaims.reduce((s, c) => {
    const code = tomsCodes.find(k => k.id === c.toms_code);
    if (!code?.proxy_value_pence) return s;
    return s + (Number(c.quantity) * code.proxy_value_pence / 100);
  }, 0);

  const completionRate = funnel.starters > 0
    ? (funnel.completers / funnel.starters) * 100
    : 0;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        backHref={`/cohorts/${params.id}`}
        backLabel={cohort.cohort_ref}
        miniLabel="Reports"
        title="Capability Investor Report"
        description={`${cohort.name} - cohort evidence pack for ESG/CSR reporting.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" type="button">
              <Download className="h-3.5 w-3.5" />Print / save as PDF
            </Button>
          </div>
        }
      />

      <Card className="mb-5">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Project</div>
              <div className="text-[14px] font-medium text-ach-navy mt-1">{cohort.projects?.name ?? '—'}</div>
              <div className="text-[11.5px] text-ach-navy/60 mt-0.5">{cohort.projects?.project_ref}</div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Cohort window</div>
              <div className="text-[14px] font-medium text-ach-navy mt-1">
                {cohort.start_date ? new Date(cohort.start_date).toLocaleDateString('en-GB') : '—'}
                {cohort.end_date ? ` – ${new Date(cohort.end_date).toLocaleDateString('en-GB')}` : ''}
              </div>
              <div className="text-[11.5px] text-ach-navy/60 mt-0.5">{cohort.location ?? ''}</div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Methodology</div>
              <div className="text-[13px] text-ach-navy mt-1">HIM v1.0</div>
              <div className="text-[11px] text-ach-navy/55 mt-0.5">Generated {new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 1. Completion funnel */}
      <Card className="mb-5">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">1. Completion funnel</div>
          <div className="text-[12.5px] text-ach-navy/60 mt-0.5">Dropouts stay in the denominator. &quot;Got a job elsewhere&quot; is a WIN, not a loss.</div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Starters" value={String(funnel.starters)} />
            <Stat label="Completers" value={String(funnel.completers)} sub={`${completionRate.toFixed(0)}% completion`} />
            <Stat label="Placed (any)" value={String(funnel.placedWithPartner + funnel.placedElsewhere)} sub={`${funnel.placedWithPartner} with partner, ${funnel.placedElsewhere} elsewhere`} />
            <Stat label="Into education / training" value={String(funnel.intoEducation)} sub="continuing pathway" />
          </div>
          {(funnel.healthOrPersonal + funnel.disengaged + funnel.followable + funnel.otherExits) > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <Stat label="Health / personal" value={String(funnel.healthOrPersonal)} muted />
              <Stat label="Disengaged" value={String(funnel.disengaged)} muted />
              <Stat label="Followable" value={String(funnel.followable)} muted />
              <Stat label="Other" value={String(funnel.otherExits)} muted />
            </div>
          )}
          {funnel.stillInProgramme > 0 && (
            <div className="text-[12px] text-ach-navy/60 mt-2">
              {funnel.stillInProgramme} candidate{funnel.stillInProgramme === 1 ? ' is' : 's are'} still in programme.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Capability uplift two ways */}
      <Card className="mb-5">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">2. Capability uplift — two ways</div>
          <div className="text-[12.5px] text-ach-navy/60 mt-0.5">
            <span className="font-medium">Completers basis</span> = average across candidates with both baseline + exit scores. <span className="font-medium">Intention-to-treat (ITT)</span> = average across ALL starters; dropouts held at baseline (zero uplift). The ITT figure is always more conservative and earns more academic respect.
          </div>
        </CardHeader>
        <CardContent>
          {uplift.every(u => u.upliftCompleters == null && u.upliftItt == null) ? (
            <div className="text-[13px] text-ach-navy/60">No assessment data yet for this cohort. Run baseline + exit assessments to populate this report.</div>
          ) : (
            <>
              <div className="overflow-hidden rounded-[12px] border-[0.5px] border-ach-border mb-4">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-ach-page">
                    <tr>
                      <th className="text-left px-3 py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Domain</th>
                      <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Baseline avg</th>
                      <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Exit avg (completers)</th>
                      <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Uplift (completers)</th>
                      <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Uplift (ITT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uplift.map(u => (
                      <tr key={u.domain} className="border-t-[0.5px] border-ach-border">
                        <td className="px-3 py-2 text-ach-navy font-medium">{DOMAIN_LABELS[u.domain] ?? u.domain}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ach-navy/75">{u.baselineAvg != null ? u.baselineAvg.toFixed(2) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ach-navy/75">{u.exitAvgCompleters != null ? u.exitAvgCompleters.toFixed(2) : '—'}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${u.upliftCompleters != null && u.upliftCompleters > 0 ? 'text-[#5E7A3C]' : 'text-ach-navy/75'}`}>
                          {u.upliftCompleters != null ? (u.upliftCompleters >= 0 ? '+' : '') + u.upliftCompleters.toFixed(2) : '—'}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${u.upliftItt != null && u.upliftItt > 0 ? 'text-[#5E7A3C]' : 'text-ach-navy/75'}`}>
                          {u.upliftItt != null ? (u.upliftItt >= 0 ? '+' : '') + u.upliftItt.toFixed(2) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Capability radar (completers)</div>
                  <CapabilityRadar data={radarData} mode="comparison" height={260} />
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Uplift bars — completers vs ITT</div>
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
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 3. TOMs translation */}
      <Card className="mb-5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">3. TOMs translation (£ social value)</div>
              <div className="text-[12.5px] text-ach-navy/60 mt-0.5">
                Activity-based £ claims for public-procurement reporting. {tomsTotal > 0 ? `This cohort claims £${Math.round(tomsTotal).toLocaleString()} of social value at 2019 proxy values.` : 'Enter quantities below to compute the £ claim.'}
              </div>
            </div>
            <Link href="/toms-crosswalk" className="text-[12px] underline text-ach-navy whitespace-nowrap">View full crosswalk</Link>
          </div>
        </CardHeader>
        <CardContent>
          <CohortTomsCalculator
            cohortId={params.id}
            codes={tomsCodes.map(c => ({
              id: c.id, measure: c.measure, unit: c.unit, proxy_value_pence: c.proxy_value_pence, play: c.play,
            }))}
            initialClaims={tomsClaims.map(c => ({ toms_code: c.toms_code, quantity: c.quantity, notes: c.notes }))}
          />
        </CardContent>
      </Card>

      {/* 4. Attribution caveats */}
      <Card className="mb-5">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">4. Attribution & caveats</div>
        </CardHeader>
        <CardContent className="text-[12.5px] text-ach-navy/80 space-y-2.5 max-w-prose">
          <p><span className="font-medium">Methodology version.</span> Scoring uses the HIM Methodology Specification v1.0 (May 2026). Indicator-to-domain rollup, asymmetric depth/breadth weight ratios, and universal-factor apportionment follow the published spec.</p>
          <p><span className="font-medium">Two-way reporting.</span> Uplift is reported on a completers basis AND intention-to-treat (dropouts held at baseline). The ITT figure is the conservative estimate; the completers figure shows the upper bound for candidates who finished the programme.</p>
          <p><span className="font-medium">TOMs values.</span> £ proxy values reference the National TOMs 2019 district-council edition and must be verified against the live edition before any contractual commitment.</p>
          <p><span className="font-medium">Attribution.</span> Capability uplift between baseline and exit is observed within the programme window but is not adjusted for counterfactual change (what would have happened without the programme). The platform reports observed uplift only.</p>
          <p><span className="font-medium">Sample size.</span> {funnel.starters} starters; {funnel.completers} completers. Small-n statistics; treat as evidence-of-change rather than population-level estimate.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, muted }: { label: string; value: string; sub?: string; muted?: boolean }) {
  return (
    <div className={`rounded-[12px] border-[0.5px] p-3 ${muted ? 'border-ach-border bg-ach-page/40' : 'border-ach-border bg-white'}`}>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className={`text-[20px] font-medium tracking-[-0.5px] mt-1 tabular-nums ${muted ? 'text-ach-navy/70' : 'text-ach-navy'}`}>{value}</div>
      {sub && <div className="text-[11.5px] text-ach-navy/55 mt-0.5">{sub}</div>}
    </div>
  );
}
