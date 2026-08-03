import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageCircle, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

export const metadata = { title: 'Follow-ups' };

const TIMEPOINT_LABELS: Record<string, string> = {
  mid_3mo:       '3 months',
  exit_6mo:      '6 months',
  followup_12mo: '12 months',
};

const URGENCY_STYLES: Record<string, string> = {
  overdue:  'bg-[#D67890]/15 text-[#8B3E52] border-[#D67890]/30',
  due:      'bg-[#E8C25E]/15 text-ach-navy border-[#E8C25E]/30',
  soon:     'bg-ach-page text-ach-navy/70 border-ach-border',
  upcoming: 'bg-ach-page text-ach-navy/50 border-ach-border',
};

const STATUS_STYLES: Record<string, string> = {
  queued:      'bg-ach-page text-ach-navy/70 border-ach-border',
  sent:        'bg-[#7DA8C9]/15 text-ach-navy border-[#7DA8C9]/30',
  responded:   'bg-[#95B670]/15 text-ach-navy border-[#95B670]/30',
  flagged:     'bg-[#D67890]/15 text-[#8B3E52] border-[#D67890]/30',
  no_response: 'bg-[#E8C25E]/15 text-ach-navy border-[#E8C25E]/30',
  closed:      'bg-ach-page text-ach-navy/40 border-ach-border',
};

export default async function FollowUpsPage() {
  const supabase = createClient();

  const [openRes, flaggedRes, noResponseRes, upcomingRes, doneRes] = await Promise.all([
    supabase.from('follow_ups_queue').select('*').in('status', ['queued', 'sent']).lte('due_date', new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)).order('due_date', { ascending: true }).limit(200),
    supabase.from('follow_ups_queue').select('*').eq('status', 'flagged').order('responded_at', { ascending: false }).limit(50),
    supabase.from('follow_ups_queue').select('*').eq('status', 'no_response').order('due_date', { ascending: true }).limit(50),
    supabase.from('follow_ups_queue').select('*').eq('status', 'queued').gt('due_date', new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)).order('due_date', { ascending: true }).limit(50),
    supabase.from('follow_ups_queue').select('*').in('status', ['responded', 'closed']).order('responded_at', { ascending: false, nullsFirst: false }).limit(20),
  ]);

  const open      = (openRes.data as any[]) ?? [];
  const flagged   = (flaggedRes.data as any[]) ?? [];
  const noResp    = (noResponseRes.data as any[]) ?? [];
  const upcoming  = (upcomingRes.data as any[]) ?? [];
  const done      = (doneRes.data as any[]) ?? [];

  const total = open.length + flagged.length + noResp.length;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader miniLabel="Reports" title="Follow-ups queue" />
      <p className="text-[13px] text-ach-navy/70 -mt-2 mb-5 max-w-3xl">
        Automated dispatch schedule for 3-, 6- and 12-month check-ins after placement. HIM populates this queue and classifies
        responses; ACH staff only intervene when something needs judgement.
      </p>

      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <SummaryTile icon={AlertTriangle} label="Concerning responses" value={flagged.length}
          hint="Auto-flagged for staff review" tone="alert" />
        <SummaryTile icon={Clock} label="Unresponsive" value={noResp.length}
          hint="3+ attempts, no reply" tone="warn" />
        <SummaryTile icon={Phone} label="Ready to work" value={open.length}
          hint="Due this week or overdue" tone="focus" />
        <SummaryTile icon={CheckCircle2} label="Closed recently" value={done.length}
          hint="Responses captured" tone="ok" />
      </div>

      {/* Concerning */}
      {flagged.length > 0 && (
        <Section title="Concerning responses" hint="Auto-flagged from response content. Review before closing.">
          <QueueTable rows={flagged} showResponse />
        </Section>
      )}

      {/* Unresponsive */}
      {noResp.length > 0 && (
        <Section title="Unresponsive after 3 attempts" hint="Consider case-worker escalation or manual outreach.">
          <QueueTable rows={noResp} />
        </Section>
      )}

      {/* Ready to work */}
      <Section title="Ready to work" hint="Due this week. Click a candidate to record their response.">
        {open.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-[13px] text-ach-navy/60 italic">
              Nothing due right now. HIM will populate this as candidates hit their 3/6/12-month marks.
            </CardContent>
          </Card>
        ) : (
          <QueueTable rows={open} showActions />
        )}
      </Section>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Section title="Coming up" hint="Not due yet — visible so staff can see the pipeline.">
          <QueueTable rows={upcoming.slice(0, 20)} compact />
        </Section>
      )}

      {/* Recently closed */}
      {done.length > 0 && (
        <Section title="Recently closed">
          <QueueTable rows={done} compact showResponse />
        </Section>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[15px] font-serif font-semibold text-ach-navy">{title}</h2>
        {hint && <div className="text-[11.5px] text-ach-navy/55">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, hint, tone }: {
  icon: any; label: string; value: number; hint: string;
  tone: 'alert' | 'warn' | 'focus' | 'ok';
}) {
  const toneMap = {
    alert: 'text-[#8B3E52]',
    warn:  'text-[#B8862C]',
    focus: 'text-ach-navy',
    ok:    'text-[#3C6B47]',
  };
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-3.5 w-3.5 ${toneMap[tone]}`} />
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">{label}</div>
        </div>
        <div className={`text-[24px] font-serif ${toneMap[tone]}`}>{value}</div>
        <div className="text-[11px] text-ach-navy/55">{hint}</div>
      </CardContent>
    </Card>
  );
}

function QueueTable({
  rows,
  compact = false,
  showActions = false,
  showResponse = false,
}: {
  rows: any[];
  compact?: boolean;
  showActions?: boolean;
  showResponse?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/55 bg-ach-page/50">
              <tr>
                <th className="text-left px-4 py-2.5">Candidate</th>
                <th className="text-left px-4 py-2.5">Cohort · role</th>
                <th className="text-left px-4 py-2.5">Timepoint</th>
                <th className="text-left px-4 py-2.5">Due</th>
                <th className="text-left px-4 py-2.5">Status</th>
                {showResponse && <th className="text-left px-4 py-2.5">Response snippet</th>}
                <th className="text-right px-4 py-2.5">{showActions ? 'Action' : ''}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-ach-border/60 hover:bg-ach-page/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/candidates/${r.candidate_id}`} className="text-ach-navy hover:underline">
                      {r.given_name ?? r.candidate_ref}
                    </Link>
                    <div className="text-[11px] text-ach-navy/55">{r.candidate_ref}</div>
                  </td>
                  <td className="px-4 py-2.5 text-ach-navy/75">
                    {r.cohort_name && <div>{r.cohort_name}</div>}
                    {r.placement_role && (
                      <div className="text-[11px] text-ach-navy/55">
                        {r.placement_role}{r.placement_partner ? ` · ${r.placement_partner}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ach-navy/80">{TIMEPOINT_LABELS[r.timepoint] ?? r.timepoint}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] ${URGENCY_STYLES[r.urgency] ?? URGENCY_STYLES.upcoming}`}>
                      {r.urgency}
                    </span>
                    <div className="text-[11px] text-ach-navy/55 mt-0.5">{r.due_date}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] ${STATUS_STYLES[r.status] ?? STATUS_STYLES.queued}`}>
                      {r.status}
                    </span>
                    {r.attempts > 0 && (
                      <div className="text-[11px] text-ach-navy/55 mt-0.5">{r.attempts} attempt{r.attempts === 1 ? '' : 's'}</div>
                    )}
                  </td>
                  {showResponse && (
                    <td className="px-4 py-2.5 max-w-md text-ach-navy/75">
                      {r.flag_reason && <div className="text-[11px] text-[#8B3E52] mb-0.5">⚑ {r.flag_reason}</div>}
                      <div className="line-clamp-2">{/* handled inline */}</div>
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/follow-ups/${r.id}`}
                      className="text-[11.5px] text-ach-navy underline underline-offset-2 hover:text-ach-navy/70"
                    >
                      {compact ? 'View' : (r.status === 'flagged' ? 'Review' : 'Record response')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
