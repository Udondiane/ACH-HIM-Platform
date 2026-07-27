import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: 'Candidate case study' };

const TIMEPOINT_LABELS: Record<string, string> = {
  baseline: 'Baseline',
  mid_3mo: 'End of programme',
  exit_6mo: '6 months',
  followup_12mo: '12 months',
};

export default async function CaseStudyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, candidate_ref, given_name, family_name, preferred_name, status, career_goal_summary, country_of_origin, arrival_year, progression_type, progression_notes')
    .eq('id', params.id)
    .maybeSingle();
  if (!candidate) notFound();
  const cand = candidate as any;

  const [consentRes, assessmentsRes, responsesRes, placementsRes, quotesRes, trainingRes] = await Promise.all([
    supabase.from('candidate_consent').select('may_be_named, may_be_quoted, may_appear_in_case_study, given_at').eq('candidate_id', params.id).order('given_at', { ascending: false }).limit(1),
    supabase.from('assessments').select('id, timepoint, status, assessed_on, cohort_id').eq('candidate_id', params.id).order('assessed_on', { ascending: true }),
    supabase.from('assessment_responses').select('id, assessment_id, indicator_id, numeric_value, narrative, candidate_voice, feature_worthy').limit(1000),
    supabase.from('placements').select('id, start_date, end_date, role_title, partners(id, name)').eq('candidate_id', params.id).order('start_date', { ascending: false }),
    supabase.from('featured_quotes').select('id, quote_text, context, speaker_type, use_anonymised, display_name, source_type, tagged_at').eq('candidate_id', params.id).is('archived_at', null).order('tagged_at', { ascending: false }),
    supabase.from('training_enrolments').select('id, status, programme:programme_id(name, category)').eq('candidate_id', params.id).limit(50).then(r => r).catch(() => ({ data: [] })),
  ]);

  const consent = ((consentRes.data as any[])?.[0] ?? {}) as any;
  const consentGiven = !!(consent.may_appear_in_case_study);
  const assessments = (assessmentsRes.data as any[]) ?? [];
  const responses = (responsesRes.data as any[]) ?? [];
  const placements = (placementsRes.data as any[]) ?? [];
  const quotes = (quotesRes.data as any[]) ?? [];
  const training = ((trainingRes as any).data as any[]) ?? [];

  // Identity handling: anonymised name if by-name consent not granted
  const useName = !!consent.may_be_named;
  const displayName = useName
    ? (cand.preferred_name || cand.given_name || cand.candidate_ref)
    : `${cand.candidate_ref} (anonymised)`;

  const candAssessmentIds = new Set(assessments.map(a => a.id));
  const candResponses = responses.filter(r => candAssessmentIds.has(r.assessment_id));

  const scoreByTimepoint = new Map<string, number>();
  for (const tp of ['baseline', 'mid_3mo', 'exit_6mo', 'followup_12mo']) {
    const assessmentsAtTp = assessments.filter(a => a.timepoint === tp);
    if (!assessmentsAtTp.length) continue;
    const asIds = new Set(assessmentsAtTp.map(a => a.id));
    const vals = candResponses
      .filter(r => asIds.has(r.assessment_id) && typeof r.numeric_value === 'number')
      .map(r => Number(r.numeric_value));
    if (vals.length) {
      scoreByTimepoint.set(tp, vals.reduce((s, x) => s + x, 0) / vals.length);
    }
  }

  const featureWorthyResponses = candResponses.filter(r => r.feature_worthy && (r.narrative || r.candidate_voice));

  return (
    <div className="max-w-4xl mx-auto pb-16 print:max-w-none">
      <div className="print:hidden mb-4">
        <Link href={`/candidates/${params.id}`} className="inline-flex items-center gap-1.5 text-[12px] text-ach-navy/70 hover:text-ach-navy">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to candidate
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8 border-b border-ach-border pb-6">
        <div className="text-[11px] uppercase tracking-[1.4px] text-ach-navy/55 mb-1">Candidate case study</div>
        <h1 className="text-[26px] font-serif font-semibold text-ach-navy leading-tight">
          {displayName}
        </h1>
        <div className="mt-2 text-[13px] text-ach-navy/70">
          Prepared from HIM as at {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          {' · '}Methodology version v1.0
        </div>
      </div>

      {/* Consent gate */}
      {!consentGiven && (
        <Card className="mb-6 border-amber-300 bg-amber-50/60">
          <CardContent className="pt-4 pb-4">
            <div className="text-[13px] text-ach-navy">
              <span className="font-medium">Case-study consent not recorded.</span> This candidate has not granted permission to appear in a case study.
              Nothing on this page should be shared externally without recording that consent on the candidate profile first.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="print:hidden mb-6">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-[8px] border border-ach-border text-ach-navy hover:bg-ach-page"
        >
          <Printer className="h-3.5 w-3.5" /> Print or save as PDF
        </button>
      </div>

      {/* Background */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">Background</h2>
        <Card>
          <CardContent className="pt-6 space-y-3 text-[13px] text-ach-navy leading-relaxed">
            {cand.country_of_origin && (
              <div><span className="text-ach-navy/60">Country of origin:</span> {cand.country_of_origin}
                {cand.arrival_year ? ` · Arrived in UK ${cand.arrival_year}` : ''}
              </div>
            )}
            {cand.career_goal_summary && (
              <div><span className="text-ach-navy/60">Career goal:</span> {cand.career_goal_summary}</div>
            )}
            {training.length > 0 && (
              <div>
                <span className="text-ach-navy/60">Training taken:</span>
                <ul className="list-disc list-inside mt-1 text-[12.5px]">
                  {training.slice(0, 8).map(t => (
                    <li key={t.id}>{t.programme?.name}{t.status === 'completed' ? ' · completed' : ''}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Journey through capability change */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">Journey through the programme</h2>
        {scoreByTimepoint.size === 0 ? (
          <Card><CardContent className="pt-6"><div className="text-[13px] text-ach-navy/60 italic">No assessment data captured yet.</div></CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-4 gap-4">
                {['baseline', 'mid_3mo', 'exit_6mo', 'followup_12mo'].map(tp => {
                  const v = scoreByTimepoint.get(tp);
                  return (
                    <div key={tp}>
                      <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/50 mb-1">{TIMEPOINT_LABELS[tp]}</div>
                      {v !== undefined ? (
                        <div className="text-[26px] font-serif text-ach-navy">{v.toFixed(2)}</div>
                      ) : (
                        <div className="text-[15px] text-ach-navy/40 italic mt-2">not yet</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-[11.5px] text-ach-navy/55 mt-3">Mean indicator score across HIM's 7 domains, 0–5 scale.</div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Placement */}
      {placements.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">Placement outcome</h2>
          <Card>
            <CardContent className="pt-6">
              {placements.slice(0, 1).map(p => (
                <div key={p.id} className="text-[13px] text-ach-navy leading-relaxed">
                  {p.role_title && <div className="font-medium">{p.role_title}</div>}
                  {p.partners?.name && <div className="text-ach-navy/70">{p.partners.name}</div>}
                  <div className="text-[11.5px] text-ach-navy/55 mt-1">
                    From {p.start_date ?? 'not recorded'}{p.end_date ? ` to ${p.end_date}` : ' (ongoing)'}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Featured quotes */}
      <section className="mb-8">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">In their own words</h2>
        {quotes.length === 0 && featureWorthyResponses.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-[13px] text-ach-navy/60 italic">
                No featured quotes tagged for this candidate yet.
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
            {featureWorthyResponses.slice(0, 3).map(r => (
              <div key={r.id} className="border-l-2 border-ach-navy/30 pl-4 py-1">
                {r.candidate_voice && (
                  <div className="text-[13.5px] text-ach-navy font-serif italic leading-relaxed">“{r.candidate_voice}”</div>
                )}
                {r.narrative && (
                  <div className="text-[12.5px] text-ach-navy/75 mt-1">{r.narrative}</div>
                )}
                <div className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/45 mt-1.5">
                  Flagged during assessment · indicator {r.indicator_id}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Progression */}
      {cand.progression_type && (
        <section className="mb-8">
          <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">Progression</h2>
          <Card>
            <CardContent className="pt-6 text-[13px] text-ach-navy leading-relaxed">
              <div><span className="text-ach-navy/60">Type:</span> {cand.progression_type}</div>
              {cand.progression_notes && <div className="mt-2">{cand.progression_notes}</div>}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Methodology footer */}
      <section className="mt-10 pt-6 border-t border-ach-border text-[11.5px] text-ach-navy/60 leading-relaxed">
        <div className="font-medium text-ach-navy/75 mb-1">Methodology note</div>
        <p>
          Data pulled live from HIM. Featured quotes appear only when the candidate has granted quoting consent; by-name
          appearance appears only when named consent is granted. Case-study consent must be recorded before this document is
          shared externally. Methodology version v1.0.
        </p>
      </section>
    </div>
  );
}
