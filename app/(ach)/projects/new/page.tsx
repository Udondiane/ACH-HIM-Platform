import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectForm } from '@/components/projects/project-form';
import { createProjectAction } from '@/lib/projects/actions';

export default function NewProjectPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref="/projects"
        backLabel="Projects"
        miniLabel="Network"
        title="New project"
        description="A project is the intervention design. Once created, you'll pick which capability domains are Core, Optional, or Excluded - then run cohorts under this project and assess each candidate against the same design."
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
