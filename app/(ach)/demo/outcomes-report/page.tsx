import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PrintButton } from '@/components/ui/print-button';

export const metadata = { title: 'Sample impact report · IKEA Bristol Q4 2025' };

const DOMAINS = [
  { label: 'Employment',           hint: 'work, earnings, quality',        baseline: 2.2, exit: 4.0 },
  { label: 'Education & Skills',   hint: 'language, digital, vocational',  baseline: 2.4, exit: 3.8 },
  { label: 'Belonging & Identity', hint: 'cultural comfort, self-worth',   baseline: 2.6, exit: 3.9 },
  { label: 'Health & Wellbeing',   hint: 'mental, physical, care access',  baseline: 2.9, exit: 3.6 },
  { label: 'Social Participation', hint: 'networks, civic life',           baseline: 2.4, exit: 3.4 },
  { label: 'Housing',              hint: 'security, quality',              baseline: 2.8, exit: 3.2 },
  { label: 'Rights & Citizenship', hint: 'status, rights, voice',          baseline: 3.0, exit: 3.5 },
];

const OUTCOMES = [
  { num: '01', label: 'Passed English course',        hint: 'observable proficiency at work',       val: 9, pct: '75%' },
  { num: '02', label: 'Passed Customer service course', hint: 'IKEA on-the-floor prep',              val: 8, pct: '67%' },
  { num: '03', label: 'Passed Health & Safety course',  hint: 'certified pre-placement',             val: 10, pct: '83%' },
  { num: '04', label: 'Got a job offer',                hint: 'from IKEA or another employer',       val: 7, pct: '58%' },
  { num: '05', label: 'Started a job',                  hint: 'first day on the floor',              val: 5, pct: '42%' },
  { num: '06', label: 'Retained in job at 6 months',    hint: 'confirmed by employer questionnaire', val: 4, pct: '80% of placed' },
];

export default function SampleOutcomesReportPage() {
  return (
    <div className="max-w-5xl mx-auto pb-16 print:max-w-none">
      <div className="mb-4 print:hidden flex items-center justify-between">
        <Link href="/dashboard" className="text-[13px] text-ach-navy/70 hover:text-ach-navy flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[1.4px] text-ach-navy/50 font-mono">Sample · seeded data</span>
          <PrintButton />
        </div>
      </div>

      {/* Masthead */}
      <div className="pb-5 border-b border-ach-border mb-8">
        <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-2">
          Corporate partner outcomes report · Draft
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="font-serif text-[38px] tracking-[-0.01em] leading-[1.05] text-ach-navy font-medium">
            Bridge to Employment · <em className="italic font-normal text-ach-navy/60">IKEA Bristol · Q4 2025</em>
          </h1>
          <div className="text-right text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/60 leading-[1.9]">
            Programme window · <span className="text-ach-navy font-medium">Sep – Dec 2025</span><br />
            Cohort · <span className="text-ach-navy font-medium">PRJ-2025-IKEA-04</span><br />
            Prepared by · <span className="text-ach-navy font-medium">ACH · Powered by HIM</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-[#FBF2E0]/40 border border-ach-navy/20 rounded-[6px] p-8 mb-6">
        <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-3">
          Headline outcome
        </div>
        <p className="font-serif text-[24px] leading-[1.35] text-ach-navy font-medium max-w-[42ch] text-balance mb-6">
          Twelve beneficiaries baselined. Ten completed.{' '}
          <span className="text-[#B8843C] font-medium">Five started at IKEA on permanent contracts</span>, and mean HIM capability rose from Level 2 · Emerging to Level 4 · Confident.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 border-t border-dotted border-ach-navy/25">
          <HeroStat k="Beneficiaries" v="12" s="10 completed · 83%" />
          <HeroStat k="Placed in work" v="5" s="42% of starters" />
          <HeroStat k="Salary secured" v="£112k" s="£22.4k avg · into local economy" />
          <HeroStat k="Estimated social value" v="£184k" s="HACT UK Social Value Bank" />
        </div>
      </div>

      {/* HIM signature */}
      <SectionCard title="HIM impact signature" sub="Baseline → exit · 7 domains · 0–5 scale">
        <div className="space-y-3.5">
          {DOMAINS.map(d => (
            <div key={d.label} className="grid grid-cols-[190px_1fr_140px] gap-4 items-center max-md:grid-cols-[130px_1fr_100px]">
              <div className="text-[13.5px] text-ach-navy">
                {d.label}
                <span className="block text-[11px] text-ach-navy/55 mt-px">{d.hint}</span>
              </div>
              <div className="relative h-5 bg-ach-page rounded-[3px] overflow-hidden border-[0.5px] border-ach-border/70">
                <div className="absolute inset-y-0 left-0 bg-ach-navy/25" style={{ width: `${(d.baseline / 5) * 100}%` }} />
                <div className="absolute inset-y-0 left-0 bg-[#B8843C]" style={{ width: `${(d.exit / 5) * 100}%` }} />
              </div>
              <div className="text-[12px] font-mono tabular-nums text-right text-ach-navy/60">
                {d.baseline.toFixed(1)} → {d.exit.toFixed(1)}
                <strong className="text-[#1B6D6A] font-semibold ml-1.5">+{(d.exit - d.baseline).toFixed(1)}</strong>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Outcomes ladder */}
      <SectionCard title="Outcomes reached" sub="Ticked as beneficiaries hit them · Live during delivery">
        <div className="flex flex-col">
          {OUTCOMES.map((o, i) => (
            <div key={o.num} className={`grid grid-cols-[32px_1fr_auto_auto] gap-4 items-center py-3.5 ${i < OUTCOMES.length - 1 ? 'border-b border-dotted border-ach-border' : ''}`}>
              <div className="text-right pr-1 text-[11px] font-mono text-ach-navy/55">{o.num}</div>
              <div>
                <div className="text-[14px] text-ach-navy">{o.label}</div>
                <div className="text-[11.5px] text-ach-navy/55 mt-px">{o.hint}</div>
              </div>
              <div className="font-serif text-[22px] tabular-nums text-ach-navy">{o.val}</div>
              <div className="font-mono text-[11px] text-ach-navy/60 text-right min-w-[86px]">{o.pct}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Quotes */}
      <SectionCard title="In beneficiaries' words" sub="Consented · Anonymised where requested">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <blockquote className="border-l-2 border-[#B8843C] pl-4 py-1">
            <p className="font-serif italic text-[15px] leading-[1.45] text-ach-navy m-0">
              "On my first shift I was nervous. My manager said 'you sound like you belong here'. I hadn't heard that in a long time."
            </p>
            <div className="text-[11.5px] text-ach-navy/55 mt-2">— A., 42, arrived from Sudan Aug 2023. Now permanent IKEA Bristol.</div>
          </blockquote>
          <blockquote className="border-l-2 border-[#B8843C] pl-4 py-1">
            <p className="font-serif italic text-[15px] leading-[1.45] text-ach-navy m-0">
              "The classes taught me the English I needed on the floor. Not textbook English — real conversations. That's what makes a difference."
            </p>
            <div className="text-[11.5px] text-ach-navy/55 mt-2">— K., 29, arrived from Eritrea 2024. Started at IKEA October 2025.</div>
          </blockquote>
        </div>
      </SectionCard>

      {/* Narrative */}
      <SectionCard title="Programme reflections" sub="Recorded at close-out · 3 fields">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <NarrativeBlock label="What worked well">
            Paid placements plus in-work check-ins at 3 and 6 months. Trial shifts converted five beneficiaries into permanent offers. IKEA hosting the training venue removed cost and built familiarity before day one.
          </NarrativeBlock>
          <NarrativeBlock label="Challenges encountered">
            Two beneficiaries withdrew due to childcare — pre-programme childcare assessment now added. Salesforce data entry duplicated with HIM; consolidated into HIM for the next cohort.
          </NarrativeBlock>
          <NarrativeBlock label="Unexpected impact">
            Two beneficiaries mentored applicants for the next cohort. One is now an IKEA cultural-awareness co-trainer, invited by the store manager.
          </NarrativeBlock>
        </div>
      </SectionCard>

      {/* Partners */}
      <SectionCard title="Delivery partners" sub="Cohort collaborators">
        <div className="flex flex-wrap gap-2">
          <PartnerChip>IKEA Bristol · Corporate partner</PartnerChip>
          <PartnerChip>Comic Relief · Grant funder</PartnerChip>
          <PartnerChip>DWP · Referral pipeline</PartnerChip>
          <PartnerChip>St Mungo's · Referral pipeline</PartnerChip>
          <PartnerChip>Aston University · Methodology partner</PartnerChip>
        </div>
      </SectionCard>

      <div className="flex items-center justify-between pt-5 mt-6 border-t border-ach-border font-mono text-[10.5px] uppercase tracking-[1.4px] text-ach-navy/55">
        <div className="text-ach-navy">ACH · Bristol · Powered by HIM</div>
        <div>Report generated on close-out · v1.0</div>
      </div>
    </div>
  );
}

function HeroStat({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[1.6px] text-ach-navy/55 font-mono">{k}</div>
      <div className="font-serif text-[26px] tabular-nums text-ach-navy tracking-[-0.01em] leading-none mt-1.5">{v}</div>
      {s && <div className="text-[11.5px] text-ach-navy/55 mt-1">{s}</div>}
    </div>
  );
}

function SectionCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-ach-border rounded-[6px] p-6 mb-5">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div className="font-serif text-[19px] tracking-[-0.005em] font-medium text-ach-navy">{title}</div>
        <div className="text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/55">{sub}</div>
      </div>
      {children}
    </div>
  );
}

function NarrativeBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/55 mb-2">{label}</div>
      <p className="text-[13.5px] leading-[1.5] text-ach-navy/85 m-0">{children}</p>
    </div>
  );
}

function PartnerChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] px-3 py-1.5 bg-ach-page border border-ach-border rounded-full text-ach-navy">
      {children}
    </span>
  );
}
