import Link from 'next/link';
import { Lightbulb } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { evaluateDelphi } from '@/lib/scoring/delphi';
import { formatDate } from '@/lib/utils/format';

const STATE_LABELS: Record<string, string> = {
  open_round_1: 'Round 1 open',
  aggregating: 'Aggregating',
  open_round_2: 'Round 2 open',
  consensus_reached: 'Consensus',
  no_consensus: 'No consensus',
  closed: 'Closed',
};

const STATE_VARIANTS: Record<string, 'default' | 'active' | 'paused' | 'closed' | 'prospect'> = {
  open_round_1: 'prospect',
  aggregating: 'paused',
  open_round_2: 'prospect',
  consensus_reached: 'active',
  no_consensus: 'closed',
  closed: 'default',
};

export default async function DelphiPage() {
  const supabase = createClient();
  const { data: panels } = await supabase
    .from('delphi_panels')
    .select('*, delphi_experts(id, name, role), delphi_rounds(id, round_number, opened_at, closed_at, delphi_responses(selected_option))')
    .order('created_at', { ascending: false });

  const rows = (panels as any[]) ?? [];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Method · V2"
        title="Delphi panels"
        description="Spec §5 — 8–12 expert panels run in two rounds. Consensus is reached when ≥70% agree on a single option OR the interquartile range of numeric ratings is ≤ 1 scale point."
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
        <Stat label="Panels" value={String(rows.length)} subline="total" />
        <Stat label="At consensus" value={String(rows.filter(r => r.state === 'consensus_reached').length)} />
        <Stat label="In progress" value={String(rows.filter(r => r.state === 'open_round_1' || r.state === 'open_round_2' || r.state === 'aggregating').length)} />
        <Stat label="Total experts" value={String(rows.reduce((s, p) => s + (p.delphi_experts?.length ?? 0), 0))} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Lightbulb className="h-10 w-10" />}
            title="No panels yet"
            description="Delphi panels are used to validate methodology choices — e.g. weight ratios, indicator priorities, classification thresholds."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map(p => {
            const round1 = (p.delphi_rounds ?? []).find((r: any) => r.round_number === 1);
            const round2 = (p.delphi_rounds ?? []).find((r: any) => r.round_number === 2);
            const latest = round2 ?? round1;
            const counts: Record<string, number> = {};
            for (const resp of (latest?.delphi_responses ?? [])) {
              counts[resp.selected_option] = (counts[resp.selected_option] ?? 0) + 1;
            }
            const result = evaluateDelphi({ optionCounts: counts });

            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-0.5">{p.name}</div>
                      <div className="text-[15px] font-medium text-ach-navy leading-snug">{p.research_question}</div>
                    </div>
                    <Badge variant={STATE_VARIANTS[p.state]}>{STATE_LABELS[p.state] ?? p.state}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Options</div>
                      <div className="space-y-1.5">
                        {(p.options ?? []).map((opt: string) => {
                          const n = counts[opt] ?? 0;
                          const pct = result.totalVotes > 0 ? (n / result.totalVotes) * 100 : 0;
                          const winning = result.winningOption === opt;
                          return (
                            <div key={opt} className="flex items-center gap-3">
                              <div className="text-[12px] text-ach-navy w-44 truncate">{opt}</div>
                              <div className="flex-1 h-2 bg-ach-page rounded-full overflow-hidden border-[0.5px] border-ach-border">
                                <div
                                  className={`h-full ${winning ? 'bg-ach-navy' : 'bg-ach-navy/40'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="text-[12px] tabular-nums text-ach-navy/70 w-12 text-right">{n} · {pct.toFixed(0)}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-ach-page rounded-[10px] p-4 border-[0.5px] border-ach-border">
                      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Consensus check</div>
                      <div className="text-[18px] font-medium text-ach-navy mt-1.5">
                        {result.consensus ? '✓ Reached' : 'Not yet'}
                      </div>
                      <div className="text-[12px] text-ach-navy/70 mt-2">
                        Top option: {result.totalVotes > 0 ? `${(result.agreementPct! * 100).toFixed(0)}%` : '—'}
                      </div>
                      <div className="text-[11px] text-ach-navy/55 mt-1">
                        Rule A threshold: 70%
                      </div>
                      <div className="text-[11px] text-ach-navy/55 mt-3 border-t-[0.5px] border-ach-border pt-2">
                        Experts: {p.delphi_experts?.length ?? 0} · Rounds: {p.delphi_rounds?.length ?? 0}
                      </div>
                      {p.consensus_reached_at && (
                        <div className="text-[11px] text-ach-navy/55 mt-1">Reached: {formatDate(p.consensus_reached_at)}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, subline }: { label: string; value: string; subline?: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy mt-2 leading-none tabular-nums">{value}</div>
      {subline && <div className="text-[11px] text-ach-navy/60 mt-2">{subline}</div>}
    </Card>
  );
}
