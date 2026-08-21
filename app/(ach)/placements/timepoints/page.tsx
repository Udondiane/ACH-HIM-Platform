import Link from 'next/link';
import { CalendarDays, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { CandidateIdentity } from '@/components/ui/candidate-identity';

export const dynamic = 'force-dynamic';

type TimepointStatus = 'not_due_yet' | 'coming_up' | 'due' | 'overdue' | 'done';

interface TimepointCell {
  targetDate: Date;
  status: TimepointStatus;
  daysUntil: number;   // positive = future, negative = past
  labelSuffix?: string;
}

interface Row {
  placementId: string;
  candidateId: string;
  candidateRef: string;
  candidate: { candidate_ref: string; given_name?: string | null; family_name?: string | null };
  partnerName: string;
  roleTitle: string;
  startDate: Date;
  status: string;
  exit_3mo: TimepointCell;
  retention_6mo: TimepointCell;
  retention_12mo: TimepointCell;
  earliestUpcoming: number;  // for sort — smallest days-until (or largest days-overdue if all past)
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
function classifyTimepoint(target: Date, done: boolean, now: Date): TimepointCell {
  const daysUntil = daysBetween(now, target);
  let status: TimepointStatus;
  if (done)                        status = 'done';
  else if (daysUntil < 0)          status = 'overdue';
  else if (daysUntil === 0)        status = 'due';
  else if (daysUntil <= 14)        status = 'coming_up';
  else                             status = 'not_due_yet';
  return { targetDate: target, status, daysUntil };
}

export default async function PlacementTimepointsPage() {
  const supabase = createClient();

  const [placementsRes, offersRes, retentionsRes] = await Promise.all([
    supabase
      .from('placements')
      .select('id, candidate_id, role_title, start_date, status, candidates(id, candidate_ref, given_name, family_name), partners(id, name)')
      .not('start_date', 'is', null)
      .neq('status', 'cancelled')
      .order('start_date', { ascending: false }),
    supabase
      .from('placement_offers')
      .select('placement_id, offer_type, candidate_response'),
    supabase
      .from('placement_retention_checks')
      .select('placement_id, timepoint, still_employed, created_at'),
  ]);

  const placements = (placementsRes.data as any[]) ?? [];
  const offersByPlacement = new Map<string, any>();
  for (const o of (offersRes.data as any[]) ?? []) offersByPlacement.set(o.placement_id, o);
  const retentionByPlacement = new Map<string, { r6?: boolean; r12?: boolean }>();
  for (const r of (retentionsRes.data as any[]) ?? []) {
    const cur = retentionByPlacement.get(r.placement_id) ?? {};
    if (r.timepoint === 'retention_6mo')  cur.r6  = true;
    if (r.timepoint === 'retention_12mo') cur.r12 = true;
    retentionByPlacement.set(r.placement_id, cur);
  }

  const now = new Date();

  const rows: Row[] = placements.map(p => {
    const startDate = new Date(p.start_date);
    const exit3Target = addMonths(startDate, 3);
    const r6Target    = addMonths(startDate, 6);
    const r12Target   = addMonths(startDate, 12);

    const exitDone      = offersByPlacement.has(p.id);
    const r6Done        = !!retentionByPlacement.get(p.id)?.r6;
    const r12Done       = !!retentionByPlacement.get(p.id)?.r12;

    const exit_3mo      = classifyTimepoint(exit3Target, exitDone, now);
    const retention_6mo = classifyTimepoint(r6Target, r6Done, now);
    const retention_12mo= classifyTimepoint(r12Target, r12Done, now);

    // The most-urgent NOT-done timepoint drives the row's sort priority.
    const pendings = [exit_3mo, retention_6mo, retention_12mo].filter(t => t.status !== 'done');
    const earliestUpcoming = pendings.length
      ? Math.min(...pendings.map(t => t.daysUntil))
      : Infinity;

    return {
      placementId: p.id,
      candidateId: p.candidate_id,
      candidateRef: p.candidates?.candidate_ref ?? '—',
      candidate: p.candidates,
      partnerName: p.partners?.name ?? '—',
      roleTitle: p.role_title ?? '—',
      startDate,
      status: p.status ?? '—',
      exit_3mo,
      retention_6mo,
      retention_12mo,
      earliestUpcoming,
    };
  });

  // Sort: overdue first (most overdue on top), then coming-up (soonest first),
  // then not-due-yet, then fully-done placements last.
  rows.sort((a, b) => {
    const aAllDone = a.earliestUpcoming === Infinity;
    const bAllDone = b.earliestUpcoming === Infinity;
    if (aAllDone && !bAllDone) return 1;
    if (bAllDone && !aAllDone) return -1;
    return a.earliestUpcoming - b.earliestUpcoming;
  });

  const overdueCount   = rows.filter(r => [r.exit_3mo, r.retention_6mo, r.retention_12mo].some(t => t.status === 'overdue')).length;
  const comingUpCount  = rows.filter(r => [r.exit_3mo, r.retention_6mo, r.retention_12mo].some(t => t.status === 'coming_up' || t.status === 'due')).length;
  const allDoneCount   = rows.filter(r => [r.exit_3mo, r.retention_6mo, r.retention_12mo].every(t => t.status === 'done')).length;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        miniLabel="Placements"
        title="Timepoint schedule"
        description="All placements with their end-of-placement feedback, 6-month retention check, and 12-month retention check due dates. Colour-coded by urgency."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatCard label="Overdue" value={overdueCount} tone="rose" />
        <StatCard label="Due in next 14 days" value={comingUpCount} tone="amber" />
        <StatCard label="Fully complete" value={allDoneCount} tone="emerald" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">All placements</div>
              <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Sorted by earliest upcoming (or most overdue) timepoint first.</div>
            </div>
            <Legend />
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60 py-6 text-center">No placements yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b-[0.5px] border-ach-border">
                    <Th>Candidate</Th>
                    <Th>Partner</Th>
                    <Th>Role</Th>
                    <Th>Start</Th>
                    <Th>End of placement (3mo)</Th>
                    <Th>6-month retention</Th>
                    <Th>12-month retention</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.placementId} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/40">
                      <Td>
                        <Link href={`/candidates/${row.candidateId}`} className="text-ach-navy hover:underline">
                          <CandidateIdentity candidate={row.candidate} />
                        </Link>
                      </Td>
                      <Td className="text-ach-navy/80">{row.partnerName}</Td>
                      <Td className="text-ach-navy/80">{row.roleTitle}</Td>
                      <Td className="text-ach-navy/70 tabular-nums">
                        {row.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Td>
                      <TimepointCellView cell={row.exit_3mo} href={`/placements/${row.placementId}/timepoints`} />
                      <TimepointCellView cell={row.retention_6mo} href={`/placements/${row.placementId}/timepoints`} />
                      <TimepointCellView cell={row.retention_12mo} href={`/placements/${row.placementId}/timepoints`} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'rose' | 'amber' | 'emerald' }) {
  const bg = tone === 'rose' ? 'bg-ach-rose/10 border-ach-rose/30' : tone === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';
  const fg = tone === 'rose' ? 'text-[#8B3A4F]' : tone === 'amber' ? 'text-amber-800' : 'text-emerald-800';
  return (
    <div className={`rounded-[10px] border-[0.5px] px-3 py-3 ${bg}`}>
      <div className={`text-[10.5px] uppercase tracking-[1.2px] mb-1 ${fg}`}>{label}</div>
      <div className={`text-[22px] font-semibold tabular-nums ${fg}`}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2 text-left text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium pr-3">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2 pr-3 align-top ${className}`}>{children}</td>;
}

function TimepointCellView({ cell, href }: { cell: TimepointCell; href: string }) {
  const dateStr = cell.targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  let label: string;
  let className: string;
  let icon: React.ReactNode;

  switch (cell.status) {
    case 'done':
      label = 'Complete';
      className = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      icon = <CheckCircle2 className="h-3 w-3 shrink-0" />;
      break;
    case 'overdue':
      label = `Overdue ${Math.abs(cell.daysUntil)}d`;
      className = 'bg-ach-rose/15 text-[#8B3A4F] border-ach-rose/40';
      icon = <AlertCircle className="h-3 w-3 shrink-0" />;
      break;
    case 'due':
      label = 'Due today';
      className = 'bg-amber-100 text-amber-900 border-amber-300';
      icon = <AlertCircle className="h-3 w-3 shrink-0" />;
      break;
    case 'coming_up':
      label = `In ${cell.daysUntil}d`;
      className = 'bg-amber-50 text-amber-800 border-amber-200';
      icon = <Clock className="h-3 w-3 shrink-0" />;
      break;
    case 'not_due_yet':
    default:
      label = `In ${cell.daysUntil}d`;
      className = 'bg-white text-ach-navy/60 border-ach-border';
      icon = <CalendarDays className="h-3 w-3 shrink-0" />;
      break;
  }

  return (
    <Td>
      <Link
        href={href}
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 border-[0.5px] text-[11px] font-medium ${className}`}
        title={dateStr}
      >
        {icon}
        <span>{label}</span>
      </Link>
      <div className="text-[10.5px] text-ach-navy/50 mt-0.5">{dateStr}</div>
    </Td>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
      <LegendItem className="bg-ach-rose/15 text-[#8B3A4F] border-ach-rose/40" label="Overdue" />
      <LegendItem className="bg-amber-100 text-amber-900 border-amber-300" label="Due today" />
      <LegendItem className="bg-amber-50 text-amber-800 border-amber-200" label="≤14 days" />
      <LegendItem className="bg-emerald-50 text-emerald-800 border-emerald-200" label="Complete" />
    </div>
  );
}
function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border-[0.5px] font-medium ${className}`}>
      {label}
    </span>
  );
}
