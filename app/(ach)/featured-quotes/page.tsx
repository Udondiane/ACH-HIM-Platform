import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArchiveQuoteButton } from '@/components/featured-quotes/archive-button';

export const metadata = { title: 'Featured quotes library' };

interface Search { projectId?: string }

export default async function FeaturedQuotesPage({ searchParams }: { searchParams?: Search }) {
  const supabase = createClient();

  // Pull quotes, cohorts + their project links, and project names so we
  // can display + filter by project. cohort_id on featured_quotes is
  // the primary anchor; candidates.cohort membership is the backup path
  // for older quotes that pre-date cohort tagging.
  const [quotesRes, cohortsRes, projectsRes, cohortCandsRes] = await Promise.all([
    supabase
      .from('featured_quotes')
      .select('id, quote_text, context, speaker_type, source_type, use_anonymised, display_name, tagged_at, candidate_id, cohort_id, candidates(candidate_ref, given_name), cohorts(name, project_id)')
      .is('archived_at', null)
      .order('tagged_at', { ascending: false })
      .limit(200),
    supabase.from('cohorts').select('id, project_id'),
    supabase.from('projects').select('id, project_ref, name').order('project_ref'),
    supabase.from('cohort_candidates').select('cohort_id, candidate_id'),
  ]);

  const quotes = ((quotesRes.data as any[]) ?? []);
  const projects = ((projectsRes.data as any[]) ?? []);
  const cohortToProject = new Map<string, string>();
  for (const c of ((cohortsRes.data as { id: string; project_id: string | null }[]) ?? [])) {
    if (c.project_id) cohortToProject.set(c.id, c.project_id);
  }
  const projectById = new Map<string, { id: string; project_ref: string; name: string }>(
    projects.map((p: any) => [p.id, p]),
  );
  // Candidate → set of projects they're enrolled in (via any cohort)
  const candidateToProjects = new Map<string, Set<string>>();
  for (const cc of ((cohortCandsRes.data as { cohort_id: string; candidate_id: string }[]) ?? [])) {
    const projId = cohortToProject.get(cc.cohort_id);
    if (!projId) continue;
    if (!candidateToProjects.has(cc.candidate_id)) candidateToProjects.set(cc.candidate_id, new Set());
    candidateToProjects.get(cc.candidate_id)!.add(projId);
  }

  // Attach a project to each quote for display + filtering.
  //   1st preference: the quote's cohort → project mapping
  //   2nd preference: the candidate's enrolment → project mapping
  //                  (returns the first project if enrolled in several;
  //                  a quote spanning multiple projects is edge-case
  //                  and worth surfacing separately if it becomes common)
  const enriched = quotes.map(q => {
    let projectId: string | null = null;
    if (q.cohort_id) projectId = cohortToProject.get(q.cohort_id) ?? null;
    if (!projectId && q.candidate_id) {
      const set = candidateToProjects.get(q.candidate_id);
      if (set && set.size > 0) projectId = Array.from(set)[0];
    }
    const project = projectId ? projectById.get(projectId) ?? null : null;
    return { ...q, project };
  });

  const filterProjectId = searchParams?.projectId ?? '';
  const filtered = filterProjectId
    ? enriched.filter(q => q.project?.id === filterProjectId)
    : enriched;

  // Rollup for the filter dropdown — quote counts per project so ACH
  // staff can see at a glance which projects have quotes attached.
  const countByProject = new Map<string, number>();
  for (const q of enriched) {
    if (q.project?.id) countByProject.set(q.project.id, (countByProject.get(q.project.id) ?? 0) + 1);
  }
  const unattachedCount = enriched.filter(q => !q.project).length;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader miniLabel="Reports" title="Featured quotes library" />
      <p className="text-[13px] text-ach-navy/70 -mt-2 mb-4">
        Curated quotes from assessments, timepoint feedback and interviews. Every quote is
        tagged to the project its candidate belongs to and only appears on that project&apos;s
        outcomes report. Consent-gated: quotes only surface when the candidate has granted
        quoting consent.
      </p>

      {/* Project filter — client-safe (server-rendered links, no JS
          required). Keeps a stable URL you can bookmark or share. */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="text-ach-navy/60">Filter by project:</span>
        <Link
          href="/featured-quotes"
          className={`px-2.5 py-1 rounded-full border-[0.5px] ${!filterProjectId ? 'bg-ach-navy text-ach-cream border-ach-navy' : 'border-ach-border bg-white text-ach-navy/75 hover:bg-ach-page'}`}
        >
          All ({enriched.length})
        </Link>
        {projects
          .filter((p: any) => (countByProject.get(p.id) ?? 0) > 0)
          .map((p: any) => {
            const active = filterProjectId === p.id;
            return (
              <Link
                key={p.id}
                href={`/featured-quotes?projectId=${p.id}`}
                className={`px-2.5 py-1 rounded-full border-[0.5px] ${active ? 'bg-ach-navy text-ach-cream border-ach-navy' : 'border-ach-border bg-white text-ach-navy/75 hover:bg-ach-page'}`}
              >
                {p.name} ({countByProject.get(p.id) ?? 0})
              </Link>
            );
          })}
        {unattachedCount > 0 && (
          <span className="text-[11px] text-ach-navy/45 italic">
            {unattachedCount} quote{unattachedCount === 1 ? '' : 's'} not yet attached to a project
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-[13px] text-ach-navy/70">
            <p className="mb-2">
              {filterProjectId ? 'No quotes for this project yet.' : 'No featured quotes yet.'}
            </p>
            <p className="text-ach-navy/55">
              Assessors can flag a response as feature-worthy during any assessment, or promote
              a closing-reflection answer directly. Flagged responses become available for
              curation into reports.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => (
            <Card key={q.id}>
              <CardContent className="pt-5 pb-4">
                <div className="text-[14px] text-ach-navy font-serif italic leading-relaxed">
                  &ldquo;{q.quote_text}&rdquo;
                </div>
                <div className="flex items-center flex-wrap gap-2 text-[11.5px] text-ach-navy/60 mt-2">
                  <Badge>{q.speaker_type}</Badge>
                  <Badge>from {q.source_type.replace('_', ' ')}</Badge>
                  {q.use_anonymised
                    ? <span>Anonymised</span>
                    : <span>By name: {q.display_name ?? '—'}</span>}
                  {q.context && <span className="italic">&middot; {q.context}</span>}
                </div>
                <div className="flex items-center gap-3 text-[11.5px] text-ach-navy/55 mt-2 flex-wrap">
                  {q.project ? (
                    <Link
                      href={`/projects/${q.project.id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ach-page border-[0.5px] border-ach-border hover:bg-white"
                    >
                      <span className="font-mono text-[10.5px] text-ach-navy/60">{q.project.project_ref}</span>
                      <span className="text-ach-navy">{q.project.name}</span>
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ach-rose/10 border-[0.5px] border-ach-rose/30 text-[#8B3A4F] italic">
                      Not attached to a project
                    </span>
                  )}
                  {q.candidates?.candidate_ref && (
                    <Link href={`/candidates/${q.candidate_id}`} className="hover:text-ach-navy underline underline-offset-2">
                      {q.candidates.candidate_ref}
                    </Link>
                  )}
                  {q.cohorts?.name && (
                    <Link href={`/cohorts/${q.cohort_id}`} className="hover:text-ach-navy underline underline-offset-2">
                      {q.cohorts.name}
                    </Link>
                  )}
                  <span className="ml-auto text-ach-navy/40">
                    tagged {new Date(q.tagged_at).toLocaleDateString('en-GB')}
                  </span>
                  <ArchiveQuoteButton id={q.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
