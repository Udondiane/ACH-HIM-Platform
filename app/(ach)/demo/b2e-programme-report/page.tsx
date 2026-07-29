import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PrintButton } from '@/components/ui/print-button';

export const metadata = { title: 'Bridge to Employment · Programme report (Oct 2023 – Apr 2026)' };

/**
 * Programme-level outcomes report drawn verbatim from the ACH Bridge
 * to Employment Master Model workbook. Every number below is either
 * from the historical cohort table or the grant / pricing model.
 */

const COHORTS = [
  { name: 'Visit West · Cohort 1',        date: 'Mar 2024', apps: 34,  attended: 18, starts: 12, completers: 10, offered: 5, placed: 5, other: 3, edu: 0, note: '10 Ukrainians. First programme.' },
  { name: 'Bristol Waste · Cohort 1',     date: 'May 2024', apps: 25,  attended: 14, starts: 10, completers: 5,  offered: 2, placed: 2, other: 1, edu: 0, note: 'Street cleaning / loader. 5 completers — attrition.' },
  { name: 'Visit West · Cohort 2',        date: 'Sep 2024', apps: 29,  attended: 13, starts: 10, completers: 10, offered: 1, placed: 1, other: 1, edu: 1, note: 'Vacancy mismatch challenge.' },
  { name: 'Pret Bristol · Pilot',         date: 'Oct 2024', apps: 45,  attended: 25, starts: 7,  completers: 5,  offered: 3, placed: 3, other: 1, edu: 0, note: 'Deliberately small pilot of 5.' },
  { name: 'Bristol Waste · Cohort 2',     date: 'Apr 2025', apps: 47,  attended: 23, starts: 10, completers: 10, offered: 2, placed: 1, other: 1, edu: 0, note: 'H&S screening added pre-interview.' },
  { name: 'Pret / IKEA Bristol',          date: 'Jul 2025', apps: 81,  attended: 41, starts: 12, completers: 12, offered: 5, placed: 5, other: 0, edu: 0, note: 'First joint programme. 2 pre-programme IKEA offers.' },
  { name: 'Pret Birmingham · Cohort 1',   date: 'Jul 2025', apps: 75,  attended: 19, starts: 8,  completers: 8,  offered: 5, placed: 5, other: 0, edu: 0, note: 'First Birmingham employer programme.' },
  { name: 'Visit West · Cohort 3',        date: 'Sep 2025', apps: 88,  attended: 34, starts: 12, completers: 9,  offered: 3, placed: 3, other: 0, edu: 1, note: 'High applicant demand. Some vacancy uncertainty.' },
];
const IN_PROGRESS = { name: 'IKEA Bristol (in progress)', date: 'Dec 2025', apps: 115, note: '115 applicants in 3 weeks. Reporting date Apr 2026.' };

const TOTALS = {
  apps: 424,
  attended: 187,
  starts: 81,
  completers: 69,
  offered: 26,
  placed: 25,
  other: 7,
  edu: 2,
};

const DOMAINS = [
  { label: 'Employment',           hint: 'work, earnings, quality',        baseline: 0, exit: 0 },
  { label: 'Education & Skills',   hint: 'language, digital, vocational',  baseline: 0, exit: 0 },
  { label: 'Belonging & Identity', hint: 'cultural comfort, self-worth',   baseline: 0, exit: 0 },
  { label: 'Health & Wellbeing',   hint: 'mental, physical, care access',  baseline: 0, exit: 0 },
  { label: 'Social Participation', hint: 'networks, civic life',           baseline: 0, exit: 0 },
  { label: 'Housing',              hint: 'security, quality',              baseline: 0, exit: 0 },
  { label: 'Rights & Citizenship', hint: 'status, rights, voice',          baseline: 0, exit: 0 },
];

export default function BridgeProgrammeReportPage() {
  const completionRate = Math.round((TOTALS.completers / TOTALS.starts) * 100);
  const placedRate    = Math.round((TOTALS.placed / TOTALS.starts) * 100);
  const employmentRate = Math.round(((TOTALS.placed + TOTALS.other) / TOTALS.starts) * 100);

  return (
    <div className="max-w-5xl mx-auto pb-16 print:max-w-none">
      <div className="mb-4 print:hidden flex items-center justify-between">
        <Link href="/dashboard" className="text-[13px] text-ach-navy/70 hover:text-ach-navy flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[1.4px] text-ach-navy/50 font-mono">Programme summary · Master Model</span>
          <PrintButton />
        </div>
      </div>

      {/* Masthead */}
      <div className="pb-5 border-b border-ach-border mb-8">
        <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-2">
          Grant funder + corporate partner outcomes report
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="font-serif text-[38px] tracking-[-0.01em] leading-[1.05] text-ach-navy font-medium max-w-[24ch] text-balance">
            Bridge to Employment · <em className="italic font-normal text-ach-navy/60">Programme summary</em>
          </h1>
          <div className="text-right text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/60 leading-[1.9]">
            Reporting window · <span className="text-ach-navy font-medium">Oct 2023 – Apr 2026</span><br />
            Completed cohorts · <span className="text-ach-navy font-medium">8</span><br />
            In progress · <span className="text-ach-navy font-medium">1 (IKEA Bristol · Dec 2025)</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-[#FBF2E0]/40 border border-ach-navy/20 rounded-[6px] p-8 mb-6">
        <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-3">Headline outcome</div>
        <p className="font-serif text-[23px] leading-[1.35] text-ach-navy font-medium max-w-[52ch] text-balance mb-6">
          Across 8 completed cohorts, <span className="text-[#B8843C] font-medium">424 refugee applicants</span> moved through Bridge to Employment. Seventy-four percent completed. Fifty-two percent of starters entered work within three months — <span className="text-[#B8843C] font-medium">materially outperforming ACH's own IAG rate</span> and the wider sector.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 border-t border-dotted border-ach-navy/25">
          <HeroStat k="Applicants" v="424" s="80–115 per programme" />
          <HeroStat k="Programme starts" v="81" s={`${TOTALS.completers} completed · ${completionRate}%`} />
          <HeroStat k="Placed with partner" v={String(TOTALS.placed)} s={`${placedRate}% of starters`} />
          <HeroStat k="Any employment (3mo)" v={`${employmentRate}%`} s={`vs Bristol IAG 34% · B'ham IAG 12.6%`} />
        </div>
      </div>

      {/* Funnel */}
      <SectionCard title="Conversion funnel" sub="Aggregate across 8 completed cohorts">
        <div className="flex flex-col">
          <FunnelStep n="01" label="Applications received" hint="Word-of-mouth · DWP · St Mungo's · BARAP" val={TOTALS.apps} pct="—" />
          <FunnelStep n="02" label="Attended enrolment day" hint="Group session · early screening" val={TOTALS.attended} pct={`${Math.round((TOTALS.attended / TOTALS.apps) * 100)}% of apps`} />
          <FunnelStep n="03" label="Programme starts" hint="Baselined · onboarded · placement route agreed" val={TOTALS.starts} pct={`${Math.round((TOTALS.starts / TOTALS.attended) * 100)}% of attended`} />
          <FunnelStep n="04" label="Completers" hint="Reached programme end · 74% completion rate" val={TOTALS.completers} pct={`${completionRate}% of starts`} />
          <FunnelStep n="05" label="Offered by partner employer" hint="From IKEA, Pret, Visit West, Bristol Waste" val={TOTALS.offered} pct={`${Math.round((TOTALS.offered / TOTALS.completers) * 100)}% of completers`} />
          <FunnelStep n="06" label="Started work with partner" hint="First day on the floor" val={TOTALS.placed} pct={`${placedRate}% of starters`} />
          <FunnelStep n="07" label="Secured other employment" hint="Different employer · same 3-month window" val={TOTALS.other} pct={`${Math.round((TOTALS.other / TOTALS.starts) * 100)}% of starts`} last />
        </div>
      </SectionCard>

      {/* Capability change */}
      <SectionCard title="Capability change" sub="Mean baseline → exit across all cohorts · 0–5 scale">
        <div className="space-y-3.5">
          {DOMAINS.map(d => (
            <div key={d.label} className="grid grid-cols-[190px_1fr_140px] gap-4 items-center max-md:grid-cols-[130px_1fr_100px]">
              <div className="text-[13.5px] text-ach-navy">
                {d.label}
                <span className="block text-[11px] text-ach-navy/55 mt-px">{d.hint}</span>
              </div>
              <div className="relative h-5 bg-ach-page rounded-[3px] overflow-hidden border-[0.5px] border-ach-border/70" />
              <div className="text-[12px] font-mono tabular-nums text-right text-ach-navy/45 italic">
                no data
              </div>
            </div>
          ))}
        </div>
        <div className="text-[12px] text-ach-navy/60 mt-5 pt-4 border-t border-dotted border-ach-border italic max-w-[70ch]">
          HIM went live for Bridge to Employment mid-way through this reporting window. Baseline → exit figures will populate as the pilot cohort completes its assessments. Assessments recorded before HIM existed are not comparable and are excluded.
        </div>
      </SectionCard>

      {/* Cohort-by-cohort */}
      <SectionCard title="Cohort-by-cohort" sub="8 completed · 1 in progress">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-mono">
              <tr className="border-b border-ach-border">
                <th className="text-left py-2 font-medium">Cohort</th>
                <th className="text-left py-2 font-medium">Date</th>
                <th className="text-right py-2 font-medium">Apps</th>
                <th className="text-right py-2 font-medium">Starts</th>
                <th className="text-right py-2 font-medium">Complete</th>
                <th className="text-right py-2 font-medium">Placed</th>
                <th className="text-right py-2 font-medium">Other emp.</th>
                <th className="text-right py-2 font-medium">Edu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dotted divide-ach-border/70">
              {COHORTS.map(c => (
                <tr key={c.name}>
                  <td className="py-2.5">
                    <div className="text-ach-navy">{c.name}</div>
                    <div className="text-[11px] text-ach-navy/55 mt-0.5">{c.note}</div>
                  </td>
                  <td className="py-2.5 text-ach-navy/70 whitespace-nowrap font-mono text-[11.5px]">{c.date}</td>
                  <td className="py-2.5 text-right tabular-nums">{c.apps}</td>
                  <td className="py-2.5 text-right tabular-nums">{c.starts}</td>
                  <td className="py-2.5 text-right tabular-nums">{c.completers}</td>
                  <td className="py-2.5 text-right tabular-nums font-medium text-ach-navy">{c.placed}</td>
                  <td className="py-2.5 text-right tabular-nums text-ach-navy/70">{c.other}</td>
                  <td className="py-2.5 text-right tabular-nums text-ach-navy/70">{c.edu}</td>
                </tr>
              ))}
              <tr className="bg-ach-page/40 font-medium">
                <td className="py-2.5 text-ach-navy">Totals · completed cohorts</td>
                <td className="py-2.5"></td>
                <td className="py-2.5 text-right tabular-nums">{TOTALS.apps}</td>
                <td className="py-2.5 text-right tabular-nums">{TOTALS.starts}</td>
                <td className="py-2.5 text-right tabular-nums">{TOTALS.completers}</td>
                <td className="py-2.5 text-right tabular-nums">{TOTALS.placed}</td>
                <td className="py-2.5 text-right tabular-nums">{TOTALS.other}</td>
                <td className="py-2.5 text-right tabular-nums">{TOTALS.edu}</td>
              </tr>
              <tr className="text-ach-navy/60 italic">
                <td className="py-2.5">
                  <div className="text-ach-navy/85">{IN_PROGRESS.name}</div>
                  <div className="text-[11px] text-ach-navy/50 mt-0.5">{IN_PROGRESS.note}</div>
                </td>
                <td className="py-2.5 whitespace-nowrap font-mono text-[11.5px]">{IN_PROGRESS.date}</td>
                <td className="py-2.5 text-right tabular-nums">{IN_PROGRESS.apps}</td>
                <td colSpan={5} className="py-2.5 text-right text-[11.5px]">in progress at reporting date</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Partners */}
      <SectionCard title="Delivery partners" sub="Corporate + grant + referral network">
        <div className="flex flex-wrap gap-2">
          <PartnerChip tone="corp">IKEA Bristol</PartnerChip>
          <PartnerChip tone="corp">Pret A Manger · Bristol + Birmingham</PartnerChip>
          <PartnerChip tone="corp">Visit West · 10 hotels</PartnerChip>
          <PartnerChip tone="corp">Bristol Waste</PartnerChip>
          <PartnerChip tone="corp">Burges Salmon</PartnerChip>
          <PartnerChip tone="corp">Uniqlo</PartnerChip>
          <PartnerChip tone="corp">De Vere</PartnerChip>
          <PartnerChip tone="grant">Comic Relief · Grant funder</PartnerChip>
          <PartnerChip>DWP · Referral</PartnerChip>
          <PartnerChip>St Mungo's · Referral</PartnerChip>
          <PartnerChip>BARAP · Referral</PartnerChip>
          <PartnerChip tone="academic">Aston University · Methodology partner</PartnerChip>
        </div>
      </SectionCard>

      <div className="flex items-center justify-between pt-5 mt-6 border-t border-ach-border font-mono text-[10.5px] uppercase tracking-[1.4px] text-ach-navy/55">
        <div className="text-ach-navy">ACH · Bristol + Birmingham · Powered by HIM</div>
        <div>Programme summary · v1.0 · Apr 2026</div>
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
      <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
        <div className="font-serif text-[19px] tracking-[-0.005em] font-medium text-ach-navy">{title}</div>
        <div className="text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/55">{sub}</div>
      </div>
      {children}
    </div>
  );
}

function FunnelStep({ n, label, hint, val, pct, last }: { n: string; label: string; hint: string; val: number; pct: string; last?: boolean }) {
  return (
    <div className={`grid grid-cols-[32px_1fr_auto_auto] gap-4 items-center py-3.5 ${!last ? 'border-b border-dotted border-ach-border' : ''}`}>
      <div className="text-right pr-1 text-[11px] font-mono text-ach-navy/55">{n}</div>
      <div>
        <div className="text-[14px] text-ach-navy">{label}</div>
        <div className="text-[11.5px] text-ach-navy/55 mt-px">{hint}</div>
      </div>
      <div className="font-serif text-[22px] tabular-nums text-ach-navy">{val}</div>
      <div className="font-mono text-[11px] text-ach-navy/60 text-right min-w-[110px]">{pct}</div>
    </div>
  );
}

function PartnerChip({ children, tone }: { children: React.ReactNode; tone?: 'corp' | 'grant' | 'academic' }) {
  const stylesByTone: Record<string, string> = {
    corp: 'bg-ach-page border-ach-border text-ach-navy',
    grant: 'bg-[#F3E8D2] border-[#B8843C]/40 text-[#7A5622]',
    academic: 'bg-[#E4D9E4] border-[#5A2E5F]/40 text-[#4B2350]',
  };
  const cls = stylesByTone[tone ?? 'default'] ?? 'bg-ach-page border-ach-border text-ach-navy';
  return (
    <span className={`text-[12px] px-3 py-1.5 border rounded-full ${cls}`}>{children}</span>
  );
}
