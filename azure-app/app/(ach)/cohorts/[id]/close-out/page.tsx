import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PrintButton } from '@/components/ui/print-button';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SnapshotButton } from '@/components/cohort-reports/snapshot-button';
import { scoreToLevel, relativeGainPct, upliftNarrative } from '@/lib/scoring/interpret';

export const metadata = { title: 'Programme close-out report' };

export default async function CloseOutReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: cohort } = await supabase.from('cohorts').select('*').eq('id', params.id).maybeSingle();
  if (!cohort) notFound();
  const c = cohort as any;

  const [candidatesRes, assessmentsRes, responsesRes, placementsRes, quotesRes, priorReports, partnersRes] = await Promise.all([
    supabase.from('cohort_candidates').select('candidate_id, candidates(id, candidate_ref, given_name, family_name, status)').eq('cohort_id', params.id),
    supabase.from('assessments').select('id, candidate_id, timepoint, status, assessed_on').eq('cohort_id', params.id),
    supabase.from('assessment_responses').select('id, assessment_id, indicator_id, numeric_value, narrative, candidate_voice, feature_worthy').limit(2000),
    supabase.from('placements').select('candidate_id, start_date, end_date').order('start_date', { ascending: false }),
    supabase.from('featured_quotes').select('id, quote_text, context, speaker_type, use_anonymised, display_name, candidate_id').eq('cohort_id', params.id).is('archived_at', null),
    supabase.from('cohort_reports').select('id, report_type, status, generated_at, issued_at').eq('cohort_id', params.id).eq('report_type', 'close_out').order('generated_at', { ascending: false }).limit(3),
    supabase.from('cohort_partners').select('id, partners(id, name)').eq('cohort_id', params.id),
  ]);

  const candidates = ((candidatesRes.data as any[]) ?? []).map(cc => cc.candidates).filter(Boolean);
  const assessments = (assessmentsRes.data as any[]) ?? [];
  const responses = (responsesRes.data as any[]) ?? [];
  const placements = (placementsRes.data as any[]) ?? [];
  const quotes = (quotesRes.data as any[]) ?? [];
  const prior = (priorReports.data as any[]) ?? [];
  const partners = ((partnersRes.data as any[]) ?? []).map(p => p.partners).filter(Boolean);

  // Filter responses to just this cohort's assessments
  const cohortAssessmentIds = new Set(assessments.map(a => a.id));
  const cohortResponses = responses.filter(r => cohortAssessmentIds.has(r.assessment_id));

  // Outputs
  const totalCandidates = candidates.length;
  const enrolledIds = new Set(candidates.map(c => c.id));
  const placedCandidates = placements.filter(p => enrolledIds.has(p.candidate_id)).length;
  const completedAssessments = assessments.filter(a => a.status === 'completed' || a.status === 'reviewed').length;
  const withdrawn = candidates.filter(c => c.status === 'withdrawn').length;

  // Short-term outcomes: baseline vs mid_3mo (end of placement / programme exit)
  const responsesByAssessment = new Map<string, any[]>();
  for (const r of cohortResponses) {
    const list = responsesByAssessment.get(r.assessment_id) ?? [];
    list.push(r);
    responsesByAssessment.set(r.assessment_id, list);
  }
  const baselineAssessments = assessments.filter(a => a.timepoint === 'baseline');
  const exitAssessments = assessments.filter(a => a.timepoint === 'mid_3mo');
  const mean = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
  const scoreFor = (asmts: any[]) => {
    const vals: number[] = [];
    for (const a of asmts) {
      for (const r of (responsesByAssessment.get(a.id) ?? [])) {
        if (typeof r.numeric_value === 'number') vals.push(Number(r.numeric_value));
      }
    }
    return mean(vals);
  };
  const meanBaseline = scoreFor(baselineAssessments);
  const meanExit = scoreFor(exitAssessments);
  const uplift = meanExit - meanBaseline;

  // Featured qualitative material
  const featureWorthy = cohortResponses.filter(r => r.feature_worthy && (r.narrative || r.candidate_voice));

  const snapshot = {
    generated_at: new Date().toISOString(),
    cohort: { id: c.id, name: c.name, status: c.status, planned_start: c.planned_start, planned_end: c.planned_end },
    partners: partners.map(p => ({ id: p.id, name: p.name })),
    outputs: {
      total_candidates: totalCandidates,
      placed: placedCandidates,
      completed_assessments: completedAssessments,
      withdrawn,
    },
    short_term_outcomes: {
      mean_baseline: Number(meanBaseline.toFixed(2)),
      mean_exit: Number(meanExit.toFixed(2)),
      uplift: Number(uplift.toFixed(2)),
    },
    featured_quotes: quotes.map(q => ({
      quote: q.quote_text,
      context: q.context,
      speaker: q.speaker_type,
      display_name: q.use_anonymised ? null : q.display_name,
    })),
    methodology_version: 'v1.0',
  };

  return (
    <div className="max-w-5xl mx-auto pb-16 print:max-w-none">
      <div className="print:hidden mb-4">
        <Link href={`/cohorts/${params.id}`} className="inline-flex items-center gap-1.5 text-[12px] text-ach-navy/70 hover:text-ach-navy">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to cohort
        </Link>
      </div>

      {/* Report header */}
      <div className="mb-8 border-b border-ach-border pb-6">
        <div className="text-[11px] uppercase tracking-[1.4px] text-ach-navy/55 mb-1">Programme close-out report</div>
        <h1 className="text-[26px] font-serif font-semibold text-ach-navy leading-tight">
          {c.name ?? 'Cohort'}
        </h1>
        <div className="mt-2 text-[13px] text-ach-navy/70">
          Prepared from HIM as at {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          {' · '}Methodology version v1.0
        </div>
        {partners.length > 0 && (
          <div className="mt-2 text-[12.5px] text-ach-navy/60">
            Partners: {partners.map(p => p.name).join(', ')}
          </div>
        )}
      </div>

      {/* Actions row */}
      <div className="print:hidden flex items-center gap-2 mb-6">
        <SnapshotButton cohortId={c.id} snapshot={snapshot} reportType="close_out" />
        <PrintButton />
        {prior.length > 0 && (
          <span className="text-[12px] text-ach-navy/60 ml-auto">
            {prior.filter(p => p.status === 'issued').length} issued · {prior.filter(p => p.status === 'draft').length} draft on file
          </span>
        )}
      </div>

      {/* 1. Outputs */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">1 · Outputs from the programme</h2>
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Candidates enrolled" value={totalCandidates} />
          <StatCard label="Assessments completed" value={completedAssessments} />
          <StatCard label="Placements made" value={placedCandidates} />
          <StatCard label="Withdrawn" value={withdrawn} />
        </div>
      </section>

      {/* 2. Short-term outcomes */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">2 · Short-term outcomes: capability change</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/50 mb-1">Mean baseline score</div>
                <div className="text-[28px] font-serif text-ach-navy">{meanBaseline.toFixed(2)}</div>
                <div className="text-[11.5px] text-ach-navy/55">
                  Level {scoreToLevel(meanBaseline).level} · {scoreToLevel(meanBaseline).label}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/50 mb-1">Mean exit score</div>
                <div className="text-[28px] font-serif text-ach-navy">{meanExit.toFixed(2)}</div>
                <div className="text-[11.5px] text-ach-navy/55">
                  Level {scoreToLevel(meanExit).level} · {scoreToLevel(meanExit).label}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/50 mb-1">Uplift</div>
                <div className={`text-[28px] font-serif ${uplift >= 0 ? 'text-ach-navy' : 'text-red-700'}`}>
                  {uplift >= 0 ? '+' : ''}{uplift.toFixed(2)}
                </div>
                <div className="text-[11.5px] text-ach-navy/55">
                  {relativeGainPct(meanBaseline, meanExit) >= 0 ? '+' : ''}
                  {relativeGainPct(meanBaseline, meanExit)}% on baseline
                </div>
              </div>
            </div>
            {meanBaseline > 0 && meanExit > 0 && (
              <div className="mt-4 text-[12.5px] text-ach-navy/80 leading-relaxed italic">
                {upliftNarrative(meanBaseline, meanExit)}
              </div>
            )}
            {baselineAssessments.length === 0 && (
              <div className="mt-4 text-[12px] text-ach-navy/60 italic">
                No baseline assessments in this cohort yet. Uplift will populate once baseline assessments are recorded.
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-ach-border/60 text-[11px] text-ach-navy/60 leading-relaxed">
              <span className="font-medium">What this is measuring.</span> Capability change is an <em>outcome proxy</em> — stronger evidence than activity output (which we tracked in section 1), weaker than fully-triangulated impact (captured in the 12-month impact report). It shows how much candidates changed across the HIM domains over the programme window.
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Featured quotes */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">3 · Voices from the cohort</h2>
        {quotes.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-[13px] text-ach-navy/60 italic">
                No featured quotes tagged for this cohort yet. Assessors can flag responses as feature-worthy during assessments, or curate quotes from the featured-quotes page.
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {quotes.map(q => (
              <div key={q.id} className="border-l-2 border-ach-navy/40 pl-4 py-1">
                <div className="text-[14px] text-ach-navy font-serif italic leading-relaxed">
                  “{q.quote_text}”
                </div>
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

      {/* 4. Themes flagged during assessments */}
      {featureWorthy.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">4 · Feature-worthy responses tagged during assessment</h2>
          <div className="space-y-2">
            {featureWorthy.slice(0, 6).map(r => (
              <Card key={r.id}>
                <CardContent className="pt-4 pb-3">
                  {r.candidate_voice && (
                    <div className="text-[13px] text-ach-navy font-serif italic mb-1">“{r.candidate_voice}”</div>
                  )}
                  {r.narrative && (
                    <div className="text-[12.5px] text-ach-navy/75">{r.narrative}</div>
                  )}
                  <div className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/45 mt-1.5">
                    Indicator {r.indicator_id}
                  </div>
                </CardContent>
              </Card>
            ))}
            {featureWorthy.length > 6 && (
              <div className="text-[12px] text-ach-navy/60 italic">
                And {featureWorthy.length - 6} more flagged responses (curate via the featured-quotes page).
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. Methodology footer */}
      <section className="mt-10 pt-6 border-t border-ach-border text-[11.5px] text-ach-navy/60 leading-relaxed">
        <div className="font-medium text-ach-navy/75 mb-1">Methodology note</div>
        <p>
          Scores are the mean of numeric indicator responses (0–5 scale) captured by assessors at each timepoint. Uplift is
          computed as (mean exit) minus (mean baseline) at cohort level. This report reflects the state of HIM at generation
          time; the “Snapshot for funder” button below stores an immutable copy under methodology version v1.0.
        </p>
        <p className="mt-2">
          A separate 12-month impact report becomes available a year after programme end, capturing retention, progression,
          and follow-up capability change.
        </p>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{label}</div>
        <div className="text-[26px] font-serif text-ach-navy">{value}</div>
      </CardContent>
    </Card>
  );
}
