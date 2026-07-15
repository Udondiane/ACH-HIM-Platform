import Link from 'next/link';
import { Users, Plus, FolderKanban, ArrowLeft, List, ArrowRight, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CANDIDATE_STATUSES, CANDIDATE_STATUS_LABELS, LOCALE_NAMES } from '@/lib/candidates/schema';
import { CandidateIdentity } from '@/components/ui/candidate-identity';

export const dynamic = 'force-dynamic';

type Search = { status?: string; at_risk?: string; project?: string; view?: string };

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
      service_type: string | null;
      projects: { id: string; project_ref: string; name: string } | null;
    } | null;
  }[] | null;
};

type ProjectGroup = {
  project: { id: string; project_ref: string; name: string } | null;
  serviceType: string;
  candidates: CandidateRow[];
};

export default async function CandidatesListPage({ searchParams }: { searchParams?: Search }) {
  const supabase = createClient();
  let q = supabase
    .from('candidates')
    .select(`
      id, candidate_ref, given_name, family_name, preferred_locale,
      country_of_origin, status, arrival_year, is_ach_tenant, at_risk, at_risk_reason,
      cohort_candidates(cohorts(id, project_id, start_date, service_type, projects(id, project_ref, name)))
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

  // Group each candidate under (project, service_type). A candidate's most
  // recent cohort's project + service_type becomes the bucket. Programmes
  // with multiple service shapes (e.g. B2E running Full programme AND
  // IAG only cohorts) appear as separate cards on the index.
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
    const serviceType = recent.service_type ?? 'full_programme';
    const key = `${project.id}::${serviceType}`;
    if (!groups.has(key)) {
      groups.set(key, { project, serviceType, candidates: [] });
    }
    groups.get(key)!.candidates.push(c);
  }

  const SERVICE_ORDER: Record<string, number> = { full_programme: 1, iag_only: 2 };
  const orderedGroups = Array.from(groups.values()).sort((a, b) => {
    const refCmp = (a.project!.project_ref ?? '').localeCompare(b.project!.project_ref ?? '');
    if (refCmp !== 0) return refCmp;
    return (SERVICE_ORDER[a.serviceType] ?? 99) - (SERVICE_ORDER[b.serviceType] ?? 99);
  });

  const isAllView = searchParams?.view === 'all';
  const focusedProjectParam = searchParams?.project;
  // Focus key is now `<projectId>::<serviceType>` (or 'unassigned'). Old links
  // with just a projectId fall back to the first matching service type.
  const [focusedProjectId, focusedServiceType] = focusedProjectParam
    ? focusedProjectParam.split('::')
    : [undefined, undefined];
  const focusedGroup = focusedProjectParam
    ? (focusedProjectParam === 'unassigned'
        ? { project: null, serviceType: 'full_programme' as string, candidates: unassigned }
        : (focusedServiceType
            ? orderedGroups.find(g => g.project?.id === focusedProjectId && g.serviceType === focusedServiceType)
            : orderedGroups.find(g => g.project?.id === focusedProjectId)
          ) ?? null)
    : null;

  // Filter pill base href changes based on which view we're in
  const baseHref =
    focusedProjectParam ? `/candidates?project=${focusedProjectParam}`
    : isAllView ? '/candidates?view=all'
    : '/candidates';

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Network"
        title={
          focusedGroup
            ? (focusedGroup.project?.name
                ? `${focusedGroup.project.name} · ${SERVICE_TYPE_LABEL[focusedGroup.serviceType] ?? focusedGroup.serviceType}`
                : 'Unassigned candidates')
            : isAllView
              ? 'All candidates'
              : 'Candidates'
        }
        backHref={focusedGroup || isAllView ? '/candidates' : undefined}
        backLabel={focusedGroup || isAllView ? 'Programmes' : undefined}
        description={
          focusedGroup
            ? `Candidates running through ${focusedGroup.project?.name ?? 'no programme'}${focusedGroup.project ? ` (${SERVICE_TYPE_LABEL[focusedGroup.serviceType] ?? focusedGroup.serviceType})` : ''}.`
            : isAllView
              ? 'Every candidate across every programme. Use the filters to narrow.'
              : 'Programme participants grouped by the project (and service shape) they are running through. Pick a card to drill in, or view all candidates flat.'
        }
        actions={
          <div className="flex items-center gap-2">
            {!focusedGroup && !isAllView && (
              <Link href="/candidates?view=all">
                <Button variant="secondary"><List className="h-4 w-4" />View all candidates</Button>
              </Link>
            )}
            <Link href="/candidates/import">
              <Button variant="secondary"><Plus className="h-4 w-4" />Import from CSV</Button>
            </Link>
            <Link href="/candidates/new">
              <Button><Plus className="h-4 w-4" />Add candidate</Button>
            </Link>
          </div>
        }
      />

      {/* Filters — shown for inside-project view and all-candidates view, not the programme-cards index */}
      {(focusedGroup || isAllView) && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <FilterPill href={baseHref} label="All statuses" active={!searchParams?.status && searchParams?.at_risk !== 'true'} />
          {CANDIDATE_STATUSES.map(s => (
            <FilterPill key={s} href={addParam(baseHref, 'status', s)} label={CANDIDATE_STATUS_LABELS[s]} active={searchParams?.status === s} />
          ))}
          <div className="w-px h-5 bg-ach-border mx-1" />
          <FilterPill
            href={addParam(baseHref, 'at_risk', 'true')}
            label="Needs attention"
            active={searchParams?.at_risk === 'true'}
            variant="risk"
          />
        </div>
      )}

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
      ) : focusedGroup ? (
        /* Single-programme drill-in: just the candidate table for that project */
        focusedGroup.candidates.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="No candidates match the filter"
              description="Clear the filter or choose a different programme."
            />
          </Card>
        ) : (
          <CandidateTable candidates={focusedGroup.candidates} />
        )
      ) : isAllView ? (
        /* Flat all-candidates view */
        <CandidateTable candidates={candidates} />
      ) : (
        /* Default: programme cards index */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orderedGroups.map(g => (
            <ProgrammeCard
              key={`${g.project!.id}-${g.serviceType}`}
              focusKey={`${g.project!.id}::${g.serviceType}`}
              title={g.project!.name}
              ref_={g.project!.project_ref}
              serviceType={g.serviceType}
              candidates={g.candidates}
            />
          ))}
          {unassigned.length > 0 && (
            <ProgrammeCard
              focusKey="unassigned"
              title="Unassigned"
              ref_="No cohort yet"
              serviceType="full_programme"
              candidates={unassigned}
              isUnassigned
            />
          )}
        </div>
      )}
    </div>
  );
}

const SERVICE_TYPE_LABEL: Record<string, string> = {
  full_programme: 'Full programme',
  iag_only:       'IAG only',
};

function ProgrammeCard({
  focusKey, title, ref_, serviceType, candidates, isUnassigned,
}: {
  focusKey: string;
  title: string;
  ref_: string;
  serviceType: string;
  candidates: CandidateRow[];
  isUnassigned?: boolean;
}) {
  const atRiskCount = candidates.filter(c => c.at_risk).length;
  const inProgrammeCount = candidates.filter(c => c.status === 'in_programme').length;
  const placedCount = candidates.filter(c => c.status === 'placed').length;
  const exitedCount = candidates.filter(c => c.status === 'withdrawn' || c.status === 'completed').length;

  const serviceLabel = SERVICE_TYPE_LABEL[serviceType] ?? serviceType;

  return (
    <Link href={`/candidates?project=${focusKey}`} className="block">
      <Card className="hover:bg-ach-page transition-colors h-full p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{ref_}</div>
            <div className="text-[15px] font-medium text-ach-navy flex items-center gap-1.5">
              <FolderKanban className="h-3.5 w-3.5 text-ach-navy/55 shrink-0" />
              {title}
            </div>
            {!isUnassigned && (
              <div className="mt-1.5">
                <span className={`inline-flex items-center text-[10.5px] uppercase tracking-[1.2px] font-medium rounded-full px-2 py-0.5 border-[0.5px] ${
                  serviceType === 'iag_only'
                    ? 'bg-ach-slate-tint text-ach-slate-deep border-ach-slate-blue/30'
                    : 'bg-white text-ach-navy/65 border-ach-border'
                }`}>
                  {serviceLabel}
                </span>
              </div>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-ach-navy/40 shrink-0 mt-1" />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center text-[11.5px] text-ach-navy/75">
            <Users className="h-3 w-3 mr-1 text-ach-navy/55" />
            <span className="font-medium tabular-nums">{candidates.length}</span>
            <span className="ml-1 text-ach-navy/55">{candidates.length === 1 ? 'candidate' : 'candidates'}</span>
          </span>
          {atRiskCount > 0 && (
            <span className="inline-flex items-center text-[10.5px] uppercase tracking-[1.2px] font-medium text-[#8B3A4F]">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {atRiskCount} need{atRiskCount === 1 ? 's' : ''} attention
            </span>
          )}
        </div>

        {!isUnassigned && (inProgrammeCount > 0 || placedCount > 0 || exitedCount > 0) && (
          <div className="flex items-center gap-2.5 mt-3 pt-3 border-t-[0.5px] border-ach-border text-[11px] text-ach-navy/65">
            {inProgrammeCount > 0 && <span><span className="font-medium text-ach-navy/85">{inProgrammeCount}</span> in programme</span>}
            {placedCount > 0 && <span><span className="font-medium text-ach-navy/85">{placedCount}</span> placed</span>}
            {exitedCount > 0 && <span><span className="font-medium text-ach-navy/85">{exitedCount}</span> exited</span>}
          </div>
        )}
      </Card>
    </Link>
  );
}

function CandidateTable({ candidates }: { candidates: CandidateRow[] }) {
  return (
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
              <Td><CandidateIdentity candidate={c} /></Td>
              <Td className="text-ach-navy/70">{c.country_of_origin ?? '—'}</Td>
              <Td className="text-ach-navy/70">{LOCALE_NAMES[c.preferred_locale as keyof typeof LOCALE_NAMES] ?? c.preferred_locale}</Td>
              <Td>
                {c.at_risk
                  ? <span title={c.at_risk_reason ?? 'Needs attention'} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] bg-ach-rose/15 text-[#8B3A4F] border-ach-rose/40">Needs attention</span>
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
  );
}

function addParam(baseHref: string, key: string, value: string): string {
  const [path, qs] = baseHref.split('?');
  const params = new URLSearchParams(qs ?? '');
  params.set(key, value);
  return `${path}?${params.toString()}`;
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
