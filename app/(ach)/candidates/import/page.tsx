import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ImportCandidatesClient } from '@/components/candidates/import-candidates-client';
import { ensureDefaultCohortForProject } from '@/lib/projects/actions';

export const dynamic = 'force-dynamic';

interface Search { projectId?: string }

export default async function CandidateImportPage({ searchParams }: { searchParams?: Search }) {
  const supabase = createClient();

  // Self-heal: if arrived here with a project context, make sure that
  // project has a default cohort BEFORE we read the cohorts list, so the
  // "auto-enrol into cohort" dropdown always shows the Main cohort. No-op
  // if the project already has one.
  if (searchParams?.projectId) {
    await ensureDefaultCohortForProject(supabase, searchParams.projectId);
  }

  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, cohort_ref, name, project_id, projects(name), created_at')
    // Order by created_at so newly-auto-created cohorts (with null
    // start_date) still surface at the top of the "auto-enrol" picker.
    // start_date-based sort would sink them below every dated cohort.
    .order('created_at', { ascending: false });

  // If arrived from a project header (Bulk upload button), pre-select
  // that project's cohort. Prefer the oldest cohort of that project (the
  // auto-created Main one) so beneficiaries land straight into it.
  let defaultCohortId: string | undefined;
  let projectContext: { id: string; name?: string } | undefined;
  if (searchParams?.projectId) {
    const projectId = searchParams.projectId;
    const { data: projRow } = await supabase
      .from('projects').select('name').eq('id', projectId).maybeSingle();
    projectContext = { id: projectId, name: (projRow as { name?: string } | null)?.name };
    const projectCohorts = ((cohorts as any[]) ?? []).filter(c => c.project_id === projectId);
    if (projectCohorts.length > 0) {
      // Oldest first — the Main cohort auto-created on project save.
      const sortedByAge = [...projectCohorts].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      defaultCohortId = sortedByAge[0].id;
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref={projectContext ? `/projects/${projectContext.id}` : '/candidates'}
        backLabel={projectContext?.name ?? 'Candidates'}
        miniLabel="Bulk import"
        title={projectContext ? `Bulk upload beneficiaries to ${projectContext.name ?? 'project'}` : 'Import candidates from application form'}
        description="Upload a CSV or Excel export from Microsoft Forms, Google Forms, or any spreadsheet."
      />
      <Card>
        <CardContent className="pt-6">
          <ImportCandidatesClient
            cohorts={((cohorts as any[]) ?? []).map(c => ({
              id: c.id,
              label: `${c.cohort_ref} — ${c.name}${c.projects?.name ? ` (${c.projects.name})` : ''}`,
            }))}
            defaultCohortId={defaultCohortId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
