import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ImportCandidatesClient } from '@/components/candidates/import-candidates-client';

export const dynamic = 'force-dynamic';

export default async function CandidateImportPage() {
  const supabase = createClient();
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, cohort_ref, name, projects(name)')
    .order('start_date', { ascending: false, nullsFirst: false });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref="/candidates"
        backLabel="Candidates"
        miniLabel="Bulk import"
        title="Import candidates from application form"
        description="Upload a CSV or Excel export (from Microsoft Forms, Google Forms, or any spreadsheet). ACH picks which rows to import. Unrecognised columns are preserved on each candidate record."
      />
      <Card>
        <CardContent className="pt-6">
          <ImportCandidatesClient
            cohorts={((cohorts as any[]) ?? []).map(c => ({
              id: c.id,
              label: `${c.cohort_ref} — ${c.name}${c.projects?.name ? ` (${c.projects.name})` : ''}`,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
