import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, ClipboardCheck, Plus, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CapabilityPicker } from '@/components/projects/capability-picker';
import {
  PROJECT_TYPE_LABELS, WEIGHT_RATIO_LABELS, OPTIONAL_SCHEME_LABELS,
  FUNDING_MODEL_LABELS, type FundingModel,
} from '@/lib/projects/schema';
import { COHORT_STATUS_LABELS } from '@/lib/cohorts/schema';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: project } = await supabase
    .from('projects').select('*').eq('id', params.id).maybeSingle();
  if (!project) notFound();
  const p = project as any;

  const [capabilities, assessments, cohorts] = await Promise.all([
    supabase.from('project_capabilities').select('domain, role').eq('project_id', params.id),
    supabase.from('assessments')
      .select('id, timepoint, assessed_on, status, candidate_id, candidates(candidate_ref, given_name)')
      .eq('project_id', params.id).order('assessed_on', { ascending: false }).limit(10),
    supabase.from('cohorts')
      .select('id, cohort_ref, name, status, location, start_date, target_size, cohort_candidates(id)')
      .eq('project_id', params.id)
      .order('start_date', { ascending: false }),
  ]);

  const caps = (capabilities.data as any[]) ?? [];
  const cohortRows = (cohorts.data as any[]) ?? [];
  const totalStarts = cohortRows.reduce((s, c) => s + (c.cohort_candidates?.length ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref="/projects"
        backLabel="Projects"
        miniLabel={p.project_ref}
        title={p.name}
        description={p.description ?? undefined}
        actions={
          <Link href={`/projects/${p.id}/edit`}>
            <Button variant="secondary"><Pencil className="h-3.5 w-3.5" />Edit</Button>
          </Link>
        }
      />

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
              <DT label="Type">{PROJECT_TYPE_LABELS[p.type as keyof typeof PROJECT_TYPE_LABELS]}</DT>
              <DT label="Weight ratio">{WEIGHT_RATIO_LABELS[p.weight_ratio as keyof typeof WEIGHT_RATIO_LABELS]}</DT>
              <DT label="Hybrid option">{p.hybrid_option ?? '—'}</DT>
              <DT label="Optional scheme">{OPTIONAL_SCHEME_LABELS[p.optional_scheme as keyof typeof OPTIONAL_SCHEME_LABELS] ?? p.optional_scheme}</DT>
              <DT label="Stability blend">{Number(p.stability_blend).toFixed(2)}</DT>
              <DT label="Classification score">{p.classification_total ?? '—'}/8</DT>
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
