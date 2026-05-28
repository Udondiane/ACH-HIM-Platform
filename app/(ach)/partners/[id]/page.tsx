import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, ExternalLink, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PARTNER_TYPE_LABELS, PARTNER_STATUS_LABELS } from '@/lib/partners/schema';

export default async function PartnerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!partner) notFound();

  const { data: placements } = await supabase
    .from('placements')
    .select('id, role_title, salary_band, start_date, status')
    .eq('partner_id', params.id)
    .order('start_date', { ascending: false })
    .limit(5);

  const p = partner as any;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref="/partners"
        backLabel="Partners"
        miniLabel={PARTNER_TYPE_LABELS[p.type as keyof typeof PARTNER_TYPE_LABELS]}
        title={p.name}
        description={[p.sector, p.region].filter(Boolean).join(' · ') || undefined}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/partner-dashboard?as=${p.id}`} target="_blank">
              <Button variant="secondary"><Eye className="h-3.5 w-3.5" />View as this partner</Button>
            </Link>
            <Link href={`/partners/${p.id}/edit`}>
              <Button variant="secondary"><Pencil className="h-3.5 w-3.5" />Edit</Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Details</div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-[13px]">
            <DT label="Type"><Badge variant={p.type}>{PARTNER_TYPE_LABELS[p.type as keyof typeof PARTNER_TYPE_LABELS]}</Badge></DT>
            <DT label="Status"><Badge variant={p.status}>{PARTNER_STATUS_LABELS[p.status as keyof typeof PARTNER_STATUS_LABELS]}</Badge></DT>
            <DT label="Sector">{p.sector ?? '—'}</DT>
            <DT label="Region">{p.region ?? '—'}</DT>
            <DT label="Employees">{p.employee_count?.toLocaleString() ?? '—'}</DT>
            <DT label="Website">
              {p.website ? (
                <a href={p.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                  {p.website.replace(/^https?:\/\//, '')}<ExternalLink className="h-3 w-3" />
                </a>
              ) : '—'}
            </DT>
            <DT label="Created">{new Date(p.created_at).toLocaleDateString('en-GB')}</DT>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Recent placements</div>
        </CardHeader>
        <CardContent>
          {!placements || placements.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60">No placements yet.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Role</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Band</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Start</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(placements as any[]).map(pl => (
                  <tr key={pl.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <td className="py-2">{pl.role_title}</td>
                    <td className="py-2 capitalize">{pl.salary_band}</td>
                    <td className="py-2 text-ach-navy/70">{new Date(pl.start_date).toLocaleDateString('en-GB')}</td>
                    <td className="py-2"><Badge>{pl.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DT({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-0.5">{label}</dt>
      <dd className="text-ach-navy">{children}</dd>
    </div>
  );
}
