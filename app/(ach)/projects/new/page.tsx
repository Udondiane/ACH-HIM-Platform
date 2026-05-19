import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectForm } from '@/components/projects/project-form';
import { createProjectAction } from '@/lib/projects/actions';
import { createClient } from '@/lib/supabase/server';

export default async function NewProjectPage() {
  const supabase = createClient();
  const { data: cohorts } = await supabase
    .from('cohorts').select('id, cohort_ref, name').neq('status', 'cancelled').order('cohort_ref');

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref="/projects"
        backLabel="Projects"
        miniLabel="Network"
        title="New project"
        description="Once created, you'll pick which capability domains are Core, Optional, or Excluded — then run assessments to calculate the HIM score."
      />
      <Card>
        <CardContent className="pt-6">
          <ProjectForm
            action={createProjectAction}
            cohorts={(cohorts as any[]) ?? []}
            cancelHref="/projects"
            submitLabel="Create project"
          />
        </CardContent>
      </Card>
    </div>
  );
}
