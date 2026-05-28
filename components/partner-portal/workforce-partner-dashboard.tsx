import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/* Replacement-cost methodology per the HIM Methodology Specification
   Section 9.1: salary band -> % of salary used as replacement-cost
   estimate. Following Oxford Economics (2014) and CIPD research.
   Estimated, not realised. Conservative - calculated only where 12+
   months has elapsed AND only for the count exceeding industry-
   expected retention. */

const REPLACEMENT_COST_PCT: Record<string, number> = {
  volume:   0.16, // Entry level (<£25k) - 16%
  standard: 0.50, // Mid-range (£25-35k) - 50%
  premium:  0.75, // Senior (£35-50k) - 75%
};

const BAND_LABELS: Record<string, string> = {
  volume:   'Entry (<£25k)',
  standard: 'Mid-range (£25–35k)',
  premium:  'Senior (£35–50k)',
};

/* Industry-expected 12-month retention (sector benchmark, indicative).
   Used as a conservative baseline: we only claim savings on retained
   placements EXCEEDING this rate. */
const SECTOR_BENCHMARK_12MO = 0.68;

export async function WorkforcePartnerDashboard({ partner, hideHeader }: { partner: any; hideHeader?: boolean }) {
  const supabase = createClient();

  const [placements, cohortPartners, devFundCredits, assessmentResponses] = await Promise.all([
    supabase.from('placements')
      .select('id, role_title, salary_band, salary_actual, start_date, status, candidates(id, candidate_ref, given_name, country_of_origin)')
      .eq('partner_id', partner.id).order('start_date', { ascending: false }),
    supabase.from('cohort_partners')
      .select('id, cohorts(id, cohort_ref, name, status)')
      .eq('partner_id', partner.id),
    supabase.from('dev_fund_credits').select('amount').eq('partner_id', partner.id),
    supabase.from('assessment_responses')
      .select(`
        numeric_value,
        assessments!inner(candidate_id, timepoint, candidates!inner(id))
      `),
  ]);

  const allPlacements = (placements.data as any[]) ?? [];
  const cohortRows = (cohortPartners.data as any[]) ?? [];
  const placedCandidateIds = new Set(allPlacements.map(p => p.candidates?.id).filter(Boolean));

  /* Section 9.1 - Commercial Outcomes */
  const totalPlacements = allPlacements.length;
  const activePlacements = allPlacements.filter(p => p.status === 'active' || p.status === 'started').length;
  const retained12mo = allPlacements.filter(p => p.status === 'completed_12mo').length;
  const eligibleFor12mo = allPlacements.filter(p => {
    const start = new Date(p.start_date);
    const months = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4);
    return months >= 12 && p.status !== 'active' && p.status !== 'started';
  }).length || totalPlacements;
  const retentionRate = eligibleFor12mo > 0 ? retained12mo / eligibleFor12mo : null;
  const benchmarkDelta = retentionRate != null ? retentionRate - SECTOR_BENCHMARK_12MO : null;

  /* Estimated retention savings: only count placements that exceed the
     industry-expected retention baseline. Conservative per spec. */
  const retainedExceedingBenchmark = Math.max(0, retained12mo - Math.round(SECTOR_BENCHMARK_12MO * eligibleFor12mo));
  const retentionSavings = allPlacements
    .filter(p => p.status === 'completed_12mo')
    .slice(0, retainedExceedingBenchmark)
    .reduce((s, p) => {
      const pct = REPLACEMENT_COST_PCT[p.salary_band as string] ?? 0;
      return s + (Number(p.salary_actual ?? 0) * pct);
    }, 0);

  const devFundContribution = ((devFundCredits.data as any[]) ?? [])
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);

  /* Section 9.2 - D&I Outcomes */
  const placedCountries = Array.from(new Set(
    allPlacements
      .map(p => p.candidates?.country_of_origin)
      .filter((c): c is string => typeof c === 'string' && c.length > 0)
  )).sort();
  const refugeeMigrantHires = totalPlacements;
  const employeeCount = Number(partner.employee_count ?? 0);
  const workforcePct = employeeCount > 0 ? (refugeeMigrantHires / employeeCount) * 100 : null;

  /* Section 9.3 - Candidate Capability Outcomes */
  const partnerResponses = ((assessmentResponses.data as any[]) ?? [])
    .filter(r => placedCandidateIds.has(r.assessments?.candidate_id));
  const baselineByC = new Map<string, number[]>();
  const exitByC = new Map<string, number[]>();
  for (const r of partnerResponses) {
    if (r.numeric_value == null) continue;
    const cId = r.assessments?.candidate_id as string;
    const tp = r.assessments?.timepoint as string;
    const target = tp === 'baseline' ? baselineByC : (tp === 'exit_6mo' || tp === 'followup_12mo' ? exitByC : null);
    if (!target) continue;
    if (!target.has(cId)) target.set(cId, []);
    target.get(cId)!.push(Number(r.numeric_value));
  }
  const upliftValues: number[] = [];
  for (const cId of placedCandidateIds) {
    const b = baselineByC.get(cId);
    const e = exitByC.get(cId);
    if (b && b.length > 0 && e && e.length > 0) {
      const bMean = b.reduce((s, v) => s + v, 0) / b.length;
      const eMean = e.reduce((s, v) => s + v, 0) / e.length;
      upliftValues.push(eMean - bMean);
    }
  }
  const meanUplift = upliftValues.length > 0
    ? upliftValues.reduce((s, v) => s + v, 0) / upliftValues.length
    : null;

  return (
    <div>
      {hideHeader ? (
        <div className="mb-4 pb-3 border-b-[0.5px] border-ach-border">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">As a Workforce Partner</div>
        </div>
      ) : (
        <PageHeader
          miniLabel="ACH Workforce Partner"
          title={`Welcome, ${partner.name}`}
        />
      )}

      {/* SECTION 9.1 — COMMERCIAL OUTCOMES */}
      <div className="mb-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Section 1 · Commercial outcomes</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <KpiCard label="Total placements" value={String(totalPlacements)} sub={`${activePlacements} currently active`} />
        <KpiCard
          label="Retained at 12 months"
          value={String(retained12mo)}
          sub={retentionRate != null
            ? `${(retentionRate * 100).toFixed(0)}% retention rate` + (benchmarkDelta != null ? ` · ${benchmarkDelta >= 0 ? '+' : ''}${(benchmarkDelta * 100).toFixed(0)}pp vs ${(SECTOR_BENCHMARK_12MO * 100).toFixed(0)}% benchmark` : '')
            : 'awaiting eligible placements'}
        />
        <KpiCard
          label="Estimated retention savings"
          value={`£${Math.round(retentionSavings).toLocaleString()}`}
          sub="conservative; counts only placements exceeding the benchmark"
        />
        <KpiCard
          label="Development Fund"
          value={`£${devFundContribution.toLocaleString()}`}
          sub="invested in candidate progression"
        />
      </div>

      {retainedExceedingBenchmark > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Retention savings breakdown</div>
            <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Replacement-cost methodology: salary × % per band (Oxford Economics 2014, CIPD). Estimated, not realised.</div>
          </CardHeader>
          <CardContent>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <Th>Reference</Th>
                  <Th>Role</Th>
                  <Th>Salary band</Th>
                  <Th className="text-right">Salary</Th>
                  <Th className="text-right">Replacement cost %</Th>
                  <Th className="text-right">Saving (£)</Th>
                </tr>
              </thead>
              <tbody>
                {allPlacements
                  .filter(p => p.status === 'completed_12mo')
                  .slice(0, retainedExceedingBenchmark)
                  .map(p => {
                    const pct = REPLACEMENT_COST_PCT[p.salary_band as string] ?? 0;
                    const saving = Number(p.salary_actual ?? 0) * pct;
                    return (
                      <tr key={p.id} className="border-b-[0.5px] border-ach-border last:border-0">
                        <Td className="text-ach-navy font-medium">{p.candidates?.candidate_ref ?? '—'}</Td>
                        <Td>{p.role_title}</Td>
                        <Td className="text-ach-navy/70">{BAND_LABELS[p.salary_band as string] ?? p.salary_band}</Td>
                        <Td className="text-right tabular-nums">£{Number(p.salary_actual ?? 0).toLocaleString()}</Td>
                        <Td className="text-right tabular-nums">{(pct * 100).toFixed(0)}%</Td>
                        <Td className="text-right tabular-nums font-medium">£{Math.round(saving).toLocaleString()}</Td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* SECTION 9.2 — D&I OUTCOMES */}
      <div className="mb-2 mt-5 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Section 2 · Diversity & Inclusion outcomes</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <KpiCard label="Refugee / migrant hires" value={String(refugeeMigrantHires)} sub="through ACH" />
        <KpiCard
          label="Countries represented"
          value={String(placedCountries.length)}
          sub={placedCountries.length > 0 ? placedCountries.slice(0, 4).join(', ') + (placedCountries.length > 4 ? `, +${placedCountries.length - 4} more` : '') : '—'}
        />
        <KpiCard
          label="% of workforce"
          value={workforcePct != null ? `${workforcePct.toFixed(2)}%` : '—'}
          sub={employeeCount > 0 ? `of ${employeeCount.toLocaleString()} employees` : 'employee count not recorded'}
        />
      </div>

      {/* SECTION 9.3 — CANDIDATE CAPABILITY OUTCOMES */}
      <div className="mb-2 mt-5 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Section 3 · Candidate capability outcomes</div>
      <Card className="mb-5">
        <CardContent className="pt-5">
          {meanUplift == null ? (
            <p className="text-[13px] text-ach-navy/65">
              No baseline + exit HIM assessment data yet for placed candidates. The capability uplift summary appears here once exit assessments are completed.
            </p>
          ) : (
            <>
              <div className="text-[13px] text-ach-navy/75">
                Average HIM uplift across {upliftValues.length} assessed candidate{upliftValues.length === 1 ? '' : 's'}:
              </div>
              <div className={`text-[28px] font-medium tracking-[-0.5px] mt-1 tabular-nums ${meanUplift > 0 ? 'text-[#5E7A3C]' : 'text-ach-navy'}`}>
                {meanUplift >= 0 ? '+' : ''}{meanUplift.toFixed(2)}
              </div>
              <div className="text-[11.5px] text-ach-navy/55 mt-1">
                On a 0–5 scale. Per-candidate trajectory (baseline + most recent assessment) is available to ACH staff and to the placed individual; anonymised candidate refs only.
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Recent placements</div>
        </CardHeader>
        <CardContent>
          {allPlacements.length === 0 ? (
            <p className="text-[13px] text-ach-navy/60">No placements yet.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <Th>Reference</Th><Th>Role</Th><Th>Band</Th><Th>Started</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {allPlacements.slice(0, 10).map(p => (
                  <tr key={p.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <Td className="text-ach-navy font-medium">{p.candidates?.candidate_ref}</Td>
                    <Td>{p.role_title}</Td>
                    <Td className="capitalize">{p.salary_band}</Td>
                    <Td className="text-ach-navy/70">{new Date(p.start_date).toLocaleDateString('en-GB')}</Td>
                    <Td><Badge>{p.status}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Methodology notes</div>
          <ul className="text-[11.5px] text-ach-navy/70 mt-2 space-y-1 list-disc pl-4 max-w-prose">
            <li>Retention savings are estimated using a replacement-cost methodology (% of salary by band, per Oxford Economics 2014 and CIPD). They are not realised cash savings.</li>
            <li>Calculations apply only to placements with 12+ months elapsed and only to the count exceeding the industry-expected {(SECTOR_BENCHMARK_12MO * 100).toFixed(0)}% 12-month benchmark.</li>
            <li>Sector benchmark is an indicative baseline; replace with sector-specific data (Skills for Care, UK Hospitality, NHS Digital, ONS) for high-stakes use.</li>
            <li>No combined &quot;partner HIM score&quot; is produced. The three sections above are reported separately on incompatible scales.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
        <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5 tabular-nums">{value}</div>
        <div className="text-[11.5px] text-ach-navy/60 mt-1.5">{sub}</div>
      </CardContent>
    </Card>
  );
}
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2 ${className}`}>{children}</td>;
}
