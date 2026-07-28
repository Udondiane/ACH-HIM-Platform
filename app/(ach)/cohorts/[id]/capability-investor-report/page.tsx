import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PrintButton } from '@/components/ui/print-button';
import { SnapshotButton } from '@/components/cohort-reports/snapshot-button';
import { scoreToLevel, relativeGainPct, upliftNarrative } from '@/lib/scoring/interpret';

export const metadata = { title: 'Capability investor report' };

async function safeFetch<T>(fn: () => any, fallback: T): Promise<T> {
  try {
    const r = await fn();
    if (r?.error) return fallback;
    return (r?.data ?? fallback) as T;
  } catch { return fallback; }
}

const DOMAIN_ORDER = ['employment', 'housing', 'education', 'health', 'belonging', 'social', 'rights'];
const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  housing: 'Housing',
  education: 'Education & Skills',
  health: 'Health & Wellbeing',
  belonging: 'Belonging & Identity',
  social: 'Social Participation',
  rights: 'Rights & Citizenship',
};

export default async function CapabilityInvestorReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: cohort } = await supabase.from('cohorts').select('*').eq('id', params.id).maybeSingle();
  if (!cohort) notFound();
  const c = cohort as any;

  const [candidates, assessments, responses, factorDomains, quotes, partners] = await Promise.all([
    safeFetch<any[]>(() => supabase.from('cohort_candidates').select('candidate_id, candidates(id, candidate_ref, status)').eq('cohort_id', params.id), []),
    safeFetch<any[]>(() => supabase.from('assessments').select('id, candidate_id, timepoint, status').eq('cohort_id', params.id), []),
    safeFetch<any[]>(() => supabase.from('assessment_responses').select('id, assessment_id, indicator_id, numeric_value').limit(2000), []),
    safeFetch<any[]>(() => supabase.from('factor_domains').select('factor_id, domain_id'), []),
    safeFetch<any[]>(() => supabase.from('featured_quotes').select('id, quote_text, context, speaker_type, use_anonymised, display_name').eq('cohort_id', params.id).is('archived_at', null).order('tagged_at', { ascending: false }), []),
    safeFetch<any[]>(() => supabase.from('cohort_partners').select('id, partners(id, name)').eq('cohort_id', params.id), []),
  ]);

  const candList = (candidates as any[]).map(cc => cc.candidates).filter(Boolean);
  const partnerList = (partners as any[]).map(p => p.partners).filter(Boolean);

  // Compute per-domain baseline vs exit uplift
  const cohortAssessmentIds = new Set(assessments.map(a => a.id));
  const cohortResponses = responses.filter((r: any) => cohortAssessmentIds.has(r.assessment_id));

  // Need indicator → factor → domain mapping. We have factor_domains. We need indicator → factor.
  // For simplicity we'll fetch indicators separately.
  const indicators = await safeFetch<any[]>(() =>
    supabase.from('indicators').select('id, factor_id'), []);

  const indToFactor = new Map<string, string>();
  for (const i of indicators) indToFactor.set(i.id, i.factor_id);
  const factorToDomains = new Map<string, string[]>();
  for (const fd of factorDomains as any[]) {
    const list = factorToDomains.get(fd.factor_id) ?? [];
    list.push(fd.domain_id);
    factorToDomains.set(fd.factor_id, list);
  }

  // Per (domain, timepoint) → array of numeric_values
  const bucket = new Map<string, number[]>();  // key = domain|timepoint
  const assessmentTimepoint = new Map<string, string>();
  for (const a of assessments as any[]) assessmentTimepoint.set(a.id, a.timepoint);

  for (const r of cohortResponses) {
    if (typeof r.numeric_value !== 'number') continue;
    const timepoint = assessmentTimepoint.get(r.assessment_id);
    if (!timepoint) continue;
    const factorId = indToFactor.get(r.indicator_id);
    if (!factorId) continue;
    const domains = factorToDomains.get(factorId) ?? [];
    for (const d of domains) {
      const key = `${d}|${timepoint}`;
      const arr = bucket.get(key) ?? [];
      arr.push(Number(r.numeric_value));
      bucket.set(key, arr);
    }
  }

  const mean = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
  const domainRows = DOMAIN_ORDER.map(d => {
    const baseline = mean(bucket.get(`${d}|baseline`) ?? []);
    const exit = mean(bucket.get(`${d}|mid_3mo`) ?? []);
    const followup = mean(bucket.get(`${d}|followup_12mo`) ?? []);
    const primary = exit ?? followup;
    const uplift = (baseline !== null && primary !== null) ? primary - baseline : null;
    return {
      domain: d,
      label: DOMAIN_LABELS[d],
      baseline,
      exit,
      followup,
      uplift,
      any_data: baseline !== null || exit !== null || followup !== null,
    };
  });

  const domainsWithData = domainRows.filter(r => r.any_data);
  const overallBaseline = mean(domainRows.map(r => r.baseline).filter((v): v is number => v !== null));
  const overallExit = mean(domainRows.map(r => r.exit).filter((v): v is number => v !== null));
  const overallUplift = (overallBaseline !== null && overallExit !== null) ? overallExit - overallBaseline : null;

  const snapshot = {
    generated_at: new Date().toISOString(),
    report_type: 'capability_investor',
    cohort: { id: c.id, name: c.name },
    partners: partnerList.map(p => ({ id: p.id, name: p.name })),
    cohort_size: candList.length,
    overall: {
      mean_baseline: overallBaseline !== null ? Number(overallBaseline.toFixed(2)) : null,
      mean_exit: overallExit !== null ? Number(overallExit.toFixed(2)) : null,
      uplift: overallUplift !== null ? Number(overallUplift.toFixed(2)) : null,
    },
    domains: domainRows.map(r => ({
      domain: r.domain,
      label: r.label,
      baseline: r.baseline !== null ? Number(r.baseline.toFixed(2)) : null,
      exit: r.exit !== null ? Number(r.exit.toFixed(2)) : null,
      followup: r.followup !== null ? Number(r.followup.toFixed(2)) : null,
      uplift: r.uplift !== null ? Number(r.uplift.toFixed(2)) : null,
    })),
    featured_quotes: quotes.length,
    methodology_version: 'v1.0',
  };

  return (
    <div className="max-w-5xl mx-auto pb-16 print:max-w-none">
      <div className="print:hidden mb-4">
        <Link href={`/cohorts/${params.id}`} className="inline-flex items-center gap-1.5 text-[12px] text-ach-navy/70 hover:text-ach-navy">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to cohort
        </Link>
      </div>

      <div className="mb-8 border-b border-ach-border pb-6">
        <div className="text-[11px] uppercase tracking-[1.4px] text-ach-navy/55 mb-1">Capability investor report</div>
        <h1 className="text-[26px] font-serif font-semibold text-ach-navy leading-tight">{c.name ?? 'Cohort'}</h1>
        <div className="mt-2 text-[13px] text-ach-navy/70">
          Cohort of {candList.length} · Prepared as at {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          {' · '}Methodology v1.0
        </div>
        {partnerList.length > 0 && (
          <div className="mt-2 text-[12.5px] text-ach-navy/60">
            Sponsoring partners: {partnerList.map(p => p.name).join(', ')}
          </div>
        )}
      </div>

      <div className="print:hidden flex items-center gap-2 mb-6">
        <SnapshotButton cohortId={c.id} snapshot={snapshot} reportType="close_out" />
        <PrintButton />
      </div>

      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">1 · Overall capability change</h2>
        <Card>
          <CardContent className="pt-6">
            {overallUplift === null ? (
              <div className="text-[13px] text-ach-navy/60 italic">No baseline / exit pair available yet.</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-6">
                  <ScoreBlock label="Mean baseline" value={overallBaseline!} sub={`Level ${scoreToLevel(overallBaseline!).level} · ${scoreToLevel(overallBaseline!).label}`} />
                  <ScoreBlock label="Mean exit" value={overallExit!} sub={`Level ${scoreToLevel(overallExit!).level} · ${scoreToLevel(overallExit!).label}`} />
                  <ScoreBlock label="Uplift" value={overallUplift} sub={`${relativeGainPct(overallBaseline!, overallExit!) >= 0 ? '+' : ''}${relativeGainPct(overallBaseline!, overallExit!)}% on baseline`} highlight />
                </div>
                <div className="mt-4 text-[12.5px] text-ach-navy/80 leading-relaxed italic">
                  {upliftNarrative(overallBaseline!, overallExit!)}
                </div>
                <div className="mt-4 pt-3 border-t border-ach-border/60 text-[11px] text-ach-navy/60 leading-relaxed">
                  <span className="font-medium">What this measures.</span> Capability change is an outcome proxy — evidence that the intervention moved candidates on the domains we set out to measure. Domain-by-domain detail in section 2 shows where the change concentrated.
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">2 · Domain-by-domain change</h2>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-[12.5px]">
              <thead className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/55 bg-ach-page/50">
                <tr>
                  <th className="text-left px-4 py-2.5">Domain</th>
                  <th className="text-right px-4 py-2.5">Baseline</th>
                  <th className="text-right px-4 py-2.5">Exit</th>
                  <th className="text-right px-4 py-2.5">12-month</th>
                  <th className="text-right px-4 py-2.5">Uplift</th>
                </tr>
              </thead>
              <tbody>
                {domainsWithData.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center italic text-ach-navy/60">No domain data captured yet.</td></tr>
                ) : (
                  domainsWithData.map(r => (
                    <tr key={r.domain} className="border-t border-ach-border/60">
                      <td className="px-4 py-2.5 text-ach-navy font-medium">{r.label}</td>
                      <td className="px-4 py-2.5 text-right text-ach-navy/80">{r.baseline?.toFixed(2) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-ach-navy/80">{r.exit?.toFixed(2) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-ach-navy/80">{r.followup?.toFixed(2) ?? '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${r.uplift === null ? 'text-ach-navy/40' : r.uplift >= 0 ? 'text-ach-navy' : 'text-red-700'}`}>
                        {r.uplift === null ? '—' : `${r.uplift >= 0 ? '+' : ''}${r.uplift.toFixed(2)}`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">3 · Beneficiary voices</h2>
        {quotes.length === 0 ? (
          <Card><CardContent className="pt-6"><div className="text-[13px] text-ach-navy/60 italic">No featured quotes tagged for this cohort yet.</div></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {quotes.slice(0, 5).map((q: any) => (
              <div key={q.id} className="border-l-2 border-ach-navy/40 pl-4 py-1">
                <div className="text-[14px] text-ach-navy font-serif italic leading-relaxed">&ldquo;{q.quote_text}&rdquo;</div>
                <div className="text-[11.5px] text-ach-navy/55 mt-1.5">
                  {q.use_anonymised ? 'Anonymised' : (q.display_name ?? 'By name')}
                  {' · '}{q.speaker_type}
                  {q.context ? <> · <span className="italic">{q.context}</span></> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 pt-6 border-t border-ach-border text-[11.5px] text-ach-navy/60 leading-relaxed">
        <div className="font-medium text-ach-navy/75 mb-1">Methodology note</div>
        <p>
          Capability change is the mean of numeric indicator responses (0–5 scale), aggregated to domain level via
          the HIM factor → domain mapping, and compared between the baseline and exit / 12-month follow-up timepoints.
          Domains not measured in this cohort are omitted. Featured quotes appear only where quoting consent has
          been recorded. Snapshot to store this report as an immutable capability-investor record.
        </p>
      </section>
    </div>
  );
}

function ScoreBlock({ label, value, sub, highlight }: { label: string; value: number; sub: string; highlight?: boolean }) {
  const positive = value >= 0;
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{label}</div>
      <div className={`text-[26px] font-serif ${highlight && !positive ? 'text-red-700' : 'text-ach-navy'}`}>
        {highlight && positive ? '+' : ''}{value.toFixed(2)}
      </div>
      <div className="text-[11.5px] text-ach-navy/55">{sub}</div>
    </div>
  );
}
