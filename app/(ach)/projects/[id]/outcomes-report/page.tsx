import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PrintButton } from '@/components/ui/print-button';
import { scoreToLevel } from '@/lib/scoring/interpret';

export const metadata = { title: 'Project outcomes report' };

const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  housing:    'Housing',
  education:  'Education & Skills',
  health:     'Health & Wellbeing',
  belonging:  'Belonging & Identity',
  social:     'Social Participation',
  rights:     'Rights & Citizenship',
};

export default async function ProjectOutcomesReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!project) notFound();
  const p = project as any;

  const [cohortsRes, cohortCandsRes, assessmentsRes, responsesRes, placementsRes, quotesRes, dataProvidersRes, partnersRes, activitiesRes] = await Promise.all([
    supabase.from('cohorts').select('id, name, cohort_ref, status').eq('project_id', params.id),
    supabase.from('cohort_candidates').select('candidate_id, cohort_id, candidates(id, candidate_ref, given_name, family_name, status)').limit(1000),
    supabase.from('assessments').select('id, candidate_id, cohort_id, timepoint, status').eq('project_id', params.id),
    supabase.from('assessment_responses').select(`
      numeric_value, narrative, candidate_voice, feature_worthy,
      indicators(factor_id, factors(factor_domains(domain_id))),
      assessments!inner(id, cohort_id, timepoint, project_id)
    `).eq('assessments.project_id', params.id),
    supabase.from('placements').select('candidate_id, partner_id, start_date, salary_pence'),
    supabase.from('featured_quotes').select('quote_text, context, speaker_type, use_anonymised, display_name').is('archived_at', null).limit(20),
    supabase.from('project_data_providers').select('email, contact_name, role').eq('project_id', params.id),
    supabase.from('cohort_partners').select('cohort_id, partners(id, name, types)'),
    supabase.from('project_activities').select('activity').eq('project_id', params.id),
  ]);

  const cohorts = ((cohortsRes.data as any[]) ?? []);
  const cohortIds = new Set(cohorts.map(c => c.id));
  const cohortCands = ((cohortCandsRes.data as any[]) ?? []).filter(cc => cohortIds.has(cc.cohort_id));
  const candidates = cohortCands.map((cc: any) => cc.candidates).filter(Boolean);
  const candidateIds = new Set(candidates.map((c: any) => c.id));
  const assessments = (assessmentsRes.data as any[]) ?? [];
  const responses = (responsesRes.data as any[]) ?? [];
  const placements = ((placementsRes.data as any[]) ?? []).filter(pl => candidateIds.has(pl.candidate_id));
  const quotes = ((quotesRes.data as any[]) ?? []);
  const dataProviders = ((dataProvidersRes.data as any[]) ?? []);
  const partners = Array.from(new Map(((partnersRes.data as any[]) ?? [])
    .filter((p: any) => cohortIds.has(p.cohort_id) && p.partners)
    .map((p: any) => [p.partners.id, p.partners])).values());
  const activities = ((activitiesRes.data as any[]) ?? []).map(a => a.activity);

  // Impact signature per domain: mean baseline vs mean exit (mid_3mo or exit_6mo)
  type DomainAgg = { domain: string; baselineSum: number; baselineN: number; exitSum: number; exitN: number };
  const agg: Record<string, DomainAgg> = {};
  for (const dom of Object.keys(DOMAIN_LABELS)) agg[dom] = { domain: dom, baselineSum: 0, baselineN: 0, exitSum: 0, exitN: 0 };

  for (const r of responses) {
    const domains = r.indicators?.factors?.factor_domains ?? [];
    const tp = r.assessments?.timepoint;
    const v = r.numeric_value;
    if (typeof v !== 'number') continue;
    for (const fd of domains) {
      const dom = fd.domain_id;
      if (!agg[dom]) continue;
      if (tp === 'baseline') {
        agg[dom].baselineSum += v; agg[dom].baselineN += 1;
      } else if (tp === 'exit_6mo' || tp === 'mid_3mo' || tp === 'followup_12mo') {
        agg[dom].exitSum += v; agg[dom].exitN += 1;
      }
    }
  }

  const domainRows = Object.values(agg).map(a => ({
    domain: a.domain,
    baseline: a.baselineN > 0 ? a.baselineSum / a.baselineN : null,
    exit:     a.exitN     > 0 ? a.exitSum     / a.exitN     : null,
  })).filter(r => r.baseline !== null || r.exit !== null);

  // Outputs
  const totalScreened = candidates.length;
  const placedCount = placements.length;
  const withdrawn = candidates.filter((c: any) => c.status === 'withdrawn').length;
  const progressed = candidates.filter((c: any) => c.status === 'progressed').length;
  const totalSalary = placements.reduce((s, p) => s + (p.salary_pence ?? 0), 0) / 100;

  const featured = quotes.filter((q: any) => q.quote_text).slice(0, 3);

  const audienceLabel =
    p.funding_model === 'commercial' ? 'Corporate partner outcomes report' :
    p.funding_model === 'hybrid' ? 'Grant funder and corporate partner outcomes report' :
    'Grant funder outcomes report';

  return (
    <div className="max-w-4xl mx-auto pb-16 print:max-w-none">
      <div className="mb-4 print:hidden flex items-center justify-between">
        <Link href={`/projects/${params.id}`} className="text-[13px] text-ach-navy/70 hover:text-ach-navy flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to project
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{audienceLabel}</div>
        <h1 className="text-[28px] font-medium tracking-[-0.5px] text-ach-navy mt-1">
          <span className="identity-ref">{p.project_ref}</span> · {p.name}
        </h1>
        <div className="text-[12.5px] text-ach-navy/60 mt-2">
          {p.completed_at
            ? <>Completed on {new Date(p.completed_at).toLocaleDateString('en-GB')}.</>
            : <>Status: <Badge>{p.status}</Badge> — draft outcomes report.</>}
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader><div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Headline</div></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Candidates" value={String(totalScreened)} />
            <Stat label="Placed" value={String(placedCount)} sub={placedCount > 0 && totalScreened > 0 ? `${Math.round((placedCount/totalScreened)*100)}%` : undefined} />
            <Stat label="Progressed" value={String(progressed)} />
            <Stat label="Total salary" value={`£${totalSalary.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`} sub="entering the local economy" />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Capability change</div>
          <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Baseline vs exit scores per domain (0–5 scale).</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {domainRows.length === 0
            ? <div className="text-[12.5px] text-ach-navy/55">No assessment data yet.</div>
            : domainRows.map(r => <DomainBar key={r.domain} label={DOMAIN_LABELS[r.domain]} baseline={r.baseline} exit={r.exit} />)}
        </CardContent>
      </Card>

      {featured.length > 0 && (
        <Card className="mb-4">
          <CardHeader><div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">In beneficiaries' words</div></CardHeader>
          <CardContent className="space-y-3">
            {featured.map((q: any, i: number) => (
              <blockquote key={i} className="border-l-2 border-ach-navy/30 pl-3 text-[13.5px] text-ach-navy/85 italic">
                "{q.quote_text}"
                {q.context && <div className="text-[11px] text-ach-navy/55 not-italic mt-1">— {q.context}</div>}
              </blockquote>
            ))}
          </CardContent>
        </Card>
      )}

      {(p.end_narrative_what_worked || p.end_narrative_challenges || p.end_narrative_unexpected) && (
        <Card className="mb-4">
          <CardHeader><div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Programme reflections</div></CardHeader>
          <CardContent className="space-y-3">
            {p.end_narrative_what_worked && <Narrative label="What worked well" text={p.end_narrative_what_worked} />}
            {p.end_narrative_challenges && <Narrative label="Challenges encountered" text={p.end_narrative_challenges} />}
            {p.end_narrative_unexpected && <Narrative label="Unexpected impact" text={p.end_narrative_unexpected} />}
          </CardContent>
        </Card>
      )}

      {partners.length > 0 && (
        <Card className="mb-4">
          <CardHeader><div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Delivery partners</div></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 text-[12.5px] text-ach-navy/80">
              {partners.map((pr: any) => <span key={pr.id} className="px-2 py-1 rounded-full bg-ach-page border-[0.5px] border-ach-border">{pr.name}</span>)}
            </div>
          </CardContent>
        </Card>
      )}

      {p.partner_provides_standard_data && dataProviders.length > 0 && (
        <Card className="mb-4 print:hidden">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Partner data collection</div>
            <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Contacts who supply retention / promotion / satisfaction data at the agreed timepoints.</div>
          </CardHeader>
          <CardContent>
            <ul className="text-[12.5px] text-ach-navy/80 space-y-1">
              {dataProviders.map((dp, i) => (
                <li key={i} className="flex items-center gap-2">
                  <a href={`mailto:${dp.email}?subject=Standard%20performance%20data%20—%20${encodeURIComponent(p.name)}&body=Hi%20—%20please%20share%20the%20standard%20retention%20and%20progression%20data%20for%20candidates%20we%20placed%20with%20you.%20Thank%20you.`} className="text-ach-navy underline underline-offset-2">
                    {dp.email}
                  </a>
                  {dp.contact_name && <span className="text-ach-navy/55">· {dp.contact_name}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[12px] border-[0.5px] border-ach-border bg-white p-3">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-ach-navy/55 mt-0.5">{sub}</div>}
    </div>
  );
}

function DomainBar({ label, baseline, exit }: { label: string; baseline: number | null; exit: number | null }) {
  const b = baseline ?? 0;
  const e = exit ?? b;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[12px] text-ach-navy">{label}</div>
        <div className="text-[11.5px] tabular-nums text-ach-navy/70">
          {baseline !== null ? scoreToLevel(baseline).label : '—'} → {exit !== null ? scoreToLevel(exit).label : '—'}
        </div>
      </div>
      <div className="relative h-2 rounded-full bg-ach-page overflow-hidden">
        {baseline !== null && (
          <div className="absolute inset-y-0 left-0 bg-ach-navy/30" style={{ width: `${(b / 5) * 100}%` }} />
        )}
        {exit !== null && (
          <div className="absolute inset-y-0 left-0 bg-ach-navy" style={{ width: `${(e / 5) * 100}%`, mixBlendMode: 'multiply' }} />
        )}
      </div>
    </div>
  );
}

function Narrative({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">{label}</div>
      <div className="text-[13px] text-ach-navy/85 whitespace-pre-line">{text}</div>
    </div>
  );
}
