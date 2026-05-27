import { createClient } from '@/lib/supabase/server';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { GraduationCap } from 'lucide-react';

export default async function PartnerDevFundPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);
  if (!partner) return null;

  const supabase = createClient();
  const { data: credits } = await supabase
    .from('dev_fund_credits')
    .select(`
      id, amount, kind, created_at,
      placements(
        candidates(candidate_ref, given_name)
      )
    `)
    .eq('partner_id', partner.id)
    .order('created_at', { ascending: false });

  const rows = (credits as any[]) ?? [];
  const totalContributed = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const candidatesSupported = new Set(rows.map(r => r.placements?.candidates?.candidate_ref).filter(Boolean)).size;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Development Fund"
        title="Development Fund contribution"
        description="Your retention milestone payments fund candidate-led development training — accredited qualifications, sector certifications, language progression, and pre-degree access. Each candidate decides how to use their balance."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Kpi label="Total contributed" value={`£${totalContributed.toLocaleString()}`} sub="across all retention milestones" />
        <Kpi label="Candidates supported" value={String(candidatesSupported)} sub="have a Dev Fund balance" />
        <Kpi label="Average per candidate" value={candidatesSupported > 0 ? `£${Math.round(totalContributed / candidatesSupported).toLocaleString()}` : '£0'} sub="based on your contributions" />
      </div>

      <Card className="mb-5">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">How it works</div>
        </CardHeader>
        <CardContent className="text-[13px] text-ach-navy/80 space-y-3 max-w-prose">
          <p>
            For every retention milestone you pay, ACH ringfences a proportion into the Development Fund. The fund is held in trust for the placed candidate and unlocks at specific durability checkpoints.
          </p>
          <p>
            Candidates spend their balance on training that builds long-term capability: vocational qualifications, English progression, sector-specific certifications, or pre-university access programmes. ACH caseworkers review each request to make sure it aligns with the candidate&apos;s development plan.
          </p>
          <p>
            <span className="font-medium text-ach-navy">Why this matters for you:</span> the Dev Fund is what converts your retention payment from a transactional fee into a measurable social value contribution. It appears separately in your Verified tier evidence pack.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Contribution history</div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="h-10 w-10" />}
              title="No contributions yet"
              description="Your first retention milestone payment will appear here as a Development Fund credit."
            />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <Th>Date</Th>
                  <Th>Candidate</Th>
                  <Th>Kind</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <Td className="text-ach-navy/70">{new Date(r.created_at).toLocaleDateString('en-GB')}</Td>
                    <Td className="text-ach-navy font-medium">{r.placements?.candidates?.candidate_ref ?? '—'}</Td>
                    <Td className="text-ach-navy/70 capitalize">{(r.kind ?? '').replace(/_/g, ' ')}</Td>
                    <Td className="text-right tabular-nums">£{Number(r.amount).toFixed(0)}</Td>
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
        <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5 tabular-nums">{value}</div>
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
