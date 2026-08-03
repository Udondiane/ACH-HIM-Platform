import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Bid support packs' };

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  won: 'Won',
  lost: 'Lost',
  withdrawn: 'Withdrawn',
};

export default async function BidsListPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('bids')
    .select('id, name, funder_name, ask_amount_gbp, deadline, status, updated_at')
    .order('updated_at', { ascending: false });

  const bids = (data as any[]) ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        miniLabel="Reports"
        title="Bid support packs"
        description="Assembled evidence packs for fundraising bids. Pulls HIM impact + featured voices + financial framework mapping into a printable funder-facing pack."
        actions={
          <Link href="/bids/new">
            <Button><Plus className="h-3.5 w-3.5" />New bid pack</Button>
          </Link>
        }
      />

      {bids.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-[13px] text-ach-navy/70">
            <p className="mb-1">No bid packs yet.</p>
            <p className="text-ach-navy/55">Create one from the button above. Each pack pulls impact evidence from HIM and monetises it via a chosen financial framework (HACT, TOMs, or bespoke).</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-[12.5px]">
              <thead className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/55 bg-ach-page/50">
                <tr>
                  <th className="text-left px-4 py-2.5">Bid</th>
                  <th className="text-left px-4 py-2.5">Funder</th>
                  <th className="text-right px-4 py-2.5">Ask</th>
                  <th className="text-left px-4 py-2.5">Deadline</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((b: any) => (
                  <tr key={b.id} className="border-t border-ach-border/60 hover:bg-ach-page/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/bids/${b.id}`} className="text-ach-navy font-medium hover:underline">{b.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-ach-navy/80">{b.funder_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-ach-navy/80">
                      {b.ask_amount_gbp
                        ? `£${Number(b.ask_amount_gbp).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-ach-navy/80">{b.deadline ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge>{STATUS_LABELS[b.status] ?? b.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
