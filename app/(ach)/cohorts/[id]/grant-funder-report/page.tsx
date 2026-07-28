import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PrintButton } from '@/components/ui/print-button';
import { SnapshotButton } from '@/components/cohort-reports/snapshot-button';

export const metadata = { title: 'Grant funder report' };

async function safeFetch<T>(fn: () => any, fallback: T): Promise<T> {
  try {
    const r = await fn();
    if (r?.error) return fallback;
    return (r?.data ?? fallback) as T;
  } catch { return fallback; }
}

export default async function GrantFunderReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: cohort } = await supabase.from('cohorts').select('*').eq('id', params.id).maybeSingle();
  if (!cohort) notFound();
  const c = cohort as any;

  const [candidates, assessments, responses, placements, quotes, priorReports, project, partners] = await Promise.all([
    safeFetch<any[]>(() => supabase.from('cohort_candidates').select('candidate_id, candidates(id, candidate_ref, status)').eq('cohort_id', params.id), []),
    safeFetch<any[]>(() => supabase.from('assessments').select('id, candidate_id, timepoint, status, assessed_on').eq('cohort_id', params.id), []),
    safeFetch<any[]>(() => supabase.from('assessment_responses').select('id, assessment_id, indicator_id, numeric_value, narrative').limit(2000), []),
    safeFetch<any[]>(() => supabase.from('placements').select('candidate_id, start_date, end_date').order('start_date', { ascending: false }), []),
    safeFetch<any[]>(() => supabase.from('featured_quotes').select('id, quote_text, context, speaker_type, use_anonymised, display_name').eq('cohort_id', params.id).is('archived_at', null).order('tagged_at', { ascending: false }), []),
    safeFetch<any[]>(() => supabase.from('cohort_reports').select('id, status, generated_at, issued_at').eq('cohort_id', params.id).eq('report_type', 'close_out').order('generated_at', { ascending: false }).limit(3), []),
    c.project_id ? safeFetch<any>(() => supabase.from('projects').select('id, name, funder, funding_model, target_start_count').eq('id', c.project_id).maybeSingle(), null) : Promise.resolve(null),
    safeFetch<any[]>(() => supabase.from('cohort_partners').select('id, partners(id, name)').eq('cohort_id', params.id), []),
  ]);

  const candList = (candidates as any[]).map(cc => cc.candidates).filter(Boolean);
  const partnerList = (partners as any[]).map(p => p.partners).filter(Boolean);
  const proj = project as any;

  const cohortAssessmentIds = new Set(assessments.map(a => a.id));
  const cohortResponses = responses.filter((r: any) => cohortAssessmentIds.has(r.assessment_id));

  const totalCandidates = candList.length;
  const enrolledIds = new Set(candList.map(c => c.id));
  const placedCount = new Set(placements.filter((p: any) => enrolledIds.has(p.candidate_id)).map((p: any) => p.candidate_id)).size;
  const completedAssessments = assessments.filter((a: any) => a.status === 'completed' || a.status === 'reviewed').length;
  const target = proj?.target_start_count ?? null;
  const variance = target ? totalCandidates - target : null;
  const variancePct = target ? Math.round(((totalCandidates - target) / target) * 100) : null;

  const responsesByAssessment = new Map<string, any[]>();
  for (const r of cohortResponses) {
    const list = responsesByAssessment.get(r.assessment_id) ?? [];
    list.push(r);
    responsesByAssessment.set(r.assessment_id, list);
  }
  const scoreFor = (tp: string) => {
    const asmts = assessments.filter((a: any) => a.timepoint === tp);
    const vals: number[] = [];
    for (const a of asmts) {
      for (const r of (responsesByAssessment.get(a.id) ?? [])) {
        if (typeof r.numeric_value === 'number') vals.push(Number(r.numeric_value));
      }
    }
    return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
  };
  const meanBaseline = scoreFor('baseline');
  const meanExit = scoreFor('mid_3mo');
  const uplift = meanExit - meanBaseline;

  const snapshot = {
    generated_at: new Date().toISOString(),
    report_type: 'grant_funder',
    cohort: { id: c.id, name: c.name },
    project: proj ? { id: proj.id, name: proj.name, funder: proj.funder, target: proj.target_start_count } : null,
    starts: totalCandidates,
    target,
    variance,
    variance_pct: variancePct,
    placements: placedCount,
    completed_assessments: completedAssessments,
    capability_uplift: {
      mean_baseline: Number(meanBaseline.toFixed(2)),
      mean_exit: Number(meanExit.toFixed(2)),
      uplift: Number(uplift.toFixed(2)),
    },
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
        <div className="text-[11px] uppercase tracking-[1.4px] text-ach-navy/55 mb-1">Grant funder report</div>
        <h1 className="text-[26px] font-serif font-semibold text-ach-navy leading-tight">{c.name ?? 'Cohort'}</h1>
        <div className="mt-2 text-[13px] text-ach-navy/70">
          Prepared for {proj?.funder ?? '[Funder name]'} · As at {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          {' · '}Methodology v1.0
        </div>
        {partnerList.length > 0 && (
          <div className="mt-2 text-[12.5px] text-ach-navy/60">
            Delivered in partnership with: {partnerList.map(p => p.name).join(', ')}
          </div>
        )}
      </div>

      <div className="print:hidden flex items-center gap-2 mb-6">
        <SnapshotButton cohortId={c.id} snapshot={snapshot} reportType="close_out" />
        <PrintButton />
      </div>

      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">1 · Delivery against grant aims</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Target starts" value={target ?? '—'} sub="from grant agreement" />
              <StatCard label="Actual starts" value={totalCandidates} sub="candidates enrolled" />
              <StatCard
                label="Variance"
                value={variance === null ? '—' : `${variance >= 0 ? '+' : ''}${variance}`}
                sub={variancePct === null ? 'no target set' : `${variancePct >= 0 ? '+' : ''}${variancePct}%`}
              />
              <StatCard label="Placements made" value={placedCount} sub="into work / progression" />
            </div>
            {target === null && (
              <div className="mt-4 text-[12px] text-ach-navy/55 italic">
                No target start count set on this project. Add a target on /projects/[id]/edit to see variance.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">2 · Capability change (against baseline)</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-6">
              <ScoreBlock label="Mean baseline" value={meanBaseline} sub="across all indicators, 0–5 scale" />
              <ScoreBlock label="Mean exit / follow-up" value={meanExit} sub="end of programme timepoint" />
              <ScoreBlock
                label="Uplift"
                value={uplift}
                sub="change over the programme window"
                highlight
              />
            </div>
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

      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">4 · What we learned</h2>
        <Card>
          <CardContent className="pt-6 text-[13px] text-ach-navy leading-relaxed">
            <p className="italic text-ach-navy/60 mb-2">
              [ACH staff to complete before issuing to the funder — 1–2 short paragraphs on what worked, what did not, and what the next iteration would change.]
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 pt-6 border-t border-ach-border text-[11.5px] text-ach-navy/60 leading-relaxed">
        <div className="font-medium text-ach-navy/75 mb-1">Methodology note</div>
        <p>
          Delivery figures are drawn from HIM records at report generation time. Capability change is the mean of
          numeric indicator responses (0–5 scale) across the HIM 7 domains, at each timepoint. Featured quotes
          appear only where consent to quote has been recorded. Snapshot to store this report as an immutable
          grant close-out record; a 12-month impact report follows one year post-programme.
        </p>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{label}</div>
      <div className="text-[26px] font-serif text-ach-navy">{value}</div>
      {sub && <div className="text-[11.5px] text-ach-navy/55">{sub}</div>}
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
