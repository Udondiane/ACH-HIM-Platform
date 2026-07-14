import Link from 'next/link';
import { FolderKanban, Plus, Layers, Users, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { FUNDING_MODEL_LABELS, type FundingModel } from '@/lib/projects/schema';

export const dynamic = 'force-dynamic';

function FundingPill({ model }: { model: FundingModel }) {
  const cls = model === 'commercial'
    ? 'bg-ach-navy text-ach-cream border-ach-navy'
    : model === 'hybrid'
      ? 'bg-ach-slate-tint text-ach-slate-deep border-ach-slate-blue/30'
      : 'bg-ach-page text-ach-navy/80 border-ach-border';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[1.1px] font-medium border-[0.5px] ${cls}`}>
      {FUNDING_MODEL_LABELS[model]}
    </span>
  );
}

export default async function ProjectsListPage() {
  const supabase = createClient();
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      id, project_ref, name, description, type, weight_ratio, status, start_date,
      funding_model, funder_name,
      cohorts(id, cohort_candidates(id))
    `)
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Network"
        title="Projects"
        description="A project is an intervention design. Cohorts of candidates run under a project."
        actions={<Link href="/projects/new"><Button><Plus className="h-4 w-4" />New project</Button></Link>}
      />

      {error ? (
        <Card>
          <div className="p-6 flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-[#8B3A4F] shrink-0 mt-0.5" />
            <div className="space-y-2 text-[13px] text-ach-navy/80">
              <p className="font-medium text-ach-navy">Could not load projects.</p>
              <p>
                Supabase returned: <code className="text-[11.5px] bg-ach-page px-1 rounded">{error.message}</code>
              </p>
              <p>
                If <code className="text-[12px] bg-ach-page px-1 rounded">AUTH_DISABLED=true</code> on Vercel,
                also set <code className="text-[12px] bg-ach-page px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code>{' '}
                in Vercel → Settings → Environment Variables, then redeploy.
              </p>
            </div>
          </div>
        </Card>
      ) : !projects || projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="h-10 w-10" />}
            title="No projects yet"
            description="Create your first project. Once it's set up you'll choose the Core/Optional capability mix and start running assessments — for either a cohort intake or individual delivery."
            action={<Link href="/projects/new"><Button><Plus className="h-4 w-4" />New project</Button></Link>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(projects as any[]).map(p => {
            const cohortCount = p.cohorts?.length ?? 0;
            const candidateStarts = (p.cohorts ?? []).reduce(
              (sum: number, c: any) => sum + (c.cohort_candidates?.length ?? 0),
              0,
            );
            return (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="hover:bg-ach-page transition-colors h-full">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{p.project_ref}</div>
                      <div className="flex items-center gap-2">
                        {p.funding_model && <FundingPill model={p.funding_model as FundingModel} />}
                        <Badge>{p.status}</Badge>
                      </div>
                    </div>
                    <h3 className="text-[15px] font-medium text-ach-navy">{p.name}</h3>
                    {p.funder_name && (
                      <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Funded by {p.funder_name}</div>
                    )}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t-[0.5px] border-ach-border text-[12px] text-ach-navy/70">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5" />
                        {cohortCount === 0
                          ? <span className="text-ach-navy/45">No cohorts</span>
                          : <span><span className="font-medium text-ach-navy">{cohortCount}</span> cohort{cohortCount === 1 ? '' : 's'}</span>}
                      </span>
                      {candidateStarts > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          <span className="font-medium text-ach-navy">{candidateStarts}</span> candidate{candidateStarts === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
