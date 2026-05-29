import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { InterviewForm } from '@/components/interviews/interview-form';
import { updateInterviewAction, type InterviewResult } from '@/lib/interviews/actions';

export default async function EditPartnerInterviewPage({
  params,
  searchParams,
}: {
  params: { interviewId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);
  if (!partner) notFound();

  const supabase = createClient();
  const { data: interview } = await supabase
    .from('candidate_interviews')
    .select('*, candidates(candidate_ref, country_of_origin)')
    .eq('id', params.interviewId)
    .maybeSingle();
  if (!interview) notFound();
  const i = interview as any;
  if (i.partner_id !== partner.id) notFound();

  const action = async (prev: InterviewResult | null, fd: FormData) =>
    updateInterviewAction(params.interviewId, prev, fd);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref="/partner/interviews"
        backLabel="Interviews"
        miniLabel={i.candidates?.candidate_ref}
        title="Edit interview feedback"
      />
      <Card>
        <CardContent className="pt-6">
          <InterviewForm
            action={action}
            candidateId={i.candidate_id}
            cohortId={i.cohort_id}
            partnerId={partner.id}
            partnerSide
            initial={i}
            cancelHref="/partner/interviews"
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
