import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export async function CapabilityInvestorDashboard({ partner, hideHeader }: { partner: any; hideHeader?: boolean }) {
  const supabase = createClient();

  const { data: cohortPartners } = await supabase
    .from('cohort_partners')
    .select('id, cohort_id, sponsorship_count, engagement_fee, cohorts(id, cohort_ref, name, status, location, start_date)')
    .eq('partner_id', partner.id);

  const cps = (cohortPartners as any[]) ?? [];
  const totalSponsorships = cps.reduce((s, cp) => s + (cp.sponsorship_count ?? 0), 0);
  const totalEngagementFee = cps.reduce((s, cp) => s + Number(cp.engagement_fee ?? 0), 0);
  const activeCohorts = cps.filter(cp => cp.cohorts?.status === 'in_progress' || cp.cohorts?.status === 'recruiting').length;

  const { data: sponsoredCandidates } = await supabase
    .from('cohort_candidates')
    .select('candidate_id, candidates(candidate_ref, given_name, status, country_of_origin)')
    .eq('sponsoring_partner_id', partner.id);
  const sponsored = (sponsoredCandidates as any[]) ?? [];

  return (
    <div>
      {hideHeader ? (
        <div className="mb-4 pb-3 border-b-[0.5px] border-ach-border">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">As a Capability Investor</div>
        </div>
      ) : (
        <PageHeader
          miniLabel="ACH Capability Investor"
          title={`Welcome, ${partner.name}`}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard label="Sponsorships" value={String(totalSponsorships)} sub="committed" />
        <KpiCard label="Cohorts engaged" value={String(cps.length)} sub={`${activeCohorts} active`} />
        <KpiCard label="Engagement fees" value={`£${totalEngagementFee.toLocaleString()}`} sub="paid to date" />
        <KpiCard label="Candidates supported" value={String(sponsored.length)} sub="across cohorts" />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Your cohorts</div>
        </CardHeader>
        <CardContent>
          {cps.length === 0 ? (
            <p className="text-[13px] text-ach-navy/60">No cohort engagements recorded yet.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <Th>Cohort</Th><Th>Location</Th><Th>Started</Th>
                  <Th className="text-right">Sponsorships</Th><Th className="text-right">Fee</Th>
                </tr>
              </thead>
              <tbody>
                {cps.map(cp => (
                  <tr key={cp.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <Td className="text-ach-navy font-medium">{cp.cohorts?.cohort_ref}</Td>
                    <Td className="text-ach-navy/70">{cp.cohorts?.location ?? '—'}</Td>
                    <Td className="text-ach-navy/70">
                      {cp.cohorts?.start_date ? new Date(cp.cohorts.start_date).toLocaleDateString('en-GB') : '—'}
                    </Td>
                    <Td className="text-right tabular-nums">{cp.sponsorship_count}</Td>
                    <Td className="text-right tabular-nums">£{Number(cp.engagement_fee ?? 0).toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
            Anonymised candidates you&apos;ve supported
          </div>
        </CardHeader>
        <CardContent>
          {sponsored.length === 0 ? (
            <p className="text-[13px] text-ach-navy/60">
              No candidates linked to your sponsorship yet. Once cohort enrolment completes,
              candidates will appear here by reference (e.g. C-2026-001) — never by name unless
              they&apos;ve given explicit consent.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <Th>Reference</Th><Th>Country of origin</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {sponsored.map((sc: any) => (
                  <tr key={sc.candidate_id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <Td className="text-ach-navy font-medium">{sc.candidates?.candidate_ref}</Td>
                    <Td className="text-ach-navy/70">{sc.candidates?.country_of_origin ?? '—'}</Td>
                    <Td><Badge>{sc.candidates?.status}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[12px] text-ach-navy/60 mt-4 max-w-prose">
            Capability uplift data is aggregated across your sponsored candidates and reported
            via the Career Progression Report — generated annually by ACH staff.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
        <div className="text-[24px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5 tabular-nums">{value}</div>
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
