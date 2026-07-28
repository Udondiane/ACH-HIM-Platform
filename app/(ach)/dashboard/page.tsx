import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { scoreToLevel, relativeGainPct } from '@/lib/scoring/interpret';

export const dynamic = 'force-dynamic';

const DOMAINS = [
  { key: 'employment',  label: 'Employment' },
  { key: 'housing',     label: 'Housing' },
  { key: 'education',   label: 'Education & Skills' },
  { key: 'health',      label: 'Health & Wellbeing' },
  { key: 'belonging',   label: 'Belonging & Identity' },
  { key: 'social',      label: 'Social Participation' },
  { key: 'rights',      label: 'Rights & Citizenship' },
];

async function safeFetch<T>(fn: () => any, fallback: T): Promise<T> {
  try {
    const r = await fn();
    if (r?.error) return fallback;
    return (r?.data ?? fallback) as T;
  } catch { return fallback; }
}

export default async function AchDashboardPage() {
  const supabase = createClient();

  const [assessments, responses, indicators, factorDomains, placements, retentionChecks, hactProxies, cohorts, candidates] = await Promise.all([
    safeFetch<any[]>(() => supabase.from('assessments').select('id, candidate_id, timepoint, cohort_id').limit(3000), []),
    safeFetch<any[]>(() => supabase.from('assessment_responses').select('assessment_id, indicator_id, numeric_value').limit(6000), []),
    safeFetch<any[]>(() => supabase.from('indicators').select('id, factor_id'), []),
    safeFetch<any[]>(() => supabase.from('factor_domains').select('factor_id, domain_id'), []),
    safeFetch<any[]>(() => supabase.from('placements').select('id, candidate_id, start_date, status'), []),
    safeFetch<any[]>(() => supabase.from('placement_retention_checks').select('placement_id, timepoint, still_employed'), []),
    safeFetch<any[]>(() => supabase.from('bid_framework_domain_proxies').select('domain_id, proxy_value_pence, unit').eq('framework_key', 'hact_wellbeing_2019'), []),
    safeFetch<any[]>(() => supabase.from('cohorts').select('id, status'), []),
    safeFetch<any[]>(() => supabase.from('candidates').select('id, status'), []),
  ]);

  // Lookups
  const indToFactor = new Map(indicators.map((i: any) => [i.id, i.factor_id]));
  const factorToDomains = new Map<string, string[]>();
  for (const fd of factorDomains as any[]) {
    const arr = factorToDomains.get(fd.factor_id) ?? [];
    arr.push(fd.domain_id);
    factorToDomains.set(fd.factor_id, arr);
  }
  const tpByAsm = new Map(assessments.map((a: any) => [a.id, a.timepoint]));

  // Per-domain baseline vs exit
  const perDomain = new Map<string, { baseline: number[]; exit: number[]; candidatesWithData: Set<string> }>();
  for (const d of DOMAINS) perDomain.set(d.key, { baseline: [], exit: [], candidatesWithData: new Set() });

  for (const r of responses as any[]) {
    if (typeof r.numeric_value !== 'number') continue;
    const factor = indToFactor.get(r.indicator_id);
    if (!factor) continue;
    const domains = factorToDomains.get(factor) ?? [];
    const tp = tpByAsm.get(r.assessment_id);
    if (!tp) continue;
    const asm = (assessments as any[]).find((a: any) => a.id === r.assessment_id);
    if (!asm) continue;
    for (const d of domains) {
      const entry = perDomain.get(d);
      if (!entry) continue;
      if (tp === 'baseline') entry.baseline.push(Number(r.numeric_value));
      if (tp === 'mid_3mo' || tp === 'exit_6mo' || tp === 'followup_12mo') entry.exit.push(Number(r.numeric_value));
      entry.candidatesWithData.add(asm.candidate_id);
    }
  }

  const mean = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;

  // Domain rows for the impact signature
  const domainRows = DOMAINS.map(d => {
    const entry = perDomain.get(d.key)!;
    const b = mean(entry.baseline);
    const e = mean(entry.exit);
    const uplift = (b !== null && e !== null) ? e - b : null;
    return {
      key: d.key, label: d.label,
      baseline: b, exit: e, uplift,
      candidates: entry.candidatesWithData.size,
    };
  });

  // Overall
  const allBase = domainRows.flatMap(r => r.baseline !== null ? [r.baseline] : []);
  const allExit = domainRows.flatMap(r => r.exit !== null ? [r.exit] : []);
  const overallBaseline = mean(allBase);
  const overallExit = mean(allExit);
  const overallUplift = (overallBaseline !== null && overallExit !== null) ? overallExit - overallBaseline : null;

  // Outcomes
  const totalCandidates = candidates.length;
  const baselinedCandidates = new Set(
    (assessments as any[]).filter((a: any) => a.timepoint === 'baseline').map(a => a.candidate_id)
  );
  const placedCandidates = new Set((placements as any[]).map(p => p.candidate_id));
  const placementIds = new Set((placements as any[]).map(p => p.id));

  const retention6 = (retentionChecks as any[]).filter(r => placementIds.has(r.placement_id) && r.timepoint === 'retention_6mo');
  const retained6 = retention6.filter(r => r.still_employed === true).length;
  const retention12 = (retentionChecks as any[]).filter(r => placementIds.has(r.placement_id) && r.timepoint === 'retention_12mo');
  const retained12 = retention12.filter(r => r.still_employed === true).length;

  const progressedCount = (candidates as any[]).filter(c => c.status === 'progressed').length;

  // Financial value (HACT starter)
  const hactByDomain = new Map(
    (hactProxies as any[]).map(p => [p.domain_id, { value_gbp: Number(p.proxy_value_pence) / 100, unit: p.unit }])
  );
  let totalSocialValueGbp = 0;
  for (const dr of domainRows) {
    const proxy = hactByDomain.get(dr.key);
    if (!proxy) continue;
    // For employment: count placements. For others: count candidates with positive uplift.
    let people = 0;
    if (dr.key === 'employment') people = placedCandidates.size;
    else if (dr.uplift !== null && dr.uplift > 0) people = dr.candidates;
    totalSocialValueGbp += proxy.value_gbp * people;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Holistic Impact Metric"
        title="Impact dashboard"
        description="What HIM says about ACH’s impact right now, across the seven life domains that make up holistic outcomes."
      />

      {/* HERO — the headline impact statement */}
      <Card className="mb-4 border-ach-navy/25 bg-[#FBF2E0]/40">
        <CardContent className="pt-6 pb-6">
          <div className="text-[10.5px] uppercase tracking-[1.4px] text-ach-navy/60 mb-2">Impact right now</div>
          {overallUplift === null || overallBaseline === null || overallExit === null ? (
            <div className="text-[16px] text-ach-navy leading-relaxed">
              Impact evidence will appear here as candidates are baselined and reassessed. Nothing yet — start by running a baseline assessment.
            </div>
          ) : (
            <>
              <div className="text-[19px] text-ach-navy font-serif leading-relaxed">
                Across the seven HIM domains, mean capability rose from{' '}
                <span className="font-medium">{overallBaseline.toFixed(2)}</span>{' '}
                (Level {scoreToLevel(overallBaseline).level} · {scoreToLevel(overallBaseline).label}) to{' '}
                <span className="font-medium">{overallExit.toFixed(2)}</span>{' '}
                (Level {scoreToLevel(overallExit).level} · {scoreToLevel(overallExit).label}){' '}
                — <span className="font-medium">{relativeGainPct(overallBaseline, overallExit) >= 0 ? '+' : ''}{relativeGainPct(overallBaseline, overallExit)}%</span> on baseline.
              </div>
              <div className="text-[13px] text-ach-navy/60 mt-3">
                Estimated <span className="font-medium text-ach-navy">£{totalSocialValueGbp.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span> of social value delivered so far (HACT wellbeing framework, indicative).
                {' '}<Link href="/impact-library" className="underline underline-offset-2 hover:text-ach-navy">Open impact library →</Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 7-DOMAIN IMPACT SIGNATURE */}
      <Card className="mb-4">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Impact signature</div>
              <div className="text-[15px] font-medium text-ach-navy mt-1">Change across the seven HIM domains</div>
            </div>
            <Link href="/aggregate" className="text-[11.5px] text-ach-navy/70 underline underline-offset-2 hover:text-ach-navy">Network view →</Link>
          </div>
          <div className="space-y-3">
            {domainRows.map(dr => (
              <DomainBar key={dr.key} row={dr} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* OUTCOMES */}
      <Card className="mb-4">
        <CardContent className="pt-5 pb-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">Outcomes achieved</div>
          <div className="text-[15px] font-medium text-ach-navy mb-4">The observable change HIM has captured</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <OutcomeStat
              label="Baselined"
              value={baselinedCandidates.size}
              denom={totalCandidates}
              hint="captured at programme start"
            />
            <OutcomeStat
              label="Placed into work"
              value={placedCandidates.size}
              denom={totalCandidates}
              hint="an active placement recorded"
            />
            <OutcomeStat
              label="Retained at 6 months"
              value={retained6}
              denom={retention6.length}
              hint="still employed at partner check"
            />
            <OutcomeStat
              label="Retained at 12 months"
              value={retained12}
              denom={retention12.length}
              hint="sustained employment confirmed"
            />
            <OutcomeStat
              label="Progressed"
              value={progressedCount}
              denom={placedCandidates.size}
              hint="onward growth after placement"
            />
          </div>
        </CardContent>
      </Card>

      {/* Small links to drill-in surfaces */}
      <div className="text-[11.5px] text-ach-navy/55 flex flex-wrap items-center gap-4 justify-center mt-6 pb-2">
        <Link href="/candidates" className="hover:text-ach-navy underline underline-offset-2">Candidates</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/cohorts" className="hover:text-ach-navy underline underline-offset-2">Cohorts</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/projects" className="hover:text-ach-navy underline underline-offset-2">Projects</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/partners" className="hover:text-ach-navy underline underline-offset-2">Partners</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/aggregate" className="hover:text-ach-navy underline underline-offset-2">Network view</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/impact-library" className="hover:text-ach-navy underline underline-offset-2">Impact library</Link>
      </div>
    </div>
  );
}

function DomainBar({ row }: { row: { key: string; label: string; baseline: number | null; exit: number | null; uplift: number | null; candidates: number } }) {
  const bwPct = row.baseline !== null ? (row.baseline / 5) * 100 : 0;
  const ewPct = row.exit !== null ? (row.exit / 5) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[12.5px] font-medium text-ach-navy">{row.label}</div>
        <div className="text-[11px] text-ach-navy/55">
          {row.baseline !== null && row.exit !== null ? (
            <>
              {row.baseline.toFixed(2)} → {row.exit.toFixed(2)}
              <span className={`ml-2 font-medium ${(row.uplift ?? 0) >= 0 ? 'text-ach-navy' : 'text-red-700'}`}>
                {row.uplift !== null ? `${row.uplift >= 0 ? '+' : ''}${row.uplift.toFixed(2)}` : ''}
              </span>
            </>
          ) : (
            <span className="italic text-ach-navy/45">no data yet</span>
          )}
        </div>
      </div>
      <div className="relative h-5 bg-ach-page rounded-[4px] overflow-hidden border border-ach-border/60">
        {/* Baseline bar (lighter) */}
        <div
          className="absolute top-0 left-0 h-full bg-ach-navy/25"
          style={{ width: `${bwPct}%` }}
          title={`Baseline: ${row.baseline?.toFixed(2) ?? '—'}`}
        />
        {/* Exit bar (darker) inside baseline area */}
        <div
          className="absolute top-0 left-0 h-full bg-ach-navy/70"
          style={{ width: `${ewPct}%` }}
          title={`Exit: ${row.exit?.toFixed(2) ?? '—'}`}
        />
      </div>
    </div>
  );
}

function OutcomeStat({ label, value, denom, hint }: { label: string; value: number; denom?: number; hint: string }) {
  const pct = denom && denom > 0 ? Math.round((value / denom) * 100) : null;
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <div className="text-[24px] font-serif text-ach-navy">{value}</div>
        {pct !== null && (
          <div className="text-[12px] text-ach-navy/60">/ {pct}%</div>
        )}
      </div>
      <div className="text-[11px] text-ach-navy/55">{hint}</div>
    </div>
  );
}
