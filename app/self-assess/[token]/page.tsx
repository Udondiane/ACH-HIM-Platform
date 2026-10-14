import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { markTokenOpenedAction } from '@/lib/self-assessment/actions';
import { SelfAssessmentForm } from '@/components/self-assessment/self-assessment-form';
import { SELF_ASSESSMENT_TIMEPOINT_LABELS } from '@/lib/self-assessment/schema';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'HIM Platform — Self-Assessment',
  description: 'A short check-in from your ACH caseworker. Takes about 10 minutes.',
  openGraph: {
    title: 'HIM Platform — Self-Assessment',
    description: 'A short check-in from your ACH caseworker. Takes about 10 minutes.',
    type: 'website',
    siteName: 'HIM Platform',
  },
  twitter: {
    card: 'summary',
    title: 'HIM Platform — Self-Assessment',
    description: 'A short check-in from your ACH caseworker. Takes about 10 minutes.',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SelfAssessmentPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from('self_assessment_tokens')
    .select('id, candidate_id, project_id, timepoint, expires_at, completed_at, revoked_at, candidates(given_name), projects(name)')
    .eq('token', params.token)
    .maybeSingle();

  if (!tokenRow) notFound();
  const t = tokenRow as any;

  if (t.revoked_at)                        return <TokenState state="revoked" />;
  if (new Date(t.expires_at) < new Date()) return <TokenState state="expired" />;
  if (t.completed_at)                      return <TokenState state="completed" />;

  // Mark opened (first click)
  await markTokenOpenedAction(params.token);

  // Pull the project's capability selection and the factors / indicators for scoring
  const [capsRes, factorDomainsRes, factorsRes, indicatorsRes] = await Promise.all([
    supabase.from('project_capabilities').select('domain, role, selected_factors').eq('project_id', t.project_id),
    supabase.from('factor_domains').select('factor_id, domain_id'),
    supabase.from('factors').select('id, name, measurement_question'),
    supabase.from('indicators').select('id, factor_id'),
  ]);

  const caps = (capsRes.data as any[]) ?? [];
  const factorDomains = (factorDomainsRes.data as any[]) ?? [];
  const factors = (factorsRes.data as any[]) ?? [];

  // Determine the factors this project wants scored.
  const factorIdSet = new Set<string>();
  for (const cap of caps) {
    if (Array.isArray(cap.selected_factors) && cap.selected_factors.length > 0) {
      for (const fid of cap.selected_factors) factorIdSet.add(fid);
    } else {
      for (const fd of factorDomains) {
        if (fd.domain_id === cap.domain) factorIdSet.add(fd.factor_id);
      }
    }
  }

  const factorList = factors
    .filter(f => factorIdSet.has(f.id))
    .map(f => ({
      id: f.id,
      name: f.name,
      measurement_question: f.measurement_question,
    }));

  return (
    <div className="min-h-screen bg-ach-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[1.5px] text-ach-navy/60">
            {t.projects?.name ?? 'HIM Programme'} · {SELF_ASSESSMENT_TIMEPOINT_LABELS[t.timepoint as keyof typeof SELF_ASSESSMENT_TIMEPOINT_LABELS] ?? t.timepoint}
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-medium text-ach-navy mt-2 leading-tight">
            {t.candidates?.given_name ? `Hi ${t.candidates.given_name},` : 'Hi,'} how have things been?
          </h1>
          <p className="text-[13.5px] text-ach-navy/75 mt-2 leading-relaxed">
            This short form helps us understand where you are in your journey. There are no right or wrong answers — just share where you feel you are today. It takes about 10 minutes.
          </p>
        </div>

        <SelfAssessmentForm
          token={params.token}
          factors={factorList}
        />

        <p className="mt-6 text-[11.5px] text-ach-navy/50 text-center">
          Your responses are saved to your HIM record and reviewed by your ACH caseworker.
        </p>
      </div>
    </div>
  );
}

function TokenState({ state }: { state: 'revoked' | 'expired' | 'completed' }) {
  const message = {
    revoked:   'This link has been revoked. Please contact your ACH caseworker for a new one.',
    expired:   'This link has expired. Please contact your ACH caseworker for a new one.',
    completed: 'This self-assessment has already been submitted. Thank you.',
  }[state];

  return (
    <div className="min-h-screen bg-ach-page flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-[22px] font-medium text-ach-navy mb-3">Thank you</h1>
        <p className="text-[14px] text-ach-navy/75">{message}</p>
      </div>
    </div>
  );
}
