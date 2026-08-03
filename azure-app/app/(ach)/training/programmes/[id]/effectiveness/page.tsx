import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { PrintButton } from '@/components/ui/print-button';
import { scoreToLevel, relativeGainPct, upliftNarrative } from '@/lib/scoring/interpret';

export const metadata = { title: 'Training programme effectiveness' };

async function safeFetch<T>(fn: () => any, fallback: T): Promise<T> {
  try {
    const r = await fn();
    if (r?.error) return fallback;
    return (r?.data ?? fallback) as T;
  } catch { return fallback; }
}

export default async function TrainingProgrammeEffectivenessPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { project?: string; from?: string; to?: string };
}) {
  const supabase = createClient();
  const filterProjectId = searchParams?.project ?? '';
  const filterFrom = searchParams?.from ?? '';
  const filterTo = searchParams?.to ?? '';

  const [prog, learningOutcomes, outcomeMap, enrolmentsRaw, factors, usedInProjects] = await Promise.all([
    safeFetch<any>(() => supabase.from('training_programmes').select('id, name, code, category, description').eq('id', params.id).maybeSingle(), null),
    safeFetch<any[]>(() => supabase.from('training_learning_outcomes').select('id, outcome_code, outcome_text').eq('programme_id', params.id).order('sort_order'), []),
    safeFetch<any[]>(() => supabase.from('training_learning_outcome_map').select('learning_outcome_id, factor_id, evidence_weight'), []),
    safeFetch<any[]>(() => {
      let q = supabase.from('training_enrolments').select('id, candidate_id, status, enrolled_date, completed_date').eq('programme_id', params.id);
      if (filterFrom) q = q.gte('enrolled_date', filterFrom);
      if (filterTo)   q = q.lte('enrolled_date', filterTo);
      return q;
    }, []),
    safeFetch<any[]>(() => supabase.from('factors').select('id, name'), []),
    safeFetch<any[]>(() => supabase.from('project_training_programmes').select('project_id, projects(id, name, project_ref)').eq('programme_id', params.id), []),
  ]);

  const enrolments = enrolmentsRaw;
  const projectsList = ((usedInProjects as any[]) ?? []).map(r => r.projects).filter(Boolean);

  // Optional filter: only candidates enrolled on this training WHO ARE ALSO on the specified project's cohorts
  let filteredEnrolments = enrolments as any[];
  if (filterProjectId) {
    const projectCohortsRes = await safeFetch<any[]>(() => supabase.from('cohorts').select('id').eq('project_id', filterProjectId), []);
    const cohortIds = (projectCohortsRes as any[]).map(c => c.id);
    if (cohortIds.length > 0) {
      const projectCandidatesRes = await safeFetch<any[]>(() => supabase.from('cohort_candidates').select('candidate_id').in('cohort_id', cohortIds), []);
      const projectCandidateIds = new Set((projectCandidatesRes as any[]).map(cc => cc.candidate_id));
      filteredEnrolments = (enrolments as any[]).filter(e => projectCandidateIds.has(e.candidate_id));
    } else {
      filteredEnrolments = [];
    }
  }

  const programme = prog as any;
  if (!programme) notFound();

  // Factor IDs linked to this programme (via learning outcomes)
  const outcomeIds = new Set(learningOutcomes.map((o: any) => o.id));
  const linkedFactorIds = new Set(
    outcomeMap.filter((m: any) => outcomeIds.has(m.learning_outcome_id)).map((m: any) => m.factor_id),
  );
  const factorLookup = new Map(factors.map((f: any) => [f.id, f.name]));

  // Enrolled + completed candidates
  const enrolled = filteredEnrolments.map(e => e.candidate_id);
  const completed = filteredEnrolments.filter(e => e.status === 'completed').map(e => e.candidate_id);
  const inProgress = filteredEnrolments.filter(e => e.status === 'enrolled').length;
  const withdrawn = filteredEnrolments.filter(e => e.status === 'withdrawn').length;

  // For completers, fetch their assessment responses on the linked factors
  // We need indicators linked to those factors, then responses on those indicators
  const indicators = linkedFactorIds.size > 0
    ? await safeFetch<any[]>(() => supabase.from('indicators').select('id, factor_id').in('factor_id', Array.from(linkedFactorIds)), [])
    : [];
  const indicatorToFactor = new Map(indicators.map((i: any) => [i.id, i.factor_id]));
  const indicatorIds = Array.from(indicatorToFactor.keys());

  const assessmentsForCompleters = completed.length > 0
    ? await safeFetch<any[]>(() => supabase.from('assessments').select('id, candidate_id, timepoint, status').in('candidate_id', completed), [])
    : [];
  const assessmentIds = assessmentsForCompleters.map((a: any) => a.id);
  const responses = assessmentIds.length > 0 && indicatorIds.length > 0
    ? await safeFetch<any[]>(() => supabase.from('assessment_responses').select('assessment_id, indicator_id, numeric_value').in('assessment_id', assessmentIds).in('indicator_id', indicatorIds), [])
    : [];

  // Aggregate per factor: mean baseline vs mean exit (mid_3mo / exit_6mo, whichever exists)
  const assessmentMap = new Map(assessmentsForCompleters.map((a: any) => [a.id, a]));
  const perFactor = new Map<string, { baseline: number[]; exit: number[] }>();
  for (const r of responses as any[]) {
    if (typeof r.numeric_value !== 'number') continue;
    const factorId = indicatorToFactor.get(r.indicator_id);
    if (!factorId) continue;
    const a = assessmentMap.get(r.assessment_id) as any;
    if (!a) continue;
    const entry = perFactor.get(factorId) ?? { baseline: [], exit: [] };
    if (a.timepoint === 'baseline') entry.baseline.push(Number(r.numeric_value));
    if (a.timepoint === 'mid_3mo' || a.timepoint === 'exit_6mo') entry.exit.push(Number(r.numeric_value));
    perFactor.set(factorId, entry);
  }

  const mean = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
  const factorRows = Array.from(linkedFactorIds).map(fid => {
    const entry = perFactor.get(fid) ?? { baseline: [], exit: [] };
    const b = mean(entry.baseline);
    const e = mean(entry.exit);
    const uplift = (b !== null && e !== null) ? e - b : null;
    return {
      factor_id: fid,
      factor_name: factorLookup.get(fid) ?? fid,
      baseline: b,
      exit: e,
      uplift,
      pre_n: entry.baseline.length,
      post_n: entry.exit.length,
    };
  }).sort((x, y) => (y.uplift ?? -Infinity) - (x.uplift ?? -Infinity));

  const rowsWithData = factorRows.filter(r => r.baseline !== null || r.exit !== null);
  const overallBaseline = mean(factorRows.map(r => r.baseline).filter((v): v is number => v !== null));
  const overallExit = mean(factorRows.map(r => r.exit).filter((v): v is number => v !== null));

  return (
    <div className="max-w-5xl mx-auto pb-16 print:max-w-none">
      <div className="print:hidden mb-4">
        <Link href={`/training/programmes/${params.id}`} className="inline-flex items-center gap-1.5 text-[12px] text-ach-navy/70 hover:text-ach-navy">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to programme
        </Link>
      </div>

      <PageHeader
        miniLabel={programme.code ?? 'Training programme'}
        title={`Effectiveness · ${programme.name}`}
        description="Did this training move HIM scores on its linked factors? For candidates who completed the programme, mean baseline vs mean exit on each linked factor."
      />

      {/* Filter bar */}
      <Card className="mb-6 print:hidden">
        <CardContent className="pt-5">
          <form method="get" className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
            <div>
              <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-medium block mb-1">
                Filter to a specific project
              </label>
              <select
                name="project"
                defaultValue={filterProjectId}
                className="flex h-9 w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
              >
                <option value="">All projects (including standalone)</option>
                {projectsList.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-medium block mb-1">Enrolled from</label>
              <input type="date" name="from" defaultValue={filterFrom} className="h-9 rounded-[10px] border-[0.5px] border-ach-border px-3 text-[13px]" />
            </div>
            <div>
              <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 font-medium block mb-1">to</label>
              <input type="date" name="to" defaultValue={filterTo} className="h-9 rounded-[10px] border-[0.5px] border-ach-border px-3 text-[13px]" />
            </div>
            <button type="submit" className="h-9 px-4 rounded-[10px] bg-ach-navy text-ach-cream text-[12.5px] hover:opacity-90">
              Apply
            </button>
          </form>
          {(filterProjectId || filterFrom || filterTo) && (
            <div className="mt-3 text-[11.5px] text-ach-navy/60">
              Showing {filteredEnrolments.length} enrolment{filteredEnrolments.length === 1 ? '' : 's'} matching the filter.{' '}
              <a href={`/training/programmes/${params.id}/effectiveness`} className="underline underline-offset-2">Clear filter</a>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="print:hidden mb-6">
        <PrintButton />
      </div>

      {/* Enrolment shape */}
      <section className="mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-4 gap-6">
              <Stat label="Enrolled" value={enrolled.length} />
              <Stat label="Completed" value={completed.length} sub={completed.length && enrolled.length ? `${Math.round((completed.length / enrolled.length) * 100)}%` : ''} />
              <Stat label="In progress" value={inProgress} />
              <Stat label="Withdrawn" value={withdrawn} />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Overall */}
      <section className="mb-6">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">1 · Overall movement on linked factors</h2>
        <Card>
          <CardContent className="pt-6">
            {linkedFactorIds.size === 0 ? (
              <div className="text-[13px] text-ach-navy/60 italic">
                No HIM factors linked to this programme yet. Add learning outcomes and map them to factors on the programme detail page.
              </div>
            ) : overallBaseline === null || overallExit === null ? (
              <div className="text-[13px] text-ach-navy/60 italic">
                No pre/post assessment data for completers yet. As baseline and exit assessments happen for completers, this section populates.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-6">
                  <ScoreBlock label="Mean baseline" value={overallBaseline} sub={`Level ${scoreToLevel(overallBaseline).level} · ${scoreToLevel(overallBaseline).label}`} />
                  <ScoreBlock label="Mean exit" value={overallExit} sub={`Level ${scoreToLevel(overallExit).level} · ${scoreToLevel(overallExit).label}`} />
                  <ScoreBlock label="Uplift" value={overallExit - overallBaseline} sub={`${relativeGainPct(overallBaseline, overallExit) >= 0 ? '+' : ''}${relativeGainPct(overallBaseline, overallExit)}% on baseline`} highlight />
                </div>
                <div className="mt-4 text-[12.5px] text-ach-navy/80 italic">
                  {upliftNarrative(overallBaseline, overallExit)}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Per-factor breakdown */}
      <section className="mb-6">
        <h2 className="text-[16px] font-serif font-semibold text-ach-navy mb-3">2 · Per-factor change (linked to this programme)</h2>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-[12.5px]">
              <thead className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/55 bg-ach-page/50">
                <tr>
                  <th className="text-left px-4 py-2.5">Factor</th>
                  <th className="text-right px-4 py-2.5">Baseline</th>
                  <th className="text-right px-4 py-2.5">Exit</th>
                  <th className="text-right px-4 py-2.5">Uplift</th>
                  <th className="text-right px-4 py-2.5">n (pre / post)</th>
                </tr>
              </thead>
              <tbody>
                {rowsWithData.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center italic text-ach-navy/60">No data on linked factors yet.</td></tr>
                ) : (
                  rowsWithData.map(r => (
                    <tr key={r.factor_id} className="border-t border-ach-border/60">
                      <td className="px-4 py-2.5 text-ach-navy font-medium">{r.factor_name}</td>
                      <td className="px-4 py-2.5 text-right text-ach-navy/80">{r.baseline?.toFixed(2) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-ach-navy/80">{r.exit?.toFixed(2) ?? '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${r.uplift === null ? 'text-ach-navy/40' : r.uplift >= 0 ? 'text-ach-navy' : 'text-red-700'}`}>
                        {r.uplift === null ? '—' : `${r.uplift >= 0 ? '+' : ''}${r.uplift.toFixed(2)}`}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ach-navy/60">
                        {r.pre_n} / {r.post_n}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* Methodology / caveats */}
      <section className="mt-8 text-[11.5px] text-ach-navy/60 leading-relaxed">
        <div className="font-medium text-ach-navy/75 mb-1">Methodology and caveats</div>
        <p className="mb-2">
          This view shows pre/post HIM factor scores for candidates who completed this programme. It answers
          <em> &ldquo;did we move the needle on the factors this training was designed to shift?&rdquo;</em>
        </p>
        <p className="mb-2">
          <span className="font-medium text-ach-navy/75">Attribution warning.</span> Uplift here cannot be attributed
          solely to this training — candidates typically participate in other programme activities and life events
          in the same window. To isolate the training&rsquo;s contribution you would need either a matched comparison
          group (candidates who did NOT take this training) or a dose-response analysis. Both are Phase 4 features.
        </p>
        <p>
          Factor links are drawn from training_learning_outcomes + training_learning_outcome_map. If a programme
          has no learning outcomes mapped to factors, this view stays empty.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{label}</div>
      <div className="text-[24px] font-serif text-ach-navy">{value}</div>
      {sub && <div className="text-[11.5px] text-ach-navy/55">{sub}</div>}
    </div>
  );
}

function ScoreBlock({ label, value, sub, highlight }: { label: string; value: number; sub: string; highlight?: boolean }) {
  const positive = value >= 0;
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{label}</div>
      <div className={`text-[26px] font-serif ${highlight && !positive ? 'text-red-700' : 'text-ach-navy'}`}>
        {highlight && positive ? '+' : ''}{value.toFixed(2)}
      </div>
      <div className="text-[11.5px] text-ach-navy/55">{sub}</div>
    </div>
  );
}
