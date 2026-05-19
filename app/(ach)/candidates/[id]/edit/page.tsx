import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CandidateForm } from '@/components/candidates/candidate-form';
import { updateCandidateAction, withdrawCandidateAction, type ActionResult } from '@/lib/candidates/actions';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export default async function EditCandidatePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: candidate } = await supabase
    .from('candidates').select('*').eq('id', params.id).maybeSingle();
  if (!candidate) notFound();
  const c = candidate as any;

  const action = async (prev: ActionResult | null, fd: FormData) => updateCandidateAction(params.id, prev, fd);
  const handleWithdraw = async () => { 'use server'; await withdrawCandidateAction(params.id); };

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
          <form action={handleWithdraw}>
            <Button variant="danger" type="submit">
              <Trash2 className="h-3.5 w-3.5" />Mark withdrawn
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
