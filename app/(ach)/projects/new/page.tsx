import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectForm } from '@/components/projects/project-form';
import { createProjectAction } from '@/lib/projects/actions';
import { createClient } from '@/lib/supabase/server';

export default async function NewProjectPage() {
  const supabase = createClient();
  const { data: programmes } = await supabase
    .from('training_programmes')
    .select('id, name, code, category')
    .eq('status', 'active')
    .order('name');

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref="/projects"
        backLabel="Projects"
        miniLabel="Network"
        title="New project"
        description="A project is an intervention design. Cohorts of candidates run under a project."
      />
      <Card>
        <CardContent className="pt-6">
          <ProjectForm
            action={createProjectAction}
            cancelHref="/projects"
            submitLabel="Create project"
            availableTrainingProgrammes={(programmes as any[]) ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
