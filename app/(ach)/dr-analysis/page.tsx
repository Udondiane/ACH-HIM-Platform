import { BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { discrimination } from '@/lib/scoring/discrimination';

const TYPE_LABELS: Record<string, string> = {
  depth: 'Depth',
  hybrid: 'Hybrid',
  breadth: 'Breadth',
};

export default async function DiscriminationRatioPage() {
  const supabase = createClient();
  // Pull all completed assessments with their project type. The assessment's
  // him_score is captured at completion; for the gating-honest pre-data case
  // we group by project type and run the DR check.
  const { data: assessments } = await supabase
    .from('assessments')
    .select('id, him_score, projects(type)')
    .eq('status', 'completed');

  const rows = (assessments as any[]) ?? [];
  const groups: Record<string, number[]> = { depth: [], hybrid: [], breadth: [] };
  for (const a of rows) {
    const type = a.projects?.type;
    const score = Number(a.him_score);
    if (!type || !Number.isFinite(score)) continue;
    if (groups[type] !== undefined) groups[type].push(score);
  }

  const result = discrimination({ groups });

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        miniLabel="Method · V2"
        title="Discrimination Ratio analysis"
        description="Spec §6 — DR = V_between / V_within. Tests whether HIM scores discriminate between project types (depth / hybrid / breadth). Gated at n ≥ 10 per type to avoid spurious results."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Stat label="Depth (n)" value={String(groups.depth.length)} subline={groups.depth.length >= 10 ? 'ready' : `need ${10 - groups.depth.length} more`} />
        <Stat label="Hybrid (n)" value={String(groups.hybrid.length)} subline={groups.hybrid.length >= 10 ? 'ready' : `need ${10 - groups.hybrid.length} more`} />
        <Stat label="Breadth (n)" value={String(groups.breadth.length)} subline={groups.breadth.length >= 10 ? 'ready' : `need ${10 - groups.breadth.length} more`} />
      </div>

      {result.status === 'insufficient_data' ? (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Insufficient data</div>
            <p className="text-[13px] text-ach-navy/80">
              {result.reason} The discrimination ratio is gated at n ≥ 10 per project type per V2 §6 to avoid reporting unstable values on small samples.
            </p>
            <p className="text-[12px] text-ach-navy/60">
              Once each project type has at least 10 completed assessments, this page computes V_between / V_within and surfaces the verdict (good / moderate / poor).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Result</div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">DR</div>
                  <div className="text-[36px] font-medium tracking-[-1px] text-ach-navy mt-1 tabular-nums leading-none">
                    {Number.isFinite(result.dr) ? result.dr.toFixed(2) : '∞'}
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Verdict</div>
                  <div className="mt-2">
                    <Badge variant={result.verdict === 'good' ? 'active' : result.verdict === 'moderate' ? 'paused' : 'closed'}>
                      {result.verdict}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-ach-navy/55 mt-2">DR &gt; 2 good · 1–2 moderate · &lt; 1 poor</div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">V_between</div>
                  <div className="text-[18px] font-medium text-ach-navy mt-1 tabular-nums">{result.vBetween.toFixed(4)}</div>
                  <div className="text-[11px] text-ach-navy/55 mt-1">variance of group means</div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">V_within</div>
                  <div className="text-[18px] font-medium text-ach-navy mt-1 tabular-nums">{result.vWithin.toFixed(4)}</div>
                  <div className="text-[11px] text-ach-navy/55 mt-1">mean within-group variance</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Group means</div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {Object.entries(result.groupMeans).map(([type, m]) => (
                  <div key={type} className="flex items-center gap-3">
                    <div className="w-20 text-[12px] text-ach-navy">{TYPE_LABELS[type] ?? type}</div>
                    <div className="flex-1 h-2 bg-ach-page rounded-full overflow-hidden border-[0.5px] border-ach-border">
                      <div className="h-full bg-ach-navy" style={{ width: `${m * 100}%` }} />
                    </div>
                    <div className="text-[12px] tabular-nums text-ach-navy/80 w-16 text-right">{m.toFixed(3)}</div>
                    <div className="text-[11px] tabular-nums text-ach-navy/55 w-12 text-right">n={result.perTypeN[type]}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
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
