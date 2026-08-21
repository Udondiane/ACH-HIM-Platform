import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { startAssessmentAction } from '@/lib/assessments/actions';
import { ensureDefaultCohortForProject } from '@/lib/projects/actions';
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

  // Self-heal: any project without a default cohort gets one silently on
  // first assessment attempt. Catches projects created before the
  // auto-create-on-project-create fix landed, and any that failed the
  // insert silently for schema reasons.
  await ensureDefaultCohortForProject(supabase, params.id);

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

  // Candidates available: ONLY beneficiaries enrolled on this project (via
  // any of its cohorts). Previously this page merged in the full applicant
  // pool, which caused stray unrelated beneficiaries to appear in the
  // picker and get assessed against the wrong project. The correct workflow
  // is enrol first (via /candidates/import or the project's Enrol screen),
  // then run the assessment against that enrolled set.
  const { data: cohortIds } = await supabase
    .from('cohorts').select('id').eq('project_id', params.id);
  const ids = ((cohortIds as { id: string }[] | null) ?? []).map(c => c.id);

  const enrolledRes = ids.length > 0
    ? await supabase.from('cohort_candidates')
        .select('candidate_id, candidates(id, candidate_ref, given_name, family_name, status)')
        .in('cohort_id', ids)
    : { data: [] as any[] };

  const seen = new Set<string>();
  const candidates: { id: string; candidate_ref: string; given_name?: string | null; family_name?: string | null }[] = [];
  for (const cc of ((enrolledRes.data as any[]) ?? [])) {
    const c = cc.candidates;
    if (!c) continue;
    // Skip withdrawn candidates — they shouldn't be assessed further.
    if (c.status === 'withdrawn') continue;
    if (!seen.has(c.id)) { seen.add(c.id); candidates.push(c); }
  }
  // Sort by candidate_ref so the picker order is predictable.
  candidates.sort((a, b) => a.candidate_ref.localeCompare(b.candidate_ref));

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
        description="Pick the enrolled beneficiary and the timepoint. Each beneficiary can have one assessment per timepoint for this project."
      />

      {candidates.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 mt-0.5 text-ach-navy/60 shrink-0" />
              <div className="text-[13px] text-ach-navy/80 space-y-2 flex-1">
                <p className="font-medium text-ach-navy">
                  No beneficiaries have been added to this project.
                </p>
                <p>
                  Assessments run against enrolled beneficiaries only. Return to
                  <span className="mx-1 font-mono text-[11.5px] bg-ach-page px-1.5 py-0.5 rounded">
                    {p.project_ref}
                  </span>
                  and add beneficiaries before reattempting the assessment.
                </p>
              </div>
            </div>
            <div className="mt-5">
              <Link href={`/projects/${params.id}`}>
                <Button variant="ghost">
                  <ArrowLeft className="h-4 w-4" />
                  Return to project
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 rounded-[8px] border-[0.5px] border-ach-border bg-ach-page/40 px-3 py-2 text-[11.5px] text-ach-navy/70">
              <strong>{candidates.length}</strong> beneficiar{candidates.length === 1 ? 'y' : 'ies'} enrolled on this project available to assess.{' '}
              <Link href={`/candidates/import?projectId=${params.id}`} className="text-ach-navy underline underline-offset-2 ml-1">
                Enrol more →
              </Link>
            </div>
            <form action={action} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Beneficiary</label>
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
