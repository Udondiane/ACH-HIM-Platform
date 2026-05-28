import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export async function WorkforcePartnerDashboard({ partner, hideHeader }: { partner: any; hideHeader?: boolean }) {
  const supabase = createClient();

  const [placements, cohortPartners, devFundCredits] = await Promise.all([
    supabase.from('placements')
      .select('id, role_title, salary_band, salary_actual, start_date, status, candidates(candidate_ref, given_name)')
      .eq('partner_id', partner.id).order('start_date', { ascending: false }),
    supabase.from('cohort_partners')
      .select('id, cohorts(id, cohort_ref, name, status)')
      .eq('partner_id', partner.id),
    supabase.from('dev_fund_credits').select('amount').eq('partner_id', partner.id),
  ]);

  const allPlacements = (placements.data as any[]) ?? [];
  const cohortRows = (cohortPartners.data as any[]) ?? [];

  const totalPlacements = allPlacements.length;
  const activePlacements = allPlacements.filter(p => p.status === 'active' || p.status === 'started').length;
  const totalSalary = allPlacements
    .filter(p => p.status === 'active' || p.status === 'completed_12mo')
    .reduce((s, p) => s + Number(p.salary_actual ?? 0), 0);

  const totalDevFundContribution = ((devFundCredits.data as any[]) ?? [])
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);

  return (
    <div>
      {hideHeader ? (
        <div className="mb-4 pb-3 border-b-[0.5px] border-ach-border">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">As a Workforce Partner</div>
        </div>
      ) : (
        <PageHeader
          miniLabel="ACH Workforce Partner"
          title={`Welcome, ${partner.name}`}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard label="Total placements" value={String(totalPlacements)} sub={`${activePlacements} currently active`} />
        <KpiCard label="Cohorts engaged" value={String(cohortRows.length)} sub="programmes you have run with ACH" />
        <KpiCard label="Annualised salary" value={`£${totalSalary.toLocaleString()}`} sub="across active placements" />
        <KpiCard label="Development Fund" value={`£${totalDevFundContribution.toLocaleString()}`} sub="invested in candidate progression" />
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
            <div className="text-[12px] text-ach-navy/60">invested in candidate-led training</div>
          </div>
          <p className="text-[12.5px] text-ach-navy/70 mt-3 max-w-prose">
            Your Development Fund contribution is ringfenced for candidate-led progression -
            accredited qualifications, sector certifications, language progression, and pre-degree
            access. Each candidate decides how to use their balance, with ACH caseworker review.
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
