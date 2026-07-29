import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const DOMAINS = [
  { key: 'employment', label: 'Employment',           hint: 'work, earnings, quality of employment' },
  { key: 'housing',    label: 'Housing',              hint: 'security, quality, affordability' },
  { key: 'education',  label: 'Education & Skills',   hint: 'language, digital, vocational skills' },
  { key: 'health',     label: 'Health & Wellbeing',   hint: 'mental, physical, healthcare access' },
  { key: 'belonging',  label: 'Belonging & Identity', hint: 'cultural comfort, self-worth, roots' },
  { key: 'social',     label: 'Social Participation', hint: 'networks, civic life, community' },
  { key: 'rights',     label: 'Rights & Citizenship', hint: 'immigration status, rights, voice' },
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

  const [assessments, responses, indicators, factorDomains, benefOutcomes] = await Promise.all([
    safeFetch<any[]>(() => supabase.from('assessments').select('id, timepoint').limit(3000), []),
    safeFetch<any[]>(() => supabase.from('assessment_responses').select('assessment_id, indicator_id, numeric_value').limit(6000), []),
    safeFetch<any[]>(() => supabase.from('indicators').select('id, factor_id'), []),
    safeFetch<any[]>(() => supabase.from('factor_domains').select('factor_id, domain_id'), []),
    safeFetch<any[]>(() => supabase.from('beneficiary_outcomes').select('candidate_id, outcome_key, outcome_label').limit(5000), []),
  ]);

  const indToFactor = new Map(indicators.map((i: any) => [i.id, i.factor_id]));
  const factorToDomains = new Map<string, string[]>();
  for (const fd of factorDomains as any[]) {
    const arr = factorToDomains.get(fd.factor_id) ?? [];
    arr.push(fd.domain_id);
    factorToDomains.set(fd.factor_id, arr);
  }
  const asmById = new Map(assessments.map((a: any) => [a.id, a]));

  const perDomain = new Map<string, { baseline: number[]; exit: number[] }>();
  for (const d of DOMAINS) perDomain.set(d.key, { baseline: [], exit: [] });

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
    }
  }

  const mean = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;

  const domainRows = DOMAINS.map(d => {
    const e = perDomain.get(d.key)!;
    return { ...d, baseline: mean(e.baseline), exit: mean(e.exit) };
  });

  const hasAnyData = domainRows.some(r => r.baseline !== null || r.exit !== null);

  // Aggregate outcomes across ACH — one row per outcome_key with a
  // distinct-beneficiary count (a beneficiary might have the same outcome
  // ticked on multiple projects; count them once).
  const outcomeAgg = new Map<string, { label: string; beneficiaries: Set<string> }>();
  for (const o of (benefOutcomes as any[])) {
    const key = o.outcome_key;
    if (!key || key === 'other') continue;
    const entry = outcomeAgg.get(key) ?? { label: o.outcome_label ?? key, beneficiaries: new Set<string>() };
    entry.beneficiaries.add(o.candidate_id);
    outcomeAgg.set(key, entry);
  }
  const outcomeRows = Array.from(outcomeAgg.entries())
    .map(([key, v]) => ({ key, label: v.label, count: v.beneficiaries.size }))
    .sort((a, b) => b.count - a.count);
  const totalOtherOutcomes = (benefOutcomes as any[]).filter(o => o.outcome_key === 'other').length;
  const hasOutcomeData = outcomeRows.length > 0 || totalOtherOutcomes > 0;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        miniLabel="Holistic Impact Metric"
        title="Impact overview"
      />

      {!hasAnyData && (
        <Card className="mb-4 border-ach-navy/15 bg-[#FBF2E0]/40">
          <CardContent className="pt-5 pb-5">
            <div className="text-[13.5px] text-ach-navy/75 leading-relaxed">
              This overview will populate as data is collected — baselines, exits and follow-ups feed the seven domains below.
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent className="pt-5 pb-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-4">The seven HIM domains</div>
          <div className="space-y-3">
            {domainRows.map(row => <DomainRow key={row.key} row={row} />)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">Outcomes reached</div>
          <div className="text-[11.5px] text-ach-navy/55 mb-4">Beneficiaries who have reached each outcome across every ACH project.</div>
          {!hasOutcomeData ? (
            <div className="text-[13px] text-ach-navy/55 italic">Outcomes will appear here as they are ticked on project pages.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {outcomeRows.map(o => (
                  <div key={o.key} className="flex items-center justify-between rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2">
                    <div className="text-[12.5px] text-ach-navy">{o.label}</div>
                    <div className="text-[15px] font-medium tabular-nums text-ach-navy">{o.count}</div>
                  </div>
                ))}
              </div>
              {totalOtherOutcomes > 0 && (
                <div className="text-[11.5px] text-ach-navy/55 mt-3">
                  Plus <span className="font-medium text-ach-navy/75 tabular-nums">{totalOtherOutcomes}</span> unexpected outcome{totalOtherOutcomes === 1 ? '' : 's'} recorded.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="text-[11.5px] text-ach-navy/55 flex flex-wrap items-center gap-4 justify-center mt-6 pb-4">
        <Link href="/candidates" className="hover:text-ach-navy underline underline-offset-2">Beneficiaries</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/projects" className="hover:text-ach-navy underline underline-offset-2">Projects</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/impact-library" className="hover:text-ach-navy underline underline-offset-2">Impact library</Link>
      </div>
    </div>
  );
}

function DomainRow({ row }: { row: { key: string; label: string; hint: string; baseline: number | null; exit: number | null } }) {
  const bwPct = row.baseline !== null ? (row.baseline / 5) * 100 : 0;
  const ewPct = row.exit     !== null ? (row.exit     / 5) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <span className="text-[13px] font-medium text-ach-navy">{row.label}</span>
          <span className="text-[11.5px] text-ach-navy/55 ml-2">{row.hint}</span>
        </div>
        <div className="text-[11px] tabular-nums text-ach-navy/60">
          {row.baseline !== null && row.exit !== null ? (
            <>{row.baseline.toFixed(2)} → {row.exit.toFixed(2)}</>
          ) : row.baseline !== null ? (
            <>baseline {row.baseline.toFixed(2)}</>
          ) : (
            <span className="italic text-ach-navy/40">pending</span>
          )}
        </div>
      </div>
      <div className="relative h-3 bg-ach-page rounded-[3px] overflow-hidden border border-ach-border/60">
        {row.baseline !== null && (
          <div className="absolute top-0 left-0 h-full bg-ach-navy/25" style={{ width: `${bwPct}%` }} />
        )}
        {row.exit !== null && (
          <div className="absolute top-0 left-0 h-full bg-ach-navy/75" style={{ width: `${ewPct}%` }} />
        )}
      </div>
    </div>
  );
}
