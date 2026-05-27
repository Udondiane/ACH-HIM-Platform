import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CohortForm } from '@/components/cohorts/cohort-form';
import { createCohortAction } from '@/lib/cohorts/actions';
import { createClient } from '@/lib/supabase/server';

export default async function NewCohortPage() {
  const supabase = createClient();
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, project_ref')
    .order('name');

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref="/cohorts"
        backLabel="Cohorts"
        miniLabel="Network"
        title="New cohort"
        description="Once the cohort is created, you'll be able to link partners (sponsorships, engagement fees) and candidates from the cohort's detail page."
      />
      <Card>
        <CardContent className="pt-6">
          <CohortForm
            action={createCohortAction}
            cancelHref="/cohorts"
            submitLabel="Create cohort"
            projects={(projects as any[]) ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
