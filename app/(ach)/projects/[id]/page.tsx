import Link from 'next/link';
import { Pencil, ClipboardCheck, Plus, Layers, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CapabilityPicker } from '@/components/projects/capability-picker';
import { FactorPicker } from '@/components/projects/factor-picker';
import { CapabilityRadar } from '@/components/charts/capability-radar';
import { CapabilityBar } from '@/components/charts/capability-bar';
import { WordCloud } from '@/components/charts/word-cloud';
import { ProjectExportButton } from '@/components/projects/project-export-button';
import { FUNDING_MODEL_LABELS, type FundingModel } from '@/lib/projects/schema';
import { COHORT_STATUS_LABELS } from '@/lib/cohorts/schema';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: project, error: projectError } = await supabase
    .from('projects').select('*').eq('id', params.id).maybeSingle();

  if (projectError || !project) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader
          backHref="/projects"
          backLabel="Projects"
          miniLabel={params.id}
          title="Project not available"
          description="The project detail page could not load."
        />
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-[#8B3A4F] shrink-0 mt-0.5" />
              <div className="space-y-2 text-[13px] text-ach-navy/80">
                <p className="font-medium text-ach-navy">Likely causes:</p>
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>
                    <span className="font-medium">Supabase service role key is missing</span> — when
                    {' '}<code className="text-[12px] bg-ach-page px-1 rounded">AUTH_DISABLED=true</code> and
                    {' '}<code className="text-[12px] bg-ach-page px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> is not set
                    in the Vercel project env vars, every read silently returns null because RLS blocks the anon key. Set the
                    service role key under Vercel → Settings → Environment Variables and redeploy.
                  </li>
                  <li>
                    The project with this ID has been deleted from the database.
                  </li>
                  {projectError && (
                    <li>
                      Supabase returned an error: <code className="text-[11.5px] bg-ach-page px-1 rounded">{projectError.message}</code>
                    </li>
                  )}
                </ol>
                <p className="pt-2">
                  <Link href="/projects" className="text-ach-navy underline">← Back to project list</Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  const p = project as any;

  const [capabilities, assessments, cohorts, responses, factorsAll, factorDomainsAll] = await Promise.all([
    supabase.from('project_capabilities').select('domain, role, selected_factors').eq('project_id', params.id),
    supabase.from('assessments')
      .select('id, timepoint, assessed_on, status, candidate_id, candidates(candidate_ref, given_name)')
      .eq('project_id', params.id).order('assessed_on', { ascending: false }).limit(10),
    supabase.from('cohorts')
      .select('id, cohort_ref, name, status, location, start_date, target_size, cohort_candidates(id)')
      .eq('project_id', params.id)
      .order('start_date', { ascending: false }),
    supabase.from('assessment_responses')
      .select(`
        numeric_value, narrative, observable_changes, practices,
        indicators(factor_id, factors(factor_domains(domain_id))),
        assessments!inner(project_id, timepoint)
      `)
      .eq('assessments.project_id', params.id),
    supabase.from('factors').select('id, name, conversion_factor_type, measurement_question, behavioural_prompt'),
    supabase.from('factor_domains').select('factor_id, domain_id'),
  ]);

  const caps = (capabilities.data as any[]) ?? [];
  const allFactors = (factorsAll.data as any[]) ?? [];
  const factorDomainsList = (factorDomainsAll.data as any[]) ?? [];
  const factorById = new Map(allFactors.map(f => [f.id, f]));
  const factorsByDomain: Record<string, any[]> = {};
  for (const fd of factorDomainsList) {
    if (!factorsByDomain[fd.domain_id]) factorsByDomain[fd.domain_id] = [];
    const f = factorById.get(fd.factor_id);
    if (f) factorsByDomain[fd.domain_id].push(f);
  }

  // A project is "in flight" (factor selection locked) once any cohort linked
  // to this project has at least one assessment recorded.
  const assessmentsAny = (assessments.data as any[]) ?? [];
  const hasAssessments = assessmentsAny.length > 0;
  const cohortRows = (cohorts.data as any[]) ?? [];
  const totalStarts = cohortRows.reduce((s, c) => s + (c.cohort_candidates?.length ?? 0), 0);

  // Per-domain selected-factor filter (empty selection = include all factors)
  const selectedFactorsByDomain: Record<string, Set<string> | null> = {};
  for (const c of caps) {
    const sel: string[] = c.selected_factors ?? [];
    selectedFactorsByDomain[c.domain] = sel.length === 0 ? null : new Set(sel);
  }

  // Aggregate response scores into per-domain averages for chart rendering
  const allResponses = (responses.data as any[]) ?? [];
  const domainAggregate: Record<string, { baselineSum: number; baselineN: number; exitSum: number; exitN: number; currentSum: number; currentN: number }> = {};
  for (const r of allResponses) {
    if (r.numeric_value == null) continue;
    const fds: any[] = r.indicators?.factors?.factor_domains ?? [];
    const factorId: string | undefined = r.indicators?.factor_id;
    for (const fd of fds) {
      const dom = fd.domain_id;
      const allowed = selectedFactorsByDomain[dom];
      if (allowed && (!factorId || !allowed.has(factorId))) continue;
      if (!domainAggregate[dom]) domainAggregate[dom] = { baselineSum: 0, baselineN: 0, exitSum: 0, exitN: 0, currentSum: 0, currentN: 0 };
      const v = Number(r.numeric_value);
      domainAggregate[dom].currentSum += v;
      domainAggregate[dom].currentN += 1;
      if (r.assessments?.timepoint === 'baseline') {
        domainAggregate[dom].baselineSum += v;
        domainAggregate[dom].baselineN += 1;
      } else if (r.assessments?.timepoint === 'exit_6mo' || r.assessments?.timepoint === 'followup_12mo') {
        domainAggregate[dom].exitSum += v;
        domainAggregate[dom].exitN += 1;
      }
    }
  }
  const radarData = caps.map(c => {
    const agg = domainAggregate[c.domain] ?? { baselineSum: 0, baselineN: 0, exitSum: 0, exitN: 0, currentSum: 0, currentN: 0 };
    return {
      domain: c.domain,
      baseline: agg.baselineN > 0 ? agg.baselineSum / agg.baselineN : null,
      exit: agg.exitN > 0 ? agg.exitSum / agg.exitN : null,
      current: agg.currentN > 0 ? agg.currentSum / agg.currentN : null,
    };
  });
  const barData = caps.map(c => {
    const agg = domainAggregate[c.domain];
    return {
      domain: c.domain,
      score: agg && agg.currentN > 0 ? agg.currentSum / agg.currentN : 0,
      role: c.role as 'core' | 'optional',
    };
  });
  const narrativeTexts: string[] = allResponses.flatMap(r => [r.observable_changes, r.practices, r.narrative].filter(Boolean));
  const hasAnyAssessmentData = allResponses.length > 0;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref="/projects"
        backLabel="Projects"
        miniLabel={p.project_ref}
        title={p.name}
        description={p.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <ProjectExportButton projectId={p.id} projectRef={p.project_ref} />
            <Link href={`/projects/${p.id}/edit`}>
              <Button variant="secondary"><Pencil className="h-3.5 w-3.5" />Edit</Button>
            </Link>
          </div>
        }
      />

      {p.is_locked && (
        <div className="mb-4 text-[12.5px] text-ach-slate-deep bg-ach-slate-tint rounded-[10px] px-3 py-2 border-[0.5px] border-ach-slate-blue/30 flex items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[1.2px] font-medium">Locked</span>
          <span>Core/Optional selection is locked because assessments are in flight. Unlock from the Edit page if you need to change the design.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Configuration</div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
              <DT label="Funding model">
                {p.funding_model
                  ? <FundingPill model={p.funding_model as FundingModel} />
                  : <span className="text-ach-navy/45">—</span>}
              </DT>
              <DT label="Funder">{p.funder_name ?? <span className="text-ach-navy/45">—</span>}</DT>
              <DT label="Start">{p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'}</DT>
              <DT label="End">{p.end_date ? new Date(p.end_date).toLocaleDateString('en-GB') : '—'}</DT>
              <DT label="Status"><Badge>{p.status}</Badge></DT>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Cohorts</div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none tabular-nums">{cohortRows.length}</div>
              <div className="text-[12px] text-ach-navy/60">{totalStarts} candidate starts across all cohorts</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Assessments</div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none tabular-nums">
                {assessments.data?.length ?? 0}
              </div>
              <Link href={`/projects/${p.id}/assess`}>
                <Button size="sm"><Plus className="h-3.5 w-3.5" />New assessment</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Capability selection</div>
        </CardHeader>
        <CardContent>
          <CapabilityPicker projectId={p.id} initial={caps} />
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Factor selection</div>
          <div className="text-[11.5px] text-ach-navy/55 mt-0.5">
            Choose which factors within each selected capability are scored. Reduces candidate session length when a project doesn&apos;t need every factor.
          </div>
        </CardHeader>
        <CardContent>
          <FactorPicker
            projectId={p.id}
            capabilities={caps}
            factorsByDomain={factorsByDomain}
            locked={hasAssessments}
          />
          {hasAssessments && (
            <div className="mt-3 text-[11.5px] text-ach-slate-deep bg-ach-slate-tint rounded-[8px] px-3 py-2 border-[0.5px] border-ach-slate-blue/30">
              Factor selection is locked because assessments have been recorded against this project. Any change now would invalidate cross-candidate comparability within the cohort.
            </div>
          )}
        </CardContent>
      </Card>

      {hasAnyAssessmentData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Capability radar</div>
              <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Aggregate scores per domain. Baseline (lighter) vs Exit/Follow-up (darker).</div>
            </CardHeader>
            <CardContent>
              <CapabilityRadar data={radarData} mode="comparison" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Current scores by domain</div>
              <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Faded bars are Optional; full opacity are Core.</div>
            </CardHeader>
            <CardContent>
              <CapabilityBar data={barData} />
            </CardContent>
          </Card>
        </div>
      )}

      {narrativeTexts.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Themes in evidence</div>
            <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Most frequent words across observable changes, practices, and narrative responses.</div>
          </CardHeader>
          <CardContent>
            <WordCloud texts={narrativeTexts} />
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Cohorts running this project</div>
              <div className="text-[12px] text-ach-navy/60 mt-1">Each cohort is a specific intake against the same design.</div>
            </div>
            <Link href="/cohorts/new">
              <Button size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" />New cohort</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {cohortRows.length === 0 ? (
            <div className="flex flex-col items-center text-center py-8 text-ach-navy/50">
              <Layers className="h-8 w-8 mb-2" />
              <p className="text-[13px]">No cohorts linked yet. Create a cohort and pick this project on its form.</p>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Reference</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Name</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Location</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Start</th>
                  <th className="text-right py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Candidates</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {cohortRows.map(c => (
                  <tr key={c.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/30">
                    <td className="py-2">
                      <Link href={`/cohorts/${c.id}`} className="text-ach-navy font-medium hover:underline">{c.cohort_ref}</Link>
                    </td>
                    <td className="py-2 text-ach-navy/80">{c.name}</td>
                    <td className="py-2 text-ach-navy/70">{c.location ?? '—'}</td>
                    <td className="py-2 text-ach-navy/70">{c.start_date ? new Date(c.start_date).toLocaleDateString('en-GB') : '—'}</td>
                    <td className="py-2 text-right tabular-nums text-ach-navy/80">{c.cohort_candidates?.length ?? 0}{c.target_size ? ` / ${c.target_size}` : ''}</td>
                    <td className="py-2"><Badge variant={c.status === 'completed' ? 'active' : c.status === 'cancelled' ? 'closed' : 'default'}>{COHORT_STATUS_LABELS[c.status as keyof typeof COHORT_STATUS_LABELS] ?? c.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Recent assessments</div>
            <Link href={`/projects/${p.id}/assess`}>
              <Button size="sm" variant="secondary"><ClipboardCheck className="h-3.5 w-3.5" />Run assessment</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!assessments.data || assessments.data.length === 0 ? (
            <p className="text-[13px] text-ach-navy/60">No assessments yet. Click &quot;Run assessment&quot; to capture a baseline.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Candidate</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Timepoint</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Assessed on</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Status</th>
                  <th className="text-right py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(assessments.data as any[]).map(a => (
                  <tr key={a.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <td className="py-2">
                      <Link href={`/candidates/${a.candidate_id}`} className="text-ach-navy font-medium hover:underline">
                        {a.candidates?.candidate_ref} · {a.candidates?.given_name}
                      </Link>
                    </td>
                    <td className="py-2 text-ach-navy/70">{timepointLabel(a.timepoint)}</td>
                    <td className="py-2 text-ach-navy/70">{new Date(a.assessed_on).toLocaleDateString('en-GB')}</td>
                    <td className="py-2"><Badge>{a.status}</Badge></td>
                    <td className="py-2 text-right">
                      <Link href={`/projects/${p.id}/assess/${a.id}`} className="text-[12px] underline text-ach-navy">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function timepointLabel(t: string): string {
  const map: Record<string, string> = {
    baseline: 'Baseline', mid_3mo: '3 months', exit_6mo: '6 months', followup_12mo: '12 months',
  };
  return map[t] ?? t;
}

function FundingPill({ model }: { model: FundingModel }) {
  const cls = model === 'commercial'
    ? 'bg-ach-navy text-ach-cream border-ach-navy'
    : model === 'hybrid'
      ? 'bg-ach-slate-tint text-ach-slate-deep border-ach-slate-blue/30'
      : 'bg-ach-page text-ach-navy/80 border-ach-border';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] ${cls}`}>
      {FUNDING_MODEL_LABELS[model]}
    </span>
  );
}

function DT({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-0.5">{label}</dt>
      <dd className="text-ach-navy">{children}</dd>
    </div>
  );
}
