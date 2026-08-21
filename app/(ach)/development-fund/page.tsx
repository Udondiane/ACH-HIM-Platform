import Link from 'next/link';
import { PoundSterling, Sparkles, ArrowRight, Info } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const metadata = { title: 'Development fund · Coming soon' };

/**
 * The Development Fund module is deferred to a future release. The
 * intended model is different from what the earlier prototype captured:
 * a fund that grows from partner retention fees and re-invests a
 * defined share back into beneficiary training. Shelved rather than
 * deleted — the underlying tables (development_fund_balances,
 * training_requests, training_catalogue) stay in the DB so no data
 * that already exists is lost, and the full page can be re-enabled
 * once the funding rules are settled.
 */
export default function DevelopmentFundComingSoonPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        miniLabel="Operations"
        title="Development fund"
        description="Coming in a future release. Design still being finalised with ACH's finance and workforce leads."
      />

      <Card className="mb-5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#B8843C]" />
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">
              Upcoming feature · Not yet available in this build
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-[10px] border-[0.5px] border-ach-border bg-ach-page/40 p-4">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 mt-0.5 text-ach-navy/60 shrink-0" />
              <div className="text-[13px] text-ach-navy/80 space-y-2 flex-1">
                <p>
                  This surface is <strong>parked</strong> until the funding rules are finalised.
                  The earlier prototype modelled a one-way discretionary grant pool, but ACH&apos;s
                  actual model is a <strong>retention-fee funded loop</strong> — the details still
                  need signing off with finance and the workforce partner team.
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">
              How the fund will work
            </div>
            <ol className="space-y-3 text-[13px] text-ach-navy/85">
              <li className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-ach-navy/10 text-ach-navy text-[11px] font-mono flex items-center justify-center">1</span>
                <div>
                  <strong>Retention-linked charge to the employer.</strong> Once a beneficiary is
                  placed with a partner and retained past an agreed milestone (typically 6 months),
                  a percentage of their annual salary is invoiced to the employer as a
                  retention-based success fee.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-ach-navy/10 text-ach-navy text-[11px] font-mono flex items-center justify-center">2</span>
                <div>
                  <strong>Split into two pools.</strong> A defined share of every retention-fee
                  payment flows into the Development Fund; the remainder covers ACH&apos;s delivery
                  cost recovery.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-ach-navy/10 text-ach-navy text-[11px] font-mono flex items-center justify-center">3</span>
                <div>
                  <strong>Re-invested back into beneficiary training.</strong> The fund
                  underwrites accredited qualifications, sector certifications, language and
                  digital skills, pre-degree access — anything that raises the earning ceiling
                  of a placed beneficiary or unlocks progression for someone still enrolled.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-ach-navy/10 text-ach-navy text-[11px] font-mono flex items-center justify-center">4</span>
                <div>
                  <strong>Transparent per-candidate ledger.</strong> Every beneficiary can see
                  what their placement retention has credited to the pool and what they&apos;ve
                  drawn against it — accountability in both directions.
                </div>
              </li>
            </ol>
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">
              What we&apos;re waiting on
            </div>
            <ul className="text-[13px] text-ach-navy/80 space-y-1.5 list-disc pl-5">
              <li>ACH finance sign-off on the retention-fee percentage and the split ratio into the fund.</li>
              <li>Workforce partner team confirmation that new commercial contracts include the retention-fee clause.</li>
              <li>Governance for approvals — who signs off on individual training grants, and against what criteria.</li>
              <li>Match-funding rules — whether a partner can top up the fund for their own placements.</li>
            </ul>
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">
              What&apos;s already built and paused
            </div>
            <ul className="text-[13px] text-ach-navy/80 space-y-1.5 list-disc pl-5">
              <li><strong>Training catalogue</strong> — accredited courses (L2–L5), sector certifications, language qualifications, soft-skills progressions, pre-degree access, categorised.</li>
              <li><strong>Training request workflow</strong> — beneficiary submits, ACH reviews, approve/decline, enrol, complete or withdraw.</li>
              <li><strong>Balance ledger</strong> — per-beneficiary running total of credited / spent / match-funded amounts.</li>
              <li><strong>Database tables preserved</strong> — <code className="text-[11.5px] bg-ach-page px-1.5 py-0.5 rounded">development_fund_balances</code>, <code className="text-[11.5px] bg-ach-page px-1.5 py-0.5 rounded">training_requests</code>, <code className="text-[11.5px] bg-ach-page px-1.5 py-0.5 rounded">training_catalogue</code>. Nothing already captured has been dropped.</li>
            </ul>
          </div>

          <div className="pt-3 border-t-[0.5px] border-ach-border text-[12px] text-ach-navy/60">
            Until this ships, the same training programmes ACH already delivers (
            <Link href="/training" className="text-ach-navy underline underline-offset-2">Delivery → Training</Link>
            ) remain the primary training pathway. Individual training grants outside those
            programmes should continue to be logged in ACH&apos;s existing finance system.
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-[13px] text-ach-navy/70 hover:text-ach-navy underline underline-offset-2">
          Back to dashboard <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
