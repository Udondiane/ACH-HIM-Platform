import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { SelfAssessmentForm } from '@/components/self-assessment/self-assessment-form';
import { closingReflectionPrompt, type ReflectionTimepoint } from '@/lib/assessments/closing-reflection-prompts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'ACH — Share your reflection' };

/**
 * Public token-scoped page. Beneficiary opens the link from WhatsApp,
 * SMS, or email — no login required. Shows one contextual question
 * derived from the project's activities + timepoint, captures the
 * answer typed or voice, submits back into HIM as the closing
 * reflection on the appropriate assessment row.
 */
export default async function SelfAssessPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from('self_assessment_tokens')
    .select(`
      id, candidate_id, project_id, timepoint, used_at, expires_at,
      candidates(given_name, preferred_locale),
      projects(name, project_ref)
    `)
    .eq('token', params.token)
    .maybeSingle();

  if (!tokenRow) notFound();
  const t = tokenRow as any;

  const now = new Date();
  if (t.used_at) return <StateCard title="This link has already been used" body="Thank you for sharing your reflection with ACH. If you meant to submit a new answer, please ask your ACH contact for a fresh link." tone="info" />;
  if (new Date(t.expires_at) < now) return <StateCard title="This link has expired" body="For your security, links expire after 14 days. Please ask your ACH contact for a new link and try again." tone="warn" />;

  // Fetch the project's activities so the closing-reflection prompt
  // has the same contextual anchor the in-app assessor sees.
  const { data: activitiesRes } = await supabase
    .from('project_activities').select('activity').eq('project_id', t.project_id);
  const activityIds = ((activitiesRes as { activity: string }[] | null) ?? []).map(a => a.activity);
  const { prompt, context } = closingReflectionPrompt(t.timepoint as ReflectionTimepoint, activityIds);

  const givenName = (t.candidates?.given_name as string | undefined) ?? '';
  const projectName = (t.projects?.name as string | undefined) ?? 'the ACH programme';
  const preferredLocale = (t.candidates?.preferred_locale as string | undefined) ?? null;

  return (
    <div className="min-h-screen bg-ach-page flex flex-col">
      <header className="px-5 py-4 border-b-[0.5px] border-ach-border bg-white">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="text-[15px] font-medium text-ach-navy">ACH</div>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-mono">Reflection</div>
        </div>
      </header>

      <main className="flex-1 px-5 py-6">
        <div className="max-w-md mx-auto">
          <div className="mb-5">
            {givenName && (
              <p className="text-[15px] text-ach-navy/70 mb-2">
                Hi {givenName} 👋
              </p>
            )}
            <p className="text-[14px] text-ach-navy/75 leading-relaxed">
              ACH would love to hear how <strong>{projectName}</strong> has been for you. Your answer helps us understand what&apos;s working and improve support for others.
            </p>
          </div>

          <SelfAssessmentForm
            token={params.token}
            prompt={prompt}
            activityContext={context}
            candidateLanguage={preferredLocale}
          />

          <div className="mt-6 pt-5 border-t-[0.5px] border-ach-border text-[11.5px] text-ach-navy/55 space-y-2">
            <p><strong>Your privacy:</strong> what you share here is stored securely and only seen by ACH staff. If you have granted quoting consent to ACH, your words may be featured (anonymised or by name per your consent) in impact reports for funders.</p>
            <p><strong>This link is for you only.</strong> It works once and expires after 14 days.</p>
          </div>
        </div>
      </main>
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
