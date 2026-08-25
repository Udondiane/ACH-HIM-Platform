import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { SelfAssessmentForm } from '@/components/self-assessment/self-assessment-form';
import {
  SelfAssessmentFactorForm,
  type SelfAssessmentFactor,
} from '@/components/self-assessment/self-assessment-factor-form';
import { closingReflectionPrompt, type ReflectionTimepoint } from '@/lib/assessments/closing-reflection-prompts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'ACH — Your check-in' };

const TIMEPOINT_LABEL: Record<string, string> = {
  baseline: 'Starting',
  mid_3mo: '3 month',
  exit_6mo: '6 month',
  followup_12mo: '12 month',
};

// Domain labels — kept here rather than fetched from the DB because the
// set is small, fixed, and this page must render fast on a phone.
const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  education:  'Education & Skills',
  social:     'Social participation',
  housing:    'Housing',
  health:     'Health & wellbeing',
  belonging:  'Belonging & identity',
  rights:     'Rights & citizenship',
};

// Short beneficiary-facing anchors for the 1 and 5 endpoints on the
// Likert. Deliberately generic — the specific measurement wording lives
// on the factor's measurement_question field.
const LIKERT_LOW  = 'Not at all';
const LIKERT_HIGH = 'A great deal';

/**
 * Public token-scoped page. Beneficiary opens the link from WhatsApp,
 * SMS, or email — no login required.
 *
 *   - Baseline timepoint: single-question reflection (unchanged from
 *     migration 067). Staff usually captures the HIM assessment in
 *     person for baseline; this closer is the beneficiary's own words.
 *   - 3mo / 6mo / 12mo: full HIM factor scoring (1–5 Likert per
 *     assigned factor) followed by a closing reflection. This IS the
 *     re-assessment for the timepoint — captured through the same
 *     tokenised link (migration 068).
 */
export default async function SelfAssessPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from('self_assessment_tokens')
    .select(`
      id, candidate_id, project_id, timepoint, used_at, opened_at, expires_at,
      candidates(given_name, preferred_locale),
      projects(name, project_ref)
    `)
    .eq('token', params.token)
    .maybeSingle();

  if (!tokenRow) notFound();
  const t = tokenRow as any;

  const now = new Date();
  if (t.used_at) return <StateCard title="This link has already been used" body="Thank you for sharing with ACH. If you meant to submit a new answer, please ask your ACH contact for a fresh link." tone="info" />;
  if (new Date(t.expires_at) < now) return <StateCard title="This link has expired" body="For your security, links expire after 14 days. Please ask your ACH contact for a new link and try again." tone="warn" />;

  // Fire-and-forget: stamp opened_at on first open. Never blocks render.
  if (!t.opened_at) {
    supabase.from('self_assessment_tokens')
      .update({ opened_at: new Date().toISOString() } as never)
      .eq('id', t.id)
      .then(() => undefined, () => undefined);
  }

  const timepoint = t.timepoint as ReflectionTimepoint;
  const givenName = (t.candidates?.given_name as string | undefined) ?? '';
  const projectName = (t.projects?.name as string | undefined) ?? 'the ACH programme';
  const preferredLocale = (t.candidates?.preferred_locale as string | undefined) ?? null;

  // Project activities + activity→factor mapping — same shape as the
  // staff-side runner uses, so the beneficiary sees exactly the factors
  // ACH has scoped for their project.
  const [activitiesRes, activityFactorsRes, capabilitiesRes, factorsRes, factorDomainsRes, indicatorsRes] =
    await Promise.all([
      supabase.from('project_activities').select('activity').eq('project_id', t.project_id),
      supabase.from('activity_factors').select('activity, factor_id'),
      supabase.from('project_capabilities').select('domain, role, selected_factors').eq('project_id', t.project_id),
      supabase.from('factors').select('id, name, measurement_question'),
      supabase.from('factor_domains').select('factor_id, domain_id'),
      supabase.from('indicators').select('id, factor_id, name, sort_order').order('sort_order'),
    ]);

  const activityIds = ((activitiesRes.data as { activity: string }[] | null) ?? []).map(a => a.activity);
  const { prompt, context } = closingReflectionPrompt(timepoint, activityIds);

  // ── Baseline → reflection-only flow ─────────────────
  if (timepoint === 'baseline') {
    return (
      <PageShell givenName={givenName} projectName={projectName} timepointLabel="Starting">
        <SelfAssessmentForm
          token={params.token}
          prompt={prompt}
          activityContext={context}
          candidateLanguage={preferredLocale}
        />
        <PrivacyNote />
      </PageShell>
    );
  }

  // ── 3mo / 6mo / 12mo → factor scoring + reflection ─
  const selectedFactorsByDomain = new Map<string, Set<string> | null>();
  for (const c of ((capabilitiesRes.data as any[]) ?? []) as { domain: string; role: string; selected_factors: string[] | null }[]) {
    const sel = c.selected_factors ?? [];
    selectedFactorsByDomain.set(c.domain, sel.length === 0 ? null : new Set(sel));
  }

  const activityFactors = (activityFactorsRes.data as { activity: string; factor_id: string }[] | null) ?? [];
  const activityDerivedIds = activityIds.length === 0
    ? new Set<string>()
    : new Set(activityFactors.filter(af => activityIds.includes(af.activity)).map(af => af.factor_id));
  const activatedFactorIds = activityDerivedIds.size > 0 ? activityDerivedIds : null;

  const factorsById = new Map(((factorsRes.data as any[]) ?? []).map((f: any) => [f.id as string, f]));
  const factorDomains = (factorDomainsRes.data as { factor_id: string; domain_id: string }[] | null) ?? [];
  const indicators = ((indicatorsRes.data as any[]) ?? []) as { id: string; factor_id: string; name: string; sort_order: number | null }[];

  // For each (factor, domain) selected on the project, pick ONE indicator
  // per factor to score against — self-assessment uses one 1–5 rating per
  // factor rather than the multi-indicator staff flow. Sort_order ensures
  // we consistently pick the same anchor indicator.
  const indicatorByFactor = new Map<string, { id: string; name: string }>();
  for (const ind of indicators) {
    if (!indicatorByFactor.has(ind.factor_id)) indicatorByFactor.set(ind.factor_id, { id: ind.id, name: ind.name });
  }

  const factorsForForm: SelfAssessmentFactor[] = [];
  const seen = new Set<string>();
  for (const fd of factorDomains) {
    const selectedSet = selectedFactorsByDomain.get(fd.domain_id);
    if (selectedSet && !selectedSet.has(fd.factor_id)) continue;
    if (activatedFactorIds && !activatedFactorIds.has(fd.factor_id)) continue;
    if (seen.has(fd.factor_id)) continue;   // one row per factor even if it maps to multiple domains
    seen.add(fd.factor_id);

    const f = factorsById.get(fd.factor_id);
    const ind = indicatorByFactor.get(fd.factor_id);
    if (!f || !ind) continue;

    factorsForForm.push({
      indicatorId: ind.id,
      factorName: f.name as string,
      domainId: fd.domain_id,
      domainLabel: DOMAIN_LABELS[fd.domain_id] ?? fd.domain_id,
      question: (f.measurement_question as string | null) ?? f.name as string,
      low: LIKERT_LOW,
      high: LIKERT_HIGH,
    });
  }

  // Empty-factors fallback — should not happen for a properly configured
  // project, but if it does we don't want to trap the beneficiary. Fall
  // back to the reflection-only form so they can still respond.
  if (factorsForForm.length === 0) {
    return (
      <PageShell givenName={givenName} projectName={projectName} timepointLabel={TIMEPOINT_LABEL[timepoint] ?? 'Check-in'}>
        <SelfAssessmentForm
          token={params.token}
          prompt={prompt}
          activityContext={context}
          candidateLanguage={preferredLocale}
        />
        <PrivacyNote />
      </PageShell>
    );
  }

  const timepointLabel = TIMEPOINT_LABEL[timepoint] ?? 'Check-in';

  return (
    <PageShell givenName={givenName} projectName={projectName} timepointLabel={timepointLabel}>
      <SelfAssessmentFactorForm
        token={params.token}
        reflectionPrompt={prompt}
        activityContext={context}
        candidateLanguage={preferredLocale}
        factors={factorsForForm}
        timepointLabel={timepointLabel}
      />
      <PrivacyNote />
    </PageShell>
  );
}

// ── shared shell ────────────────────────────────────────
function PageShell({
  givenName, projectName, timepointLabel, children,
}: { givenName: string; projectName: string; timepointLabel: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ach-page flex flex-col">
      <header className="px-5 py-4 border-b-[0.5px] border-ach-border bg-white">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="text-[15px] font-medium text-ach-navy">ACH</div>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-mono">
            {timepointLabel} check-in
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 py-6">
        <div className="max-w-md mx-auto">
          <div className="mb-5">
            {givenName && (
              <p className="text-[15px] text-ach-navy/70 mb-2">Hi {givenName} 👋</p>
            )}
            <p className="text-[14px] text-ach-navy/75 leading-relaxed">
              ACH would love to hear how <strong>{projectName}</strong> has been for you. Your answers help us understand what&apos;s working and improve support for others.
            </p>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="mt-6 pt-5 border-t-[0.5px] border-ach-border text-[11.5px] text-ach-navy/55 space-y-2">
      <p><strong>Your privacy:</strong> what you share here is stored securely and only seen by ACH staff. If you have granted quoting consent to ACH, your words may be featured (anonymised or by name per your consent) in impact reports for funders.</p>
      <p><strong>This link is for you only.</strong> It works once and expires after 14 days.</p>
    </div>
  );
}

function StateCard({ title, body, tone }: { title: string; body: string; tone: 'info' | 'warn' }) {
  return (
    <div className="min-h-screen bg-ach-page flex items-center justify-center px-5 py-6">
      <div className="max-w-md w-full rounded-[12px] border-[0.5px] border-ach-border bg-white p-6">
        <div className={`text-[10.5px] uppercase tracking-[1.2px] mb-2 font-mono ${tone === 'warn' ? 'text-[#8B3A4F]' : 'text-ach-navy/55'}`}>
          {tone === 'warn' ? 'Notice' : 'Information'}
        </div>
        <h1 className="text-[18px] font-medium text-ach-navy mb-3">{title}</h1>
        <p className="text-[13.5px] text-ach-navy/75 leading-relaxed">{body}</p>
        <div className="mt-5 pt-4 border-t-[0.5px] border-ach-border text-[11.5px] text-ach-navy/55">
          ACH · Ashley Community Housing · Bristol
        </div>
      </div>
    </div>
  );
}
