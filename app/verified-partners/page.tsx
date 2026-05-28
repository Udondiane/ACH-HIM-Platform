import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PARTNER_TYPE_LABELS } from '@/lib/partners/schema';

export const metadata = {
  title: 'Verified Partners · ACH',
};

export default async function VerifiedPartnersPublicPage() {
  const supabase = createClient();

  // Tier rows that opted into public listing
  const { data: tierRows } = await supabase
    .from('partner_tier_status')
    .select('partner_id, current_tier, qualified_at, partners(id, name, type, sector, region)')
    .eq('public_listing_consent', true)
    .in('current_tier', ['verified', 'verified_plus']);

  const rows = ((tierRows as any[]) ?? []).filter(t => t.partners?.consent_public_listing !== false);
  const plus = rows.filter(t => t.current_tier === 'verified_plus');
  const verified = rows.filter(t => t.current_tier === 'verified');

  return (
    <div className="min-h-screen bg-ach-page">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-12">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">
            ACH
          </div>
          <h1 className="text-[42px] font-medium tracking-[-0.5px] text-ach-navy leading-tight mb-4">
            Verified Partners
          </h1>
          <p className="text-[14px] text-ach-navy/70 max-w-2xl leading-relaxed">
            Organisations who have completed at least 12 months of milestone payments in good standing,
            and who have consented to public listing. Verified+ partners have maintained good standing
            for 24 months or longer.
          </p>
        </div>

        {plus.length > 0 && (
          <section className="mb-10">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-4">
              Verified+ partners
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {plus.map(t => <PartnerCard key={t.partner_id} row={t} />)}
            </div>
          </section>
        )}

        {verified.length > 0 && (
          <section>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-4">
              Verified partners
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {verified.map(t => <PartnerCard key={t.partner_id} row={t} />)}
            </div>
          </section>
        )}

        {rows.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-[14px] text-ach-navy/70">
                The first cohort of Verified Partners will appear here once they complete their
                first 12 months of milestone payments.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-16 pt-8 border-t-[0.5px] border-ach-border text-[12px] text-ach-navy/60">
          <p className="max-w-2xl leading-relaxed">
            Inclusion on this page reflects partners&apos; consent to public listing and their current
            tier status. Verification is conducted by ACH.
          </p>
        </div>
      </div>
    </div>
  );
}

function PartnerCard({ row }: { row: any }) {
  const p = row.partners;
  if (!p) return null;
  return (
    <Card className="bg-white">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="text-[15px] font-medium text-ach-navy">{p.name}</div>
          <Badge variant={row.current_tier as any}>
            {row.current_tier === 'verified_plus' ? 'Verified+' : 'Verified'}
          </Badge>
        </div>
        <div className="text-[12.5px] text-ach-navy/70 flex items-center gap-2 flex-wrap">
          <span>{PARTNER_TYPE_LABELS[p.type as keyof typeof PARTNER_TYPE_LABELS] ?? p.type}</span>
          {p.sector && <><span className="text-ach-navy/30">·</span><span>{p.sector}</span></>}
          {p.region && <><span className="text-ach-navy/30">·</span><span>{p.region}</span></>}
        </div>
        {row.qualified_at && (
          <div className="text-[11.5px] text-ach-navy/50 mt-3">
            Verified since {new Date(row.qualified_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
