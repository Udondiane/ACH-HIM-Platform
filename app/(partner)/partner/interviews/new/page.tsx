import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { InterviewForm } from '@/components/interviews/interview-form';
import { createInterviewAction } from '@/lib/interviews/actions';

export default async function NewPartnerInterviewPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);
  if (!partner) notFound();

  const candidateId = typeof searchParams?.candidate === 'string' ? searchParams.candidate : null;
  const cohortId = typeof searchParams?.cohort === 'string' ? searchParams.cohort : undefined;
  if (!candidateId) notFound();

  const supabase = createClient();
  const { data: candidate } = await supabase
    .from('candidates').select('id, candidate_ref, given_name, country_of_origin').eq('id', candidateId).maybeSingle();
  if (!candidate) notFound();
  const c = candidate as any;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref="/partner/interviews"
        backLabel="Interviews"
        miniLabel={c.candidate_ref}
        title="Record interview feedback"
        description={`Candidate: ${c.candidate_ref}${c.country_of_origin ? ` · ${c.country_of_origin}` : ''}`}
      />
      <Card>
        <CardContent className="pt-6">
          <InterviewForm
            action={createInterviewAction}
            candidateId={candidateId}
            cohortId={cohortId}
            partnerId={partner.id}
            partnerSide
            cancelHref="/partner/interviews"
            submitLabel="Save interview feedback"
          />
        </CardContent>
      </Card>
    </div>
  );
}
