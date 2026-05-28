import { notFound } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectForm } from '@/components/projects/project-form';
import { updateProjectAction, deleteProjectAction, type ActionResult } from '@/lib/projects/actions';

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: project } = await supabase
    .from('projects').select('*').eq('id', params.id).maybeSingle();
  if (!project) notFound();
  const p = project as any;

  const [cohortCountRes, assessmentCountRes] = await Promise.all([
    supabase.from('cohorts').select('id', { count: 'exact', head: true }).eq('project_id', params.id),
    supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('project_id', params.id),
  ]);
  const cohortCount = cohortCountRes.count ?? 0;
  const assessmentCount = assessmentCountRes.count ?? 0;

  const action = async (prev: ActionResult | null, fd: FormData) => updateProjectAction(params.id, prev, fd);
  const handleDelete = async () => { 'use server'; await deleteProjectAction(params.id); };

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
            cancelHref={`/projects/${params.id}`}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>

      <Card className="mt-5 border-ach-rose/30">
        <CardContent className="pt-6">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Danger zone</div>
          <p className="text-[13px] text-ach-navy/80 mb-3">
            Permanently delete this project. Its capability mix is removed. Any linked cohorts
            ({cohortCount}) and assessments ({assessmentCount}) are preserved but unlinked from
            the project.
          </p>
          <form action={handleDelete}>
            <Button variant="danger" type="submit">
              <Trash2 className="h-3.5 w-3.5" />Delete project
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
