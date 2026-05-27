import Link from 'next/link';
import { FolderKanban, Plus, Layers, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PROJECT_TYPE_LABELS, WEIGHT_RATIO_LABELS } from '@/lib/projects/schema';

export default async function ProjectsListPage() {
  const supabase = createClient();
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, project_ref, name, description, type, weight_ratio, status, start_date,
      cohorts(id, cohort_candidates(id))
    `)
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Network"
        title="Projects"
        description="Each project is a distinct intervention design with its own capability mix and HIM scoring. Cohorts of candidates run under a project; some projects (training, IAG, consultancy) deliver impact without cohort-based delivery."
        actions={<Link href="/projects/new"><Button><Plus className="h-4 w-4" />New project</Button></Link>}
      />

      {!projects || projects.length === 0 ? (
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
                      <Badge>{p.status}</Badge>
                    </div>
                    <h3 className="text-[15px] font-medium text-ach-navy">{p.name}</h3>
                    {p.description && (
                      <p className="text-[12.5px] text-ach-navy/70 mt-1.5 line-clamp-2">{p.description}</p>
                    )}
                    <div className="text-[11.5px] text-ach-navy/55 mt-3">
                      {PROJECT_TYPE_LABELS[p.type as keyof typeof PROJECT_TYPE_LABELS]}
                      {' · '}
                      {WEIGHT_RATIO_LABELS[p.weight_ratio as keyof typeof WEIGHT_RATIO_LABELS]?.split(' — ')[0]}
                    </div>
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
