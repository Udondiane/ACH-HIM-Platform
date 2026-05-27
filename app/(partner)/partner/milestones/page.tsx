import { createClient } from '@/lib/supabase/server';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollText } from 'lucide-react';

const KIND_LABELS: Record<string, string> = {
  placement:       'Placement',
  retention_6mo:   '6-month retention',
  retention_12mo:  '12-month retention',
};

export default async function PartnerMilestonesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);
  if (!partner) return null;

  const supabase = createClient();
  const { data: milestones } = await supabase
    .from('placement_milestones')
    .select(`
      id, kind, amount, due_on, paid_on, state,
      placements!inner(
        partner_id, role_title,
        candidates(candidate_ref, given_name)
      )
    `)
    .eq('placements.partner_id', partner.id)
    .order('due_on', { ascending: false });

  const rows = (milestones as any[]) ?? [];
  const paid = rows.filter(r => r.state === 'paid');
  const pending = rows.filter(r => r.state === 'pending');
  const totalPaid = paid.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalPending = pending.reduce((s, r) => s + Number(r.amount ?? 0), 0);

  const placementMilestones = rows.filter(r => r.kind === 'placement');
  const retentionMilestones = rows.filter(r => r.kind !== 'placement');
  const totalRetentionPaid = retentionMilestones
    .filter(r => r.state === 'paid')
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Milestone payments"
        title="Milestone history"
        description="Placement and retention milestones for every candidate hired through ACH. Retention milestones ringfence into the Development Fund."
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
        <Kpi label="Total paid" value={`£${totalPaid.toLocaleString()}`} sub={`${paid.length} milestones`} />
        <Kpi label="Outstanding" value={`£${totalPending.toLocaleString()}`} sub={`${pending.length} due`} />
        <Kpi label="Placement fees" value={`£${placementMilestones.filter(r => r.state === 'paid').reduce((s, r) => s + Number(r.amount), 0).toLocaleString()}`} sub="paid at hire" />
        <Kpi label="Retention fees" value={`£${totalRetentionPaid.toLocaleString()}`} sub="into Dev Fund" />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ScrollText className="h-10 w-10" />}
            title="No milestones yet"
            description="Milestones appear when you have placements with payment schedules attached."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-ach-page border-b-[0.5px] border-ach-border">
              <tr>
                <Th>Reference</Th>
                <Th>Role</Th>
                <Th>Kind</Th>
                <Th>Due</Th>
                <Th>Paid</Th>
                <Th className="text-right">Amount</Th>
                <Th>State</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/40">
                  <Td className="text-ach-navy font-medium">{r.placements?.candidates?.candidate_ref ?? '—'}</Td>
                  <Td className="text-ach-navy/80">{r.placements?.role_title ?? '—'}</Td>
                  <Td>{KIND_LABELS[r.kind] ?? r.kind}</Td>
                  <Td className="text-ach-navy/70">{new Date(r.due_on).toLocaleDateString('en-GB')}</Td>
                  <Td className="text-ach-navy/70">{r.paid_on ? new Date(r.paid_on).toLocaleDateString('en-GB') : '—'}</Td>
                  <Td className="text-right tabular-nums">£{Number(r.amount).toFixed(0)}</Td>
                  <Td><Badge variant={r.state === 'paid' ? 'active' : 'default'}>{r.state}</Badge></Td>
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
        <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5 tabular-nums">{value}</div>
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
