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

  const [assessments, responses, indicators, factorDomains, placements, retentionChecks, hactProxies, candidates, cohortCandidates] = await Promise.all([
    safeFetch<any[]>(() => supabase.from('assessments').select('id, candidate_id, timepoint').limit(3000), []),
    safeFetch<any[]>(() => supabase.from('assessment_responses').select('assessment_id, indicator_id, numeric_value').limit(6000), []),
    safeFetch<any[]>(() => supabase.from('indicators').select('id, factor_id'), []),
    safeFetch<any[]>(() => supabase.from('factor_domains').select('factor_id, domain_id'), []),
    safeFetch<any[]>(() => supabase.from('placements').select('id, candidate_id'), []),
    safeFetch<any[]>(() => supabase.from('placement_retention_checks').select('placement_id, timepoint, still_employed'), []),
    safeFetch<any[]>(() => supabase.from('bid_framework_domain_proxies').select('domain_id, proxy_value_pence').eq('framework_key', 'hact_wellbeing_2019'), []),
    safeFetch<any[]>(() => supabase.from('candidates').select('id, status'), []),
    safeFetch<any[]>(() => supabase.from('cohort_candidates').select('candidate_id'), []),
  ]);

  // Lookups
  const indToFactor = new Map(indicators.map((i: any) => [i.id, i.factor_id]));
  const factorToDomains = new Map<string, string[]>();
  for (const fd of factorDomains as any[]) {
    const arr = factorToDomains.get(fd.factor_id) ?? [];
    arr.push(fd.domain_id);
    factorToDomains.set(fd.factor_id, arr);
  }
  const asmById = new Map(assessments.map((a: any) => [a.id, a]));

  // Per-domain baseline vs exit
  const perDomain = new Map<string, { baseline: number[]; exit: number[]; cands: Set<string> }>();
  for (const d of DOMAINS) perDomain.set(d.key, { baseline: [], exit: [], cands: new Set() });

  for (const r of responses as any[]) {
    if (typeof r.numeric_value !== 'number') continue;
    const factor = indToFactor.get(r.indicator_id);
    if (!factor) continue;
    const asm = asmById.get(r.assessment_id) as any;
    if (!asm) continue;
    for (const d of (factorToDomains.get(factor) ?? [])) {
      const entry = perDomain.get(d);
      if (!entry) continue;
      if (asm.timepoint === 'baseline') entry.baseline.push(Number(r.numeric_value));
      if (asm.timepoint === 'mid_3mo' || asm.timepoint === 'exit_6mo' || asm.timepoint === 'followup_12mo') entry.exit.push(Number(r.numeric_value));
      entry.cands.add(asm.candidate_id);
    }
  }

  const mean = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;

  const domainRows = DOMAINS.map(d => {
    const e = perDomain.get(d.key)!;
    const baseline = mean(e.baseline);
    const exit = mean(e.exit);
    const uplift = (baseline !== null && exit !== null) ? exit - baseline : null;
    return { key: d.key, label: d.label, baseline, exit, uplift };
  });

  // Overall
  const overallBaseline = mean(domainRows.map(r => r.baseline).filter((v): v is number => v !== null));
  const overallExit     = mean(domainRows.map(r => r.exit).filter((v): v is number => v !== null));

  // OUTCOMES LADDER
  const enrolledIds = new Set((cohortCandidates as any[]).map(cc => cc.candidate_id));
  const baselinedIds = new Set(
    (assessments as any[]).filter(a => a.timepoint === 'baseline').map(a => a.candidate_id)
  );
  const placedCandIds = new Set((placements as any[]).map(p => p.candidate_id));
  const placementIds  = new Set((placements as any[]).map(p => p.id));
  const ret6  = (retentionChecks as any[]).filter(r => placementIds.has(r.placement_id) && r.timepoint === 'retention_6mo');
  const ret12 = (retentionChecks as any[]).filter(r => placementIds.has(r.placement_id) && r.timepoint === 'retention_12mo');
  const retained6  = ret6.filter(r => r.still_employed === true).length;
  const retained12 = ret12.filter(r => r.still_employed === true).length;
  const progressedCount = (candidates as any[]).filter(c => c.status === 'progressed').length;

  const enrolled = enrolledIds.size;
  const baselined = baselinedIds.size;
  const placed = placedCandIds.size;

  // FINANCIAL — only show if we have real data
  const hact = new Map((hactProxies as any[]).map(p => [p.domain_id, Number(p.proxy_value_pence) / 100]));
  let totalSocialValueGbp = 0;
  for (const dr of domainRows) {
    const proxy = hact.get(dr.key);
    if (!proxy) continue;
    if (dr.key === 'employment') totalSocialValueGbp += proxy * placed;
    else if (dr.uplift !== null && dr.uplift > 0) totalSocialValueGbp += proxy * baselined; // rough — refined per bid
  }

  const haveImpactData = overallBaseline !== null && overallExit !== null;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Holistic Impact Metric"
        title="Impact dashboard"
        description="What HIM says about ACH’s impact across the seven life domains."
      />

      {/* SECTION 1 — HERO */}
      <Card className="mb-4 border-ach-navy/25 bg-[#FBF2E0]/40">
        <CardContent className="pt-6 pb-6">
          <div className="text-[10.5px] uppercase tracking-[1.4px] text-ach-navy/60 mb-2">Impact right now</div>
          {!haveImpactData ? (
            <div className="text-[16px] text-ach-navy leading-relaxed">
              Impact evidence will appear here as candidates are baselined and reassessed. Run a baseline assessment to start.
            </div>
          ) : (
            <>
              <div className="text-[19px] text-ach-navy font-serif leading-relaxed">
                Across the seven HIM domains, mean capability rose from{' '}
                <span className="font-medium">{overallBaseline!.toFixed(2)}</span>{' '}
                (Level {scoreToLevel(overallBaseline!).level} · {scoreToLevel(overallBaseline!).label}) to{' '}
                <span className="font-medium">{overallExit!.toFixed(2)}</span>{' '}
                (Level {scoreToLevel(overallExit!).level} · {scoreToLevel(overallExit!).label}) —{' '}
                <span className="font-medium">
                  {relativeGainPct(overallBaseline!, overallExit!) >= 0 ? '+' : ''}
                  {relativeGainPct(overallBaseline!, overallExit!)}%
                </span>{' '}on baseline.
              </div>
              {totalSocialValueGbp > 0 && (
                <div className="text-[13px] text-ach-navy/70 mt-3">
                  Estimated{' '}
                  <span className="font-medium text-ach-navy">
                    £{totalSocialValueGbp.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </span>{' '}
                  of social value delivered so far (HACT wellbeing framework, indicative).{' '}
                  <Link href="/impact-library" className="underline underline-offset-2 hover:text-ach-navy">Open impact library →</Link>
                </div>
              )}
              {totalSocialValueGbp === 0 && (
                <div className="text-[13px] text-ach-navy/60 mt-3">
                  <Link href="/impact-library" className="underline underline-offset-2 hover:text-ach-navy">Open impact library →</Link>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2 — IMPACT SIGNATURE */}
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
            {domainRows.map(row => <DomainBar row={row} key={row.key} />)}
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3 — OUTCOMES LADDER */}
      <Card className="mb-4">
        <CardContent className="pt-5 pb-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">Outcomes ladder</div>
          <div className="text-[15px] font-medium text-ach-navy mb-4">The observable outcomes HIM has captured</div>

          <LadderStep num={1} label="Enrolled"                value={enrolled}       denom={enrolled}     hint="candidates on a cohort" isBase />
          <LadderStep num={2} label="Baselined"               value={baselined}      denom={enrolled}     hint="have a baseline assessment recorded" />
          <LadderStep num={3} label="Placed into work"        value={placed}         denom={baselined}    hint="active placement recorded" />
          <LadderStep num={4} label="Retained at 6 months"    value={retained6}      denom={placed}       hint="partner check confirmed" />
          <LadderStep num={5} label="Retained at 12 months"   value={retained12}     denom={placed}       hint="sustained employment" />
          <LadderStep num={6} label="Progressed"              value={progressedCount} denom={placed}      hint="promoted, moved on, or better role" isLast />
        </CardContent>
      </Card>

      {/* Bottom — small nav strip only */}
      <div className="text-[11.5px] text-ach-navy/55 flex flex-wrap items-center gap-4 justify-center mt-6 pb-4">
        <Link href="/candidates" className="hover:text-ach-navy underline underline-offset-2">Candidates</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/cohorts" className="hover:text-ach-navy underline underline-offset-2">Cohorts</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/projects" className="hover:text-ach-navy underline underline-offset-2">Projects</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/aggregate" className="hover:text-ach-navy underline underline-offset-2">Network view</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/impact-library" className="hover:text-ach-navy underline underline-offset-2">Impact library</Link>
      </div>
    </div>
  );
}

function DomainBar({ row }: { row: { key: string; label: string; baseline: number | null; exit: number | null; uplift: number | null } }) {
  const bwPct = row.baseline !== null ? (row.baseline / 5) * 100 : 0;
  const ewPct = row.exit     !== null ? (row.exit     / 5) * 100 : 0;
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
        <div className="absolute top-0 left-0 h-full bg-ach-navy/25" style={{ width: `${bwPct}%` }} />
        <div className="absolute top-0 left-0 h-full bg-ach-navy/70" style={{ width: `${ewPct}%` }} />
      </div>
    </div>
  );
}

function LadderStep({ num, label, value, denom, hint, isBase, isLast }: {
  num: number; label: string; value: number; denom?: number; hint: string; isBase?: boolean; isLast?: boolean;
}) {
  const pct = denom && denom > 0 ? Math.round((value / denom) * 100) : null;
  return (
    <div className={`flex items-center gap-4 py-2.5 ${!isLast ? 'border-b border-ach-border/40' : ''}`}>
      <div className="w-6 h-6 rounded-full bg-ach-navy/10 text-ach-navy/70 text-[11.5px] flex items-center justify-center font-medium shrink-0">
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-ach-navy">{label}</div>
        <div className="text-[11px] text-ach-navy/55">{hint}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[22px] font-serif text-ach-navy leading-none">{value}</div>
        {!isBase && pct !== null && denom !== undefined && denom > 0 && (
          <div className="text-[11px] text-ach-navy/55 mt-0.5">{pct}% of previous</div>
        )}
      </div>
    </div>
  );
}
