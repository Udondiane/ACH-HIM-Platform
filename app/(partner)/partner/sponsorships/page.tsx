import { createClient } from '@/lib/supabase/server';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Building2 } from 'lucide-react';

export default async function PartnerSponsorshipsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);
  if (!partner) return null;

  const supabase = createClient();
  const [cohortPartners, cohortCandidates] = await Promise.all([
    supabase.from('cohort_partners')
      .select(`
        id, sponsorship_count, engagement_fee, is_lead_partner,
        cohorts(id, cohort_ref, name, status, location, start_date, end_date)
      `)
      .eq('partner_id', partner.id),
    supabase.from('cohort_candidates')
      .select(`
        id,
        candidates(candidate_ref, given_name, country_of_origin, status),
        cohorts(id, cohort_ref, name)
      `)
      .eq('sponsoring_partner_id', partner.id),
  ]);

  const cohortRows = (cohortPartners.data as any[]) ?? [];
  const sponsoredRows = (cohortCandidates.data as any[]) ?? [];

  const totalSponsorships = cohortRows.reduce((s, r) => s + Number(r.sponsorship_count ?? 0), 0);
  const totalEngagement = cohortRows.reduce((s, r) => s + Number(r.engagement_fee ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Sponsorships"
        title="Your sponsorships"
        description="Cohorts and candidates you fund through ACH's Bridge to Employment programme. Sponsorship gives you visibility on capability uplift without the hiring commitment."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Kpi label="Cohorts sponsored" value={String(cohortRows.length)} />
        <Kpi label="Candidates sponsored" value={String(sponsoredRows.length)} sub={`${totalSponsorships} commissioned`} />
        <Kpi label="Engagement fees paid" value={`£${totalEngagement.toLocaleString()}`} sub="across all cohorts" />
      </div>

      <Card className="mb-5">
        <CardContent className="pt-6">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Cohorts</div>
          {cohortRows.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-10 w-10" />}
              title="No cohort sponsorships yet"
              description="Once ACH links you to a cohort, your sponsorship details will appear here."
            />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <Th>Cohort</Th>
                  <Th>Location</Th>
                  <Th>Window</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Sponsorships</Th>
                  <Th className="text-right">Fee</Th>
                  <Th>Role</Th>
                </tr>
              </thead>
              <tbody>
                {cohortRows.map(r => (
                  <tr key={r.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <Td className="text-ach-navy font-medium">{r.cohorts?.cohort_ref}</Td>
                    <Td className="text-ach-navy/70">{r.cohorts?.location ?? '—'}</Td>
                    <Td className="text-ach-navy/70">
                      {r.cohorts?.start_date ? new Date(r.cohorts.start_date).toLocaleDateString('en-GB') : '—'}
                      {r.cohorts?.end_date ? ` – ${new Date(r.cohorts.end_date).toLocaleDateString('en-GB')}` : ''}
                    </Td>
                    <Td><Badge>{r.cohorts?.status ?? '—'}</Badge></Td>
                    <Td className="text-right tabular-nums">{r.sponsorship_count ?? 0}</Td>
                    <Td className="text-right tabular-nums">£{Number(r.engagement_fee ?? 0).toFixed(0)}</Td>
                    <Td>{r.is_lead_partner ? <Badge variant="active">Lead</Badge> : <span className="text-ach-navy/55 text-[12px]">Co-sponsor</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Sponsored candidates</div>
          {sponsoredRows.length === 0 ? (
            <p className="text-[13px] text-ach-navy/60">No individual sponsorships yet.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <Th>Reference</Th>
                  <Th>Country</Th>
                  <Th>Cohort</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {sponsoredRows.map(r => (
                  <tr key={r.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <Td className="text-ach-navy font-medium">{r.candidates?.candidate_ref}</Td>
                    <Td className="text-ach-navy/70">{r.candidates?.country_of_origin ?? '—'}</Td>
                    <Td className="text-ach-navy/70">{r.cohorts?.cohort_ref ?? '—'}</Td>
                    <Td><Badge>{r.candidates?.status ?? '—'}</Badge></Td>
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

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
        <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5 tabular-nums">{value}</div>
        {sub && <div className="text-[12px] text-ach-navy/60 mt-2">{sub}</div>}
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
