import { Calculator, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

const CAPABILITY_LABELS: Record<string, string> = {
  employment: 'Employment',
  housing:    'Housing',
  education:  'Education & Skills',
  health:     'Health & Wellbeing',
  belonging:  'Belonging & Identity',
  social:     'Social Participation',
  rights:     'Rights & Citizenship',
};

export default async function TomsCrosswalkPage() {
  const supabase = createClient();
  const [codesRes, crosswalkRes] = await Promise.all([
    supabase.from('toms_codes').select('*').order('sort_order'),
    supabase.from('toms_crosswalk').select('*, toms_codes(measure, proxy_value_pence, play, unit)').order('sort_order'),
  ]);

  const codes = (codesRes.data as any[]) ?? [];
  const crosswalk = (crosswalkRes.data as any[]) ?? [];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Reports"
        title="HIM → National TOMs crosswalk"
        description="Maps each HIM capability indicator to the National TOMs code it can be claimed against, with the 2019-edition £ proxy value and the claim/attribution rule. GREEN rows are quantitative £ plays (monetised proxy). AMBER are qualitative / record-only."
      />

      <div className="mb-5 rounded-[10px] border-[0.5px] border-ach-rose/40 bg-ach-rose/8 px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-[#8B3A4F] shrink-0 mt-0.5" />
        <div className="text-[12.5px] text-ach-navy/85">
          <span className="font-medium text-[#8B3A4F]">Verify before bidding.</span>{' '}
          The £ proxy values below are from the National TOMs 2019 district-council edition. Confirm against the CURRENT live TOMs edition before any commitment. Bid documents typically reference the framework version effective at the procurement date.
        </div>
      </div>

      {crosswalk.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Calculator className="h-10 w-10" />}
            title="Crosswalk not seeded"
            description="Run migration 023 to seed the TOMs codes and the HIM crosswalk."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-ach-page border-b-[0.5px] border-ach-border">
              <tr>
                <Th>HIM capability</Th>
                <Th>HIM indicator</Th>
                <Th>NT code</Th>
                <Th>TOMs measure</Th>
                <Th>Unit</Th>
                <Th className="text-right">£ proxy (2019)</Th>
                <Th>Play</Th>
                <Th>Claim / attribution rule</Th>
              </tr>
            </thead>
            <tbody>
              {crosswalk.map((row: any) => {
                const code = row.toms_codes;
                const quant = code?.play === 'QUANT';
                return (
                  <tr key={row.id} className={`border-b-[0.5px] border-ach-border last:border-0 ${quant ? 'bg-[#F4F8F0]' : 'bg-[#FBF6E8]'}`}>
                    <Td className="text-ach-navy font-medium">{CAPABILITY_LABELS[row.capability] ?? row.capability}</Td>
                    <Td className="text-ach-navy/80">{row.indicator_label}</Td>
                    <Td className="text-ach-navy/75 font-medium">{row.toms_code}</Td>
                    <Td className="text-ach-navy/75">{code?.measure ?? '—'}</Td>
                    <Td className="text-ach-navy/65 text-[12px]">{code?.unit ?? '—'}</Td>
                    <Td className="text-right tabular-nums">
                      {code?.proxy_value_pence != null
                        ? `£${(code.proxy_value_pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] uppercase tracking-[1px] font-medium border-[0.5px] ${
                        quant ? 'bg-[#5E7A3C] text-white border-[#5E7A3C]' : 'bg-[#F2C744] text-[#735100] border-[#735100]/30'
                      }`}>
                        {code?.play ?? '—'}
                      </span>
                    </Td>
                    <Td className="text-ach-navy/65 text-[12px]">{row.attribution}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="mt-5">
        <CardContent className="pt-6 text-[12.5px] text-ach-navy/80 max-w-prose space-y-3">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">How to use the crosswalk</div>
          <p><span className="font-medium">QUANT plays</span> bank a £ value at the moment the activity occurs (mentoring hours delivered, training weeks completed, placements made). These produce the headline £ social value figure for TOMs-scored bids.</p>
          <p><span className="font-medium">QUAL plays</span> are spend-based or narrative — they win the qualitative half of the social value score but don&apos;t produce a meaningful £ line. Report uplift as evidence, not as money.</p>
          <p>The Capability Investor market (corporate ESG) values the opposite: holistic HIM uplift is the premium product, and the £ translation is supporting context — not the lead.</p>
          <p><span className="font-medium">Bid discipline.</span> Be conservative on placement commitments (NT1/3/4) because placement is ACH&apos;s volatile metric. Be generous on activity measures you control (NT7 mentoring hours, NT9 training weeks, NT12/13 placement weeks) — these bank £ without placement risk.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-3 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>;
}
