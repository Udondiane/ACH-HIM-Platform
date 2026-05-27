import { createClient } from '@/lib/supabase/server';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BadgeCheck } from 'lucide-react';

const TIER_LABELS: Record<string, string> = {
  none:           'Not yet verified',
  verified:       'Verified',
  verified_plus:  'Verified+',
};

const TIER_DESCRIPTIONS: Record<string, string> = {
  none:           'No verification yet. Reach 12 months of milestone payments in good standing to qualify for Verified.',
  verified:       'You have demonstrated 12+ months of consistent partnership. Verified status appears on the public Verified Partners directory.',
  verified_plus:  'You have demonstrated 24+ months of consistent partnership. Verified+ unlocks an engagement-fee discount on future cohorts and prominent positioning in the public directory.',
};

export default async function PartnerVerifiedTierPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);
  if (!partner) return null;

  const supabase = createClient();
  const [tierRes, milestones] = await Promise.all([
    supabase.from('partner_tier_status').select('*').eq('partner_id', partner.id).maybeSingle(),
    supabase.from('placement_milestones')
      .select('id, paid_on, state, placements!inner(partner_id)')
      .eq('placements.partner_id', partner.id)
      .eq('state', 'paid')
      .not('paid_on', 'is', null)
      .order('paid_on'),
  ]);

  const tier = tierRes.data as any;
  const currentTier = tier?.current_tier ?? 'none';
  const paidRows = (milestones.data as any[]) ?? [];
  const firstPaid = paidRows[0]?.paid_on ?? null;
  const monthsSinceFirstPaid = firstPaid
    ? Math.floor((Date.now() - new Date(firstPaid).getTime()) / (1000 * 60 * 60 * 24 * 30.4))
    : 0;
  const discountPct = tier?.engagement_fee_discount ? Number(tier.engagement_fee_discount) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Verified tier"
        title="Verified tier status"
        description="ACH's public verification of partners that demonstrate consistent good-faith engagement with the programme."
      />

      <Card className="mb-5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-5">
            <BadgeCheck
              className={
                currentTier === 'verified_plus' ? 'h-12 w-12 text-ach-navy shrink-0'
                : currentTier === 'verified' ? 'h-12 w-12 text-ach-slate-deep shrink-0'
                : 'h-12 w-12 text-ach-navy/30 shrink-0'
              }
            />
            <div className="flex-1">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Current tier</div>
              <div className="text-[28px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-1.5">
                {TIER_LABELS[currentTier]}
              </div>
              <p className="text-[13px] text-ach-navy/70 mt-3 max-w-prose">
                {TIER_DESCRIPTIONS[currentTier]}
              </p>
              {tier?.qualified_at && (
                <div className="text-[12px] text-ach-navy/60 mt-3">
                  Qualified {new Date(tier.qualified_at).toLocaleDateString('en-GB')}
                </div>
              )}
              {discountPct > 0 && (
                <div className="mt-3">
                  <Badge variant="active">{discountPct.toFixed(1)}% engagement-fee discount</Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Time in partnership</div>
          </CardHeader>
          <CardContent>
            {firstPaid ? (
              <>
                <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none tabular-nums">
                  {monthsSinceFirstPaid} mo
                </div>
                <div className="text-[12px] text-ach-navy/60 mt-2">since first milestone paid {new Date(firstPaid).toLocaleDateString('en-GB')}</div>
              </>
            ) : (
              <div className="text-[13px] text-ach-navy/60">No milestone payments recorded yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Milestones paid</div>
          </CardHeader>
          <CardContent>
            <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none tabular-nums">
              {paidRows.length}
            </div>
            <div className="text-[12px] text-ach-navy/60 mt-2">across all placements</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Tier criteria</div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-[13px]">
            <CriteriaRow
              label="Verified"
              status={currentTier === 'verified' || currentTier === 'verified_plus' ? 'met' : monthsSinceFirstPaid >= 12 ? 'met' : 'pending'}
              progress={`${Math.min(monthsSinceFirstPaid, 12)}/12 months`}
              description="12 months of consistent milestone payments in good standing."
            />
            <CriteriaRow
              label="Verified+"
              status={currentTier === 'verified_plus' ? 'met' : monthsSinceFirstPaid >= 24 ? 'met' : 'pending'}
              progress={`${Math.min(monthsSinceFirstPaid, 24)}/24 months`}
              description="24 months in good standing. Unlocks engagement-fee discount and prominent directory placement."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CriteriaRow({ label, status, progress, description }: { label: string; status: 'met' | 'pending'; progress: string; description: string }) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b-[0.5px] border-ach-border last:border-0 last:pb-0">
      <BadgeCheck className={`h-4 w-4 mt-0.5 ${status === 'met' ? 'text-ach-navy' : 'text-ach-navy/30'}`} />
      <div className="flex-1">
        <div className="flex items-baseline justify-between">
          <span className="font-medium text-ach-navy">{label}</span>
          <span className="text-[11.5px] text-ach-navy/60 tabular-nums">{progress}</span>
        </div>
        <div className="text-[12.5px] text-ach-navy/70 mt-0.5">{description}</div>
      </div>
    </div>
  );
}
