import Link from 'next/link';
import { Calculator, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { QUOTE_TRACK_LABELS } from '@/lib/pricing/schema';
import { formatGbp, formatDate } from '@/lib/utils/format';

const TRAFFIC_TONES: Record<string, string> = {
  green: 'bg-[#3C6B47]/15 text-[#3C6B47] border-[#3C6B47]/30',
  amber: 'bg-[#E8C25E]/15 text-[#8B6914] border-[#E8C25E]/40',
  red:   'bg-[#D67890]/15 text-[#8B3A4F] border-[#D67890]/40',
};

export default async function PricingPage() {
  const supabase = createClient();
  const { data: quotes } = await supabase
    .from('pricing_quotes')
    .select('id, quote_ref, track, status, suggested_price, traffic_light, candidate_count, partner_id, partners(name), created_at, valid_until')
    .order('created_at', { ascending: false });

  const rows = (quotes as any[]) ?? [];
  const counts = {
    draft: rows.filter(r => r.status === 'draft').length,
    sent: rows.filter(r => r.status === 'sent').length,
    accepted: rows.filter(r => r.status === 'accepted').length,
  };
  const pipelineValue = rows
    .filter(r => r.status === 'draft' || r.status === 'sent')
    .reduce((s, r) => s + Number(r.suggested_price ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Operations"
        title="Dynamic Pricing Tool"
        description="Per-candidate £2,170 sponsorship floor + salary-band placement and retention fees (memo §3–5). Every quote is checked against cost-recovery (red) and sustainability (amber/green) floors."
        actions={
          <Link href="/pricing/new">
            <Button><Plus className="h-4 w-4" />New quote</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
        <SummaryCard label="Drafts" value={counts.draft} />
        <SummaryCard label="Sent" value={counts.sent} />
        <SummaryCard label="Accepted" value={counts.accepted} />
        <SummaryCard label="Pipeline value" value={formatGbp(pipelineValue)} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Calculator className="h-10 w-10" />}
            title="No quotes yet"
            description="Build a quote for a partner — pricing follows the memo §3–5 model with traffic-light flags against the cost-recovery and sustainability floors."
            action={
              <Link href="/pricing/new">
                <Button><Plus className="h-4 w-4" />New quote</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-ach-page border-b-[0.5px] border-ach-border">
              <tr>
                <Th>Ref</Th>
                <Th>Partner</Th>
                <Th>Track</Th>
                <Th>Candidates</Th>
                <Th>Total</Th>
                <Th>Floor check</Th>
                <Th>Status</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(q => (
                <tr key={q.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/50 transition-colors">
                  <Td>
                    <Link href={`/pricing/${q.id}`} className="text-ach-navy font-medium hover:underline">
                      {q.quote_ref}
                    </Link>
                  </Td>
                  <Td className="text-ach-navy/80">{q.partners?.name ?? '—'}</Td>
                  <Td className="text-ach-navy/70">{QUOTE_TRACK_LABELS[q.track as keyof typeof QUOTE_TRACK_LABELS] ?? q.track}</Td>
                  <Td className="text-ach-navy/70 tabular-nums">{q.candidate_count}</Td>
                  <Td className="text-ach-navy font-medium tabular-nums">{formatGbp(q.suggested_price)}</Td>
                  <Td>
                    {q.traffic_light ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] ${TRAFFIC_TONES[q.traffic_light]}`}>
                        {q.traffic_light}
                      </span>
                    ) : '—'}
                  </Td>
                  <Td><Badge variant={q.status === 'accepted' ? 'active' : q.status === 'declined' ? 'closed' : 'default'}>{q.status}</Badge></Td>
                  <Td className="text-ach-navy/70">{formatDate(q.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy mt-2 leading-none tabular-nums">{value}</div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
