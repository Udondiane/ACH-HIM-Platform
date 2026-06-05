import Link from 'next/link';
import { Handshake, Building2, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoleSelector } from '@/components/dashboard/role-selector';
import { PARTNER_TYPE_LABELS } from '@/lib/partners/schema';

export default async function EngagementDashboardPage() {
  const supabase = createClient();
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const [workforcePartnersRes, cohortPartnersRes, ytdPlacementsRes, recentCohortsRes] = await Promise.all([
    supabase
      .from('partners')
      .select('id, name, type, status, sector')
      .eq('type', 'workforce_partner')
      .neq('status', 'closed')
      .order('name'),
    supabase
      .from('cohort_partners')
      .select('id, cohort_id, partner_id, sponsorship_count, engagement_fee, is_lead_partner, partners(name), cohorts(cohort_ref, name, status)')
      .order('engagement_fee', { ascending: false })
      .limit(50),
    supabase
      .from('placements')
      .select('id, partner_id, salary_band, status, start_date, candidates(candidate_ref)')
      .gte('start_date', yearStart),
    supabase
      .from('cohorts')
      .select('id, cohort_ref, name, status, intervention_start_date, start_date')
      .in('status', ['recruiting', 'in_progress'])
      .order('intervention_start_date', { ascending: false, nullsFirst: false })
      .limit(10),
  ]);

  const partners = (workforcePartnersRes.data as any[]) ?? [];
  const cohortPartners = (cohortPartnersRes.data as any[]) ?? [];
  const ytdPlacements = (ytdPlacementsRes.data as any[]) ?? [];
  const recentCohorts = (recentCohortsRes.data as any[]) ?? [];

  // Aggregate placements per partner
  const placementsByPartner = new Map<string, { count: number; active: number; sustained: number }>();
  for (const p of ytdPlacements) {
    const cur = placementsByPartner.get(p.partner_id) ?? { count: 0, active: 0, sustained: 0 };
    cur.count += 1;
    if (['started', 'active', 'completed_12mo'].includes(p.status)) cur.active += 1;
    if (['active', 'completed_12mo'].includes(p.status)) cur.sustained += 1;
    placementsByPartner.set(p.partner_id, cur);
  }

  // Aggregate sponsorships per partner
  const sponsorshipByPartner = new Map<string, { totalFee: number; cohortCount: number; sponsorshipTotal: number }>();
  for (const cp of cohortPartners) {
    const cur = sponsorshipByPartner.get(cp.partner_id) ?? { totalFee: 0, cohortCount: 0, sponsorshipTotal: 0 };
    cur.totalFee += Number(cp.engagement_fee) || 0;
    cur.cohortCount += 1;
    cur.sponsorshipTotal += Number(cp.sponsorship_count) || 0;
    sponsorshipByPartner.set(cp.partner_id, cur);
  }

  const totalEngagementFees = cohortPartners.reduce((s, cp) => s + (Number(cp.engagement_fee) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Dashboard"
        title="Employer engagement"
        description="Workforce partners, sponsorships, placements YTD."
        actions={
          <Link href="/partners"><Button variant="secondary"><Building2 className="h-3.5 w-3.5" />All partners</Button></Link>
        }
      />

      <RoleSelector activeRole="engagement" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Workforce partners" value={partners.length} />
        <StatCard label="Placements YTD" value={ytdPlacements.length} />
        <StatCard label="Corporate partner investment" value={`£${totalEngagementFees.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`} />
        <StatCard label="Active cohorts" value={recentCohorts.length} />
      </div>

      {/* Partner-by-partner overview */}
      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
            <Handshake className="h-3 w-3" />Workforce partners
          </div>
          <div className="text-[12px] text-ach-navy/60 mt-0.5">
            YTD placements and partner investment per partner.
          </div>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60">No workforce partners added yet.</div>
          ) : (
            <div className="space-y-1.5">
              {partners.map(p => {
                const placements = placementsByPartner.get(p.id) ?? { count: 0, active: 0, sustained: 0 };
                const sponsor = sponsorshipByPartner.get(p.id) ?? { totalFee: 0, cohortCount: 0, sponsorshipTotal: 0 };
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-[1fr_120px_120px_140px] items-center gap-3 p-3 rounded-[10px] border-[0.5px] border-ach-border bg-white hover:bg-ach-page transition-colors"
                  >
                    <Link href={`/partners/${p.id}`} className="min-w-0">
                      <div className="text-[13.5px] font-medium text-ach-navy truncate">{p.name}</div>
                      <div className="text-[11.5px] text-ach-navy/60 truncate">
                        {PARTNER_TYPE_LABELS[p.type as keyof typeof PARTNER_TYPE_LABELS] ?? p.type}
                        {p.sector && ` · ${p.sector}`}
                      </div>
                    </Link>
                    <div className="text-[11.5px] text-ach-navy/70">
                      <div className="font-medium text-ach-navy">{placements.count} placement{placements.count === 1 ? '' : 's'}</div>
                      <div className="text-ach-navy/55">{placements.active} active</div>
                    </div>
                    <div className="text-[11.5px] text-ach-navy/70">
                      <div className="font-medium text-ach-navy">{sponsor.cohortCount} cohort{sponsor.cohortCount === 1 ? '' : 's'}</div>
                      <div className="text-ach-navy/55">{sponsor.sponsorshipTotal} sponsored</div>
                    </div>
                    <div className="text-[11.5px] tabular-nums text-ach-navy/85 font-medium">
                      £{sponsor.totalFee.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cohorts open for sponsorship */}
      <Card>
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" />Cohorts open for sponsorship
          </div>
          <div className="text-[12px] text-ach-navy/60 mt-0.5">
            Cohorts currently recruiting or in progress.
          </div>
        </CardHeader>
        <CardContent>
          {recentCohorts.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60">No active cohorts.</div>
          ) : (
            <div className="space-y-1.5">
              {recentCohorts.map(c => (
                <Link
                  key={c.id}
                  href={`/cohorts/${c.id}`}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-[10px] hover:bg-ach-page transition-colors border-[0.5px] border-ach-border"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ach-navy truncate">{c.cohort_ref} · {c.name}</div>
                    <div className="text-[11.5px] text-ach-navy/60">
                      {c.intervention_start_date ? `Starts ${c.intervention_start_date}` : c.start_date ? `Planned ${c.start_date}` : 'Date TBD'}
                    </div>
                  </div>
                  <Badge>{c.status.replace(/_/g, ' ')}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[10px] bg-white border-[0.5px] border-ach-border p-3">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy mt-1 leading-none">{value}</div>
    </div>
  );
}
