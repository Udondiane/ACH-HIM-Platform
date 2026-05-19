import Link from 'next/link';
import { FolderKanban, Plus } from 'lucide-react';
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
    .select('id, project_ref, name, type, weight_ratio, status, start_date, cohorts(cohort_ref, name)')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Network"
        title="Projects"
        description="HIM-scored programmes. Each project has a Core/Optional capability selection, a weight ratio, and one or more assessment timepoints."
        actions={<Link href="/projects/new"><Button><Plus className="h-4 w-4" />New project</Button></Link>}
      />

      {!projects || projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="h-10 w-10" />}
            title="No projects yet"
            description="Create a project to begin running capability assessments and calculating HIM scores."
            action={<Link href="/projects/new"><Button><Plus className="h-4 w-4" />New project</Button></Link>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(projects as any[]).map(p => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="hover:bg-ach-page transition-colors h-full">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{p.project_ref}</div>
                    <Badge>{p.status}</Badge>
                  </div>
                  <h3 className="text-[15px] font-medium text-ach-navy">{p.name}</h3>
                  <div className="text-[12px] text-ach-navy/60 mt-2 space-y-0.5">
                    <div>{PROJECT_TYPE_LABELS[p.type as keyof typeof PROJECT_TYPE_LABELS]} · {WEIGHT_RATIO_LABELS[p.weight_ratio as keyof typeof WEIGHT_RATIO_LABELS]?.split(' — ')[0]}</div>
                    {p.cohorts && <div className="text-ach-navy/50">{p.cohorts.cohort_ref}</div>}
                    {p.start_date && <div className="text-ach-navy/50">Starts {new Date(p.start_date).toLocaleDateString('en-GB')}</div>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
