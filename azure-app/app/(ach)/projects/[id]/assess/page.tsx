import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { startAssessmentAction } from '@/lib/assessments/actions';
import { CandidatePicker } from '@/components/candidates/candidate-picker';

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

  // Baseline lockout: computed from project.start_date + baseline_window_days.
  // After that date, the baseline option is disabled here and rejected by the
  // server action. Later timepoints (3mo/6mo/12mo) remain available.
  const windowDays = typeof p.baseline_window_days === 'number' ? p.baseline_window_days : 3;
  let baselineLocked = false;
  let baselineDeadline: string | null = null;
  if (p.start_date) {
    const start = new Date(`${p.start_date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + windowDays);
    baselineDeadline = end.toISOString().slice(0, 10);
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    baselineLocked = todayMid > end;
  }

  // Candidates available: anyone enrolled on this project (via any cohort)
  // OR any applicant/in-programme beneficiary in the pool. Assessment
  // no longer requires prior cohort linkage — a default cohort is
  // auto-created on save if the project has none, matching how
  // 'Enrol beneficiaries' behaves.
  const { data: cohortIds } = await supabase
    .from('cohorts').select('id').eq('project_id', params.id);
  const ids = ((cohortIds as { id: string }[] | null) ?? []).map(c => c.id);

  const enrolledRes = ids.length > 0
    ? await supabase.from('cohort_candidates')
        .select('candidate_id, candidates(id, candidate_ref, given_name, family_name)')
        .in('cohort_id', ids)
    : { data: [] as any[] };

  const poolRes = await supabase.from('candidates')
    .select('id, candidate_ref, given_name, family_name')
    .in('status', ['applicant', 'in_programme'])
    .order('candidate_ref')
    .limit(300);

  const seen = new Set<string>();
  const candidates: { id: string; candidate_ref: string; given_name?: string | null; family_name?: string | null }[] = [];
  for (const cc of ((enrolledRes.data as any[]) ?? [])) {
    const c = cc.candidates;
    if (c && !seen.has(c.id)) { seen.add(c.id); candidates.push(c); }
  }
  for (const c of ((poolRes.data as any[]) ?? [])) {
    if (c && !seen.has(c.id)) { seen.add(c.id); candidates.push(c); }
  }

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
              No beneficiaries in the pool yet. Add one from the Beneficiaries tab or bulk upload from the project page, then return here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form action={action} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Candidate</label>
                <CandidatePicker name="candidate_id" required options={candidates as any[]} />
              </div>

              <div className="space-y-2">
                <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Timepoint</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIMEPOINTS.map((t, i) => {
                    const locked = t.id === 'baseline' && baselineLocked;
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center gap-2 p-3 rounded-[10px] border-[0.5px] ${
                          locked
                            ? 'border-ach-border bg-ach-page/40 cursor-not-allowed opacity-60'
                            : 'border-ach-border cursor-pointer hover:bg-ach-page'
                        }`}
                      >
                        <input
                          type="radio" name="timepoint" value={t.id}
                          defaultChecked={i === 0 && !locked}
                          disabled={locked}
                          className="h-4 w-4 border-ach-border text-ach-navy focus:ring-ach-navy/40"
                        />
                        <span className={`text-[13px] ${locked ? 'text-ach-navy/50' : 'text-ach-navy'}`}>{t.label}</span>
                      </label>
                    );
                  })}
                </div>
                {baselineLocked && (
                  <div className="text-[11.5px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30 mt-2">
                    Baseline window closed on {baselineDeadline ? new Date(baselineDeadline).toLocaleDateString('en-GB') : '—'} ({windowDays} days after project start). Baseline can no longer be recorded — later timepoints are still available.
                  </div>
                )}
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
