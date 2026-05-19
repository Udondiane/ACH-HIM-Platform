import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectForm } from '@/components/projects/project-form';
import { updateProjectAction, type ActionResult } from '@/lib/projects/actions';

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: project }, { data: cohorts }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('cohorts').select('id, cohort_ref, name').neq('status', 'cancelled').order('cohort_ref'),
  ]);
  if (!project) notFound();
  const p = project as any;

  const action = async (prev: ActionResult | null, fd: FormData) => updateProjectAction(params.id, prev, fd);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref={`/projects/${params.id}`}
        backLabel={p.project_ref}
        miniLabel="Network"
        title="Edit project"
      />
      <Card>
        <CardContent className="pt-6">
          <ProjectForm
            action={action}
            initial={p}
            cohorts={(cohorts as any[]) ?? []}
            cancelHref={`/projects/${params.id}`}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
