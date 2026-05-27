import { createClient } from '@/lib/supabase/server';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { GraduationCap } from 'lucide-react';

const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  housing:    'Housing',
  education:  'Education & skills',
  health:     'Health & wellbeing',
  belonging:  'Belonging & identity',
  social:     'Social participation',
  rights:     'Rights & citizenship',
};

export default async function PartnerCapabilityPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);
  if (!partner) return null;

  const supabase = createClient();

  // Find candidates sponsored by this partner and their HIM scores.
  const { data: sponsoredRows } = await supabase
    .from('cohort_candidates')
    .select(`
      candidate_id,
      candidates(
        candidate_ref,
        assessments(id, timepoint, status, project_id, projects(id, project_ref, name))
      )
    `)
    .eq('sponsoring_partner_id', partner.id);

  const candidates = ((sponsoredRows as any[]) ?? [])
    .map(r => r.candidates)
    .filter(Boolean);
  const candidateCount = candidates.length;

  // Count baseline + exit assessments across sponsored candidates
  const allAssessments = candidates.flatMap(c => c.assessments ?? []);
  const baselines = allAssessments.filter((a: any) => a.timepoint === 'baseline');
  const exits = allAssessments.filter((a: any) => a.timepoint === 'exit_6mo' || a.timepoint === 'followup_12mo');
  const matched = baselines.filter((b: any) =>
    exits.some((e: any) => b.project_id === e.project_id)
  ).length;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Capability uplift"
        title="Capability uplift for sponsored candidates"
        description="HIM scoring on the candidates your sponsorship enables. Capability scores combine evidence across 7 domains using the methodology agreed with academic partners."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Kpi label="Candidates sponsored" value={String(candidateCount)} />
        <Kpi label="Baseline assessments" value={String(baselines.length)} sub="captured" />
        <Kpi label="Matched pairs" value={String(matched)} sub="baseline + exit" />
      </div>

      {candidateCount === 0 ? (
        <Card>
          <EmptyState
            icon={<GraduationCap className="h-10 w-10" />}
            title="No sponsored candidates yet"
            description="HIM capability scores will appear here once you sponsor candidates and assessments are completed."
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Assessment progress per candidate</div>
            {candidates.length === 0 ? (
              <p className="text-[13px] text-ach-navy/60">No candidate records returned.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b-[0.5px] border-ach-border">
                    <Th>Reference</Th>
                    <Th>Project</Th>
                    <Th>Baseline</Th>
                    <Th>3-month</Th>
                    <Th>6-month exit</Th>
                    <Th>12-month follow-up</Th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.slice(0, 30).map((c: any) => {
                    const assess = c.assessments ?? [];
                    const baseline = assess.find((a: any) => a.timepoint === 'baseline');
                    const mid = assess.find((a: any) => a.timepoint === 'mid_3mo');
                    const exit = assess.find((a: any) => a.timepoint === 'exit_6mo');
                    const followup = assess.find((a: any) => a.timepoint === 'followup_12mo');
                    const project = baseline?.projects ?? mid?.projects ?? exit?.projects ?? followup?.projects;
                    return (
                      <tr key={c.candidate_ref} className="border-b-[0.5px] border-ach-border last:border-0">
                        <Td className="text-ach-navy font-medium">{c.candidate_ref}</Td>
                        <Td className="text-ach-navy/70">{project?.project_ref ?? '—'}</Td>
                        <Td>{baseline ? <DotComplete /> : <DotEmpty />}</Td>
                        <Td>{mid ? <DotComplete /> : <DotEmpty />}</Td>
                        <Td>{exit ? <DotComplete /> : <DotEmpty />}</Td>
                        <Td>{followup ? <DotComplete /> : <DotEmpty />}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-5">
        <CardContent className="pt-6 text-[13px] text-ach-navy/80 max-w-prose">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">What HIM measures</div>
          <p className="mb-3">
            The Holistic Impact Metric scores capability across 7 domains: {Object.values(DOMAIN_LABELS).join(', ')}. Each project picks which domains are Core (the focus of the intervention) and which are Optional (broader outcomes the project also touches).
          </p>
          <p>
            Your sponsorship contribution is reported alongside ACH&apos;s aggregate HIM uplift for the candidates you fund — useful for ESG reporting, board updates, and demonstrating the depth of social value behind your CSR commitment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DotComplete() {
  return <span className="inline-block w-2 h-2 rounded-full bg-ach-navy" />;
}
function DotEmpty() {
  return <span className="inline-block w-2 h-2 rounded-full border-[0.5px] border-ach-navy/30" />;
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
  return <th className={`text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2 ${className}`}>{children}</td>;
}
