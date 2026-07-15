import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CandidateForm } from '@/components/candidates/candidate-form';
import { updateCandidateAction } from '@/lib/candidates/actions';
import { WithdrawForm } from '@/components/candidates/withdraw-form';

export default async function EditCandidatePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: candidate } = await supabase
    .from('candidates').select('*').eq('id', params.id).maybeSingle();
  if (!candidate) notFound();
  const c = candidate as any;

  const action = updateCandidateAction.bind(null, params.id);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref={`/candidates/${params.id}`}
        backLabel={c.candidate_ref}
        miniLabel="Network"
        title="Edit candidate"
      />
      <Card>
        <CardContent className="pt-6">
          <CandidateForm
            action={action}
            initial={c}
            cancelHref={`/candidates/${params.id}`}
            submitLabel="Save changes"
            refLocked
          />
        </CardContent>
      </Card>

      <Card className="mt-5 border-ach-rose/30">
        <CardContent className="pt-6">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Danger zone</div>
          <p className="text-[13px] text-ach-navy/80 mb-3">
            Marking a candidate as withdrawn preserves their record for reporting. Use Edit → Status if they
            simply moved on (placed, progressed, completed).
          </p>
          <WithdrawForm candidateId={params.id} />
        </CardContent>
      </Card>
    </div>
  );
}
