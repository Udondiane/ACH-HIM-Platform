import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, ExternalLink } from 'lucide-react';
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

  // Pull tier status + recent placements + open cohort engagements
  const [tier, placements, cohortPartners] = await Promise.all([
    supabase.from('partner_tier_status').select('*').eq('partner_id', params.id).maybeSingle(),
    supabase.from('placements').select('id, role_title, salary_band, start_date, status').eq('partner_id', params.id).order('start_date', { ascending: false }).limit(5),
    supabase.from('cohort_partners').select('id, cohort_id, sponsorship_count, engagement_fee, cohorts(name, cohort_ref, status)').eq('partner_id', params.id),
  ]);

  const p = partner as any;
  const tierData = tier.data as any;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref="/partners"
        backLabel="Partners"
        miniLabel={PARTNER_TYPE_LABELS[p.type as keyof typeof PARTNER_TYPE_LABELS]}
        title={p.name}
        description={[p.sector, p.region].filter(Boolean).join(' · ') || undefined}
        actions={
          <Link href={`/partners/${p.id}/edit`}>
            <Button variant="secondary"><Pencil className="h-3.5 w-3.5" />Edit</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Details</div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
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
              <DT label="Public listing consent">{p.consent_public_listing ? 'Yes' : 'No'}</DT>
              <DT label="Created">{new Date(p.created_at).toLocaleDateString('en-GB')}</DT>
            </dl>

            {p.notes && (
              <div className="mt-5 pt-5 border-t-[0.5px] border-ach-border">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">Internal notes</div>
                <p className="text-[13px] text-ach-navy/80 whitespace-pre-wrap">{p.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Verified tier</div>
            </CardHeader>
            <CardContent>
              <Badge variant={(tierData?.current_tier ?? 'none') as any}>
                {tierData?.current_tier === 'verified_plus' ? 'Verified+'
                  : tierData?.current_tier === 'verified' ? 'Verified'
                  : 'Not yet verified'}
              </Badge>
              {tierData?.qualified_at && (
                <div className="text-[12px] text-ach-navy/60 mt-3">
                  Qualified {new Date(tierData.qualified_at).toLocaleDateString('en-GB')}
                </div>
              )}
              {tierData?.engagement_fee_discount > 0 && (
                <div className="text-[12px] text-ach-navy/60 mt-1">
                  Engagement fee discount: {(tierData.engagement_fee_discount * 100).toFixed(1)}%
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Cohort engagement</div>
            </CardHeader>
            <CardContent className="text-[13px] space-y-2.5">
              {!cohortPartners.data || cohortPartners.data.length === 0
                ? <div className="text-ach-navy/60">Not yet engaged in a cohort.</div>
                : cohortPartners.data.map((cp: any) => (
                  <div key={cp.id} className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/cohorts/${cp.cohort_id}`} className="text-ach-navy font-medium hover:underline">
                        {cp.cohorts?.name ?? cp.cohorts?.cohort_ref}
                      </Link>
                      <div className="text-[12px] text-ach-navy/60">
                        {cp.sponsorship_count} sponsored
                      </div>
                    </div>
                    <Badge variant={cp.cohorts?.status}>{cp.cohorts?.status}</Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Recent placements</div>
        </CardHeader>
        <CardContent>
          {!placements.data || placements.data.length === 0 ? (
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
                {(placements.data as any[]).map(pl => (
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
