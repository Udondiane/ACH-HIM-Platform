import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectForm } from '@/components/projects/project-form';
import { createProjectAction } from '@/lib/projects/actions';

export default async function NewProjectPage() {
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
