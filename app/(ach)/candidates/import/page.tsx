import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ImportCandidatesClient } from '@/components/candidates/import-candidates-client';

export const dynamic = 'force-dynamic';

interface Search { projectId?: string }

export default async function CandidateImportPage({ searchParams }: { searchParams?: Search }) {
  const supabase = createClient();
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, cohort_ref, name, project_id, projects(name)')
    .order('start_date', { ascending: false, nullsFirst: false });

  // If arrived from a project header (Bulk upload button), pre-select that
  // project's oldest cohort so beneficiaries land straight into it. No cohort
  // yet? Fall back to no default — the user will pick from the dropdown, and
  // saving with a project context could auto-create later. For now MVP.
  let defaultCohortId: string | undefined;
  let projectContext: { id: string; name?: string } | undefined;
  if (searchParams?.projectId) {
    const projectId = searchParams.projectId;
    const { data: projRow } = await supabase
      .from('projects').select('name').eq('id', projectId).maybeSingle();
    projectContext = { id: projectId, name: (projRow as { name?: string } | null)?.name };
    const projectCohorts = ((cohorts as any[]) ?? []).filter(c => c.project_id === projectId);
    if (projectCohorts.length > 0) {
      // Prefer the oldest cohort (the auto-created 'Main' one).
      defaultCohortId = projectCohorts[projectCohorts.length - 1].id;
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref={projectContext ? `/projects/${projectContext.id}` : '/candidates'}
        backLabel={projectContext?.name ?? 'Candidates'}
        miniLabel="Bulk import"
        title={projectContext ? `Bulk upload beneficiaries to ${projectContext.name ?? 'project'}` : 'Import candidates from application form'}
        description="Upload a CSV or Excel export (from Microsoft Forms, Google Forms, or any spreadsheet). ACH picks which rows to import. Unrecognised columns are preserved on each candidate record."
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
