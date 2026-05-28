import Link from 'next/link';
import { Building2, Users, Layers, FolderKanban } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

async function loadStats() {
  const supabase = createClient();
  const [partners, candidates, cohorts, projects] = await Promise.all([
    supabase.from('partners').select('id', { count: 'exact', head: true }),
    supabase.from('candidates').select('id', { count: 'exact', head: true }),
    supabase.from('cohorts').select('id, status'),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
  ]);
  const cohortsData = (cohorts.data as { id: string; status: string }[] | null) ?? [];
  const cohortsActive = cohortsData.filter(c => c.status === 'in_progress' || c.status === 'recruiting').length;
  return {
    partners: partners.count ?? 0,
    candidates: candidates.count ?? 0,
    cohorts: cohortsData.length,
    cohortsActive,
    projects: projects.count ?? 0,
  };
}

export default async function AchDashboardPage() {
  const stats = await loadStats();

  const cards = [
    { href: '/partners',   label: 'Partners',   value: stats.partners,    icon: Building2,   subline: 'across three types' },
    { href: '/candidates', label: 'Candidates', value: stats.candidates,  icon: Users,        subline: 'in programme or alumni' },
    { href: '/cohorts',    label: 'Cohorts',    value: stats.cohorts,     icon: Layers,       subline: `${stats.cohortsActive} active` },
    { href: '/projects',   label: 'Projects',   value: stats.projects,    icon: FolderKanban, subline: 'HIM-scored programmes' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Workspace"
        title="ACH staff dashboard"
        description="At-a-glance view of partners, candidates, cohorts, and projects. Click any card to drill in."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Link key={c.href} href={c.href}>
            <Card className="hover:bg-ach-page transition-colors h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
                    {c.label}
                  </div>
                  <c.icon className="h-4 w-4 text-ach-navy/40" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none">
                  {c.value}
                </div>
                <div className="text-[12px] text-ach-navy/60 mt-2">{c.subline}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
              Getting started
            </div>
            <div className="text-[15px] font-medium text-ach-navy mt-1">
              Where to begin
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 text-[13px] text-ach-navy/80">
            <p>
              <span className="text-ach-navy font-medium">1.</span> Add your partner organisations on{' '}
              <Link href="/partners" className="underline">Partners</Link> — three types: Capability Investor, Workforce Partner, Training Partner.
            </p>
            <p>
              <span className="text-ach-navy font-medium">2.</span> Add candidates on{' '}
              <Link href="/candidates" className="underline">Candidates</Link> — capture consent as you go.
            </p>
            <p>
              <span className="text-ach-navy font-medium">3.</span> Create a{' '}
              <Link href="/cohorts" className="underline">cohort</Link> and link partners + candidates to it.
            </p>
            <p>
              <span className="text-ach-navy font-medium">4.</span> Set up the{' '}
              <Link href="/projects" className="underline">project</Link> (Core/Optional capabilities, depth or breadth), then run assessments.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
