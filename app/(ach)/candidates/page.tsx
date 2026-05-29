import Link from 'next/link';
import { Users, Plus, FolderKanban } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CANDIDATE_STATUSES, CANDIDATE_STATUS_LABELS, LOCALE_NAMES } from '@/lib/candidates/schema';

type Search = { status?: string; at_risk?: string };

type CandidateRow = {
  id: string;
  candidate_ref: string;
  given_name: string;
  family_name: string | null;
  preferred_locale: string;
  country_of_origin: string | null;
  status: string;
  arrival_year: number | null;
  is_ach_tenant: boolean;
  at_risk: boolean;
  at_risk_reason: string | null;
  cohort_candidates: {
    cohorts: {
      id: string;
      project_id: string | null;
      start_date: string | null;
      projects: { id: string; project_ref: string; name: string } | null;
    } | null;
  }[] | null;
};

type ProjectGroup = {
  project: { id: string; project_ref: string; name: string } | null;
  candidates: CandidateRow[];
};

export default async function CandidatesListPage({ searchParams }: { searchParams?: Search }) {
  const supabase = createClient();
  let q = supabase
    .from('candidates')
    .select(`
      id, candidate_ref, given_name, family_name, preferred_locale,
      country_of_origin, status, arrival_year, is_ach_tenant, at_risk, at_risk_reason,
      cohort_candidates(cohorts(id, project_id, start_date, projects(id, project_ref, name)))
    `)
    .order('candidate_ref');

  if (searchParams?.status && (CANDIDATE_STATUSES as readonly string[]).includes(searchParams.status)) {
    q = q.eq('status', searchParams.status);
  }
  if (searchParams?.at_risk === 'true') {
    q = q.eq('at_risk', true);
  }

  const { data: candidatesRaw, error } = await q;
  const candidates = (candidatesRaw ?? []) as unknown as CandidateRow[];

  // Group each candidate under their most recent cohort's project.
  // Unassigned candidates (no cohort) go into a separate bucket.
  const groups = new Map<string, ProjectGroup>();
  const unassigned: CandidateRow[] = [];
  for (const c of candidates) {
    const cohortRows = (c.cohort_candidates ?? [])
      .map(r => r.cohorts)
      .filter((co): co is NonNullable<typeof co> => !!co);
    if (cohortRows.length === 0) {
      unassigned.push(c);
      continue;
    }
    // Pick the cohort with the latest start_date (or first if none has a date).
    const recent = cohortRows.sort((a, b) => {
      const ad = a.start_date ?? '';
      const bd = b.start_date ?? '';
      return bd.localeCompare(ad);
    })[0];
    const project = recent.projects;
    if (!project) {
      unassigned.push(c);
      continue;
    }
    if (!groups.has(project.id)) {
      groups.set(project.id, { project, candidates: [] });
    }
    groups.get(project.id)!.candidates.push(c);
  }

  const orderedGroups = Array.from(groups.values()).sort((a, b) =>
    (a.project!.project_ref ?? '').localeCompare(b.project!.project_ref ?? '')
  );

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Network"
        title="Candidates"
        description="Programme participants grouped by the project they are running through. Career goals and development plans are private — never shown to partners without explicit consent."
        actions={
          <Link href="/candidates/new">
            <Button><Plus className="h-4 w-4" />Add candidate</Button>
          </Link>
        }
      />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <FilterPill href="/candidates" label="All statuses" active={!searchParams?.status && searchParams?.at_risk !== 'true'} />
        {CANDIDATE_STATUSES.map(s => (
          <FilterPill key={s} href={`/candidates?status=${s}`} label={CANDIDATE_STATUS_LABELS[s]} active={searchParams?.status === s} />
        ))}
        <div className="w-px h-5 bg-ach-border mx-1" />
        <FilterPill
          href="/candidates?at_risk=true"
          label="At risk"
          active={searchParams?.at_risk === 'true'}
          variant="risk"
        />
      </div>

      {error && <ErrorBanner message={error.message} />}

      {candidates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No candidates yet"
            description="Add your first candidate to begin tracking capability assessments, placements, and progression."
            action={
              <Link href="/candidates/new">
                <Button><Plus className="h-4 w-4" />Add candidate</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {orderedGroups.map(g => (
            <GroupSection
              key={g.project!.id}
              title={g.project!.name}
              subtitle={g.project!.project_ref}
              href={`/projects/${g.project!.id}`}
              candidates={g.candidates}
            />
          ))}
          {unassigned.length > 0 && (
            <GroupSection
              title="Unassigned"
              subtitle="Not yet enrolled in a cohort"
              candidates={unassigned}
            />
          )}
        </div>
      )}
    </div>
  );
}

function GroupSection({
  title,
  subtitle,
  href,
  candidates,
}: {
  title: string;
  subtitle: string;
  href?: string;
  candidates: CandidateRow[];
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <div className="flex items-baseline gap-2.5">
          <FolderKanban className="h-3.5 w-3.5 text-ach-navy/55 self-center" />
          {href ? (
            <Link href={href} className="text-[14px] font-medium text-ach-navy hover:underline">{title}</Link>
          ) : (
            <span className="text-[14px] font-medium text-ach-navy">{title}</span>
          )}
          <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">{subtitle}</span>
        </div>
        <span className="text-[11.5px] text-ach-navy/55 tabular-nums">{candidates.length} candidate{candidates.length === 1 ? '' : 's'}</span>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-ach-page border-b-[0.5px] border-ach-border">
            <tr>
              <Th>Reference</Th>
              <Th>Given name</Th>
              <Th>Country</Th>
              <Th>Language</Th>
              <Th>Tenant</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {candidates.map(c => (
              <tr key={c.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/50 transition-colors">
                <Td>
                  <Link href={`/candidates/${c.id}`} className="text-ach-navy font-medium hover:underline">
                    {c.candidate_ref}
                  </Link>
                </Td>
                <Td>{c.given_name}</Td>
                <Td className="text-ach-navy/70">{c.country_of_origin ?? '—'}</Td>
                <Td className="text-ach-navy/70">{LOCALE_NAMES[c.preferred_locale as keyof typeof LOCALE_NAMES] ?? c.preferred_locale}</Td>
                <Td>
                  {c.at_risk
                    ? <span title={c.at_risk_reason ?? 'At risk'} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] bg-ach-rose/15 text-[#8B3A4F] border-ach-rose/40">At risk</span>
                    : c.is_ach_tenant
                      ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] bg-ach-slate-tint text-ach-slate-deep border-ach-slate-blue/30">ACH</span>
                      : <span className="text-ach-navy/40 text-[12px]">—</span>}
                </Td>
                <Td><Badge>{CANDIDATE_STATUS_LABELS[c.status as keyof typeof CANDIDATE_STATUS_LABELS] ?? c.status}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
function FilterPill({ href, label, active, variant }: { href: string; label: string; active: boolean; variant?: 'risk' }) {
  const activeCls = variant === 'risk'
    ? 'bg-[#8B3A4F] text-white border-[#8B3A4F]'
    : 'bg-ach-navy text-ach-cream border-ach-navy';
  const idleCls = variant === 'risk'
    ? 'bg-ach-rose/10 text-[#8B3A4F] border-ach-rose/30 hover:bg-ach-rose/15'
    : 'bg-white text-ach-navy/70 border-ach-border hover:bg-ach-page';
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-[12px] border-[0.5px] transition-colors ${
        active ? activeCls : idleCls
      }`}
    >
      {label}
    </Link>
  );
}
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="text-[13px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30 mb-4">
      {message}
    </div>
  );
}
