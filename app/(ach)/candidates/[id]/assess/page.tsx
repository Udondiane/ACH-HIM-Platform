import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckCircle2, Circle, Loader2, Lock, AlertTriangle, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { startAssessmentAction } from '@/lib/assessments/actions';

type Timepoint = 'baseline' | 'mid_3mo' | 'exit_6mo' | 'followup_12mo';

const TIMEPOINTS: { id: Timepoint; label: string; description: string; order: number }[] = [
  { id: 'baseline',      label: 'Baseline',          description: 'Anchors every later assessment. Run BEFORE training begins.',     order: 1 },
  { id: 'mid_3mo',       label: '3-month mid-point', description: 'Captures movement during training, typically the largest delta.', order: 2 },
  { id: 'exit_6mo',      label: '6-month exit',      description: 'Programme end. Final capability under ACH support.',              order: 3 },
  { id: 'followup_12mo', label: '12-month follow-up',description: 'Sustained capability after support ends.',                        order: 4 },
];

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'In progress',
  completed:   'Completed',
  reviewed:    'Reviewed',
};

export default async function CandidateAssessChooserPage({
  params, searchParams,
}: {
  params: { id: string };
  searchParams?: { project?: string };
}) {
  const supabase = createClient();

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, candidate_ref, given_name, status')
    .eq('id', params.id)
    .maybeSingle();
  if (!candidate) notFound();
  const c = candidate as any;

  // Cohort linkage if any.
  const { data: cc } = await supabase
    .from('cohort_candidates')
    .select('cohort_id, cohorts(id, cohort_ref, name, project_id, projects(id, project_ref, name))')
    .eq('candidate_id', params.id)
    .maybeSingle();
  const ccRow = cc as any;
  const cohort = ccRow?.cohorts ?? null;
  const cohortProject = cohort?.projects ?? null;

  // Always pull the full project list so the user can pick one even if the
  // candidate isn't in a cohort. The querystring ?project=<id> overrides the
  // cohort-derived project, and is the only source when there is no cohort.
  const { data: allProjects } = await supabase
    .from('projects').select('id, project_ref, name').order('name');
  const projects = ((allProjects as any[]) ?? []);

  // Resolve which project to run the assessment against.
  const overrideId = searchParams?.project?.trim() || null;
  const project = overrideId
    ? projects.find(p => p.id === overrideId) ?? cohortProject ?? projects[0] ?? null
    : cohortProject ?? projects[0] ?? null;

  // Pull existing assessments so we can show status against each timepoint.
  const existingMap = new Map<Timepoint, { id: string; status: string; assessed_on: string }>();
  if (project?.id) {
    const { data: existing } = await supabase
      .from('assessments')
      .select('id, timepoint, status, assessed_on')
      .eq('candidate_id', params.id)
      .eq('project_id', project.id);
    for (const a of (existing as any[]) ?? []) {
      existingMap.set(a.timepoint as Timepoint, { id: a.id, status: a.status, assessed_on: a.assessed_on });
    }
  }

  // The "next due" timepoint is the first one without an existing assessment.
  const nextDue: Timepoint | null = (() => {
    for (const tp of TIMEPOINTS) {
      if (!existingMap.has(tp.id)) return tp.id;
    }
    return null;
  })();

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref={`/candidates/${params.id}`}
        backLabel={`${c.candidate_ref} · ${c.given_name}`}
        miniLabel="Candidate · Assessments"
        title="Run an assessment"
      />

      {projects.length === 0 ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="space-y-2 text-[13px] text-ach-navy/80">
              <p className="font-medium text-ach-navy">No projects yet.</p>
              <p>Create a project first — an assessment needs a project to score against.</p>
              <p>
                <Link href="/projects/new" className="text-ach-navy underline">Create a project →</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !project ? null : (
        <>
          <Card className="mb-4">
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Assess against</div>
              <div className="mt-1 space-y-2">
                <form method="get" className="flex items-center gap-2">
                  <select
                    name="project"
                    defaultValue={project.id}
                    className="rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.project_ref} · {p.name}</option>
                    ))}
                  </select>
                  <button type="submit" className="text-[12.5px] text-ach-navy underline">Switch</button>
                </form>
                {cohort && (
                  <div className="text-[12px] text-ach-navy/60">
                    Cohort: <Link href={`/cohorts/${cohort.id}`} className="hover:underline">{cohort.cohort_ref}</Link>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          <div className="space-y-3">
            {TIMEPOINTS.map(tp => {
              const existing = existingMap.get(tp.id);
              const isNextDue = nextDue === tp.id;
              return (
                <TimepointCard
                  key={tp.id}
                  candidateId={params.id}
                  projectId={project.id}
                  timepoint={tp.id}
                  label={tp.label}
                  description={tp.description}
                  existing={existing ?? null}
                  isNextDue={isNextDue}
                />
              );
            })}
          </div>

          {nextDue === null && (
            <div className="mt-4 text-[12.5px] text-ach-navy/70 bg-ach-slate-tint rounded-[8px] px-3 py-2 border-[0.5px] border-ach-slate-blue/30">
              All four timepoints have been started for this candidate against this project.
              Re-entering any of them will resume the existing record rather than create a new one.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TimepointCard({
  candidateId, projectId, timepoint, label, description, existing, isNextDue,
}: {
  candidateId: string;
  projectId: string;
  timepoint: Timepoint;
  label: string;
  description: string;
  existing: { id: string; status: string; assessed_on: string } | null;
  isNextDue: boolean;
}) {
  const startAction = async (formData: FormData) => {
    'use server';
    const tp = formData.get('timepoint') as Timepoint;
    await startAssessmentAction(projectId, candidateId, tp);
  };

  const statusLabel = existing ? STATUS_LABELS[existing.status] ?? existing.status : 'Not started';
  const statusTone = existing?.status === 'completed' || existing?.status === 'reviewed'
    ? 'bg-ach-page text-ach-navy/70 border-ach-border'
    : existing?.status === 'in_progress'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : isNextDue
        ? 'bg-ach-navy/10 text-ach-navy border-ach-navy/20'
        : 'bg-white text-ach-navy/55 border-ach-border';

  return (
    <Card className={isNextDue && !existing ? 'border-ach-navy/30' : ''}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-1 shrink-0">
              {existing?.status === 'completed' || existing?.status === 'reviewed' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              ) : existing?.status === 'in_progress' ? (
                <Loader2 className="h-5 w-5 text-amber-700" />
              ) : (
                <Circle className={`h-5 w-5 ${isNextDue ? 'text-ach-navy' : 'text-ach-navy/30'}`} />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[14.5px] font-medium text-ach-navy">{label}</div>
                {isNextDue && !existing && (
                  <span className="inline-flex items-center text-[10.5px] uppercase tracking-[1.2px] font-medium text-ach-navy bg-ach-navy/10 rounded-full px-2 py-0.5 border-[0.5px] border-ach-navy/20">
                    Next due
                  </span>
                )}
                <span className={`inline-flex items-center text-[10.5px] uppercase tracking-[1.2px] font-medium rounded-full px-2 py-0.5 border-[0.5px] ${statusTone}`}>
                  {statusLabel}
                </span>
              </div>
              <div className="text-[12px] text-ach-navy/65 mt-1">{description}</div>
              {existing && (
                <div className="text-[11.5px] text-ach-navy/55 mt-1.5">
                  First created {new Date(existing.assessed_on).toLocaleDateString('en-GB')}
                  {(existing.status === 'completed' || existing.status === 'reviewed') && (
                    <span className="text-amber-700 ml-2">
                      · Editing this timepoint will modify a finalised record.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {existing ? (
              <Link href={`/projects/${projectId}/assess/${existing.id}`}>
                <Button variant={isNextDue ? 'primary' : 'secondary'} size="sm">
                  {existing.status === 'completed' || existing.status === 'reviewed' ? 'Review' : 'Resume'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <form action={startAction}>
                <input type="hidden" name="timepoint" value={timepoint} />
                <Button type="submit" variant={isNextDue ? 'primary' : 'secondary'} size="sm">
                  Start
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </form>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
