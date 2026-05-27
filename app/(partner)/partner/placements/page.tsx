import { createClient } from '@/lib/supabase/server';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Users } from 'lucide-react';

const SALARY_BAND_LABELS: Record<string, string> = {
  volume:   'Volume (£20–23k)',
  standard: 'Standard (£23–28k)',
  premium:  'Premium (£28k+)',
};

const STATUS_LABELS: Record<string, string> = {
  active:           'Active',
  started:          'Started',
  completed_6mo:    'Completed 6mo',
  completed_12mo:   'Retained 12mo',
  left_pre_6mo:     'Left before 6mo',
  left_6_to_12mo:   'Left 6–12mo',
};

export default async function PartnerPlacementsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);
  if (!partner) return null;

  const supabase = createClient();
  const { data: placements } = await supabase
    .from('placements')
    .select(`
      id, role_title, salary_band, salary_actual, start_date, status, sponsored_placement,
      candidates(candidate_ref, given_name, country_of_origin),
      cohorts(cohort_ref, name)
    `)
    .eq('partner_id', partner.id)
    .order('start_date', { ascending: false });

  const rows = (placements as any[]) ?? [];
  const active = rows.filter(r => r.status === 'active' || r.status === 'started').length;
  const retained = rows.filter(r => r.status === 'completed_12mo' || r.status === 'completed_6mo').length;
  const totalSalary = rows
    .filter(r => r.status === 'active' || r.status === 'completed_12mo')
    .reduce((s, r) => s + Number(r.salary_actual ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Placements"
        title="Your placements"
        description="Every candidate placed with your organisation through ACH's Bridge to Employment programme."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Kpi label="Total placements" value={String(rows.length)} />
        <Kpi label="Active or started" value={String(active)} sub={`${retained} retained beyond 6mo`} />
        <Kpi label="Annualised salary" value={`£${totalSalary.toLocaleString()}`} sub="across active placements" />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No placements yet"
            description="Once you hire your first candidate through an ACH cohort, they'll appear here."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-ach-page border-b-[0.5px] border-ach-border">
              <tr>
                <Th>Reference</Th>
                <Th>Role</Th>
                <Th>Cohort</Th>
                <Th>Started</Th>
                <Th>Band</Th>
                <Th className="text-right">Salary</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/40">
                  <Td className="text-ach-navy font-medium">{r.candidates?.candidate_ref ?? '—'}</Td>
                  <Td>{r.role_title}</Td>
                  <Td className="text-ach-navy/70">{r.cohorts?.cohort_ref ?? '—'}</Td>
                  <Td className="text-ach-navy/70">{new Date(r.start_date).toLocaleDateString('en-GB')}</Td>
                  <Td className="text-ach-navy/70 capitalize">{SALARY_BAND_LABELS[r.salary_band] ?? r.salary_band}</Td>
                  <Td className="text-right tabular-nums">{r.salary_actual ? `£${Number(r.salary_actual).toLocaleString()}` : '—'}</Td>
                  <Td><Badge>{STATUS_LABELS[r.status] ?? r.status}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
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
  return <th className={`text-left px-4 py-3 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
