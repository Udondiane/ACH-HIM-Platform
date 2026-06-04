import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { PlacementForm } from '@/components/placements/placement-form';
import { createPlacementAction } from '@/lib/placements/actions';

export default async function NewPlacementPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [candidateRes, partnersRes, cohortLinkRes] = await Promise.all([
    supabase.from('candidates').select('id, candidate_ref, given_name, family_name').eq('id', params.id).maybeSingle(),
    supabase
      .from('partners')
      .select('id, name')
      .eq('type', 'workforce_partner')
      .neq('status', 'closed')
      .order('name'),
    supabase
      .from('cohort_candidates')
      .select('cohort_id, cohorts(id, cohort_ref, name)')
      .eq('candidate_id', params.id)
      .maybeSingle(),
  ]);

  if (!candidateRes.data) notFound();
  const candidate = candidateRes.data as any;
  const partners = ((partnersRes.data as any[]) ?? []);
  const candidateCohort = (cohortLinkRes.data as any)?.cohorts;

  // Show all open cohorts as options — usually only one is relevant but the
  // candidate may have moved between cohorts.
  const { data: cohortsList } = await supabase
    .from('cohorts')
    .select('id, cohort_ref, name')
    .in('status', ['recruiting', 'in_progress', 'completed'])
    .order('cohort_ref', { ascending: false })
    .limit(50);
  const cohorts = ((cohortsList as any[]) ?? []);

  const candidateName = `${candidate.given_name}${candidate.family_name ? ' ' + candidate.family_name : ''}`;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref={`/candidates/${params.id}`}
        backLabel={`${candidate.candidate_ref} · ${candidate.given_name}`}
        miniLabel="Placement"
        title="Record a placement"
        description="Capture role, employer, salary band, and start date. The three milestones (placement / 6-month / 12-month retention) are auto-generated for the milestones page."
      />
      <Card>
        <CardContent className="pt-6">
          {partners.length === 0 ? (
            <div className="text-[13px] text-ach-navy/70">
              No workforce partners on file. Add a partner first, then come back to record this placement.
            </div>
          ) : (
            <PlacementForm
              action={createPlacementAction}
              candidateId={params.id}
              candidateRef={candidate.candidate_ref}
              candidateName={candidateName}
              partners={partners}
              cohorts={cohorts}
              defaultCohortId={candidateCohort?.id ?? null}
              cancelHref={`/candidates/${params.id}`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
