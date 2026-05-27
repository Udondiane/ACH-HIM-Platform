import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectAdminForm } from '@/components/projects/project-admin-form';
import { updateProjectAdminAction, type AdminActionResult } from '@/lib/projects/admin-action';

export default async function ProjectAdminEditPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: project } = await supabase
    .from('projects').select('*').eq('id', params.id).maybeSingle();
  if (!project) notFound();
  const p = project as any;

  const action = async (prev: AdminActionResult | null, fd: FormData) =>
    updateProjectAdminAction(params.id, prev, fd);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref="/admin/projects"
        backLabel="Project admin"
        miniLabel={p.project_ref}
        title={p.name}
        description="Technical configuration only. The project's outcomes, funding model, and basic details are managed on the main project page."
      />
      <Card>
        <CardContent className="pt-6">
          <ProjectAdminForm action={action} initial={p} cancelHref={`/admin/projects`} />
        </CardContent>
      </Card>
    </div>
  );
}
