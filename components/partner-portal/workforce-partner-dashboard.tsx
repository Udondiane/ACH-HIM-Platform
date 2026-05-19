import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const TIER_LABELS: Record<string, string> = {
  none: 'Not yet verified',
  verified: 'Verified',
  verified_plus: 'Verified+',
};

export async function WorkforcePartnerDashboard({ partner }: { partner: any }) {
  const supabase = createClient();

  const [placements, milestones, tier, devFundCredits] = await Promise.all([
    supabase.from('placements')
      .select('id, role_title, salary_band, start_date, status, candidates(candidate_ref, given_name)')
      .eq('partner_id', partner.id).order('start_date', { ascending: false }),
    supabase.from('placement_milestones')
      .select('id, kind, amount, due_on, paid_on, state, placements!inner(partner_id, candidates(candidate_ref))')
      .eq('placements.partner_id', partner.id).order('due_on'),
    supabase.from('partner_tier_status').select('*').eq('partner_id', partner.id).maybeSingle(),
    supabase.from('dev_fund_credits').select('amount').eq('partner_id', partner.id),
  ]);

  const allPlacements = (placements.data as any[]) ?? [];
  const allMilestones = (milestones.data as any[]) ?? [];
  const tierData = tier.data as any;

  // Stats
  const totalPlacements = allPlacements.length;
  const activePlacements = allPlacements.filter(p => p.status === 'active' || p.status === 'started').length;
  const retainedAt12mo = allPlacements.filter(p => p.status === 'completed_12mo').length;
  const earlyExits = allPlacements.filter(p => p.status === 'left_pre_6mo' || p.status === 'left_6_to_12mo').length;

  const paidMilestones = allMilestones.filter(m => m.state === 'paid');
  const pendingMilestones = allMilestones.filter(m => m.state === 'pending');
  const totalPaid = paidMilestones.reduce((s, m) => s + Number(m.amount ?? 0), 0);
  const totalPending = pendingMilestones.reduce((s, m) => s + Number(m.amount ?? 0), 0);

  const totalDevFundContribution = ((devFundCredits.data as any[]) ?? [])
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);

  // Estimated retention savings (using equivalence library defaults — memo §13)
  // Volume £3,900 / Standard £6,250 / Premium £11,550 per retained role
  const retentionSavings = allPlacements
    .filter(p => p.status === 'active' || p.status === 'completed_12mo')
    .reduce((s, p) => {
      const band = p.salary_band as string;
      const v = band === 'premium' ? 11550 : band === 'standard' ? 6250 : 3900;
      return s + v;
    }, 0);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Workforce partner"
        title={`Welcome, ${partner.name}`}
        description="At-a-glance view of your placements, retention milestones, Development Fund contribution, and Verified tier status."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard label="Placements" value={String(totalPlacements)} sub={`${activePlacements} active`} />
        <KpiCard label="Retained at 12mo" value={String(retainedAt12mo)} sub="completed the full year" />
        <KpiCard label="Milestone paid" value={`£${totalPaid.toLocaleString()}`} sub={`£${totalPending.toLocaleString()} pending`} />
        <KpiCard label="Retention savings (est.)" value={`£${retentionSavings.toLocaleString()}`} sub="CIPD lower-bound" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Upcoming milestones</div>
          </CardHeader>
          <CardContent>
            {pendingMilestones.length === 0 ? (
              <p className="text-[13px] text-ach-navy/60">No pending milestones.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b-[0.5px] border-ach-border">
                    <Th>Candidate</Th><Th>Kind</Th><Th>Due</Th><Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {pendingMilestones.slice(0, 8).map(m => (
                    <tr key={m.id} className="border-b-[0.5px] border-ach-border last:border-0">
                      <Td>{m.placements?.candidates?.candidate_ref ?? '—'}</Td>
                      <Td>{milestoneKindLabel(m.kind)}</Td>
                      <Td className="text-ach-navy/70">{new Date(m.due_on).toLocaleDateString('en-GB')}</Td>
                      <Td className="text-right tabular-nums">£{Number(m.amount).toFixed(0)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Verified tier</div>
          </CardHeader>
          <CardContent>
            <Badge variant={(tierData?.current_tier ?? 'none') as any}>
              {TIER_LABELS[tierData?.current_tier ?? 'none']}
            </Badge>
            {tierData?.qualified_at && (
              <div className="text-[12px] text-ach-navy/60 mt-3">
                Qualified {new Date(tierData.qualified_at).toLocaleDateString('en-GB')}
              </div>
            )}
            {tierData?.engagement_fee_discount > 0 ? (
              <div className="text-[12px] text-ach-navy/60 mt-1">
                Engagement fee discount: {Math.round(Number(tierData.engagement_fee_discount) * 100 * 10) / 10}%
              </div>
            ) : (
              <div className="text-[12px] text-ach-navy/60 mt-3">
                Verified status unlocks at 12 months of milestone payments in good standing.
                Verified+ at 24 months.
              </div>
            )}
            <div className="mt-4">
              <Link href="/partner/verified-tier">
                <Button variant="secondary" size="sm">See tier history</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Recent placements</div>
        </CardHeader>
        <CardContent>
          {allPlacements.length === 0 ? (
            <p className="text-[13px] text-ach-navy/60">No placements yet.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <Th>Reference</Th><Th>Role</Th><Th>Band</Th><Th>Started</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {allPlacements.slice(0, 10).map(p => (
                  <tr key={p.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <Td className="text-ach-navy font-medium">{p.candidates?.candidate_ref}</Td>
                    <Td>{p.role_title}</Td>
                    <Td className="capitalize">{p.salary_band}</Td>
                    <Td className="text-ach-navy/70">{new Date(p.start_date).toLocaleDateString('en-GB')}</Td>
                    <Td><Badge>{p.status}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Development Fund</div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none">
              £{totalDevFundContribution.toLocaleString()}
            </div>
            <div className="text-[12px] text-ach-navy/60">contributed to candidate-led training</div>
          </div>
          <p className="text-[12.5px] text-ach-navy/70 mt-3 max-w-prose">
            Your retention milestone payments are ringfenced for candidate-led development training —
            accredited qualifications, sector certifications, language progression, and pre-degree
            access. Each candidate decides how to use their balance, with ACH caseworker review.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function milestoneKindLabel(k: string): string {
  return ({ placement: 'Placement', retention_6mo: '6-month retention', retention_12mo: '12-month retention' } as Record<string, string>)[k] ?? k;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
        <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5">{value}</div>
        <div className="text-[12px] text-ach-navy/60 mt-2">{sub}</div>
      </CardContent>
    </Card>
  );
}
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2 ${className}`}>{children}</td>;
}
