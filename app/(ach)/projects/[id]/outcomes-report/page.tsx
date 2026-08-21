import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PrintButton } from '@/components/ui/print-button';
import { scoreToLevel } from '@/lib/scoring/interpret';

export const metadata = { title: 'Project outcomes report' };

const DOMAIN_LABELS: Record<string, { label: string; hint: string }> = {
  employment: { label: 'Employment',           hint: 'work, earnings, quality' },
  education:  { label: 'Education & Skills',   hint: 'language, digital, vocational' },
  belonging:  { label: 'Belonging & Identity', hint: 'cultural comfort, self-worth' },
  health:     { label: 'Health & Wellbeing',   hint: 'mental, physical, care access' },
  social:     { label: 'Social Participation', hint: 'networks, civic life' },
  housing:    { label: 'Housing',              hint: 'security, quality' },
  rights:     { label: 'Rights & Citizenship', hint: 'status, rights, voice' },
};

// Keys MUST match what the OutcomesTracker actually saves — that's
// TRAINING_OUTCOME_LABELS + FIXED_BENEFICIARY_OUTCOMES in
// lib/activities/definitions.ts. Any mismatch here would silently
// hide ticked outcomes from the ladder, which is exactly what
// happened in the earlier version.
const OUTCOME_DEFINITIONS: { key: string; label: string; hint: string }[] = [
  // Training-pass outcomes (surface only if the tick exists)
  { key: 'english_training',           label: 'Passed English course',           hint: 'observable proficiency at work' },
  { key: 'digital_skills_training',    label: 'Passed Digital skills course',    hint: 'workplace tools + confidence' },
  { key: 'customer_service_training',  label: 'Passed Customer service course',  hint: 'workplace-facing preparation' },
  { key: 'health_safety_training',     label: 'Passed Health & Safety course',   hint: 'certified pre-placement' },
  { key: 'cultural_awareness_training',label: 'Passed Cultural awareness course',hint: 'workplace inclusion module' },
  // Employability / progression outcomes
  { key: 'got_job_offer',              label: 'Got a job offer',                 hint: 'from partner or elsewhere' },
  { key: 'got_placement',              label: 'Got placement',                   hint: 'confirmed placement agreement' },
  { key: 'started_job',                label: 'Started a job',                   hint: 'first day on the floor' },
  { key: 'started_vocational',         label: 'Started vocational training',     hint: 'e.g. sector-specific L2/L3 route' },
  { key: 'started_further_ed',         label: 'Started further education',       hint: 'college / access course' },
  { key: 'started_apprenticeship',     label: 'Started apprenticeship',          hint: 'formal apprenticeship route' },
  { key: 'retained_6mo',               label: 'Retained in job (6+ months)',     hint: 'confirmed at retention check' },
  { key: 'retained_12mo',              label: 'Retained in job (12+ months)',    hint: 'confirmed at retention check' },
  { key: 'promoted',                   label: 'Promoted / better role',          hint: 'progression from placement' },
];

export default async function ProjectOutcomesReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: project } = await supabase
    .from('projects').select('*').eq('id', params.id).maybeSingle();
  if (!project) notFound();
  const p = project as any;

  const [cohortsRes, cohortCandsRes, responsesRes, placementsRes, quotesRes, partnersRes, activitiesRes, outcomesRes, capabilitiesRes] = await Promise.all([
    supabase.from('cohorts').select('id, name, cohort_ref, status, start_date, end_date').eq('project_id', params.id),
    supabase.from('cohort_candidates').select('candidate_id, cohort_id, candidates(id, candidate_ref, given_name, family_name, status, country_of_origin, arrival_year)').limit(1000),
    supabase.from('assessment_responses').select(`
      numeric_value, narrative, candidate_voice, feature_worthy,
      indicators(factor_id, factors(factor_domains(domain_id))),
      assessments!inner(id, cohort_id, timepoint, project_id)
    `).eq('assessments.project_id', params.id),
    supabase.from('placements').select('candidate_id, partner_id, start_date, salary_pence'),
    supabase.from('featured_quotes').select('quote_text, context, speaker_type, use_anonymised, display_name, candidates(candidate_ref, given_name, country_of_origin, arrival_year)').is('archived_at', null).limit(20),
    supabase.from('cohort_partners').select('cohort_id, is_lead_partner, partners(id, name, types)'),
    supabase.from('project_activities').select('activity').eq('project_id', params.id),
    supabase.from('beneficiary_outcomes').select('candidate_id, outcome_key').eq('project_id', params.id),
    supabase.from('project_capabilities').select('domain, role').eq('project_id', params.id),
  ]);
  const scopedDomains = new Set<string>(((capabilitiesRes.data as { domain: string }[] | null) ?? []).map(c => c.domain));

  const cohorts = ((cohortsRes.data as any[]) ?? []);
  const cohortIds = new Set(cohorts.map(c => c.id));
  const cohortCands = ((cohortCandsRes.data as any[]) ?? []).filter(cc => cohortIds.has(cc.cohort_id));
  const candidates = cohortCands.map((cc: any) => cc.candidates).filter(Boolean);
  const candidateIds = new Set(candidates.map((c: any) => c.id));
  const responses = (responsesRes.data as any[]) ?? [];
  const placements = ((placementsRes.data as any[]) ?? []).filter(pl => candidateIds.has(pl.candidate_id));
  const quotes = ((quotesRes.data as any[]) ?? []);
  const partners = Array.from(new Map(((partnersRes.data as any[]) ?? [])
    .filter((row: any) => cohortIds.has(row.cohort_id) && row.partners)
    .map((row: any) => [row.partners.id, { ...row.partners, is_lead: row.is_lead_partner }])).values());
  const beneficiaryOutcomes = (outcomesRes.data as any[]) ?? [];

  // Per-domain baseline vs exit mean
  type DomainAgg = { baselineSum: number; baselineN: number; exitSum: number; exitN: number };
  const agg: Record<string, DomainAgg> = {};
  for (const dom of Object.keys(DOMAIN_LABELS)) agg[dom] = { baselineSum: 0, baselineN: 0, exitSum: 0, exitN: 0 };
  for (const r of responses) {
    const domains = r.indicators?.factors?.factor_domains ?? [];
    const tp = r.assessments?.timepoint;
    const v = r.numeric_value;
    if (typeof v !== 'number') continue;
    for (const fd of domains) {
      const dom = fd.domain_id;
      if (!agg[dom]) continue;
      if (tp === 'baseline') { agg[dom].baselineSum += v; agg[dom].baselineN += 1; }
      else if (tp === 'exit_6mo' || tp === 'mid_3mo' || tp === 'followup_12mo') { agg[dom].exitSum += v; agg[dom].exitN += 1; }
    }
  }
  // Show ALL 7 domains, always. Each row carries a status:
  //   'scored'     — real baseline/exit numbers to display
  //   'awaiting'   — in scope for this project but no data yet
  //   'out_of_scope' — not selected as core/optional for this project
  // Reports read cleaner when every domain is present with a clear
  // reason for missing data, instead of quietly dropping domains that
  // weren't scored yet or aren't relevant to this programme.
  const domainRows = Object.entries(DOMAIN_LABELS).map(([key, meta]) => {
    const a = agg[key];
    const baseline = a.baselineN > 0 ? a.baselineSum / a.baselineN : null;
    const exit     = a.exitN     > 0 ? a.exitSum     / a.exitN     : null;
    const inScope = scopedDomains.size === 0 ? true : scopedDomains.has(key);
    let status: 'scored' | 'awaiting' | 'out_of_scope';
    if (!inScope) status = 'out_of_scope';
    else if (baseline === null && exit === null) status = 'awaiting';
    else status = 'scored';
    return { key, label: meta.label, hint: meta.hint, baseline, exit, status };
  });

  // Headline
  const totalEnrolled = candidates.length;
  const placedCount = placements.length;
  const withdrawn = candidates.filter((c: any) => c.status === 'withdrawn').length;
  const completed = totalEnrolled - withdrawn;
  const progressed = candidates.filter((c: any) => c.status === 'progressed').length;
  const totalSalary = placements.reduce((s, p) => s + (p.salary_pence ?? 0), 0) / 100;

  // Outcomes ladder — count of candidates who reached each outcome
  const outcomeCounts: Record<string, number> = {};
  for (const bo of beneficiaryOutcomes) {
    outcomeCounts[bo.outcome_key] = (outcomeCounts[bo.outcome_key] ?? 0) + 1;
  }
  const outcomeRows = OUTCOME_DEFINITIONS
    .map(o => ({ ...o, val: outcomeCounts[o.key] ?? 0 }))
    .filter(o => o.val > 0);

  const featured = quotes.filter((q: any) => q.quote_text).slice(0, 4);

  const meanBaseline = domainRows.filter(d => d.baseline !== null).reduce((s, d) => s + (d.baseline ?? 0), 0)
    / Math.max(1, domainRows.filter(d => d.baseline !== null).length);
  const meanExit = domainRows.filter(d => d.exit !== null).reduce((s, d) => s + (d.exit ?? 0), 0)
    / Math.max(1, domainRows.filter(d => d.exit !== null).length);
  const baselineLevel = isFinite(meanBaseline) && meanBaseline > 0 ? scoreToLevel(meanBaseline).label : null;
  const exitLevel     = isFinite(meanExit)     && meanExit     > 0 ? scoreToLevel(meanExit).label     : null;

  const cohortRef = cohorts[0]?.cohort_ref ?? p.project_ref;
  const programmeWindow = (() => {
    const start = cohorts[0]?.start_date ?? p.start_date;
    const end   = cohorts[0]?.end_date   ?? p.end_date;
    if (!start && !end) return 'Programme window not set';
    const fmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    return start ? `From ${fmt(start)}` : `Until ${fmt(end!)}`;
  })();

  return (
    <div className="max-w-5xl mx-auto pb-16 print:max-w-none">
      <div className="mb-4 print:hidden flex items-center justify-between">
        <Link href={`/projects/${params.id}`} className="text-[13px] text-ach-navy/70 hover:text-ach-navy flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to project
        </Link>
        <PrintButton />
      </div>

      {/* Masthead */}
      <div className="pb-5 border-b border-ach-border mb-8">
        <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-2">
          Project outcomes report · {p.completed_at ? 'Final' : 'Draft'}
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="font-serif text-[38px] tracking-[-0.01em] leading-[1.05] text-ach-navy font-medium">
            {p.name}
          </h1>
          <div className="text-right text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/60 leading-[1.9]">
            Programme window · <span className="text-ach-navy font-medium">{programmeWindow}</span><br />
            Project · <span className="text-ach-navy font-medium">{p.project_ref}</span><br />
            Cohort · <span className="text-ach-navy font-medium">{cohortRef}</span><br />
            Prepared by · <span className="text-ach-navy font-medium">ACH · Powered by HIM</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-[#FBF2E0]/40 border border-ach-navy/20 rounded-[6px] p-8 mb-6">
        <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-3">
          Headline outcome
        </div>
        <p className="font-serif text-[22px] leading-[1.4] text-ach-navy font-medium max-w-[52ch] text-balance mb-6">
          {totalEnrolled > 0 ? (
            <>
              {totalEnrolled} beneficiar{totalEnrolled === 1 ? 'y' : 'ies'} enrolled.
              {completed > 0 && <> {completed} completed.</>}
              {placedCount > 0 && <> <span className="text-[#B8843C] font-medium">{placedCount} placed in work</span>.</>}
              {baselineLevel && exitLevel && (
                <> Mean HIM capability rose from {baselineLevel} to {exitLevel}.</>
              )}
            </>
          ) : (
            'No beneficiaries enrolled yet. Once assessments begin, this headline will reflect the programme reality.'
          )}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 border-t border-dotted border-ach-navy/25">
          <HeroStat k="Beneficiaries" v={String(totalEnrolled)} s={completed > 0 && totalEnrolled > 0 ? `${completed} completed · ${Math.round((completed/totalEnrolled)*100)}%` : undefined} />
          <HeroStat k="Placed in work" v={String(placedCount)} s={placedCount > 0 && totalEnrolled > 0 ? `${Math.round((placedCount/totalEnrolled)*100)}% of starters` : undefined} />
          <HeroStat k="Salary secured" v={totalSalary > 0 ? `£${Math.round(totalSalary / 1000)}k` : '—'} s={totalSalary > 0 && placedCount > 0 ? `£${Math.round(totalSalary / placedCount / 1000)}k avg` : undefined} />
          <HeroStat k="Progressed" v={String(progressed)} s={progressed > 0 ? 'beyond first placement' : undefined} />
        </div>
      </div>

      {/* HIM signature — always renders all 7 domains, each with a clear
          status so out-of-scope ones read as intentional rather than zero. */}
      <SectionCard title="Capability change" sub="Baseline → exit · 7 domains · 0–5 scale">
        <div className="space-y-3.5">
          {domainRows.map(d => {
            const b = d.baseline ?? 0;
            const e = d.exit ?? b;
            return (
              <div key={d.key} className="grid grid-cols-[190px_1fr_140px] gap-4 items-center max-md:grid-cols-[130px_1fr_100px]">
                <div className={`text-[13.5px] ${d.status === 'out_of_scope' ? 'text-ach-navy/45' : 'text-ach-navy'}`}>
                  {d.label}
                  <span className="block text-[11px] text-ach-navy/55 mt-px">{d.hint}</span>
                </div>
                {d.status === 'scored' ? (
                  <>
                    <div className="relative h-5 bg-ach-page rounded-[3px] overflow-hidden border-[0.5px] border-ach-border/70">
                      {d.baseline !== null && (
                        <div className="absolute inset-y-0 left-0 bg-ach-navy/25" style={{ width: `${(b / 5) * 100}%` }} />
                      )}
                      {d.exit !== null && (
                        <div className="absolute inset-y-0 left-0 bg-[#B8843C]" style={{ width: `${(e / 5) * 100}%` }} />
                      )}
                    </div>
                    <div className="text-[12px] font-mono tabular-nums text-right text-ach-navy/60">
                      {d.baseline !== null ? d.baseline.toFixed(1) : '—'} → {d.exit !== null ? d.exit.toFixed(1) : '—'}
                      {d.baseline !== null && d.exit !== null && (
                        <strong className={`ml-1.5 font-semibold ${d.exit >= d.baseline ? 'text-[#1B6D6A]' : 'text-[#8B3A4F]'}`}>
                          {d.exit - d.baseline >= 0 ? '+' : ''}{(d.exit - d.baseline).toFixed(1)}
                        </strong>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`h-5 rounded-[3px] border-[0.5px] flex items-center px-2.5 ${d.status === 'out_of_scope' ? 'bg-ach-page/40 border-ach-border/40' : 'bg-ach-page/70 border-dashed border-ach-border'}`}>
                      <span className="text-[11px] italic text-ach-navy/60">
                        {d.status === 'out_of_scope'
                          ? 'Not measured on this project — not in the project&apos;s capability scope.'
                          : 'Awaiting assessment data — in scope, no scored responses yet.'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-right text-ach-navy/40">
                      {d.status === 'out_of_scope' ? 'n/a' : '—'}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Outcomes ladder */}
      {outcomeRows.length > 0 && (
        <SectionCard title="Outcomes reached" sub="Ticked live as beneficiaries hit them">
          <div className="flex flex-col">
            {outcomeRows.map((o, i) => {
              const pct = totalEnrolled > 0 ? Math.round((o.val / totalEnrolled) * 100) : 0;
              return (
                <div key={o.key} className={`grid grid-cols-[32px_1fr_auto_auto] gap-4 items-center py-3.5 ${i < outcomeRows.length - 1 ? 'border-b border-dotted border-ach-border' : ''}`}>
                  <div className="text-right pr-1 text-[11px] font-mono text-ach-navy/55">{String(i + 1).padStart(2, '0')}</div>
                  <div>
                    <div className="text-[14px] text-ach-navy">{o.label}</div>
                    <div className="text-[11.5px] text-ach-navy/55 mt-px">{o.hint}</div>
                  </div>
                  <div className="font-serif text-[22px] tabular-nums text-ach-navy">{o.val}</div>
                  <div className="font-mono text-[11px] text-ach-navy/60 text-right min-w-[86px]">{pct}%</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Quotes */}
      {featured.length > 0 && (
        <SectionCard title="In beneficiaries' words" sub="Consented · Anonymised where requested">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {featured.map((q: any, i: number) => {
              const attribution = quoteAttribution(q);
              return (
                <blockquote key={i} className="border-l-2 border-[#B8843C] pl-4 py-1">
                  <p className="font-serif italic text-[15px] leading-[1.45] text-ach-navy m-0">
                    &ldquo;{q.quote_text}&rdquo;
                  </p>
                  {attribution && (
                    <div className="text-[11.5px] text-ach-navy/55 mt-2">— {attribution}</div>
                  )}
                </blockquote>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Narrative */}
      {(p.end_narrative_what_worked || p.end_narrative_challenges || p.end_narrative_unexpected) && (
        <SectionCard title="Programme reflections" sub="Recorded at close-out · 3 fields">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {p.end_narrative_what_worked && <NarrativeBlock label="What worked well">{p.end_narrative_what_worked}</NarrativeBlock>}
            {p.end_narrative_challenges && <NarrativeBlock label="Challenges encountered">{p.end_narrative_challenges}</NarrativeBlock>}
            {p.end_narrative_unexpected && <NarrativeBlock label="Unexpected impact">{p.end_narrative_unexpected}</NarrativeBlock>}
          </div>
        </SectionCard>
      )}

      {/* Partners */}
      {partners.length > 0 && (
        <SectionCard title="Delivery partners" sub="Cohort collaborators">
          <div className="flex flex-wrap gap-2">
            {partners.map((pr: any) => (
              <PartnerChip key={pr.id}>
                {pr.name}
                {pr.types && pr.types.length > 0 && (
                  <span className="text-ach-navy/50"> · {formatPartnerType(pr.types[0])}</span>
                )}
                {pr.is_lead && <span className="text-[#B8843C] font-medium ml-1"> · Lead</span>}
              </PartnerChip>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="flex items-center justify-between pt-5 mt-6 border-t border-ach-border font-mono text-[10.5px] uppercase tracking-[1.4px] text-ach-navy/55">
        <div className="text-ach-navy">ACH · Bristol · Powered by HIM</div>
        <div>Report generated live from the database · v1.0</div>
      </div>
    </div>
  );
}

function quoteAttribution(q: any): string | null {
  const c = q.candidates;
  // Assessor's context wins if present
  if (q.context && q.context.trim().length > 0) return q.context;
  if (!c) return q.display_name ?? null;
  const initial = c.given_name ? `${c.given_name[0]}.` : c.candidate_ref;
  const origin = c.country_of_origin
    ? `arrived from ${c.country_of_origin}${c.arrival_year ? ` ${c.arrival_year}` : ''}`
    : null;
  const parts = [q.use_anonymised ? initial : (q.display_name ?? initial), origin].filter(Boolean);
  return parts.join(', ');
}

function formatPartnerType(t: string): string {
  const map: Record<string, string> = {
    grant_funder: 'Grant funder',
    workforce_partner: 'Corporate partner',
    referral_partner: 'Referral pipeline',
    methodology_partner: 'Methodology partner',
    delivery_partner: 'Delivery partner',
  };
  return map[t] ?? t.replace(/_/g, ' ');
}

function HeroStat({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[1.6px] text-ach-navy/55 font-mono">{k}</div>
      <div className="font-serif text-[26px] tabular-nums text-ach-navy tracking-[-0.01em] leading-none mt-1.5">{v}</div>
      {s && <div className="text-[11.5px] text-ach-navy/55 mt-1">{s}</div>}
    </div>
  );
}

function SectionCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-ach-border rounded-[6px] p-6 mb-5">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div className="font-serif text-[19px] tracking-[-0.005em] font-medium text-ach-navy">{title}</div>
        <div className="text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/55">{sub}</div>
      </div>
      {children}
    </div>
  );
}

function NarrativeBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/55 mb-2">{label}</div>
      <p className="text-[13.5px] leading-[1.5] text-ach-navy/85 m-0 whitespace-pre-line">{children}</p>
    </div>
  );
}

function PartnerChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] px-3 py-1.5 bg-ach-page border border-ach-border rounded-full text-ach-navy">
      {children}
    </span>
  );
}
