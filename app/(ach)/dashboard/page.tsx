import Link from 'next/link';
import { FolderKanban, Upload, Clock, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { TRAINING_OUTCOME_LABELS, FIXED_BENEFICIARY_OUTCOMES } from '@/lib/activities/definitions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DOMAINS = [
  { key: 'employment', label: 'Employment',           hint: 'work, earnings, quality of employment' },
  { key: 'housing',    label: 'Housing',              hint: 'security, quality, affordability' },
  { key: 'education',  label: 'Education & Skills',   hint: 'language, digital, vocational skills' },
  { key: 'health',     label: 'Health & Wellbeing',   hint: 'mental, physical, healthcare access' },
  { key: 'belonging',  label: 'Belonging & Identity', hint: 'cultural comfort, self-worth, roots' },
  { key: 'social',     label: 'Social Participation', hint: 'networks, civic life, community' },
  { key: 'rights',     label: 'Rights & Citizenship', hint: 'immigration status, rights, voice' },
];

// Full outcome catalogue — training-pass outcomes + fixed employability
// outcomes, keyed the same way beneficiary_outcomes.outcome_key is.
// Rendering the full frame (with zeros) beats hiding rows because it
// shows the shape of what will populate as delivery progresses.
const OUTCOME_CATALOGUE = [
  ...Object.entries(TRAINING_OUTCOME_LABELS).map(([key, label]) => ({ key, label })),
  ...FIXED_BENEFICIARY_OUTCOMES,
];

async function safeFetch<T>(fn: () => any, fallback: T): Promise<T> {
  try {
    const r = await fn();
    if (r?.error) return fallback;
    return (r?.data ?? fallback) as T;
  } catch { return fallback; }
}

export default async function AchDashboardPage() {
  const supabase = createClient();

  const [
    projects, cohortCandidates, placements, allCandidates,
    assessments, responses, indicators, factorDomains, benefOutcomes,
    featuredQuotes, changeLog, statusTransitions,
  ] = await Promise.all([
    safeFetch<any[]>(() => supabase.from('projects').select('id, status'), []),
    safeFetch<any[]>(() => supabase.from('cohort_candidates').select('candidate_id'), []),
    safeFetch<any[]>(() => supabase.from('placements').select('candidate_id, salary_pence, status'), []),
    safeFetch<any[]>(() => supabase.from('candidates').select('id, status'), []),
    safeFetch<any[]>(() => supabase.from('assessments').select('id, timepoint').limit(3000), []),
    safeFetch<any[]>(() => supabase.from('assessment_responses').select('assessment_id, indicator_id, numeric_value').limit(6000), []),
    safeFetch<any[]>(() => supabase.from('indicators').select('id, factor_id'), []),
    safeFetch<any[]>(() => supabase.from('factor_domains').select('factor_id, domain_id'), []),
    safeFetch<any[]>(() => supabase.from('beneficiary_outcomes').select('candidate_id, outcome_key, outcome_label, created_at').limit(5000), []),
    safeFetch<any[]>(() => supabase.from('featured_quotes').select('id').is('archived_at', null), []),
    safeFetch<any[]>(() => supabase.from('candidate_change_log').select('id, changed_at, field_name, candidate_id, candidates(candidate_ref)').order('changed_at', { ascending: false }).limit(6), []),
    safeFetch<any[]>(() => supabase.from('candidate_status_transitions').select('id, from_status, to_status, changed_at, candidate_id, candidates(candidate_ref)').order('changed_at', { ascending: false }).limit(6), []),
  ]);

  // ── Network-wide KPIs (same shape as the outcomes report hero) ──
  const enrolledCandidateIds = new Set((cohortCandidates as any[]).map((cc: any) => cc.candidate_id));
  const enrolledCount = enrolledCandidateIds.size;
  const completedCount = (allCandidates as any[]).filter((c: any) =>
    enrolledCandidateIds.has(c.id) && c.status !== 'withdrawn' && c.status !== 'applicant',
  ).length;
  const withdrawnCount = (allCandidates as any[]).filter((c: any) => c.status === 'withdrawn').length;
  const activePlacements = (placements as any[]).filter((p: any) => p.status !== 'cancelled');
  const placedCount = activePlacements.length;
  const totalSalary = activePlacements.reduce((s: number, p: any) => s + (p.salary_pence ?? 0), 0) / 100;
  const totalProjects = (projects as any[]).length;
  const activeProjects = (projects as any[]).filter((p: any) => p.status === 'active').length;
  const featuredQuotesCount = (featuredQuotes as any[]).length;

  // ── Per-domain mean baseline vs exit ──
  const indToFactor = new Map((indicators as any[]).map((i: any) => [i.id, i.factor_id]));
  const factorToDomains = new Map<string, string[]>();
  for (const fd of factorDomains as any[]) {
    const arr = factorToDomains.get(fd.factor_id) ?? [];
    arr.push(fd.domain_id);
    factorToDomains.set(fd.factor_id, arr);
  }
  const asmById = new Map((assessments as any[]).map((a: any) => [a.id, a]));

  const perDomain = new Map<string, { baseline: number[]; exit: number[] }>();
  for (const d of DOMAINS) perDomain.set(d.key, { baseline: [], exit: [] });

  for (const r of responses as any[]) {
    if (typeof r.numeric_value !== 'number') continue;
    const factor = indToFactor.get(r.indicator_id);
    if (!factor) continue;
    const asm = asmById.get(r.assessment_id) as any;
    if (!asm) continue;
    for (const d of (factorToDomains.get(factor) ?? [])) {
      const entry = perDomain.get(d);
      if (!entry) continue;
      if (asm.timepoint === 'baseline') entry.baseline.push(Number(r.numeric_value));
      if (asm.timepoint === 'mid_3mo' || asm.timepoint === 'exit_6mo' || asm.timepoint === 'followup_12mo') entry.exit.push(Number(r.numeric_value));
    }
  }

  const mean = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
  const domainRows = DOMAINS.map(d => {
    const e = perDomain.get(d.key)!;
    return { ...d, baseline: mean(e.baseline), exit: mean(e.exit), baselineN: e.baseline.length, exitN: e.exit.length };
  });

  // ── Outcomes ladder — full catalogue, count per outcome ──
  const outcomeCountByKey = new Map<string, Set<string>>();
  for (const o of (benefOutcomes as any[])) {
    if (!o.outcome_key || o.outcome_key === 'other') continue;
    if (!outcomeCountByKey.has(o.outcome_key)) outcomeCountByKey.set(o.outcome_key, new Set());
    outcomeCountByKey.get(o.outcome_key)!.add(o.candidate_id);
  }
  const outcomeRows = OUTCOME_CATALOGUE.map(o => ({
    ...o,
    count: outcomeCountByKey.get(o.key)?.size ?? 0,
  }));
  const totalOtherOutcomes = (benefOutcomes as any[]).filter((o: any) => o.outcome_key === 'other').length;
  const anyOutcomeTicked = outcomeRows.some(o => o.count > 0) || totalOtherOutcomes > 0;

  // ── Recent activity — top N from change log + status transitions ──
  type Activity =
    | { type: 'field'; when: Date; label: string; ref: string | null }
    | { type: 'status'; when: Date; from: string | null; to: string; ref: string | null };
  const activity: Activity[] = [];
  for (const c of (changeLog as any[])) {
    activity.push({
      type: 'field',
      when: new Date(c.changed_at),
      label: c.field_name,
      ref: c.candidates?.candidate_ref ?? null,
    });
  }
  for (const s of (statusTransitions as any[])) {
    activity.push({
      type: 'status',
      when: new Date(s.changed_at),
      from: s.from_status,
      to: s.to_status,
      ref: s.candidates?.candidate_ref ?? null,
    });
  }
  activity.sort((a, b) => b.when.getTime() - a.when.getTime());
  const recentActivity = activity.slice(0, 8);

  // If there's genuinely nothing yet, show the get-started card.
  const isEmptyPlatform = totalProjects === 0 && enrolledCount === 0;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        miniLabel="Holistic Impact Metric"
        title="Impact overview"
      />

      {isEmptyPlatform ? (
        <Card className="mb-4 border-ach-navy/15 bg-[#FBF2E0]/40">
          <CardContent className="pt-6 pb-6">
            <div className="text-[14px] font-medium text-ach-navy mb-2">Welcome to HIM.</div>
            <p className="text-[13px] text-ach-navy/75 leading-relaxed mb-4">
              This dashboard populates as ACH runs projects. Get started by scoping a project and enrolling beneficiaries into it.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/projects/new" className="inline-flex items-center gap-1.5 rounded-[10px] bg-ach-navy text-ach-cream px-3 py-1.5 text-[12.5px] hover:opacity-90">
                <FolderKanban className="h-3.5 w-3.5" /> New project
              </Link>
              <Link href="/candidates/import" className="inline-flex items-center gap-1.5 rounded-[10px] border-[0.5px] border-ach-border bg-white text-ach-navy px-3 py-1.5 text-[12.5px] hover:bg-ach-page">
                <Upload className="h-3.5 w-3.5" /> Import beneficiaries
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top KPI row — mirrors the aggregate report + outcomes report */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Kpi
              label="Beneficiaries enrolled"
              value={String(enrolledCount)}
              sub={completedCount > 0 && enrolledCount > 0
                ? `${completedCount} completed · ${Math.round((completedCount/enrolledCount)*100)}%`
                : withdrawnCount > 0 ? `${withdrawnCount} withdrawn` : undefined}
            />
            <Kpi
              label="Placed in work"
              value={String(placedCount)}
              sub={placedCount > 0 && enrolledCount > 0
                ? `${Math.round((placedCount/enrolledCount)*100)}% of enrolled`
                : undefined}
            />
            <Kpi
              label="Salary secured"
              value={totalSalary > 0 ? `£${Math.round(totalSalary / 1000)}k` : '—'}
              sub={totalSalary > 0 && placedCount > 0
                ? `£${Math.round(totalSalary / placedCount / 1000)}k avg · into local economy`
                : undefined}
            />
            <Kpi
              label="Projects"
              value={String(totalProjects)}
              sub={activeProjects > 0 ? `${activeProjects} active` : `${featuredQuotesCount} featured quote${featuredQuotesCount === 1 ? '' : 's'}`}
            />
          </div>

        </>
      )}

      {/* HIM signature — always shown, all 7 domains, honest empty states */}
      <Card className="mb-4">
        <CardContent className="pt-5 pb-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">Change by capability domain</div>
          <div className="text-[11.5px] text-ach-navy/55 mb-4">Mean HIM score per domain — baseline to exit — across every assessment on the platform.</div>
          <div className="space-y-3">
            {domainRows.map(row => <DomainRow key={row.key} row={row} />)}
          </div>
        </CardContent>
      </Card>

      {/* Outcomes ladder — every possible outcome shown, count-per-outcome
          rendered even when zero. Same visual language as the project
          outcomes report so the two pages read as one system. */}
      <Card className="mb-4">
        <CardContent className="pt-5 pb-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">Outcomes reached</div>
          <div className="text-[11.5px] text-ach-navy/55 mb-4">Count of beneficiaries who have reached each outcome across every ACH project.</div>
          {!anyOutcomeTicked ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {outcomeRows.map(o => (
                <div key={o.key} className="flex items-center justify-between rounded-[10px] border-[0.5px] border-ach-border/40 bg-ach-page/40 px-3 py-2">
                  <div className="text-[12.5px] text-ach-navy/50">{o.label}</div>
                  <div className="text-[15px] font-medium tabular-nums text-ach-navy/30">0</div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {outcomeRows.map(o => (
                  <div key={o.key} className={`flex items-center justify-between rounded-[10px] border-[0.5px] px-3 py-2 ${
                    o.count > 0 ? 'border-ach-border bg-white' : 'border-ach-border/40 bg-ach-page/40'
                  }`}>
                    <div className={`text-[12.5px] ${o.count > 0 ? 'text-ach-navy' : 'text-ach-navy/50'}`}>{o.label}</div>
                    <div className={`text-[15px] font-medium tabular-nums ${o.count > 0 ? 'text-ach-navy' : 'text-ach-navy/30'}`}>{o.count}</div>
                  </div>
                ))}
              </div>
              {totalOtherOutcomes > 0 && (
                <div className="text-[11.5px] text-ach-navy/55 mt-3">
                  Plus <span className="font-medium text-ach-navy/75 tabular-nums">{totalOtherOutcomes}</span> unexpected outcome{totalOtherOutcomes === 1 ? '' : 's'} recorded.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent activity — most-recent field edits + status transitions
          across the whole platform. Populated by the audit triggers from
          migration 065. Gives ICT staff a live pulse of who's doing what. */}
      {recentActivity.length > 0 && (
        <Card className="mb-4">
          <CardContent className="pt-5 pb-5">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">Recent activity</div>
            <div className="text-[11.5px] text-ach-navy/55 mb-4">Last few beneficiary edits and status transitions across the network.</div>
            <ul className="divide-y divide-ach-border">
              {recentActivity.map((a, i) => (
                <li key={i} className="py-2 flex items-center gap-2.5 text-[12.5px]">
                  {a.type === 'field' ? (
                    <User className="h-3.5 w-3.5 text-ach-navy/40 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-[#B8843C] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {a.type === 'field' ? (
                      <span className="text-ach-navy/80">
                        {a.ref && <span className="font-mono text-[11.5px] text-ach-navy/55 mr-1.5">{a.ref}</span>}
                        edited <span className="font-mono text-[11.5px] bg-ach-page px-1.5 py-0.5 rounded">{a.label}</span>
                      </span>
                    ) : (
                      <span className="text-ach-navy/80">
                        {a.ref && <span className="font-mono text-[11.5px] text-ach-navy/55 mr-1.5">{a.ref}</span>}
                        status: <span className="font-mono text-[11.5px] bg-ach-page px-1.5 py-0.5 rounded">{a.from ?? '(created)'}</span> → <span className="font-mono text-[11.5px] bg-ach-page px-1.5 py-0.5 rounded">{a.to}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[10.5px] text-ach-navy/50 tabular-nums shrink-0">
                    {formatRelative(a.when)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="text-[11.5px] text-ach-navy/55 flex flex-wrap items-center gap-4 justify-center mt-6 pb-4">
        <Link href="/candidates" className="hover:text-ach-navy underline underline-offset-2">Beneficiaries</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/projects" className="hover:text-ach-navy underline underline-offset-2">Projects</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/featured-quotes" className="hover:text-ach-navy underline underline-offset-2">Featured quotes</Link>
        <span className="text-ach-navy/25">·</span>
        <Link href="/impact-library" className="hover:text-ach-navy underline underline-offset-2">Impact library</Link>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
        <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2 tabular-nums">{value}</div>
        {sub && <div className="text-[11.5px] text-ach-navy/55 mt-1.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function DomainRow({ row }: { row: { key: string; label: string; hint: string; baseline: number | null; exit: number | null; baselineN: number; exitN: number } }) {
  const bwPct = row.baseline !== null ? (row.baseline / 5) * 100 : 0;
  const ewPct = row.exit     !== null ? (row.exit     / 5) * 100 : 0;
  const delta = row.baseline !== null && row.exit !== null ? row.exit - row.baseline : null;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1 gap-3">
        <div className="min-w-0">
          <span className="text-[13px] font-medium text-ach-navy">{row.label}</span>
          <span className="text-[11.5px] text-ach-navy/55 ml-2">{row.hint}</span>
        </div>
        <div className="text-[11px] tabular-nums text-ach-navy/60 shrink-0 text-right">
          {row.baseline !== null && row.exit !== null ? (
            <>
              {row.baseline.toFixed(2)} → {row.exit.toFixed(2)}
              {delta !== null && (
                <strong className={`ml-1.5 font-semibold ${delta >= 0 ? 'text-[#1B6D6A]' : 'text-[#8B3A4F]'}`}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
                </strong>
              )}
            </>
          ) : row.baseline !== null ? (
            <>baseline {row.baseline.toFixed(2)} · <span className="italic text-ach-navy/45">exit awaited</span></>
          ) : (
            <span className="italic text-ach-navy/40">awaiting first assessment</span>
          )}
        </div>
      </div>
      <div className="relative h-3 bg-ach-page rounded-[3px] overflow-hidden border border-ach-border/60">
        {row.baseline !== null && (
          <div className="absolute top-0 left-0 h-full bg-ach-navy/25" style={{ width: `${bwPct}%` }} />
        )}
        {row.exit !== null && (
          <div className="absolute top-0 left-0 h-full bg-[#B8843C]" style={{ width: `${ewPct}%` }} />
        )}
      </div>
    </div>
  );
}

/** Short relative-time formatter — "5m ago", "3h ago", "2d ago". */
function formatRelative(when: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - when.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
