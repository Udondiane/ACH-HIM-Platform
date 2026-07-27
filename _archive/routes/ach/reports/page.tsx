import { ScrollText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { formatGbpDetailed, formatDate } from '@/lib/utils/format';

export default async function ReportsPage() {
  const supabase = createClient();
  const [cprRes, erRes] = await Promise.all([
    supabase
      .from('career_progression_reports')
      .select('id, partner_id, period_label, generated_at, total_milestone_payments, total_dev_fund_contribution, candidates_contributed_to, training_enrolments_funded, transitions, methodology_version, partners(name)')
      .order('generated_at', { ascending: false }),
    supabase
      .from('engagement_reports')
      .select('id, placement_id, partner_id, generated_at, partial_sv_attribution, engagement_summary, methodology_version, partners(name), placements(role_title, candidate_id, candidates(candidate_ref))')
      .order('generated_at', { ascending: false }),
  ]);

  const cpr = (cprRes.data as any[]) ?? [];
  const er = (erRes.data as any[]) ?? [];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Reports"
        title="Career Progression & Engagement Reports"
        description="Annual Career Progression Reports per milestone-paying partner (spec §15.3) and Engagement Reports for sub-milestone exits (spec §16.2). Each is methodology-stamped."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Stat label="Career Progression Reports" value={String(cpr.length)} subline="annual per-partner" />
        <Stat label="Engagement Reports" value={String(er.length)} subline="sub-milestone exits" />
        <Stat label="Total reports" value={String(cpr.length + er.length)} />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Career Progression Reports</div>
            <div className="text-[12px] text-ach-navy/60 mt-1">Annual narrative + numbers per milestone-paying partner. Stamps milestone payments, dev fund contribution, candidates touched, training funded, transitions.</div>
          </CardHeader>
          <CardContent className="pt-0">
            {cpr.length === 0 ? (
              <EmptyState
                icon={<ScrollText className="h-8 w-8" />}
                title="No reports yet"
                description="Reports are generated annually from milestone payments and dev fund credits."
              />
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b-[0.5px] border-ach-border">
                    <Th>Partner</Th>
                    <Th>Period</Th>
                    <Th className="text-right">Milestone £</Th>
                    <Th className="text-right">Dev fund £</Th>
                    <Th className="text-right">Candidates</Th>
                    <Th className="text-right">Transitions</Th>
                    <Th>Method</Th>
                    <Th>Generated</Th>
                  </tr>
                </thead>
                <tbody>
                  {cpr.map(r => (
                    <tr key={r.id} className="border-b-[0.5px] border-ach-border last:border-0">
                      <Td><span className="text-ach-navy font-medium">{r.partners?.name ?? '—'}</span></Td>
                      <Td className="text-ach-navy/80">{r.period_label}</Td>
                      <Td className="text-right tabular-nums">{formatGbpDetailed(r.total_milestone_payments)}</Td>
                      <Td className="text-right tabular-nums">{formatGbpDetailed(r.total_dev_fund_contribution)}</Td>
                      <Td className="text-right tabular-nums">{r.candidates_contributed_to}</Td>
                      <Td className="text-right tabular-nums">{r.transitions}</Td>
                      <Td><Badge>{r.methodology_version}</Badge></Td>
                      <Td className="text-ach-navy/70">{formatDate(r.generated_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Engagement Reports</div>
            <div className="text-[12px] text-ach-navy/60 mt-1">Generated for sub-milestone exits regardless of cause. Records the engagement that occurred, candidate's development, and partial social-value attribution.</div>
          </CardHeader>
          <CardContent className="pt-0">
            {er.length === 0 ? (
              <EmptyState
                icon={<ScrollText className="h-8 w-8" />}
                title="No engagement reports"
                description="Triggered automatically on a sub-milestone placement exit."
              />
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b-[0.5px] border-ach-border">
                    <Th>Partner</Th>
                    <Th>Candidate</Th>
                    <Th>Role</Th>
                    <Th className="text-right">Partial SV £</Th>
                    <Th>Method</Th>
                    <Th>Generated</Th>
                  </tr>
                </thead>
                <tbody>
                  {er.map(r => (
                    <tr key={r.id} className="border-b-[0.5px] border-ach-border last:border-0">
                      <Td className="text-ach-navy/80">{r.partners?.name ?? '—'}</Td>
                      <Td className="text-ach-navy/80">{r.placements?.candidates?.candidate_ref ?? '—'}</Td>
                      <Td className="text-ach-navy/70">{r.placements?.role_title ?? '—'}</Td>
                      <Td className="text-right tabular-nums">{formatGbpDetailed(r.partial_sv_attribution)}</Td>
                      <Td><Badge>{r.methodology_version}</Badge></Td>
                      <Td className="text-ach-navy/70">{formatDate(r.generated_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, subline }: { label: string; value: string; subline?: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy mt-2 leading-none tabular-nums">{value}</div>
      {subline && <div className="text-[11px] text-ach-navy/60 mt-2">{subline}</div>}
    </Card>
  );
}
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
