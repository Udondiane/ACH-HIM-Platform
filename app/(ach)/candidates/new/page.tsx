import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CandidateForm } from '@/components/candidates/candidate-form';
import { createCandidateAction } from '@/lib/candidates/actions';

export default async function NewCandidatePage({
  searchParams,
}: {
  searchParams?: { cohort?: string };
}) {
  // If the user arrived from a cohort page (e.g. ?cohort=<uuid>), pass the
  // cohort id through the form as a hidden field. The create action will
  // auto-enrol the new candidate into that cohort on save and redirect back.
  const cohortId = searchParams?.cohort?.trim() || null;
  let cohortLabel: string | null = null;
  if (cohortId) {
    const supabase = createClient();
    const { data } = await supabase
      .from('cohorts')
      .select('cohort_ref, name')
      .eq('id', cohortId)
      .maybeSingle();
    const c = data as { cohort_ref?: string; name?: string } | null;
    if (c) cohortLabel = `${c.cohort_ref}${c.name ? ' · ' + c.name : ''}`;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref={cohortId ? `/cohorts/${cohortId}` : '/candidates'}
        backLabel={cohortId ? (cohortLabel ?? 'Cohort') : 'Candidates'}
        miniLabel="Network"
        title="Add candidate"
        description={cohortLabel ? `Will be auto-enrolled into ${cohortLabel} after save.` : undefined}
      />
      <Card>
        <CardContent className="pt-6">
          <CandidateForm
            action={createCandidateAction}
            cancelHref={cohortId ? `/cohorts/${cohortId}` : '/candidates'}
            submitLabel={cohortId ? 'Create + enrol' : 'Create candidate'}
            enrolCohortId={cohortId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
