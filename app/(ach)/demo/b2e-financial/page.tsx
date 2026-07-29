import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PrintButton } from '@/components/ui/print-button';

export const metadata = { title: 'Bridge to Employment · Financial reality' };

export default function B2eFinancialPage() {
  return (
    <div className="max-w-5xl mx-auto pb-16 print:max-w-none">
      <div className="mb-4 print:hidden flex items-center justify-between">
        <Link href="/dashboard" className="text-[13px] text-ach-navy/70 hover:text-ach-navy flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[1.4px] text-ach-navy/50 font-mono">Master Model · programme costing</span>
          <PrintButton />
        </div>
      </div>

      <div className="pb-5 border-b border-ach-border mb-8">
        <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-2">
          Financial analysis · Internal
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="font-serif text-[38px] tracking-[-0.01em] leading-[1.05] text-ach-navy font-medium text-balance max-w-[24ch]">
            Bridge to Employment · <em className="italic font-normal text-ach-navy/60">Financial reality</em>
          </h1>
          <div className="text-right text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/60 leading-[1.9]">
            Source · <span className="text-ach-navy font-medium">ACH Master Model</span><br />
            Cohort size · <span className="text-ach-navy font-medium">10 candidates</span><br />
            Reporting date · <span className="text-ach-navy font-medium">Apr 2026</span>
          </div>
        </div>
      </div>

      <SectionCard title="What employers paid vs true cost per cohort" sub="True cost is £16,696 loaded per cohort regardless of payer">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-mono">
              <tr className="border-b border-ach-border">
                <th className="text-left py-2 font-medium">Employer</th>
                <th className="text-right py-2 font-medium">Paid per cohort</th>
                <th className="text-right py-2 font-medium">Gap subsidised by grant</th>
                <th className="text-right py-2 font-medium">True cost</th>
                <th className="text-right py-2 font-medium">Employer coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dotted divide-ach-border/70">
              <FinRow name="IKEA" paid="£8,000" grant="£8,696" cost="£16,696" pct="48%" highlight />
              <FinRow name="Pret A Manger" paid="£0" grant="£16,696" cost="£16,696" pct="0%" />
              <FinRow name="Visit West (10 hotels)" paid="£0" grant="£16,696" cost="£16,696" pct="0%" />
              <FinRow name="Bristol Waste" paid="£0" grant="£16,696" cost="£16,696" pct="0%" />
            </tbody>
          </table>
        </div>
        <div className="text-[12px] text-ach-navy/60 mt-4 italic max-w-[70ch]">
          A cohort costs £16,696 to run whether an employer contributes or not. IKEA's £8,000 halves the grant subsidy ACH would otherwise absorb — the others rely on the grant fully. When the grant ends in October 2026, the "gap subsidised by grant" column becomes the fee ACH must recover from each employer.
        </div>
      </SectionCard>

      <SectionCard title="Per-candidate economics" sub="Loaded → floor → market">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <BoxStat k="True cost per candidate" v="£1,670" s="loaded cost — direct + 20% overhead + 5% contingency" />
          <BoxStat k="Price floor per candidate" v="£2,171" s="loaded + 30% sustainability margin" />
          <BoxStat k="Corporate rate per candidate" v="£4,341" s="IKEA / Pret target" highlight />
        </div>
        <div className="text-[12.5px] text-ach-navy/70 leading-relaxed">
          <strong className="text-ach-navy">The floor of £2,171 per candidate</strong> is where ACH stops losing money on a cohort. Anything below is quiet subsidy from ACH to the employer. The corporate rate reflects the full value delivered — screened talent, retention support, ED&amp;I evidence, CSR narrative.
        </div>
      </SectionCard>

      <SectionCard title="Per-cohort cost breakdown" sub="Where the £16,696 goes">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-mono">
              <tr className="border-b border-ach-border">
                <th className="text-left py-2 font-medium">Cost bucket</th>
                <th className="text-right py-2 font-medium">£</th>
                <th className="text-right py-2 font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dotted divide-ach-border/70">
              <CostRow name="Employer engagement" v="1,923" pct="12%" />
              <CostRow name="Recruitment &amp; screening" v="960" pct="6%" />
              <CostRow name="Programme delivery (staff + venue + catering + materials)" v="7,619" pct="46%" />
              <CostRow name="Participant support (travel · translation · welfare)" v="1,150" pct="7%" />
              <CostRow name="Placement + in-work check-ins (3 &amp; 6mo)" v="645" pct="4%" />
              <CostRow name="Programme management &amp; admin" v="954" pct="6%" />
              <CostRow name="Contingency (5%)" v="663" pct="4%" />
              <tr className="bg-ach-page/40 font-medium">
                <td className="py-2.5 text-ach-navy">Direct costs subtotal</td>
                <td className="py-2.5 text-right tabular-nums text-ach-navy">£13,913</td>
                <td className="py-2.5 text-right tabular-nums font-mono text-[12px] text-ach-navy/70">83%</td>
              </tr>
              <CostRow name="Organisational overhead (20% × direct)" v="2,783" pct="17%" />
              <tr className="bg-ach-page/40 font-medium">
                <td className="py-2.5 text-ach-navy">Full loaded cost per cohort</td>
                <td className="py-2.5 text-right tabular-nums text-ach-navy">£16,696</td>
                <td className="py-2.5 text-right tabular-nums font-mono text-[12px] text-ach-navy/70">100%</td>
              </tr>
              <CostRow name="Sustainability margin (30% × loaded)" v="5,009" pct="+30%" />
              <tr className="bg-[#F3E8D2] font-medium">
                <td className="py-2.5 text-ach-navy">Price floor per cohort</td>
                <td className="py-2.5 text-right tabular-nums text-ach-navy">£21,705</td>
                <td className="py-2.5 text-right tabular-nums font-mono text-[12px] text-ach-navy/70">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="flex items-center justify-between pt-5 mt-6 border-t border-ach-border font-mono text-[10.5px] uppercase tracking-[1.4px] text-ach-navy/55">
        <div className="text-ach-navy">ACH · Financial analysis · Internal</div>
        <div>v1.0 · Apr 2026</div>
      </div>
    </div>
  );
}

function SectionCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-ach-border rounded-[6px] p-6 mb-5">
      <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
        <div className="font-serif text-[19px] tracking-[-0.005em] font-medium text-ach-navy">{title}</div>
        <div className="text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/55">{sub}</div>
      </div>
      {children}
    </div>
  );
}

function FinRow({ name, paid, grant, cost, pct, highlight }: { name: string; paid: string; grant: string; cost: string; pct: string; highlight?: boolean }) {
  return (
    <tr>
      <td className={`py-2.5 ${highlight ? 'text-ach-navy font-medium' : 'text-ach-navy'}`}>{name}</td>
      <td className="py-2.5 text-right tabular-nums text-ach-navy">{paid}</td>
      <td className="py-2.5 text-right tabular-nums text-ach-navy/70">{grant}</td>
      <td className="py-2.5 text-right tabular-nums text-ach-navy/70">{cost}</td>
      <td className="py-2.5 text-right tabular-nums font-mono text-[12px] text-ach-navy/70">{pct}</td>
    </tr>
  );
}

function CostRow({ name, v, pct }: { name: string; v: string; pct: string }) {
  return (
    <tr>
      <td className="py-2 text-ach-navy/85" dangerouslySetInnerHTML={{ __html: name }} />
      <td className="py-2 text-right tabular-nums text-ach-navy/85">£{v}</td>
      <td className="py-2 text-right tabular-nums font-mono text-[11.5px] text-ach-navy/60">{pct}</td>
    </tr>
  );
}

function BoxStat({ k, v, s, highlight }: { k: string; v: string; s?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[6px] border px-4 py-3 ${highlight ? 'border-[#B8843C]/50 bg-[#F3E8D2]/50' : 'border-ach-border bg-ach-page/30'}`}>
      <div className="text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/55">{k}</div>
      <div className="font-serif text-[22px] tabular-nums text-ach-navy tracking-[-0.01em] leading-none mt-1.5">{v}</div>
      {s && <div className="text-[11.5px] text-ach-navy/55 mt-1">{s}</div>}
    </div>
  );
}
