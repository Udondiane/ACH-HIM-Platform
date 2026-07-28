import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/impact/copy-button';
import { scoreToLevel, relativeGainPct, upliftNarrative } from '@/lib/scoring/interpret';

export const metadata = { title: 'Impact library' };

const DOMAINS = [
  { key: 'employment', label: 'Employment',           short: 'employment gains' },
  { key: 'housing',    label: 'Housing',              short: 'housing outcomes' },
  { key: 'education',  label: 'Education & Skills',   short: 'skills and learning' },
  { key: 'health',     label: 'Health & Wellbeing',   short: 'health and wellbeing' },
  { key: 'belonging',  label: 'Belonging & Identity', short: 'sense of belonging' },
  { key: 'social',     label: 'Social Participation', short: 'social engagement' },
  { key: 'rights',     label: 'Rights & Citizenship', short: 'rights and citizenship' },
];

async function safeFetch<T>(fn: () => any, fallback: T): Promise<T> {
  try {
    const r = await fn();
    if (r?.error) return fallback;
    return (r?.data ?? fallback) as T;
  } catch { return fallback; }
}

export default async function ImpactLibraryPage({
  searchParams,
}: {
  searchParams?: { domain?: string; framework?: string };
}) {
  const supabase = createClient();
  const activeDomain = searchParams?.domain ?? 'employment';
  const activeFramework = searchParams?.framework ?? 'hact_wellbeing_2019';

  const [assessments, responses, indicators, factorDomains, quotes, consents, placements, retentionChecks, frameworks, proxies] = await Promise.all([
    safeFetch<any[]>(() => supabase.from('assessments').select('id, candidate_id, timepoint, cohort_id, project_id'), []),
    safeFetch<any[]>(() => supabase.from('assessment_responses').select('id, assessment_id, indicator_id, numeric_value, narrative, candidate_voice, feature_worthy').limit(5000), []),
    safeFetch<any[]>(() => supabase.from('indicators').select('id, factor_id'), []),
    safeFetch<any[]>(() => supabase.from('factor_domains').select('factor_id, domain_id'), []),
    safeFetch<any[]>(() => supabase.from('featured_quotes').select('id, candidate_id, source_type, source_ref, quote_text, context, speaker_type, use_anonymised, display_name, tagged_at').is('archived_at', null).order('tagged_at', { ascending: false }), []),
    safeFetch<any[]>(() => supabase.from('candidate_consent').select('candidate_id, may_be_named, may_be_quoted, may_appear_in_case_study, given_at').order('given_at', { ascending: false }), []),
    safeFetch<any[]>(() => supabase.from('placements').select('id, candidate_id, cohort_id, role_title'), []),
    safeFetch<any[]>(() => supabase.from('placement_retention_checks').select('placement_id, timepoint, still_employed'), []),
    safeFetch<any[]>(() => supabase.from('bid_financial_frameworks').select('key, label, source_ref').order('label'), []),
    safeFetch<any[]>(() => supabase.from('bid_framework_domain_proxies').select('framework_key, domain_id, proxy_value_pence, unit, guidance').eq('framework_key', activeFramework), []),
  ]);

  // Build lookup maps
  const indToFactor = new Map(indicators.map((i: any) => [i.id, i.factor_id]));
  const factorToDomains = new Map<string, string[]>();
  for (const fd of factorDomains as any[]) {
    const arr = factorToDomains.get(fd.factor_id) ?? [];
    arr.push(fd.domain_id);
    factorToDomains.set(fd.factor_id, arr);
  }
  const assessmentInfo = new Map(assessments.map((a: any) => [a.id, a]));

  // Latest consent per candidate
  const latestConsent = new Map<string, any>();
  for (const c of consents as any[]) {
    if (!latestConsent.has(c.candidate_id)) latestConsent.set(c.candidate_id, c);
  }

  // Per-candidate per-domain baseline vs exit
  const perCandPerDomain = new Map<string, Map<string, { baseline: number[]; exit: number[] }>>();
  for (const r of responses as any[]) {
    if (typeof r.numeric_value !== 'number') continue;
    const asmt = assessmentInfo.get(r.assessment_id) as any;
    if (!asmt) continue;
    const factor = indToFactor.get(r.indicator_id);
    if (!factor) continue;
    const domains = factorToDomains.get(factor) ?? [];
    for (const d of domains) {
      const perCand = perCandPerDomain.get(asmt.candidate_id) ?? new Map();
      const entry = perCand.get(d) ?? { baseline: [], exit: [] };
      if (asmt.timepoint === 'baseline') entry.baseline.push(Number(r.numeric_value));
      if (asmt.timepoint === 'mid_3mo' || asmt.timepoint === 'exit_6mo') entry.exit.push(Number(r.numeric_value));
      perCand.set(d, entry);
      perCandPerDomain.set(asmt.candidate_id, perCand);
    }
  }

  const mean = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;

  // Aggregate per domain
  const domainStats = new Map<string, { baselines: number[]; exits: number[]; candsWithBoth: string[]; upliftedCands: string[] }>();
  for (const [candId, perCand] of perCandPerDomain.entries()) {
    for (const [d, entry] of perCand.entries()) {
      const b = mean(entry.baseline);
      const e = mean(entry.exit);
      const stats = domainStats.get(d) ?? { baselines: [], exits: [], candsWithBoth: [], upliftedCands: [] };
      if (b !== null) stats.baselines.push(b);
      if (e !== null) stats.exits.push(e);
      if (b !== null && e !== null) {
        stats.candsWithBoth.push(candId);
        if (e > b) stats.upliftedCands.push(candId);
      }
      domainStats.set(d, stats);
    }
  }

  // Placements by candidate
  const placedCandIds = new Set((placements as any[]).map(p => p.candidate_id));
  const placementByCandId = new Map<string, any>();
  for (const p of placements as any[]) placementByCandId.set(p.candidate_id, p);
  const placementIds = new Set((placements as any[]).map(p => p.id));
  const retained12CandIds = new Set(
    (retentionChecks as any[])
      .filter(rc => placementIds.has(rc.placement_id) && rc.timepoint === 'retention_12mo' && rc.still_employed)
      .map(rc => (placements as any[]).find(p => p.id === rc.placement_id)?.candidate_id)
      .filter(Boolean)
  );

  // Financial proxy for this domain
  const proxyRow = (proxies as any[]).find(p => p.domain_id === activeDomain);
  const proxyGbp = proxyRow ? Number(proxyRow.proxy_value_pence) / 100 : null;

  // The active domain stats
  const stats = domainStats.get(activeDomain);
  const meanBaseline = stats ? mean(stats.baselines) : null;
  const meanExit = stats ? mean(stats.exits) : null;
  const upliftRaw = (meanBaseline !== null && meanExit !== null) ? meanExit - meanBaseline : null;

  // People moved on this domain
  const peopleMoved = activeDomain === 'employment' ? placedCandIds.size : (stats?.upliftedCands.length ?? 0);
  const estValueGbp = proxyGbp !== null ? proxyGbp * peopleMoved : null;

  // Candidates with strongest uplift on this domain who have case-study consent
  const strongCandidatesForDomain: Array<{ candId: string; uplift: number; }> = [];
  for (const [candId, perCand] of perCandPerDomain.entries()) {
    const entry = perCand.get(activeDomain);
    if (!entry) continue;
    const b = mean(entry.baseline);
    const e = mean(entry.exit);
    if (b === null || e === null) continue;
    const uplift = e - b;
    if (uplift <= 0) continue;
    const consent = latestConsent.get(candId);
    if (!consent?.may_appear_in_case_study) continue;
    strongCandidatesForDomain.push({ candId, uplift });
  }
  strongCandidatesForDomain.sort((a, b) => b.uplift - a.uplift);
  const topCandIds = strongCandidatesForDomain.slice(0, 5).map(x => x.candId);
  const candDetails = topCandIds.length > 0
    ? await safeFetch<any[]>(() => supabase.from('candidates').select('id, candidate_ref, given_name, preferred_name, country_of_origin').in('id', topCandIds), [])
    : [];
  const candDetailMap = new Map((candDetails as any[]).map((c: any) => [c.id, c]));

  // Featured quotes — annotate with inferred domain via source_ref → assessment_response → indicator → factor → domain
  const responseDomainMap = new Map<string, string[]>();
  for (const r of responses as any[]) {
    const factor = indToFactor.get(r.indicator_id);
    if (!factor) continue;
    responseDomainMap.set(r.id, factorToDomains.get(factor) ?? []);
  }
  const quotesForDomain = (quotes as any[]).filter((q: any) => {
    if (!q.source_ref || q.source_type !== 'assessment') return true; // include if not inferable
    const domains = responseDomainMap.get(q.source_ref);
    return domains ? domains.includes(activeDomain) : true;
  }).slice(0, 8);

  // Copy-ready snippets
  const domainInfo = DOMAINS.find(d => d.key === activeDomain)!;
  const headlineSnippet = meanBaseline !== null && meanExit !== null
    ? `Across ${stats?.candsWithBoth.length ?? 0} candidates assessed on ${domainInfo.short}, mean capability rose from ${meanBaseline.toFixed(2)} to ${meanExit.toFixed(2)} on the HIM 0-5 scale — a ${relativeGainPct(meanBaseline, meanExit) >= 0 ? '+' : ''}${relativeGainPct(meanBaseline, meanExit)}% change on baseline. That is Level ${scoreToLevel(meanBaseline).level} (${scoreToLevel(meanBaseline).label}) to Level ${scoreToLevel(meanExit).level} (${scoreToLevel(meanExit).label}).`
    : `Impact evidence on ${domainInfo.short} pending assessment data.`;

  const financialSnippet = (estValueGbp !== null && peopleMoved > 0)
    ? `Estimated £${estValueGbp.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} of social value delivered on ${domainInfo.short} across ${peopleMoved} people. Methodology: ${(frameworks as any[]).find(f => f.key === activeFramework)?.label ?? activeFramework}, ${proxyRow?.unit ?? 'proxy'} at £${proxyGbp?.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} per person.`
    : null;

  const activeFrameworkLabel = (frameworks as any[]).find(f => f.key === activeFramework)?.label ?? activeFramework;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Reports"
        title="Impact library"
        description="ACH’s impact evidence organised by HIM domain. Grab headlines, financial value, case studies, and beneficiary voices to support any bid or funder conversation."
      />

      {/* Domain tabs */}
      <div className="mb-6 border-b border-ach-border">
        <div className="flex items-center gap-1 flex-wrap -mb-px">
          {DOMAINS.map(d => {
            const isActive = d.key === activeDomain;
            const dstats = domainStats.get(d.key);
            const hasData = dstats && dstats.candsWithBoth.length > 0;
            return (
              <Link
                key={d.key}
                href={`/impact-library?domain=${d.key}&framework=${activeFramework}`}
                className={`px-3 py-2 text-[12.5px] rounded-t-[8px] border-x border-t transition-colors ${
                  isActive
                    ? 'bg-white border-ach-border text-ach-navy font-medium'
                    : 'border-transparent text-ach-navy/60 hover:text-ach-navy hover:bg-ach-page/50'
                }`}
              >
                {d.label}
                {hasData && <span className="ml-1.5 text-[10.5px] text-ach-navy/45">({dstats.candsWithBoth.length})</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Framework switcher */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-medium">Financial framework:</span>
        {(frameworks as any[]).map((f: any) => (
          <Link
            key={f.key}
            href={`/impact-library?domain=${activeDomain}&framework=${f.key}`}
            className={`text-[12.5px] px-2.5 py-1 rounded-[6px] border transition-colors ${
              f.key === activeFramework
                ? 'border-ach-navy bg-ach-navy text-ach-cream'
                : 'border-ach-border text-ach-navy hover:bg-ach-page'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Headline stat */}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-medium">Headline for a bid</div>
            <CopyButton text={headlineSnippet} label="Copy" />
          </div>
          <div className="text-[14.5px] text-ach-navy leading-relaxed">{headlineSnippet}</div>
          {meanBaseline !== null && meanExit !== null && (
            <div className="grid grid-cols-4 gap-4 mt-5 pt-4 border-t border-ach-border">
              <Stat label="Candidates assessed" value={String(stats?.candsWithBoth.length ?? 0)} />
              <Stat label="Mean baseline" value={meanBaseline.toFixed(2)} sub={`L${scoreToLevel(meanBaseline).level}`} />
              <Stat label="Mean exit" value={meanExit.toFixed(2)} sub={`L${scoreToLevel(meanExit).level}`} />
              <Stat label="Uplift" value={`${upliftRaw && upliftRaw >= 0 ? '+' : ''}${upliftRaw?.toFixed(2) ?? '—'}`} sub={`${relativeGainPct(meanBaseline, meanExit) >= 0 ? '+' : ''}${relativeGainPct(meanBaseline, meanExit)}% on baseline`} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial value */}
      {financialSnippet && (
        <Card className="mb-4">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-medium">Financial value ({activeFrameworkLabel})</div>
              <CopyButton text={financialSnippet} label="Copy" />
            </div>
            <div className="text-[14.5px] text-ach-navy leading-relaxed">{financialSnippet}</div>
            <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-ach-border">
              <Stat label="Proxy per person" value={proxyGbp !== null ? `£${proxyGbp.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'} sub={proxyRow?.unit ?? ''} />
              <Stat label="People counted" value={String(peopleMoved)} sub={activeDomain === 'employment' ? 'placed candidates' : 'candidates with positive uplift'} />
              <Stat label="Estimated £ delivered" value={estValueGbp !== null ? `£${estValueGbp.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'} />
            </div>
            <div className="text-[11px] text-ach-navy/55 mt-3">
              Proxy: {proxyRow?.guidance ?? '—'}. Indicative — refresh from source before final bid submission.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Case studies */}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-medium mb-3">
            Case studies exemplifying {domainInfo.short}
          </div>
          {strongCandidatesForDomain.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60 italic">
              No candidates with case-study consent AND strong uplift on this domain yet. Once assessors capture data and candidates grant consent, they appear here.
            </div>
          ) : (
            <div className="space-y-2">
              {topCandIds.map(cid => {
                const c = candDetailMap.get(cid);
                if (!c) return null;
                const cUplift = strongCandidatesForDomain.find(x => x.candId === cid)?.uplift ?? 0;
                const consent = latestConsent.get(cid);
                const displayName = consent?.may_be_named ? (c.preferred_name || c.given_name || c.candidate_ref) : `${c.candidate_ref} (anonymised)`;
                return (
                  <div key={cid} className="flex items-center justify-between gap-3 border-[0.5px] border-ach-border rounded-[8px] px-3 py-2.5 hover:bg-ach-page">
                    <div>
                      <div className="text-[13px] text-ach-navy font-medium">{displayName}</div>
                      <div className="text-[11.5px] text-ach-navy/60">
                        {c.country_of_origin ? `${c.country_of_origin} · ` : ''}
                        Uplift on {domainInfo.label}: +{cUplift.toFixed(2)}
                      </div>
                    </div>
                    <Link href={`/candidates/${cid}/case-study`} className="text-[11.5px] text-ach-navy underline underline-offset-2 hover:text-ach-navy/70">
                      Open case study →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Featured quotes */}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-medium mb-3">
            Featured voices
            {quotesForDomain.length > 0 && (
              <span className="ml-2 text-ach-navy/45 normal-case tracking-normal">
                (filtered where quote source relates to {domainInfo.short})
              </span>
            )}
          </div>
          {quotesForDomain.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60 italic">
              No featured quotes captured yet. Assessors flag feature-worthy responses during assessment; those flow here.
            </div>
          ) : (
            <div className="space-y-3">
              {quotesForDomain.map((q: any) => {
                const attribution = q.use_anonymised ? 'Anonymised' : (q.display_name ?? 'By name');
                const copyText = `"${q.quote_text}" — ${attribution}, ${q.speaker_type}${q.context ? ` (${q.context})` : ''}`;
                return (
                  <div key={q.id} className="border-l-2 border-ach-navy/40 pl-4 py-1 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[14px] text-ach-navy font-serif italic leading-relaxed flex-1">&ldquo;{q.quote_text}&rdquo;</div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <CopyButton text={copyText} label="Copy" />
                      </div>
                    </div>
                    <div className="text-[11.5px] text-ach-navy/55 mt-1.5">
                      {attribution} · {q.speaker_type}
                      {q.context ? <> · <span className="italic">{q.context}</span></> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Methodology note */}
      <section className="mt-6 text-[11.5px] text-ach-navy/60 leading-relaxed">
        <div className="font-medium text-ach-navy/75 mb-1">Methodology</div>
        <p>
          Aggregate stats computed from HIM assessment_responses joined via factor → domain, comparing baseline
          and mid_3mo/exit_6mo timepoints. Financial values applied via the selected framework’s per-domain proxy
          × people moved. Case studies filtered to candidates with strong domain uplift AND explicit
          case-study consent. Quotes filtered where the source assessment response relates to this domain.
          Every element here is <em>copy-ready</em> for pasting into a bid document. Proxy values indicative —
          refresh from source before final submission.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{label}</div>
      <div className="text-[20px] font-serif text-ach-navy">{value}</div>
      {sub && <div className="text-[11px] text-ach-navy/55">{sub}</div>}
    </div>
  );
}
