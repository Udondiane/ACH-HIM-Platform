import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CapabilityRadar } from '@/components/charts/capability-radar';
import { WordCloud } from '@/components/charts/word-cloud';

const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  education:  'Education & Skills',
  social:     'Social Participation',
  housing:    'Housing',
  health:     'Health & Wellbeing',
  belonging:  'Belonging & Identity',
  rights:     'Rights & Citizenship',
};
const DOMAIN_ORDER = ['employment','education','housing','health','belonging','social','rights'];

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

  const [placements, cohortPartners, assessmentResponses] = await Promise.all([
    supabase.from('placements')
      .select('id, role_title, salary_band, salary_actual, start_date, status, candidates(id, candidate_ref, given_name, country_of_origin)')
      .eq('partner_id', partner.id).order('start_date', { ascending: false }),
    supabase.from('cohort_partners')
      .select('id, cohorts(id, cohort_ref, name, status)')
      .eq('partner_id', partner.id),
    supabase.from('assessment_responses')
      .select(`
        numeric_value,
        observable_changes,
        practices,
        indicators!inner(factor_id, factors!inner(factor_domains!inner(domain_id))),
        assessments!inner(candidate_id, timepoint)
      `),
  ]);

  const allPlacements = (placements.data as any[]) ?? [];
  const cohortRows = (cohortPartners.data as any[]) ?? [];
  const placedCandidateIds = new Set(allPlacements.map(p => p.candidates?.id).filter(Boolean));

  /* Section 9.1 - Commercial Outcomes */
  const totalPlacements = allPlacements.length;
  const retained12mo = allPlacements.filter(p => p.status === 'completed_12mo').length;
  const eligibleFor12mo = allPlacements.filter(p => {
    const start = new Date(p.start_date);
    const months = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4);
    return months >= 12 && p.status !== 'active' && p.status !== 'started';
  }).length || totalPlacements;
  const retentionRate = eligibleFor12mo > 0 ? retained12mo / eligibleFor12mo : null;

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

  /* Section 9.2 - Diversity outcomes (country of origin focused) */
  const countryCounts = new Map<string, number>();
  for (const p of allPlacements) {
    const country = p.candidates?.country_of_origin;
    if (typeof country === 'string' && country.length > 0) {
      countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
    }
  }
  const countryBreakdown = Array.from(countryCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  /* Section 9.3 - Candidate Capability Outcomes */
  const partnerResponses = ((assessmentResponses.data as any[]) ?? [])
    .filter(r => placedCandidateIds.has(r.assessments?.candidate_id));

  // Per-candidate baseline + latest mean (overall uplift)
  const baselineByC = new Map<string, number[]>();
  const exitByC = new Map<string, number[]>();
  // Per-domain aggregates (across all placed candidates)
  type DomAgg = { baselineSum: number; baselineN: number; exitSum: number; exitN: number };
  const domainAgg = new Map<string, DomAgg>();
  // Per-(domain, candidate) — for an honest per-candidate-per-domain uplift mean
  const domainPerCandidate = new Map<string, { baseline: Map<string, number[]>; exit: Map<string, number[]> }>();
  // Narrative text for word cloud
  const narrativeTexts: string[] = [];

  for (const r of partnerResponses) {
    const cId = r.assessments?.candidate_id as string;
    const tp = r.assessments?.timepoint as string;
    const isBaseline = tp === 'baseline';
    const isExit = tp === 'exit_6mo' || tp === 'followup_12mo';
    if (!isBaseline && !isExit) continue;

    // overall per-candidate
    if (r.numeric_value != null) {
      const target = isBaseline ? baselineByC : exitByC;
      if (!target.has(cId)) target.set(cId, []);
      target.get(cId)!.push(Number(r.numeric_value));
    }

    // per-domain aggregate
    const fdRaw = r.indicators?.factors?.factor_domains;
    const fds: Array<{ domain_id: string }> = Array.isArray(fdRaw) ? fdRaw : (fdRaw ? [fdRaw] : []);
    for (const fd of fds) {
      const dom = fd.domain_id;
      if (r.numeric_value != null) {
        if (!domainAgg.has(dom)) domainAgg.set(dom, { baselineSum: 0, baselineN: 0, exitSum: 0, exitN: 0 });
        const a = domainAgg.get(dom)!;
        if (isBaseline) { a.baselineSum += Number(r.numeric_value); a.baselineN += 1; }
        else            { a.exitSum     += Number(r.numeric_value); a.exitN     += 1; }

        if (!domainPerCandidate.has(dom)) domainPerCandidate.set(dom, { baseline: new Map(), exit: new Map() });
        const dpc = domainPerCandidate.get(dom)!;
        const bag = isBaseline ? dpc.baseline : dpc.exit;
        if (!bag.has(cId)) bag.set(cId, []);
        bag.get(cId)!.push(Number(r.numeric_value));
      }
    }

    // narrative text — only from exit / follow-up so we capture "what changed"
    if (isExit) {
      if (typeof r.observable_changes === 'string') narrativeTexts.push(r.observable_changes);
      if (typeof r.practices === 'string')          narrativeTexts.push(r.practices);
    }
  }

  // Overall uplift per candidate (mean of all their responses, exit − baseline)
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

  // Per-domain rows for the breakdown table + radar
  const domainRows = DOMAIN_ORDER
    .map(dom => {
      const a = domainAgg.get(dom);
      if (!a) return null;
      const baselineMean = a.baselineN > 0 ? a.baselineSum / a.baselineN : null;
      const exitMean     = a.exitN > 0     ? a.exitSum / a.exitN         : null;
      const delta        = baselineMean != null && exitMean != null ? exitMean - baselineMean : null;
      return { domain: dom, baselineMean, exitMean, delta };
    })
    .filter((d): d is { domain: string; baselineMean: number | null; exitMean: number | null; delta: number | null } => d !== null);

  const positiveDomains = domainRows.filter(d => (d.delta ?? 0) > 0).length;
  const radarData = domainRows.map(d => ({
    domain: d.domain,
    baseline: d.baselineMean,
    exit: d.exitMean,
    current: d.exitMean,
  }));

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

      {/* Top KPI row — 4 cards (commercial outcomes + diversity headline) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <KpiCard label="Total placements" value={String(totalPlacements)} />
        <KpiCard
          label="Retained at 12 months"
          value={String(retained12mo)}
          sub={retentionRate != null
            ? `${(retentionRate * 100).toFixed(0)}% retention rate`
            : 'awaiting eligible placements'}
        />
        <KpiCard
          label="Estimated retention savings"
          value={`£${Math.round(retentionSavings).toLocaleString()}`}
        />
        <KpiCard
          label="Countries of origin represented"
          value={String(countryBreakdown.length)}
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

      {/* Country of origin breakdown — collapsed behind toggle */}
      {countryBreakdown.length > 0 && (
        <Card className="mb-5">
          <CardContent className="pt-4 pb-4">
            <details className="group">
              <summary className="flex items-center justify-between gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
                  Country of origin breakdown
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-ach-navy/55">
                  <span className="group-open:hidden">Show details</span>
                  <span className="hidden group-open:inline">Hide details</span>
                  <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </summary>
              <div className="mt-3 pt-3 border-t-[0.5px] border-ach-border">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b-[0.5px] border-ach-border">
                      <Th>Country of origin</Th>
                      <Th className="text-right">Hires</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryBreakdown.map(([country, count]) => (
                      <tr key={country} className="border-b-[0.5px] border-ach-border last:border-0">
                        <Td className="text-ach-navy">{country}</Td>
                        <Td className="text-right tabular-nums font-medium">{count}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Candidate capability outcomes — full section */}
      {meanUplift == null ? (
        <Card className="mb-5 mt-5">
          <CardContent className="pt-5">
            <p className="text-[13px] text-ach-navy/65">
              The capability section appears here once any placed candidate has both a baseline and an exit assessment recorded.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-5 space-y-4">

          {/* Capability KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard
              label="Average capability uplift"
              value={`${meanUplift >= 0 ? '+' : ''}${meanUplift.toFixed(2)}`}
              sub="on a 0–5 scale, per placed candidate"
            />
            <KpiCard
              label="Candidates assessed"
              value={String(upliftValues.length)}
              sub="with both baseline + exit"
            />
            <KpiCard
              label="Domains with positive uplift"
              value={`${positiveDomains} / ${domainRows.length}`}
              sub="across the HIM framework"
            />
          </div>

          {/* Per-domain breakdown + radar side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Per-domain breakdown</div>
                <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Mean scores across placed candidates, baseline vs latest assessment.</div>
              </CardHeader>
              <CardContent>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b-[0.5px] border-ach-border">
                      <Th>Domain</Th>
                      <Th className="text-right">Baseline</Th>
                      <Th className="text-right">Latest</Th>
                      <Th className="text-right">Δ</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {domainRows.map(d => {
                      const delta = d.delta;
                      const deltaTone =
                        delta == null ? 'text-ach-navy/40'
                        : delta > 0   ? 'text-[#5E7A3C]'
                        : delta < 0   ? 'text-[#8B3A4F]'
                                      : 'text-ach-navy/65';
                      return (
                        <tr key={d.domain} className="border-b-[0.5px] border-ach-border last:border-0">
                          <Td className="text-ach-navy">{DOMAIN_LABELS[d.domain] ?? d.domain}</Td>
                          <Td className="text-right tabular-nums text-ach-navy/70">{d.baselineMean != null ? d.baselineMean.toFixed(2) : '—'}</Td>
                          <Td className="text-right tabular-nums text-ach-navy">{d.exitMean != null ? d.exitMean.toFixed(2) : '—'}</Td>
                          <Td className={`text-right tabular-nums font-medium ${deltaTone}`}>
                            {delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}` : '—'}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Capability radar</div>
                <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Baseline (lighter) and latest assessment (darker) per domain.</div>
              </CardHeader>
              <CardContent>
                <CapabilityRadar data={radarData} mode="comparison" />
              </CardContent>
            </Card>
          </div>

          {/* Themes from candidate narratives */}
          {narrativeTexts.length > 0 && (
            <Card>
              <CardHeader>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Themes in candidate narratives</div>
                <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Most frequent words across observable-changes and practices fields at exit / follow-up.</div>
              </CardHeader>
              <CardContent>
                <WordCloud texts={narrativeTexts} />
              </CardContent>
            </Card>
          )}

          {/* Methodology footer for the capability section */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-[11px] text-ach-navy/60 max-w-prose">
                <span className="font-medium text-ach-navy/75">How capability uplift is calculated.</span> Each placed candidate is scored against the 7 HIM capability domains on a 0–5 scale at baseline (before training) and again at exit (6 months) or follow-up (12 months). The figures above show the mean per-domain score across all placed candidates, with Δ = latest − baseline. Per-candidate detail is available to ACH staff and to the individual; the partner view shows aggregates only. Methodology version: HIM v1.0.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
        <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5 tabular-nums">{value}</div>
        {sub && <div className="text-[11.5px] text-ach-navy/60 mt-1.5">{sub}</div>}
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
