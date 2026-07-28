import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IndicatorScorer } from '@/components/assessments/indicator-scorer';
import { FactorResponseField } from '@/components/assessments/factor-response-field';
import { QuoteMarker } from '@/components/featured-quotes/quote-marker';
import { HimScoreCard } from '@/components/assessments/him-score-card';
import { TranscriptModal } from '@/components/assessments/transcript-modal';
import { AttachmentUploader } from '@/components/assessments/attachment-uploader';
import { CandidateIdentity } from '@/components/ui/candidate-identity';
import { getTranslations } from 'next-intl/server';
import { completeAssessmentAction } from '@/lib/assessments/actions';
import { calculateHim } from '@/lib/scoring/him';
import type { DomainId, IndicatorResponse, ProjectCapability } from '@/lib/scoring/types';

const TIMEPOINT_LABELS: Record<string, string> = {
  baseline: 'Baseline', mid_3mo: '3 months', exit_6mo: '6 months', followup_12mo: '12 months',
};

const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  education:  'Education & Skills',
  social:     'Social Participation',
  housing:    'Housing',
  health:     'Health & Wellbeing',
  belonging:  'Belonging & Identity',
  rights:     'Rights & Citizenship',
};

export default async function AssessmentRunnerPage({
  params,
}: { params: { id: string; assessmentId: string } }) {
  const supabase = createClient();

  // Load everything in parallel
  const [project, assessment, capabilities, framework, responses, attachments] = await Promise.all([
    supabase.from('projects').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('assessments').select('*, candidates(candidate_ref, given_name, preferred_locale)').eq('id', params.assessmentId).maybeSingle(),
    supabase.from('project_capabilities').select('domain, role, selected_factors').eq('project_id', params.id),
    Promise.all([
      supabase.from('factors').select('id, name, conversion_factor_type, is_universal, measurement_method, measurement_question, behavioural_prompt, score_guides'),
      supabase.from('factor_domains').select('factor_id, domain_id'),
      supabase.from('indicators').select('id, factor_id, name, sort_order').order('sort_order'),
    ]),
    supabase.from('assessment_responses').select('id, indicator_id, numeric_value, narrative, observable_changes, practices, candidate_voice, feature_worthy').eq('assessment_id', params.assessmentId),
    supabase.from('assessment_attachments').select('id, file_name, mime_type, size_bytes, uploaded_at').eq('assessment_id', params.assessmentId).order('uploaded_at', { ascending: false }),
  ]);

  if (!project.data || !assessment.data) notFound();

  // Audio recording consent lives on candidate_consent.may_ai_analyse_transcript
  // (latest row wins). Older records were on candidates.consent_audio_recording
  // — migration 042 backfills, so this single read is authoritative.
  const candidateId = (assessment.data as any).candidate_id;
  const [factorResponsesRes, audioConsentRes] = await Promise.all([
    supabase
      .from('assessment_factor_responses')
      .select('factor_id, response_text, captured_via, spoken_language, audio_attachment_id')
      .eq('assessment_id', params.assessmentId),
    candidateId
      ? supabase
          .from('candidate_consent')
          .select('may_ai_analyse_transcript')
          .eq('candidate_id', candidateId)
          .order('given_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const factorResponsesMap = new Map<string, { response_text: string | null; captured_via: 'typed' | 'voice' | 'voice_edited'; spoken_language: string | null; audio_attachment_id: string | null }>();
  for (const fr of (factorResponsesRes.data as any[]) ?? []) {
    factorResponsesMap.set(fr.factor_id, {
      response_text: fr.response_text,
      captured_via: fr.captured_via,
      spoken_language: fr.spoken_language,
      audio_attachment_id: fr.audio_attachment_id,
    });
  }
  const consentToRecord = !!(audioConsentRes.data as { may_ai_analyse_transcript?: boolean } | null)?.may_ai_analyse_transcript;
  const p = project.data as any;
  const a = assessment.data as any;
  // Demo mode: project-level lock and assessment 'reviewed' lock are both
  // disabled so every textarea stays editable during the training session.
  const isLocked = false;

  const caps = ((capabilities.data as any[]) ?? []) as { domain: DomainId; role: 'core'|'optional'; selected_factors: string[] | null }[];
  // selected_factors: empty/null = use ALL factors in that domain (default);
  // populated = restrict to the chosen subset.
  const selectedFactorsByDomain = new Map<DomainId, Set<string> | null>();
  for (const c of caps) {
    const sel = c.selected_factors ?? [];
    selectedFactorsByDomain.set(c.domain, sel.length === 0 ? null : new Set(sel));
  }
  const [factorsRes, factorDomainsRes, indicatorsRes] = framework;
  const factors = (factorsRes.data as any[]) ?? [];
  const factorDomains = (factorDomainsRes.data as any[]) ?? [];
  const indicators = (indicatorsRes.data as any[]) ?? [];
  const frameworkError = factorsRes.error ?? factorDomainsRes.error ?? indicatorsRes.error;
  const frameworkEmpty = !frameworkError && factors.length === 0;
  const respMap = new Map<string, {
    id: string;
    numeric_value: number | null;
    narrative: string | null;
    observable_changes: string | null;
    practices: string | null;
    candidate_voice: string | null;
    feature_worthy: boolean;
  }>();
  for (const r of (responses.data as any[]) ?? []) {
    respMap.set(r.indicator_id, {
      id: r.id,
      numeric_value: r.numeric_value,
      narrative: r.narrative,
      observable_changes: r.observable_changes,
      practices: r.practices,
      candidate_voice: r.candidate_voice ?? null,
      feature_worthy: !!r.feature_worthy,
    });
  }

  // Group factors by domain for the project's Core + Optional selection,
  // filtered by per-domain selected_factors (empty = all).
  //
  // Factor selection rule:
  //   1. If the project has any project_activities ticked, factors are
  //      derived from the activity_factors mapping. Each activity activates
  //      a curated set of factors; their union is the assessment set.
  //   2. If no activities are ticked (legacy projects), fall back to the
  //      per-domain selected_factors override (if set), and otherwise the
  //      previous "first 3 Core / 2 Supporting" cap so the runner still
  //      renders.
  const coreRoleByDomain = new Map<DomainId, 'core' | 'optional'>();
  for (const c of caps) coreRoleByDomain.set(c.domain, c.role);
  const FACTORS_PER_CORE_DOMAIN_FALLBACK = 3;
  const FACTORS_PER_OPTIONAL_DOMAIN_FALLBACK = 2;

  // Pull this project's activities + the activity→factor mapping. The runner
  // does this here rather than in the parallel framework fetch above to keep
  // the diff small.
  const [projectActivitiesRes, activityFactorsRes] = await Promise.all([
    supabase.from('project_activities').select('activity').eq('project_id', params.id),
    supabase.from('activity_factors').select('activity, factor_id'),
  ]);
  const projectActivities = ((projectActivitiesRes.data as { activity: string }[] | null) ?? []).map(r => r.activity);
  const activityFactorsAll = (activityFactorsRes.data as { activity: string; factor_id: string }[] | null) ?? [];
  const activatedFactorIds = projectActivities.length === 0
    ? null
    : new Set(activityFactorsAll.filter(af => projectActivities.includes(af.activity)).map(af => af.factor_id));

  const factorsById = new Map(factors.map(f => [f.id, f]));
  const domainFactors: Record<DomainId, any[]> = {} as Record<DomainId, any[]>;
  for (const fd of factorDomains) {
    const dom = fd.domain_id as DomainId;
    const selectedSet = selectedFactorsByDomain.get(dom);
    if (selectedSet && !selectedSet.has(fd.factor_id)) continue;
    if (activatedFactorIds && !activatedFactorIds.has(fd.factor_id)) continue;
    if (!domainFactors[dom]) domainFactors[dom] = [];
    const f = factorsById.get(fd.factor_id);
    if (f) domainFactors[dom].push(f);
  }

  // Apply the legacy fallback cap only if no activity-driven set was applied.
  if (!activatedFactorIds) {
    for (const dom of Object.keys(domainFactors) as DomainId[]) {
      const role = coreRoleByDomain.get(dom);
      const cap = role === 'core' ? FACTORS_PER_CORE_DOMAIN_FALLBACK : FACTORS_PER_OPTIONAL_DOMAIN_FALLBACK;
      domainFactors[dom] = domainFactors[dom].slice(0, cap);
    }
  }

  // Factors that are not meaningful at baseline because the candidate hasn't
  // started the intervention they refer to. Auto-score these at 0 and hide
  // them from the assessor UI so the question doesn't confuse anyone.
  // - emp_e_norm (Workplace Norms & Inclusion): only meaningful once in a workplace.
  const BASELINE_HIDDEN_FACTORS = new Set<string>(['emp_e_norm']);
  if (a.timepoint === 'baseline') {
    for (const factorId of BASELINE_HIDDEN_FACTORS) {
      const facIndicators = indicators.filter(i => i.factor_id === factorId);
      if (facIndicators.length === 0) continue;
      const primaryInd = facIndicators[0];
      if (!respMap.has(primaryInd.id)) {
        const { data: inserted } = await supabase.from('assessment_responses').insert({
          assessment_id: params.assessmentId,
          indicator_id: primaryInd.id,
          numeric_value: 0,
          narrative: 'Auto-scored 0 at baseline — pre-placement, factor not yet meaningful.',
        } as never).select('id').single();
        respMap.set(primaryInd.id, {
          id: (inserted as any)?.id ?? '',
          numeric_value: 0,
          narrative: 'Auto-scored 0 at baseline — pre-placement, factor not yet meaningful.',
          observable_changes: null,
          practices: null,
          candidate_voice: null,
          feature_worthy: false,
        });
      }
    }
    // Hide from the rendered set
    for (const dom of Object.keys(domainFactors) as DomainId[]) {
      domainFactors[dom] = domainFactors[dom].filter(f => !BASELINE_HIDDEN_FACTORS.has(f.id));
    }
  }

  // Build IndicatorResponse[] for the live HIM calculation
  const scoringResponses: IndicatorResponse[] = [];
  for (const cap of caps) {
    const factorsForDomain = domainFactors[cap.domain] ?? [];
    for (const fac of factorsForDomain) {
      if (!fac) continue;
      const inds = indicators.filter(i => i.factor_id === fac.id);
      for (const ind of inds) {
        const r = respMap.get(ind.id);
        if (!r) continue;
        // All factor-domain rows for this universal factor share the response
        const domsForFactor = factorDomains
          .filter(fdo => fdo.factor_id === fac.id)
          .map(fdo => fdo.domain_id as DomainId);
        scoringResponses.push({
          indicatorId: ind.id,
          factorId: fac.id,
          domainIds: fac.is_universal ? domsForFactor : [cap.domain],
          conversionFactorType: fac.conversion_factor_type,
          isUniversal: !!fac.is_universal,
          measurementMethod: fac.measurement_method,
          numericValue: r.numeric_value,
          narrative: r.narrative,
        });
      }
    }
  }

  const projectCapabilities: ProjectCapability[] = caps.map(c => ({
    domain: c.domain, role: c.role, selectedFactors: [],
  }));

  // Compute HIM live
  const hasAnyResponses = scoringResponses.some(r => r.numericValue !== null);
  const him = hasAnyResponses ? calculateHim({
    projectType: p.type,
    weightRatio: p.weight_ratio,
    hybridOption: p.hybrid_option ?? undefined,
    optionalScheme: p.optional_scheme,
    capabilities: projectCapabilities,
    responses: scoringResponses,
  }) : null;

  // Bind the complete action
  async function handleComplete() {
    'use server';
    await completeAssessmentAction(params.assessmentId, params.id);
  }

  // Translated assessment strings (Tier B locales render translations
  // where supplied, fall back to English for missing keys via deepMerge)
  const t = await getTranslations('assessment');
  const tDomain = (id: string) => {
    try { return t(`domains.${id}` as never); } catch { return DOMAIN_LABELS[id] ?? id; }
  };
  const tFactor = (id: string, fallback: string) => {
    try { return t(`factors.${id}` as never); } catch { return fallback; }
  };
  const tPrompt = (id: string, fallback: string | null | undefined) => {
    if (!fallback) return null;
    try { return t(`prompts.${id}` as never); } catch { return fallback; }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref={`/projects/${params.id}`}
        backLabel={p.project_ref}
        miniLabel={a.candidates ? <CandidateIdentity candidate={a.candidates} showRef /> : ''}
        title={`Assessment · ${TIMEPOINT_LABELS[a.timepoint] ?? a.timepoint}`}
        description={`Score each indicator from 0 to 5 (or Yes/No for binary factors). The HIM score on the right updates live as you fill in responses.`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/framework" target="_blank" className="text-[11.5px] text-ach-navy/55 hover:text-ach-navy underline underline-offset-2 mr-1">
              Framework reference
            </Link>
            {a.status !== 'completed' && !isLocked && (
              <TranscriptModal
                assessmentId={a.id}
                indicatorLabels={Object.fromEntries(indicators.map((i: any) => [i.id, i.name]))}
              />
            )}
            {a.status !== 'completed' ? (
              <form action={handleComplete}>
                <Button type="submit"><CheckCircle2 className="h-4 w-4" />Mark complete</Button>
              </form>
            ) : <Badge>Completed</Badge>}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {frameworkError || frameworkEmpty ? (
            <Card>
              <CardContent className="pt-6 space-y-2">
                <p className="text-[13px] font-medium text-[#8B3A4F]">
                  Capability framework not available.
                </p>
                <p className="text-[12.5px] text-ach-navy/70">
                  {frameworkError
                    ? `Database error: ${frameworkError.message ?? 'unknown'}. This usually means a pending migration has not been applied yet.`
                    : 'The factors table is empty. Run migration 029_him_reference_taxonomy.sql in Supabase SQL editor to install the HIM verbatim reference framework, then refresh this page.'}
                </p>
              </CardContent>
            </Card>
          ) : caps.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-[13px] text-ach-navy/70">
                  This project has no Core or Optional capabilities selected yet. Go back to the project
                  page and configure capability selection before running an assessment.
                </p>
              </CardContent>
            </Card>
          ) : caps.map(cap => {
            const rawFactorsForDomain = domainFactors[cap.domain] ?? [];
            // Belt-and-braces: keep baseline-hidden factors out of the render
            // path no matter what (covers any upstream shape change).
            const factorsForDomain = a.timepoint === 'baseline'
              ? rawFactorsForDomain.filter(f => f && !BASELINE_HIDDEN_FACTORS.has(f.id))
              : rawFactorsForDomain;
            const allIndicators = factorsForDomain.flatMap(f =>
              f ? indicators.filter(i => i.factor_id === f.id).map(i => ({ ...i, factor: f })) : []
            );

            if (allIndicators.length === 0) return null;

            return (
              <Card key={cap.domain}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
                        {cap.role}
                      </div>
                      <div className="text-[15px] font-medium text-ach-navy mt-0.5">
                        {tDomain(cap.domain)}
                      </div>
                    </div>
                    <div className="text-[11.5px] text-ach-navy/60">
                      {allIndicators.length} indicators
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Group by factor */}
                  {factorsForDomain.map(fac => {
                    if (!fac) return null;
                    const inds = indicators.filter(i => i.factor_id === fac.id);
                    if (inds.length === 0) return null;
                    // Only score against the first indicator per factor — the
                    // others were the indicator-bullet rows the user doesn't
                    // want surfaced. Score holder collapses to one per factor.
                    const primaryInd = inds[0];
                    return (
                      <div key={fac.id} className="mb-5 last:mb-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-[12.5px] font-medium text-ach-navy">{tFactor(fac.id, fac.name)}</div>
                          <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50">
                            {fac.conversion_factor_type}
                          </span>
                        </div>
                        {fac.measurement_question && (
                          <div className="text-[14px] italic text-ach-navy mb-2 leading-snug">
                            {fac.measurement_question}
                          </div>
                        )}
                        {inds.length > 0 && !fac.score_guides && (
                          <div className="mb-3 rounded-[8px] border-[0.5px] border-ach-border bg-ach-page/40 px-3 py-2">
                            <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">
                              What the assessor is listening for
                            </div>
                            <ul className="space-y-1 text-[12.5px] text-ach-navy/80 list-disc pl-5">
                              {inds.map(i => (
                                <li key={i.id}>{i.name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {fac.score_guides && typeof fac.score_guides === 'object' && (
                          <div className="mb-3 rounded-[8px] border-[0.5px] border-ach-border bg-[#FBF2E0]/60 px-3 py-2">
                            <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/70 mb-1.5">
                              Scoring anchors (1–5)
                            </div>
                            <div className="grid grid-cols-1 gap-y-1 text-[12px] text-ach-navy/85">
                              {['1', '2', '3', '4', '5'].map(k => {
                                const desc = (fac.score_guides as Record<string, string>)[k];
                                if (!desc) return null;
                                return (
                                  <div key={k} className="flex gap-2">
                                    <span className="font-semibold text-ach-navy w-4 shrink-0">{k}</span>
                                    <span>{desc}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <FactorResponseField
                          assessmentId={params.assessmentId}
                          factorId={fac.id}
                          factorName={tFactor(fac.id, fac.name)}
                          initial={factorResponsesMap.get(fac.id) ?? null}
                          candidateLanguage={a.candidates?.preferred_locale ?? null}
                          consentToRecord={consentToRecord}
                          locked={isLocked}
                        />
                        {primaryInd && (() => {
                          const r = respMap.get(primaryInd.id);
                          return (
                            <>
                              <IndicatorScorer
                                assessmentId={params.assessmentId}
                                indicator={{
                                  id: primaryInd.id,
                                  name: '',
                                  factor_id: fac.id,
                                  measurement_method: fac.measurement_method,
                                }}
                                initialValue={r?.numeric_value ?? null}
                                initialNarrative={r?.narrative ?? null}
                                initialObservableChanges={r?.observable_changes ?? null}
                                initialPractices={r?.practices ?? null}
                                locked={isLocked}
                                timepoint={a.timepoint as 'baseline' | 'mid_3mo' | 'exit_6mo' | 'followup_12mo'}
                              />
                              {r?.id && !isLocked && (
                                <QuoteMarker
                                  responseId={r.id as string}
                                  candidateId={a.candidate_id}
                                  cohortId={a.cohort_id ?? null}
                                  initialCandidateVoice={r.candidate_voice ?? null}
                                  initialFeatureWorthy={!!r.feature_worthy}
                                />
                              )}
                            </>
                          );
                        })()}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <AttachmentUploader
                assessmentId={params.assessmentId}
                initialAttachments={(attachments.data as any[]) ?? []}
                locked={false}
              />
            </CardContent>
          </Card>

          {him ? (
            <HimScoreCard result={him} />
          ) : (
            <Card>
              <CardHeader>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">HIM result</div>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-ach-navy/60">
                  Score at least one indicator to see the HIM calculation here.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">About this assessment</div>
            </CardHeader>
            <CardContent className="text-[12.5px] text-ach-navy/70 space-y-2.5">
              <p>
                Responses save automatically as you score. Narratives save when you click out
                of the field. There&apos;s no &quot;save&quot; button to remember.
              </p>
              <p>
                Each factor shows a measurement question (anchoring the score) and, where the
                methodology specifies one, a behavioural prompt — read this verbatim to the
                candidate to elicit the evidence you&apos;re scoring against.
              </p>
              {a.timepoint === 'baseline' ? (
                <p>
                  At baseline each indicator captures the <span className="font-medium">starting context</span> —
                  what is happening now, before the programme begins, and why this score anchors the level. This is the
                  reference point every later assessment measures change against.
                </p>
              ) : (
                <p>
                  At follow-up timepoints the narrative fields capture <span className="font-medium">observable changes</span>
                  {' '}and <span className="font-medium">practices that have shifted</span> — measured against the baseline notes
                  recorded earlier.
                </p>
              )}
              <p>
                Mark the assessment <span className="font-medium">complete</span> when finished. You can
                still edit responses afterwards.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <Link href={`/projects/${params.id}`}>
          <Button variant="ghost">← Back to project</Button>
        </Link>
      </div>
    </div>
  );
}
