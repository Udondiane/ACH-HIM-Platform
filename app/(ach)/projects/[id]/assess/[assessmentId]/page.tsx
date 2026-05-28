import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IndicatorScorer } from '@/components/assessments/indicator-scorer';
import { HimScoreCard } from '@/components/assessments/him-score-card';
import { TranscriptModal } from '@/components/assessments/transcript-modal';
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
  const [project, assessment, capabilities, framework, responses] = await Promise.all([
    supabase.from('projects').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('assessments').select('*, candidates(candidate_ref, given_name)').eq('id', params.assessmentId).maybeSingle(),
    supabase.from('project_capabilities').select('domain, role').eq('project_id', params.id),
    Promise.all([
      supabase.from('factors').select('id, name, conversion_factor_type, is_universal, measurement_method, measurement_question'),
      supabase.from('factor_domains').select('factor_id, domain_id'),
      supabase.from('indicators').select('id, factor_id, name, sort_order').order('sort_order'),
    ]),
    supabase.from('assessment_responses').select('indicator_id, numeric_value, narrative, observable_changes, practices').eq('assessment_id', params.assessmentId),
  ]);

  if (!project.data || !assessment.data) notFound();
  const p = project.data as any;
  const a = assessment.data as any;
  const isLocked = !!p.is_locked || a.status === 'reviewed';

  const caps = ((capabilities.data as any[]) ?? []) as { domain: DomainId; role: 'core'|'optional' }[];
  const [factorsRes, factorDomainsRes, indicatorsRes] = framework;
  const factors = (factorsRes.data as any[]) ?? [];
  const factorDomains = (factorDomainsRes.data as any[]) ?? [];
  const indicators = (indicatorsRes.data as any[]) ?? [];
  const respMap = new Map<string, { numeric_value: number | null; narrative: string | null; observable_changes: string | null; practices: string | null }>();
  for (const r of (responses.data as any[]) ?? []) {
    respMap.set(r.indicator_id, {
      numeric_value: r.numeric_value,
      narrative: r.narrative,
      observable_changes: r.observable_changes,
      practices: r.practices,
    });
  }

  // Group factors by domain for the project's Core + Optional selection
  const factorsById = new Map(factors.map(f => [f.id, f]));
  const domainFactors: Record<DomainId, any[]> = {} as Record<DomainId, any[]>;
  for (const fd of factorDomains) {
    const dom = fd.domain_id as DomainId;
    if (!domainFactors[dom]) domainFactors[dom] = [];
    domainFactors[dom].push(factorsById.get(fd.factor_id));
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
  const tMeasurement = (id: string, fallback: string) => {
    try { return t(`measurements.${id}` as never); } catch { return fallback; }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref={`/projects/${params.id}`}
        backLabel={p.project_ref}
        miniLabel={`${a.candidates?.candidate_ref} · ${a.candidates?.given_name}`}
        title={`Assessment · ${TIMEPOINT_LABELS[a.timepoint] ?? a.timepoint}`}
        description={`Score each indicator from 0 to 5 (or Yes/No for binary factors). The HIM score on the right updates live as you fill in responses.`}
        actions={
          <div className="flex items-center gap-2">
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
          {caps.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-[13px] text-ach-navy/70">
                  This project has no Core or Optional capabilities selected yet. Go back to the project
                  page and configure capability selection before running an assessment.
                </p>
              </CardContent>
            </Card>
          ) : caps.map(cap => {
            const factorsForDomain = domainFactors[cap.domain] ?? [];
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
                    return (
                      <div key={fac.id} className="mb-5 last:mb-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-[12.5px] font-medium text-ach-navy">{tFactor(fac.id, fac.name)}</div>
                          {fac.is_universal && (
                            <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50">Universal</span>
                          )}
                          <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50">
                            {fac.conversion_factor_type}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-ach-navy/65 mb-2 italic">
                          {tMeasurement(fac.id, fac.measurement_question ?? '')}
                        </div>
                        <div className="space-y-1">
                          {inds.map(ind => {
                            const r = respMap.get(ind.id);
                            return (
                              <IndicatorScorer
                                key={ind.id}
                                assessmentId={params.assessmentId}
                                indicator={{
                                  id: ind.id,
                                  name: ind.name,
                                  factor_id: fac.id,
                                  measurement_method: fac.measurement_method,
                                }}
                                initialValue={r?.numeric_value ?? null}
                                initialNarrative={r?.narrative ?? null}
                                initialObservableChanges={r?.observable_changes ?? null}
                                initialPractices={r?.practices ?? null}
                                locked={isLocked}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
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
                Universal factors (digital literacy, self-efficacy, English fluency) are scored
                once and propagated to every domain they apply to.
              </p>
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
