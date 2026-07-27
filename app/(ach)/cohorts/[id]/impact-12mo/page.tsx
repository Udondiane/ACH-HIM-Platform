import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { SnapshotButton } from '@/components/cohort-reports/snapshot-button';

export const metadata = { title: '12-month impact report' };

export default async function ImpactReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: cohort } = await supabase.from('cohorts').select('*').eq('id', params.id).maybeSingle();
  if (!cohort) notFound();
  const c = cohort as any;

  const [candidatesRes, assessmentsRes, responsesRes, placementsRes, retentionRes, quotesRes, priorReports, partnersRes] = await Promise.all([
    supabase.from('cohort_candidates').select('candidate_id, candidates(id, candidate_ref, given_name, family_name, status)').eq('cohort_id', params.id),
    supabase.from('assessments').select('id, candidate_id, timepoint, status, assessed_on').eq('cohort_id', params.id),
    supabase.from('assessment_responses').select('id, assessment_id, indicator_id, numeric_value, narrative, candidate_voice, feature_worthy').limit(2000),
    supabase.from('placements').select('id, candidate_id, start_date, end_date').order('start_date', { ascending: false }),
    supabase.from('placement_retention_checks').select('placement_id, timepoint, still_employed, progression_notes, checked_at').limit(1000).then(r => r).catch(() => ({ data: [] })),
    supabase.from('featured_quotes').select('id, quote_text, context, speaker_type, use_anonymised, display_name, candidate_id, source_type').eq('cohort_id', params.id).is('archived_at', null),
    supabase.from('cohort_reports').select('id, report_type, status, generated_at, issued_at').eq('cohort_id', params.id).eq('report_type', 'impact_12mo').order('generated_at', { ascending: false }).limit(3),
    supabase.from('cohort_partners').select('id, partners(id, name)').eq('cohort_id', params.id),
  ]);

  const candidates = ((candidatesRes.data as any[]) ?? []).map(cc => cc.candidates).filter(Boolean);
  const assessments = (assessmentsRes.data as any[]) ?? [];
  const responses = (responsesRes.data as any[]) ?? [];
  const placements = (placementsRes.data as any[]) ?? [];
  const retention = ((retentionRes as any).data as any[]) ?? [];
  const quotes = (quotesRes.data as any[]) ?? [];
  const prior = (priorReports.data as any[]) ?? [];
  const partners = ((partnersRes.data as any[]) ?? []).map(p => p.partners).filter(Boolean);

  const cohortAssessmentIds = new Set(assessments.map(a => a.id));
  const cohortResponses = responses.filter(r => cohortAssessmentIds.has(r.assessment_id));

  // Placements linked to cohort candidates
  const enrolledIds = new Set(candidates.map(c => c.id));
  const cohortPlacements = placements.filter(p => enrolledIds.has(p.candidate_id));
  const placementIds = new Set(cohortPlacements.map(p => p.id));
  const cohortRetention = retention.filter(r => placementIds.has(r.placement_id));

  const retention6mo = cohortRetention.filter(r => r.timepoint === '6mo');
  const retention12mo = cohortRetention.filter(r => r.timepoint === '12mo');
  const employedAt6 = retention6mo.filter(r => r.still_employed === true).length;
  const employedAt12 = retention12mo.filter(r => r.still_employed === true).length;

  const rate = (num: number, denom: number) => denom ? Math.round(num * 100 / denom) : 0;

  // Longitudinal capability change: baseline vs followup_12mo
  const responsesByAssessment = new Map<string, any[]>();
  for (const r of cohortResponses) {
    const list = responsesByAssessment.get(r.assessment_id) ?? [];
    list.push(r);
    responsesByAssessment.set(r.assessment_id, list);
  }
  const scoreFor = (timepoint: string) => {
    const vals: number[] = [];
    for (const a of assessments.filter(a => a.timepoint === timepoint)) {
      for (const r of (responsesByAssessment.get(a.id) ?? [])) {
        if (typeof r.numeric_value === 'number') vals.push(Number(r.numeric_value));
      }
    }
    return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
  };
  const meanBaseline = scoreFor('baseline');
  const meanExit = scoreFor('mid_3mo');
  const meanFollowup = scoreFor('followup_12mo');
  const sustainedChange = meanFollowup - meanBaseline;
  const decay = meanFollowup - meanExit;

  // Progression narratives from retention checks
  const progressionNarratives = cohortRetention
    .filter(r => r.progression_notes && r.progression_notes.trim().length > 0)
    .map(r => r.progression_notes as string);

  const snapshot = {
    generated_at: new Date().toISOString(),
    cohort: { id: c.id, name: c.name, status: c.status },
    partners: partners.map(p => ({ id: p.id, name: p.name })),
    retention: {
      placements: cohortPlacements.length,
      retained_at_6mo: employedAt6,
      retention_rate_6mo_pct: rate(employedAt6, cohortPlacements.length),
      retained_at_12mo: employedAt12,
      retention_rate_12mo_pct: rate(employedAt12, cohortPlacements.length),
    },
    capability: {
      mean_baseline: Number(meanBaseline.toFixed(2)),
      mean_exit: Number(meanExit.toFixed(2)),
      mean_followup_12mo: Number(meanFollowup.toFixed(2)),
      sustained_change: Number(sustainedChange.toFixed(2)),
      decay_since_exit: Number(decay.toFixed(2)),
    },
    progression_narratives: progressionNarratives.slice(0, 20),
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

      {/* Header */}
      <div className="mb-8 border-b border-ach-border pb-6">
        <div className="text-[11px] uppercase tracking-[1.4px] text-ach-navy/55 mb-1">12-month impact report</div>
        <h1 className="text-[26px] font-serif font-semibold text-ach-navy leading-tight">
          {c.name ?? 'Cohort'}
        </h1>
        <div className="mt-2 text-[13px] text-ach-navy/70">
          Follow-up as at {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          {' · '}Methodology version v1.0
        </div>
        {partners.length > 0 && (
          <div className="mt-2 text-[12.5px] text-ach-navy/60">
            Partners: {partners.map(p => p.name).join(', ')}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="print:hidden flex items-center gap-2 mb-6">
        <SnapshotButton cohortId={c.id} snapshot={snapshot} reportType="impact_12mo" />
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-[8px] border border-ach-border text-ach-navy hover:bg-ach-page"
        >
          <Printer className="h-3.5 w-3.5" /> Print or save as PDF
        </button>
        {prior.length > 0 && (
          <span className="text-[12px] text-ach-navy/60 ml-auto">
            {prior.filter(p => p.status === 'issued').length} issued · {prior.filter(p => p.status === 'draft').length} draft on file
          </span>
        )}
      </div>

      {/* 1. Retention */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">1 · Retention</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/50 mb-1">Placements made</div>
                <div className="text-[28px] font-serif text-ach-navy">{cohortPlacements.length}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/50 mb-1">Retained at 6 months</div>
                <div className="text-[28px] font-serif text-ach-navy">
                  {employedAt6}
                  <span className="text-[15px] text-ach-navy/60 ml-1.5">/ {rate(employedAt6, cohortPlacements.length)}%</span>
                </div>
                <div className="text-[11.5px] text-ach-navy/55">confirmed by partner check</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/50 mb-1">Retained at 12 months</div>
                <div className="text-[28px] font-serif text-ach-navy">
                  {employedAt12}
                  <span className="text-[15px] text-ach-navy/60 ml-1.5">/ {rate(employedAt12, cohortPlacements.length)}%</span>
                </div>
                <div className="text-[11.5px] text-ach-navy/55">confirmed by partner check</div>
              </div>
            </div>
            {cohortPlacements.length === 0 && (
              <div className="mt-4 text-[12px] text-ach-navy/60 italic">
                No placements recorded for this cohort yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 2. Longitudinal capability */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">2 · Did the capability change hold?</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-4 gap-4">
              <ScorePill label="Baseline" value={meanBaseline} />
              <ScorePill label="Exit" value={meanExit} />
              <ScorePill label="12 months" value={meanFollowup} />
              <div>
                <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/50 mb-1">Sustained change</div>
                <div className={`text-[26px] font-serif ${sustainedChange >= 0 ? 'text-ach-navy' : 'text-red-700'}`}>
                  {sustainedChange >= 0 ? '+' : ''}{sustainedChange.toFixed(2)}
                </div>
                <div className="text-[11px] text-ach-navy/55">
                  {decay >= 0
                    ? `Improved by ${decay.toFixed(2)} since exit`
                    : `Decayed by ${Math.abs(decay).toFixed(2)} since exit`}
                </div>
              </div>
            </div>
            {assessments.filter(a => a.timepoint === 'followup_12mo').length === 0 && (
              <div className="mt-4 text-[12px] text-ach-navy/60 italic">
                No 12-month follow-up assessments recorded yet. Longitudinal comparison will populate once follow-ups are completed.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 3. Progression narratives */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">3 · Progression narratives (partner-verified)</h2>
        {progressionNarratives.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-[13px] text-ach-navy/60 italic">
                No progression narratives captured yet. Partners submit these via their tokenised 12-month retention form.
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {progressionNarratives.slice(0, 8).map((n, i) => (
              <div key={i} className="border-l-2 border-ach-navy/40 pl-4 py-1">
                <div className="text-[13px] text-ach-navy leading-relaxed">{n}</div>
                <div className="text-[11px] text-ach-navy/50 mt-1.5">from partner 12-month check</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Featured voices */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">4 · Voices from the cohort</h2>
        {quotes.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-[13px] text-ach-navy/60 italic">
                No featured quotes tagged. Curate from the featured-quotes page.
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {quotes.map(q => (
              <div key={q.id} className="border-l-2 border-ach-navy/40 pl-4 py-1">
                <div className="text-[14px] text-ach-navy font-serif italic leading-relaxed">“{q.quote_text}”</div>
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

      {/* Methodology footer */}
      <section className="mt-10 pt-6 border-t border-ach-border text-[11.5px] text-ach-navy/60 leading-relaxed">
        <div className="font-medium text-ach-navy/75 mb-1">Methodology note</div>
        <p>
          Retention counts are drawn from partner-verified 6-month and 12-month retention checks submitted via the tokenised
          partner portal. Longitudinal capability change compares mean baseline and 12-month follow-up assessment scores at
          cohort level. Progression narratives are partner-authored at the 12-month check.
        </p>
        <p className="mt-2">
          This report is paired with the earlier close-out report to give a complete picture of the cohort from programme
          entry to one year post-exit. Snapshot to store this report as immutable evidence for the funder.
        </p>
      </section>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/50 mb-1">{label}</div>
      <div className="text-[26px] font-serif text-ach-navy">{value.toFixed(2)}</div>
      <div className="text-[11px] text-ach-navy/55">mean indicator score, 0–5</div>
    </div>
  );
}
