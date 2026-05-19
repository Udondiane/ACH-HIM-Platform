import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TIER_LABELS: Record<string, string> = {
  none: 'Not yet verified',
  verified: 'Verified',
  verified_plus: 'Verified+',
};

export default async function VerifiedNetworkAdminPage() {
  const supabase = createClient();
  const { data: tierRows } = await supabase
    .from('partner_tier_status')
    .select('partner_id, current_tier, qualified_at, engagement_fee_discount, public_listing_consent, partners(id, name, type, status)');

  const rows = (tierRows as any[]) ?? [];
  const counts = {
    verified_plus: rows.filter(r => r.current_tier === 'verified_plus').length,
    verified: rows.filter(r => r.current_tier === 'verified').length,
    none: rows.filter(r => r.current_tier === 'none').length,
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Operations"
        title="Verified Partner network"
        description="Partner tier status across the network. Verified status auto-unlocks at 12 months of milestone payments in good standing; Verified+ at 24 months."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Verified+</div>
            <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5">
              {counts.verified_plus}
            </div>
            <div className="text-[12px] text-ach-navy/60 mt-2">24+ months in good standing</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Verified</div>
            <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5">
              {counts.verified}
            </div>
            <div className="text-[12px] text-ach-navy/60 mt-2">12+ months in good standing</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Not yet verified</div>
            <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5">
              {counts.none}
            </div>
            <div className="text-[12px] text-ach-navy/60 mt-2">recent or new partners</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">All partners by tier</div>
            <Link href="/verified-partners" target="_blank" className="text-[12px] underline text-ach-navy">
              View public listing →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-[13px] text-ach-navy/60">No partners yet. Tier rows are created automatically once a partner has placements.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <Th>Partner</Th>
                  <Th>Tier</Th>
                  <Th>Qualified</Th>
                  <Th className="text-right">Fee discount</Th>
                  <Th>Public listing</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.partner_id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <Td>
                      <Link href={`/partners/${r.partner_id}`} className="text-ach-navy font-medium hover:underline">
                        {r.partners?.name ?? r.partner_id}
                      </Link>
                    </Td>
                    <Td>
                      <Badge variant={r.current_tier as any}>{TIER_LABELS[r.current_tier]}</Badge>
                    </Td>
                    <Td className="text-ach-navy/70">
                      {r.qualified_at ? new Date(r.qualified_at).toLocaleDateString('en-GB') : '—'}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {Number(r.engagement_fee_discount) > 0
                        ? `${(Number(r.engagement_fee_discount) * 100).toFixed(1)}%`
                        : '—'}
                    </Td>
                    <Td className="text-ach-navy/70">
                      {r.public_listing_consent ? 'Yes' : 'No'}
                    </Td>
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

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2 ${className}`}>{children}</td>;
}
