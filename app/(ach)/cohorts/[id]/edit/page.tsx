import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CohortForm } from '@/components/cohorts/cohort-form';
import { updateCohortAction, cancelCohortAction, type ActionResult } from '@/lib/cohorts/actions';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export default async function EditCohortPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: cohort }, { data: projects }] = await Promise.all([
    supabase.from('cohorts').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('projects').select('id, name, project_ref').order('name'),
  ]);
  if (!cohort) notFound();
  const c = cohort as any;

  const action = async (prev: ActionResult | null, fd: FormData) => updateCohortAction(params.id, prev, fd);
  const handleCancel = async () => { 'use server'; await cancelCohortAction(params.id); };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref={`/cohorts/${params.id}`}
        backLabel={c.cohort_ref}
        miniLabel="Network"
        title="Edit cohort"
      />
      <Card>
        <CardContent className="pt-6">
          <CohortForm
            action={action}
            initial={c}
            cancelHref={`/cohorts/${params.id}`}
            submitLabel="Save changes"
            projects={(projects as any[]) ?? []}
          />
        </CardContent>
      </Card>

      <Card className="mt-5 border-ach-rose/30">
        <CardContent className="pt-6">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Danger zone</div>
          <p className="text-[13px] text-ach-navy/80 mb-3">
            Cancelling a cohort sets its status to <span className="font-medium">cancelled</span>. Existing
            enrolments and partner engagements are preserved for reporting.
          </p>
          <form action={handleCancel}>
            <Button variant="danger" type="submit">
              <Trash2 className="h-3.5 w-3.5" />Cancel cohort
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
