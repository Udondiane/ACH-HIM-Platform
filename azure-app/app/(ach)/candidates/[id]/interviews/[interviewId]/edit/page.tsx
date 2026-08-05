import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { InterviewForm } from '@/components/interviews/interview-form';
import { updateInterviewAction, type InterviewResult } from '@/lib/interviews/actions';

export default async function EditInterviewPage({ params }: { params: { id: string; interviewId: string } }) {
  const supabase = createClient();
  const [candidateRes, interviewRes] = await Promise.all([
    supabase.from('candidates').select('id, candidate_ref').eq('id', params.id).maybeSingle(),
    supabase.from('candidate_interviews').select('*').eq('id', params.interviewId).maybeSingle(),
  ]);
  if (!candidateRes.data || !interviewRes.data) notFound();
  const c = candidateRes.data as any;
  const i = interviewRes.data as any;

  const action = async (prev: InterviewResult | null, fd: FormData) => updateInterviewAction(params.interviewId, prev, fd);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref={`/candidates/${params.id}/interviews`}
        backLabel="Interviews"
        miniLabel={c.candidate_ref}
        title="Edit interview"
      />
      <Card>
        <CardContent className="pt-6">
          <InterviewForm
            action={action}
            candidateId={params.id}
            cohortId={i.cohort_id}
            partnerId={i.partner_id}
            initial={i}
            cancelHref={`/candidates/${params.id}/interviews`}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
