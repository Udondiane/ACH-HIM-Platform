import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QUOTE_TRACK_LABELS } from '@/lib/pricing/schema';
import { setQuoteStatusAction } from '@/lib/pricing/actions';
import { formatGbp, formatGbpDetailed, formatPercent, formatDate } from '@/lib/utils/format';

const TRAFFIC_TONES: Record<string, string> = {
  green: 'bg-[#3C6B47]/15 text-[#3C6B47] border-[#3C6B47]/30',
  amber: 'bg-[#E8C25E]/15 text-[#8B6914] border-[#E8C25E]/40',
  red:   'bg-[#D67890]/15 text-[#8B3A4F] border-[#D67890]/40',
};

export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: quote } = await supabase
    .from('pricing_quotes')
    .select('*, partners(id, name, type), cohorts(id, name, cohort_ref)')
    .eq('id', params.id)
    .maybeSingle();

  if (!quote) notFound();
  const q = quote as any;

  const { data: lines } = await supabase
    .from('pricing_quote_lines')
    .select('*')
    .eq('quote_id', params.id)
    .order('sort_order');

  const rows = (lines as any[]) ?? [];

  async function setStatus(formData: FormData) {
    'use server';
    const status = String(formData.get('status') ?? '');
    if (status) await setQuoteStatusAction(params.id, status);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/pricing" className="text-[12px] text-ach-navy/60 hover:text-ach-navy inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to pricing
      </Link>

      <PageHeader
        miniLabel={`Quote · ${QUOTE_TRACK_LABELS[q.track as keyof typeof QUOTE_TRACK_LABELS]}`}
        title={q.quote_ref}
        description={q.partners?.name ? `For ${q.partners.name}` : 'No partner attached'}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={q.status === 'accepted' ? 'active' : q.status === 'declined' ? 'closed' : 'default'}>{q.status}</Badge>
            {q.traffic_light && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] ${TRAFFIC_TONES[q.traffic_light]}`}>
                {q.traffic_light}
              </span>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Itemised breakdown</div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-[13px] text-ach-navy/60">No line items.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b-[0.5px] border-ach-border">
                    <Th>Item</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Unit</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(l => (
                    <tr key={l.id} className="border-b-[0.5px] border-ach-border last:border-0">
                      <Td><div className="text-ach-navy">{l.label}</div></Td>
                      <Td className="text-right tabular-nums text-ach-navy/70">{l.quantity}</Td>
                      <Td className="text-right tabular-nums text-ach-navy/70">{formatGbpDetailed(l.unit_amount)}</Td>
                      <Td className={`text-right tabular-nums font-medium ${Number(l.line_total) < 0 ? 'text-[#3C6B47]' : 'text-ach-navy'}`}>{formatGbpDetailed(l.line_total)}</Td>
                    </tr>
                  ))}
                  <tr className="border-t-[0.5px] border-ach-border">
                    <td colSpan={3} className="py-3 text-right text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Total</td>
                    <td className="py-3 text-right tabular-nums text-[16px] font-medium text-ach-navy">{formatGbp(q.suggested_price)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-3 text-[13px]">
              <div>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Floor check (internal)</div>
                <dl className="mt-2 space-y-1.5">
                  <Row label="Delivery cost" value={formatGbpDetailed(q.delivery_cost_internal)} />
                  <Row label="Cost-recovery floor" value={formatGbpDetailed(q.cost_recovery_floor)} />
                  <Row label="Sustainability floor" value={formatGbpDetailed(q.sustainability_floor)} />
                  <Row label="Margin" value={`${formatGbpDetailed(q.margin_amount)} · ${formatPercent(Number(q.margin_pct), 1)}`} />
                </dl>
              </div>
              <div className="border-t-[0.5px] border-ach-border pt-3">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Quote details</div>
                <dl className="mt-2 space-y-1.5">
                  <Row label="Track" value={QUOTE_TRACK_LABELS[q.track as keyof typeof QUOTE_TRACK_LABELS]} />
                  <Row label="Candidates" value={String(q.candidate_count)} />
                  <Row label="Hires (V/S/P)" value={`${q.expected_hires_volume} / ${q.expected_hires_standard} / ${q.expected_hires_premium}`} />
                  <Row label="Created" value={formatDate(q.created_at)} />
                  <Row label="Valid until" value={formatDate(q.valid_until)} />
                </dl>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Status</div>
              <form action={setStatus} className="flex flex-wrap gap-2">
                {['draft', 'sent', 'accepted', 'declined', 'expired'].map(s => (
                  <button
                    key={s}
                    name="status"
                    value={s}
                    type="submit"
                    disabled={q.status === s}
                    className={`px-3 py-1 rounded-full text-[12px] border-[0.5px] capitalize ${
                      q.status === s
                        ? 'bg-ach-navy text-ach-cream border-ach-navy cursor-default'
                        : 'bg-white text-ach-navy/70 border-ach-border hover:bg-ach-page'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </form>
            </CardContent>
          </Card>

          {q.notes && (
            <Card>
              <CardContent className="pt-5">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Notes</div>
                <p className="text-[13px] text-ach-navy/80 whitespace-pre-wrap">{q.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[12px]">
      <dt className="text-ach-navy/60">{label}</dt>
      <dd className="text-ach-navy tabular-nums text-right">{value}</dd>
    </div>
  );
}
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2 ${className}`}>{children}</td>;
}
