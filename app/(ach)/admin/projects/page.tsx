import Link from 'next/link';
import { Settings2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PROJECT_TYPE_LABELS, WEIGHT_RATIO_LABELS } from '@/lib/projects/schema';

export default async function ProjectAdminListPage() {
  const supabase = createClient();
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_ref, name, type, weight_ratio, hybrid_option, stability_blend, classification_total')
    .order('project_ref');

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Admin"
        title="Project technical config"
        description="Override the auto-derived project type or weight ratio, run the HIM methodology classification (Q1-Q4), or adjust scoring options. These are advanced settings that most users do not need to change."
      />

      {!projects || projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Settings2 className="h-10 w-10" />}
            title="No projects to configure"
            description="Create a project first; its technical settings will appear here."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-ach-page border-b-[0.5px] border-ach-border">
              <tr>
                <Th>Reference</Th>
                <Th>Project</Th>
                <Th>Type</Th>
                <Th>Weight ratio</Th>
                <Th>Stability</Th>
                <Th>Classification</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {(projects as any[]).map(p => (
                <tr key={p.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/40">
                  <Td><span className="text-ach-navy/70">{p.project_ref}</span></Td>
                  <Td><span className="font-medium text-ach-navy">{p.name}</span></Td>
                  <Td className="text-ach-navy/70">{PROJECT_TYPE_LABELS[p.type as keyof typeof PROJECT_TYPE_LABELS]}</Td>
                  <Td className="text-ach-navy/70">{WEIGHT_RATIO_LABELS[p.weight_ratio as keyof typeof WEIGHT_RATIO_LABELS]?.split(' — ')[0] ?? p.weight_ratio}</Td>
                  <Td className="text-ach-navy/70 tabular-nums">{Number(p.stability_blend ?? 0).toFixed(2)}</Td>
                  <Td className="text-ach-navy/70 tabular-nums">{p.classification_total ?? '—'}/8</Td>
                  <Td>
                    <Link
                      href={`/admin/projects/${p.id}`}
                      className="text-[12px] underline text-ach-navy hover:no-underline"
                    >
                      Edit
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
