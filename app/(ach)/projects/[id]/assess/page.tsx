import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { startAssessmentAction } from '@/lib/assessments/actions';

const TIMEPOINTS = [
  { id: 'baseline',      label: 'Baseline' },
  { id: 'mid_3mo',       label: '3 months' },
  { id: 'exit_6mo',      label: '6 months (exit)' },
  { id: 'followup_12mo', label: '12 months (follow-up)' },
] as const;

export default async function StartAssessmentPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: project } = await supabase
    .from('projects').select('*').eq('id', params.id).maybeSingle();
  if (!project) notFound();
  const p = project as any;

  // Candidates available: anyone enrolled in any cohort that runs this project.
  const { data: cohortIds } = await supabase
    .from('cohorts').select('id').eq('project_id', params.id);
  const ids = ((cohortIds as { id: string }[] | null) ?? []).map(c => c.id);

  const { data: cohortCandidates } = ids.length > 0
    ? await supabase.from('cohort_candidates')
        .select('candidate_id, candidates(id, candidate_ref, given_name)')
        .in('cohort_id', ids)
    : { data: [] as any[] };

  // Deduplicate candidates that might appear via more than one cohort linkage.
  const seen = new Set<string>();
  const candidates = ((cohortCandidates as any[] | null) ?? [])
    .map(cc => cc.candidates)
    .filter((c): c is { id: string; candidate_ref: string; given_name: string } => {
      if (!c || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

  async function action(formData: FormData) {
    'use server';
    const candidateId = String(formData.get('candidate_id') ?? '');
    const timepoint = String(formData.get('timepoint') ?? 'baseline') as
      'baseline' | 'mid_3mo' | 'exit_6mo' | 'followup_12mo';
    if (!candidateId) return;
    await startAssessmentAction(params.id, candidateId, timepoint);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        backHref={`/projects/${params.id}`}
        backLabel={p.project_ref}
        miniLabel="Assessment"
        title="Start a new assessment"
        description="Pick the candidate and the timepoint. Each candidate can have one assessment per timepoint for this project."
      />

      {candidates.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-[13px] text-ach-navy/70">
              This project isn&apos;t linked to a cohort with enrolled candidates yet. Add candidates
              to the project&apos;s cohort first, then return here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form action={action} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Candidate</label>
                <select
                  name="candidate_id" required
                  className="flex h-9 w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
                >
                  <option value="">Choose a candidate…</option>
                  {candidates.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.candidate_ref} · {c.given_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Timepoint</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIMEPOINTS.map((t, i) => (
                    <label key={t.id} className="flex items-center gap-2 p-3 rounded-[10px] border-[0.5px] border-ach-border cursor-pointer hover:bg-ach-page">
                      <input
                        type="radio" name="timepoint" value={t.id} defaultChecked={i === 0}
                        className="h-4 w-4 border-ach-border text-ach-navy focus:ring-ach-navy/40"
                      />
                      <span className="text-[13px] text-ach-navy">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit">Start assessment</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
