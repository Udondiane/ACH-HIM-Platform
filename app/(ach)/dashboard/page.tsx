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

  const [assessments, responses, indicators, factorDomains, placements, hactProxies, candidates, cohortCandidates, projects, projectsNearEnd] = await Promise.all([
    safeFetch<any[]>(() => supabase.from('assessments').select('id, candidate_id, timepoint').limit(3000), []),
    safeFetch<any[]>(() => supabase.from('assessment_responses').select('assessment_id, indicator_id, numeric_value').limit(6000), []),
    safeFetch<any[]>(() => supabase.from('indicators').select('id, factor_id'), []),
    safeFetch<any[]>(() => supabase.from('factor_domains').select('factor_id, domain_id'), []),
    safeFetch<any[]>(() => supabase.from('placements').select('id, candidate_id, salary_pence'), []),
    safeFetch<any[]>(() => supabase.from('bid_framework_domain_proxies').select('domain_id, proxy_value_pence').eq('framework_key', 'hact_wellbeing_2019'), []),
    safeFetch<any[]>(() => supabase.from('candidates').select('id, status'), []),
    safeFetch<any[]>(() => supabase.from('cohort_candidates').select('candidate_id'), []),
    safeFetch<any[]>(() => supabase.from('projects').select('id, status').neq('status', 'archived'), []),
    safeFetch<any[]>(() => supabase.from('projects').select('id, project_ref, name, end_date, status, completed_at').neq('status', 'completed').not('end_date', 'is', null).order('end_date', { ascending: true }), []),
  ]);

  // Projects nearing end — kept small, actionable, at the top.
  const todayD = new Date();
  const todayMid = new Date(todayD.getFullYear(), todayD.getMonth(), todayD.getDate());
  const twentyOneOut = new Date(todayMid);
  twentyOneOut.setDate(twentyOneOut.getDate() + 21);
  const projectsNeedingCloseOut = (projectsNearEnd as any[])
    .map((p: any) => ({ ...p, endDate: new Date(`${p.end_date}T00:00:00`) }))
    .filter((p: any) => p.endDate <= twentyOneOut)
    .map((p: any) => {
      const days = Math.round((p.endDate.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24));
      return { ...p, daysUntilEnd: days };
    })
    .slice(0, 4);

  // Per-domain baseline / exit
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
    const baseline = mean(e.baseline);
    const exit = mean(e.exit);
    const uplift = (baseline !== null && exit !== null) ? exit - baseline : null;
    return { key: d.key, label: d.label, baseline, exit, uplift, baselineN: e.baseline.length, exitN: e.exit.length };
  });

  const domainsWithBaseline = domainRows.filter(r => r.baseline !== null);
  const domainsWithExit = domainRows.filter(r => r.exit !== null);
  const overallBaseline = mean(domainsWithBaseline.map(r => r.baseline!));
  const overallExit     = mean(domainsWithExit.map(r => r.exit!));

  // KPI counts
  const inProgramme = (candidates as any[]).filter(c => c.status === 'in_programme').length;
  const applicantPool = (candidates as any[]).filter(c => c.status === 'applicant').length;
  const placed = (candidates as any[]).filter(c => c.status === 'placed' || c.status === 'progressed').length;
  const progressed = (candidates as any[]).filter(c => c.status === 'progressed').length;
  const activeProjects = (projects as any[]).filter(p => p.status !== 'completed' && p.status !== 'archived').length;

  // Social value — only when there's baseline data to weight by
  const baselinedIds = new Set(
    (assessments as any[]).filter(a => a.timepoint === 'baseline').map(a => a.candidate_id)
  );
  const baselinedCount = baselinedIds.size;
  const hact = new Map((hactProxies as any[]).map(p => [p.domain_id, Number(p.proxy_value_pence) / 100]));
  let totalSocialValueGbp = 0;
  for (const dr of domainRows) {
    const proxy = hact.get(dr.key);
    if (!proxy) continue;
    if (dr.key === 'employment') totalSocialValueGbp += proxy * placed;
    else if (dr.uplift !== null && dr.uplift > 0) totalSocialValueGbp += proxy * baselinedCount;
  }
  const totalSalaryGbp = (placements as any[]).reduce((s, p) => s + Number(p.salary_pence ?? 0), 0) / 100;

  // Hero narrative — three states so the card never contradicts itself.
  let heroState: 'empty' | 'baseline-only' | 'change' = 'empty';
  if (overallBaseline !== null && overallExit !== null) heroState = 'change';
  else if (overallBaseline !== null) heroState = 'baseline-only';

  const baselineLevel = overallBaseline !== null ? scoreToLevel(overallBaseline) : null;
  const exitLevel     = overallExit     !== null ? scoreToLevel(overallExit)     : null;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Holistic Impact Metric"
        title="Impact overview"
      />

      {/* HERO — narrative that adapts to what data we actually have */}
      <Card className="mb-4 border-ach-navy/25 bg-[#FBF2E0]/40">
        <CardContent className="pt-6 pb-6">
          <div className="text-[10.5px] uppercase tracking-[1.4px] text-ach-navy/60 mb-2">Where ACH stands</div>
          {heroState === 'empty' && (
            <div className="text-[15.5px] text-ach-navy leading-relaxed">
              {applicantPool > 0 || inProgramme > 0 ? (
                <>
                  ACH is currently supporting <span className="font-medium">{inProgramme + applicantPool}</span> beneficiaries across <span className="font-medium">{activeProjects}</span> active {activeProjects === 1 ? 'project' : 'projects'}.
                  Record a baseline assessment on the first beneficiary to start building the impact picture.
                </>
              ) : (
                <>No beneficiaries enrolled yet. Once you enrol beneficiaries onto a project and run baselines, the impact overview will appear here.</>
              )}
            </div>
          )}
          {heroState === 'baseline-only' && (
            <div className="text-[16.5px] text-ach-navy leading-relaxed font-serif">
              ACH has measured{' '}
              <span className="font-medium not-italic">{baselinedCount}</span>{' '}
              beneficiaries at baseline across{' '}
              <span className="font-medium not-italic">{activeProjects}</span> active {activeProjects === 1 ? 'project' : 'projects'}.
              Their starting capability sits at{' '}
              <span className="font-medium not-italic">Level {baselineLevel!.level} · {baselineLevel!.label}</span>{' '}
              (mean {overallBaseline!.toFixed(2)} / 5).
              Exit assessments will land here as programmes complete — that's when the uplift story becomes tellable.
            </div>
          )}
          {heroState === 'change' && (
            <div className="text-[16.5px] text-ach-navy leading-relaxed font-serif">
              Across the seven HIM domains, mean capability rose from{' '}
              <span className="font-medium not-italic">{overallBaseline!.toFixed(2)}</span>{' '}
              (Level {baselineLevel!.level} · {baselineLevel!.label}) to{' '}
              <span className="font-medium not-italic">{overallExit!.toFixed(2)}</span>{' '}
              (Level {exitLevel!.level} · {exitLevel!.label}) —{' '}
              <span className="font-medium not-italic">
                {relativeGainPct(overallBaseline!, overallExit!) >= 0 ? '+' : ''}
                {relativeGainPct(overallBaseline!, overallExit!)}%
              </span>{' '}on baseline.
            </div>
          )}
          {(totalSocialValueGbp > 0 || totalSalaryGbp > 0) && (
            <div className="text-[13px] text-ach-navy/70 mt-4 pt-3 border-t border-ach-navy/15 flex flex-wrap gap-x-6 gap-y-1.5">
              {totalSalaryGbp > 0 && (
                <div>
                  <span className="text-ach-navy/60">Salary secured · </span>
                  <span className="font-medium text-ach-navy">£{totalSalaryGbp.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              {totalSocialValueGbp > 0 && (
                <div>
                  <span className="text-ach-navy/60">Estimated social value · </span>
                  <span className="font-medium text-ach-navy">£{totalSocialValueGbp.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
                  <span className="text-ach-navy/45"> (HACT indicative)</span>
                </div>
              )}
              <Link href="/impact-library" className="ml-auto underline underline-offset-2 hover:text-ach-navy">Open impact library →</Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI STRIP — who is ACH working with right now */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="In programme"        value={inProgramme} hint="active support this week" />
        <Kpi label="Placed in work"      value={placed}      hint="candidates in a job" />
        <Kpi label="Progressed 12mo+"    value={progressed}  hint="promoted / education / better role" />
        <Kpi label="Active projects"     value={activeProjects} hint={applicantPool > 0 ? `${applicantPool} in application` : undefined} />
      </div>

      {/* IMPACT SIGNATURE — 7 domain bars, honest about what we have */}
      <Card className="mb-4">
        <CardContent className="pt-5 pb-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">Impact signature</div>
          <div className="text-[13.5px] text-ach-navy/70 mb-4">
            {heroState === 'change'
              ? 'Baseline (lighter) vs exit (darker) per domain. Uplift is the change.'
              : heroState === 'baseline-only'
                ? 'Where beneficiaries are starting from. Bars will darken as exit assessments land.'
                : 'Bars will appear as beneficiaries are baselined.'}
          </div>
          <div className="space-y-3">
            {domainRows.map(row => <DomainBar row={row} key={row.key} />)}
          </div>
        </CardContent>
      </Card>

      {/* Small reminder strip — projects near end date */}
      {projectsNeedingCloseOut.length > 0 && (
        <Card className="mb-4 border-ach-navy/15">
          <CardContent className="pt-4 pb-4">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Close-out due</div>
            <ul className="space-y-1.5">
              {projectsNeedingCloseOut.map((p: any) => {
                const overdue = p.daysUntilEnd < 0;
                const label = overdue
                  ? `${Math.abs(p.daysUntilEnd)}d overdue`
                  : p.daysUntilEnd === 0 ? 'ends today' : `in ${p.daysUntilEnd}d`;
                return (
                  <li key={p.id} className="flex items-center justify-between text-[12.5px]">
                    <Link href={`/projects/${p.id}`} className="text-ach-navy hover:underline">
                      <span className="text-ach-navy/60 font-mono text-[11.5px] mr-2">{p.project_ref}</span>
                      {p.name}
                    </Link>
                    <span className={`text-[11px] tabular-nums px-2 py-0.5 rounded-full ${
                      overdue ? 'bg-ach-rose/15 text-[#8B3A4F]' : 'bg-ach-page text-ach-navy/70'
                    }`}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="text-[11.5px] text-ach-navy/55 flex flex-wrap items-center gap-4 justify-center mt-6 pb-4">
        <Link href="/candidates" className="hover:text-ach-navy underline underline-offset-2">Beneficiaries</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/projects" className="hover:text-ach-navy underline underline-offset-2">Projects</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/cohorts" className="hover:text-ach-navy underline underline-offset-2">Cohorts</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/impact-library" className="hover:text-ach-navy underline underline-offset-2">Impact library</Link>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
        <div className="text-[28px] font-medium tracking-[-0.5px] text-ach-navy leading-none tabular-nums mt-1">{value}</div>
        {hint && <div className="text-[11px] text-ach-navy/55 mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function DomainBar({ row }: { row: { key: string; label: string; baseline: number | null; exit: number | null; uplift: number | null; baselineN: number; exitN: number } }) {
  const bwPct = row.baseline !== null ? (row.baseline / 5) * 100 : 0;
  const ewPct = row.exit     !== null ? (row.exit     / 5) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[12.5px] font-medium text-ach-navy">{row.label}</div>
        <div className="text-[11px] tabular-nums text-ach-navy/60">
          {row.baseline !== null && row.exit !== null ? (
            <>
              {row.baseline.toFixed(2)} → {row.exit.toFixed(2)}
              <span className={`ml-2 font-medium ${(row.uplift ?? 0) >= 0 ? 'text-ach-navy' : 'text-red-700'}`}>
                {row.uplift! >= 0 ? '+' : ''}{row.uplift!.toFixed(2)}
              </span>
            </>
          ) : row.baseline !== null ? (
            <>
              baseline {row.baseline.toFixed(2)}
              <span className="ml-2 text-ach-navy/40">exit pending</span>
            </>
          ) : (
            <span className="italic text-ach-navy/45">not measured yet</span>
          )}
        </div>
      </div>
      <div className="relative h-4 bg-ach-page rounded-[3px] overflow-hidden border border-ach-border/60">
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
