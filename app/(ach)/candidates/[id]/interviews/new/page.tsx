import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { InterviewForm } from '@/components/interviews/interview-form';
import { createInterviewAction } from '@/lib/interviews/actions';

export default async function NewInterviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: candidate } = await supabase
    .from('candidates').select('id, candidate_ref, given_name').eq('id', params.id).maybeSingle();
  if (!candidate) notFound();
  const c = candidate as any;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref={`/candidates/${params.id}/interviews`}
        backLabel="Interviews"
        miniLabel={c.candidate_ref}
        title="Record an interview"
      />
      <Card>
        <CardContent className="pt-6">
          <InterviewForm
            action={createInterviewAction}
            candidateId={params.id}
            cancelHref={`/candidates/${params.id}/interviews`}
            submitLabel="Save interview"
          />
        </CardContent>
      </Card>
    </div>
  );
}
