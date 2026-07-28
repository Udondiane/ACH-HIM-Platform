import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PrintButton } from '@/components/ui/print-button';
import { scoreToLevel, relativeGainPct } from '@/lib/scoring/interpret';

export const metadata = { title: 'Bid support pack' };

const DOMAIN_LABELS: Record<string, string> = {
  employment:  'Employment',
  housing:     'Housing',
  education:   'Education & Skills',
  health:      'Health & Wellbeing',
  belonging:   'Belonging & Identity',
  social:      'Social Participation',
  rights:      'Rights & Citizenship',
};

async function safeFetch<T>(fn: () => any, fallback: T): Promise<T> {
  try {
    const r = await fn();
    if (r?.error) return fallback;
    return (r?.data ?? fallback) as T;
  } catch { return fallback; }
}

export default async function BidPackPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: bidData } = await supabase.from('bids').select('*').eq('id', params.id).maybeSingle();
  if (!bidData) notFound();
  const bid = bidData as any;

  const focusDomains: string[] = (bid.focus_domains ?? []) as string[];
  const scopedProjectIds: string[] = (bid.scoped_project_ids ?? []) as string[];
  const scopedCohortIds: string[]  = (bid.scoped_cohort_ids ?? [])  as string[];
  const featuredQuoteIds: string[] = (bid.featured_quote_ids ?? []) as string[];

  // Pull impact evidence
  const [framework, proxies, projects, cohorts, quotes, allCohortIds] = await Promise.all([
    bid.framework_key
      ? safeFetch<any>(() => supabase.from('bid_financial_frameworks').select('*').eq('key', bid.framework_key).maybeSingle(), null)
      : Promise.resolve(null),
    bid.framework_key
      ? safeFetch<any[]>(() => supabase.from('bid_framework_domain_proxies').select('*').eq('framework_key', bid.framework_key), [])
      : Promise.resolve([]),
    scopedProjectIds.length > 0
      ? safeFetch<any[]>(() => supabase.from('projects').select('id, name, project_ref').in('id', scopedProjectIds), [])
      : Promise.resolve([]),
    scopedCohortIds.length > 0
      ? safeFetch<any[]>(() => supabase.from('cohorts').select('id, name').in('id', scopedCohortIds), [])
      : Promise.resolve([]),
    featuredQuoteIds.length > 0
      ? safeFetch<any[]>(() => supabase.from('featured_quotes').select('*').in('id', featuredQuoteIds), [])
      : Promise.resolve([]),
    scopedProjectIds.length > 0
      ? safeFetch<any[]>(() => supabase.from('cohorts').select('id').in('project_id', scopedProjectIds), [])
      : Promise.resolve([]),
  ]);

  // Combine directly-scoped cohorts + cohorts from scoped projects
  const effectiveCohortIds = Array.from(new Set([
    ...scopedCohortIds,
    ...((allCohortIds as any[]) ?? []).map(c => c.id),
  ]));

  const [assessments, responses, factorDomains, indicators, placements, retentionChecks] = await Promise.all([
    effectiveCohortIds.length > 0
      ? safeFetch<any[]>(() => supabase.from('assessments').select('id, cohort_id, candidate_id, timepoint').in('cohort_id', effectiveCohortIds), [])
      : Promise.resolve([]),
    effectiveCohortIds.length > 0
      ? safeFetch<any[]>(() => supabase.from('assessment_responses').select('assessment_id, indicator_id, numeric_value').limit(3000), [])
      : Promise.resolve([]),
    safeFetch<any[]>(() => supabase.from('factor_domains').select('factor_id, domain_id'), []),
    safeFetch<any[]>(() => supabase.from('indicators').select('id, factor_id'), []),
    effectiveCohortIds.length > 0
      ? safeFetch<any[]>(() => supabase.from('placements').select('id, candidate_id, cohort_id'), [])
      : Promise.resolve([]),
    safeFetch<any[]>(() => supabase.from('placement_retention_checks').select('placement_id, timepoint, still_employed'), []),
  ]);

  const assessmentIdSet = new Set(assessments.map((a: any) => a.id));
  const scopedResponses = responses.filter((r: any) => assessmentIdSet.has(r.assessment_id));

  // Build domain-level baseline vs exit
  const indToFactor = new Map(indicators.map((i: any) => [i.id, i.factor_id]));
  const factorToDomains = new Map<string, string[]>();
  for (const fd of factorDomains as any[]) {
    const arr = factorToDomains.get(fd.factor_id) ?? [];
    arr.push(fd.domain_id);
    factorToDomains.set(fd.factor_id, arr);
  }
  const assessmentTp = new Map(assessments.map((a: any) => [a.id, a.timepoint]));
  const perDomainByTimepoint = new Map<string, { baseline: number[]; exit: number[] }>();
  for (const r of scopedResponses) {
    if (typeof r.numeric_value !== 'number') continue;
    const factor = indToFactor.get(r.indicator_id);
    if (!factor) continue;
    const domains = factorToDomains.get(factor) ?? [];
    const tp = assessmentTp.get(r.assessment_id);
    if (!tp) continue;
    for (const d of domains) {
      const entry = perDomainByTimepoint.get(d) ?? { baseline: [], exit: [] };
      if (tp === 'baseline') entry.baseline.push(Number(r.numeric_value));
      if (tp === 'mid_3mo' || tp === 'exit_6mo') entry.exit.push(Number(r.numeric_value));
      perDomainByTimepoint.set(d, entry);
    }
  }
  const mean = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;

  // Financial framework rows
  const proxyByDomain = new Map((proxies as any[]).map((p: any) => [p.domain_id, p]));
  const domainsInScope = focusDomains.length > 0 ? focusDomains : Object.keys(DOMAIN_LABELS);

  // Placement + retention counts for the pack
  const scopedPlacementCandIds = new Set(
    (placements as any[])
      .filter(p => effectiveCohortIds.includes(p.cohort_id))
      .map(p => p.candidate_id)
  );
  const scopedPlacementIds = new Set(
    (placements as any[]).filter(p => effectiveCohortIds.includes(p.cohort_id)).map(p => p.id)
  );
  const scopedRetention12 = (retentionChecks as any[]).filter(
    r => scopedPlacementIds.has(r.placement_id) && r.timepoint === 'retention_12mo' && r.still_employed
  );

  // Financial impact per domain
  interface FinRow {
    domain: string;
    label: string;
    baseline: number | null;
    exit: number | null;
    uplift: number | null;
    people_moved: number;
    proxy_gbp: number | null;
    proxy_unit: string | null;
    est_value_gbp: number | null;
  }
  const finRows: FinRow[] = domainsInScope.map(d => {
    const b = mean(perDomainByTimepoint.get(d)?.baseline ?? []);
    const e = mean(perDomainByTimepoint.get(d)?.exit ?? []);
    const uplift = (b !== null && e !== null) ? e - b : null;
    // People "moved" = number of candidates who improved on this domain (rough proxy)
    // For now use total placement count for employment, otherwise use assessment-participating count
    let peopleMoved = 0;
    if (d === 'employment') peopleMoved = scopedPlacementCandIds.size;
    else if (uplift !== null && uplift > 0) {
      // Rough: count unique candidates who took any assessment
      const cands = new Set(
        (assessments as any[]).filter((a: any) => effectiveCohortIds.includes(a.cohort_id)).map(a => a.candidate_id)
      );
      peopleMoved = cands.size;
    }
    const proxy = proxyByDomain.get(d);
    const proxy_gbp = proxy ? Number(proxy.proxy_value_pence) / 100 : null;
    const proxy_unit = proxy?.unit ?? null;
    const est_value_gbp = (proxy_gbp !== null && peopleMoved > 0) ? proxy_gbp * peopleMoved : null;
    return {
      domain: d, label: DOMAIN_LABELS[d] ?? d,
      baseline: b, exit: e, uplift,
      people_moved: peopleMoved,
      proxy_gbp, proxy_unit,
      est_value_gbp,
    };
  });
  const totalEstValue = finRows.reduce((s, r) => s + (r.est_value_gbp ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto pb-16 print:max-w-none">
      <div className="print:hidden mb-4">
        <Link href="/bids" className="inline-flex items-center gap-1.5 text-[12px] text-ach-navy/70 hover:text-ach-navy">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to bid packs
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8 border-b border-ach-border pb-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[1.4px] text-ach-navy/55 mb-1">Bid support pack</div>
            <h1 className="text-[26px] font-serif font-semibold text-ach-navy leading-tight">{bid.name}</h1>
            <div className="mt-2 text-[13px] text-ach-navy/70">
              {bid.funder_name ? `Prepared for ${bid.funder_name}` : 'Funder to be confirmed'}
              {bid.ask_amount_gbp ? ` · Ask £${Number(bid.ask_amount_gbp).toLocaleString('en-GB')}` : ''}
              {bid.deadline ? ` · Deadline ${bid.deadline}` : ''}
              {' · Methodology v1.0'}
            </div>
          </div>
          <div className="print:hidden flex items-center gap-2 shrink-0">
            <Link href={`/bids/${bid.id}/edit`}>
              <Button variant="secondary"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
            </Link>
            <PrintButton />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <Badge>{(bid.status ?? 'draft').toUpperCase()}</Badge>
          {focusDomains.map(d => <Badge key={d}>{DOMAIN_LABELS[d] ?? d}</Badge>)}
        </div>
      </div>

      {/* Executive summary */}
      {bid.executive_summary && (
        <section className="mb-8">
          <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">Executive summary</h2>
          <Card><CardContent className="pt-5 pb-5 text-[13.5px] text-ach-navy leading-relaxed whitespace-pre-wrap">{bid.executive_summary}</CardContent></Card>
        </section>
      )}

      {/* What we will do */}
      {bid.what_we_will_do && (
        <section className="mb-8">
          <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">What we will do</h2>
          <Card><CardContent className="pt-5 pb-5 text-[13.5px] text-ach-navy leading-relaxed whitespace-pre-wrap">{bid.what_we_will_do}</CardContent></Card>
        </section>
      )}

      {/* Impact evidence pulled from HIM */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">Impact evidence (from HIM)</h2>
        {perDomainByTimepoint.size === 0 ? (
          <Card><CardContent className="pt-6"><div className="text-[13px] text-ach-navy/60 italic">No baseline/exit assessment data yet in the scoped cohorts. Select cohorts on the edit page.</div></CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-[12.5px]">
                <thead className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/55 bg-ach-page/50">
                  <tr>
                    <th className="text-left px-4 py-2.5">Domain</th>
                    <th className="text-right px-4 py-2.5">Baseline</th>
                    <th className="text-right px-4 py-2.5">Exit</th>
                    <th className="text-right px-4 py-2.5">Uplift</th>
                    <th className="text-left px-4 py-2.5">Reads as</th>
                  </tr>
                </thead>
                <tbody>
                  {finRows.filter(r => r.baseline !== null || r.exit !== null).map(r => (
                    <tr key={r.domain} className="border-t border-ach-border/60">
                      <td className="px-4 py-2.5 text-ach-navy font-medium">{r.label}</td>
                      <td className="px-4 py-2.5 text-right text-ach-navy/80">{r.baseline?.toFixed(2) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-ach-navy/80">{r.exit?.toFixed(2) ?? '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${r.uplift === null ? 'text-ach-navy/40' : r.uplift >= 0 ? 'text-ach-navy' : 'text-red-700'}`}>
                        {r.uplift === null ? '—' : `${r.uplift >= 0 ? '+' : ''}${r.uplift.toFixed(2)}`}
                      </td>
                      <td className="px-4 py-2.5 text-ach-navy/70 text-[11.5px]">
                        {r.baseline !== null && r.exit !== null
                          ? `L${scoreToLevel(r.baseline).level} → L${scoreToLevel(r.exit).level} (${relativeGainPct(r.baseline, r.exit) >= 0 ? '+' : ''}${relativeGainPct(r.baseline, r.exit)}%)`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
        <div className="mt-3 text-[11.5px] text-ach-navy/55">
          Scope: {projects.length > 0 ? `${projects.length} project${projects.length === 1 ? '' : 's'}` : 'all cohorts'}
          {scopedRetention12.length > 0 ? ` · ${scopedRetention12.length} candidates retained at 12 months` : ''}
        </div>
      </section>

      {/* Financial impact — the money bit */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">Financial impact mapping</h2>
        {!framework ? (
          <Card><CardContent className="pt-6"><div className="text-[13px] text-ach-navy/60 italic">No framework selected. Edit the bid to choose one (HACT, TOMs, or bespoke).</div></CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-[12.5px] text-ach-navy mb-4">
                Framework: <span className="font-medium">{framework.label}</span>
                {framework.source_ref && <span className="text-ach-navy/55 block text-[11px] mt-0.5">{framework.source_ref}</span>}
              </div>
              <table className="w-full text-[12.5px]">
                <thead className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/55 bg-ach-page/50">
                  <tr>
                    <th className="text-left px-3 py-2">Domain</th>
                    <th className="text-right px-3 py-2">Proxy £</th>
                    <th className="text-left px-3 py-2">Unit</th>
                    <th className="text-right px-3 py-2">People</th>
                    <th className="text-right px-3 py-2">Est. value</th>
                  </tr>
                </thead>
                <tbody>
                  {finRows.map(r => (
                    <tr key={r.domain} className="border-t border-ach-border/60">
                      <td className="px-3 py-2 text-ach-navy font-medium">{r.label}</td>
                      <td className="px-3 py-2 text-right text-ach-navy/80">
                        {r.proxy_gbp !== null ? `£${r.proxy_gbp.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-ach-navy/70 text-[11.5px]">{r.proxy_unit ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-ach-navy/80">{r.people_moved || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium text-ach-navy">
                        {r.est_value_gbp !== null
                          ? `£${r.est_value_gbp.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-ach-navy/30 bg-ach-page/50">
                    <td className="px-3 py-2.5 font-semibold text-ach-navy" colSpan={4}>Estimated total social value delivered</td>
                    <td className="px-3 py-2.5 text-right font-serif text-[18px] text-ach-navy">
                      £{totalEstValue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                </tbody>
              </table>
              {bid.ask_amount_gbp && totalEstValue > 0 && (
                <div className="mt-4 rounded-[8px] bg-[#FBF2E0]/60 border border-[#B8862C]/25 px-4 py-3 text-[13px] text-ach-navy">
                  <span className="font-medium">Value-to-ask ratio:</span>{' '}
                  £{(totalEstValue / Number(bid.ask_amount_gbp)).toFixed(2)} of social value per £1 of ask
                  {' — '}<span className="italic">indicative, methodology-dependent</span>
                </div>
              )}
              <div className="mt-4 pt-3 border-t border-ach-border/60 text-[11px] text-ach-navy/60 leading-relaxed">
                <span className="font-medium">Attribution note.</span> Proxy values from {framework.label}. People counts are rough (all placed candidates for Employment; all assessment-participating candidates with positive domain uplift for others). Refine before submission with ACH's methodology lead.
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* What change looks like */}
      {bid.what_change_looks_like && (
        <section className="mb-8">
          <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">What change looks like</h2>
          <Card><CardContent className="pt-5 pb-5 text-[13.5px] text-ach-navy leading-relaxed whitespace-pre-wrap">{bid.what_change_looks_like}</CardContent></Card>
        </section>
      )}

      {/* Featured quotes */}
      {quotes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">Voices from our work</h2>
          <div className="space-y-3">
            {(quotes as any[]).map((q: any) => (
              <div key={q.id} className="border-l-2 border-ach-navy/40 pl-4 py-1">
                <div className="text-[14px] text-ach-navy font-serif italic leading-relaxed">&ldquo;{q.quote_text}&rdquo;</div>
                <div className="text-[11.5px] text-ach-navy/55 mt-1.5">
                  {q.use_anonymised ? 'Anonymised' : (q.display_name ?? 'By name')} · {q.speaker_type}
                  {q.context ? <> · <span className="italic">{q.context}</span></> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Scope note */}
      {(projects.length > 0 || cohorts.length > 0) && (
        <section className="mb-8">
          <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">Scope of evidence</h2>
          <Card>
            <CardContent className="pt-5 pb-5 text-[12.5px] text-ach-navy leading-relaxed">
              {projects.length > 0 && (
                <div className="mb-2">
                  <span className="text-ach-navy/60 font-medium">Projects:</span>{' '}
                  {(projects as any[]).map((p: any) => (
                    <span key={p.id} className="inline-block mr-2">{p.name}{p.project_ref ? ` (${p.project_ref})` : ''};</span>
                  ))}
                </div>
              )}
              {cohorts.length > 0 && (
                <div>
                  <span className="text-ach-navy/60 font-medium">Cohorts:</span>{' '}
                  {(cohorts as any[]).map((c: any) => (
                    <span key={c.id} className="inline-block mr-2">{c.name};</span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Methodology */}
      <section className="mt-10 pt-6 border-t border-ach-border">
        <h2 className="text-[13px] font-serif font-semibold text-ach-navy mb-2">Methodology note</h2>
        <p className="text-[11.5px] text-ach-navy/70 leading-relaxed whitespace-pre-wrap">
          {bid.methodology_note ??
            'Impact evidence drawn from HIM — ACH’s Holistic Impact Metric platform. Assessments captured across baseline, mid-programme and follow-up timepoints using the HIM 7-domain framework. Financial mapping applied via the selected framework; proxy values indicative and refreshed against source. Every score has evidence and provenance attached and can be traced back to the individual assessment. Methodology version v1.0.'}
        </p>
      </section>
    </div>
  );
}
