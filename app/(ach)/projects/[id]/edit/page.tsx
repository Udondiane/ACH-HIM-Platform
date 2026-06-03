import Link from 'next/link';
import { AlertCircle, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectForm } from '@/components/projects/project-form';
import { updateProjectAction, deleteProjectAction, type ActionResult } from '@/lib/projects/actions';

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const projectRes = await supabase
    .from('projects').select('*').eq('id', params.id).maybeSingle();

  // Diagnostic surface instead of a server-side throw. Same pattern as the
  // project detail page so missing service-role key / RLS issues / deleted
  // projects show a useful message rather than a generic crash.
  if (projectRes.error || !projectRes.data) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader
          backHref="/projects"
          backLabel="Projects"
          miniLabel={params.id}
          title="Project cannot be edited"
          description="The edit form could not load this project."
        />
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-[#8B3A4F] shrink-0 mt-0.5" />
              <div className="space-y-2 text-[13px] text-ach-navy/80">
                <p className="font-medium text-ach-navy">Likely causes:</p>
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>
                    <span className="font-medium">Supabase service role key is missing</span> — when
                    {' '}<code className="text-[12px] bg-ach-page px-1 rounded">AUTH_DISABLED=true</code> and
                    {' '}<code className="text-[12px] bg-ach-page px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> is not set
                    in the Vercel project env vars, every read silently returns null because RLS blocks the anon key.
                  </li>
                  <li>The project with this ID has been deleted from the database.</li>
                  {projectRes.error && (
                    <li>
                      Supabase returned: <code className="text-[11.5px] bg-ach-page px-1 rounded">{projectRes.error.message}</code>
                    </li>
                  )}
                </ol>
                <p className="pt-2">
                  <Link href="/projects" className="text-ach-navy underline">← Back to project list</Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  const p = projectRes.data as any;

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
