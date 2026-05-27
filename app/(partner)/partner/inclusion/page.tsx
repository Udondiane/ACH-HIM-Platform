import { createClient } from '@/lib/supabase/server';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { GraduationCap } from 'lucide-react';

const DIMENSION_LABELS: Array<{ key: string; label: string; short: string }> = [
  { key: 's_economic_security',    label: 'Economic security',         short: 'Econ.' },
  { key: 's_skill_use_growth',     label: 'Skill use & growth',        short: 'Skills' },
  { key: 's_workplace_dignity',    label: 'Workplace dignity',         short: 'Dignity' },
  { key: 's_voice_agency',         label: 'Voice & agency',            short: 'Voice' },
  { key: 's_social_belonging',     label: 'Social belonging',          short: 'Belonging' },
  { key: 's_wellbeing_confidence', label: 'Wellbeing & confidence',    short: 'Wellbeing' },
];

export default async function PartnerInclusionPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);
  if (!partner) return null;

  const supabase = createClient();
  const { data: assessments } = await supabase
    .from('inclusion_assessments')
    .select('*')
    .eq('partner_id', partner.id)
    .order('assessed_on', { ascending: false });

  const rows = (assessments as any[]) ?? [];
  const latest = rows[0];

  // Average score across all dimensions, latest assessment
  const dimScores = latest
    ? DIMENSION_LABELS.map(d => Number(latest[d.key] ?? 0)).filter(v => v > 0)
    : [];
  const overall = dimScores.length > 0
    ? (dimScores.reduce((s, v) => s + v, 0) / dimScores.length).toFixed(2)
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Inclusion assessment"
        title="Inclusion environment assessment"
        description="A periodic survey across six dimensions of workplace inclusion. Trends year-over-year demonstrate practice change to ACH and your stakeholders."
      />

      {!latest ? (
        <Card>
          <EmptyState
            icon={<GraduationCap className="h-10 w-10" />}
            title="No assessment yet"
            description="Once you complete your first inclusion assessment, scores across the 6 dimensions will appear here."
          />
        </Card>
      ) : (
        <>
          <Card className="mb-5">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Latest assessment</div>
                  <div className="text-[20px] font-medium text-ach-navy mt-1">{latest.period_label}</div>
                  <div className="text-[12px] text-ach-navy/60 mt-0.5">
                    {new Date(latest.assessed_on).toLocaleDateString('en-GB')}
                    {latest.respondent_count ? ` · ${latest.respondent_count} respondents` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Overall</div>
                  <div className="text-[32px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-1 tabular-nums">
                    {overall ?? '—'}<span className="text-[16px] text-ach-navy/55"> /5</span>
                  </div>
                  <Badge>{latest.status}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DIMENSION_LABELS.map(d => {
                  const v = latest[d.key];
                  return (
                    <div key={d.key} className="p-3 rounded-[10px] border-[0.5px] border-ach-border">
                      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{d.label}</div>
                      <div className="flex items-baseline gap-2 mt-1.5">
                        <div className="text-[20px] font-medium text-ach-navy leading-none tabular-nums">
                          {v ? Number(v).toFixed(2) : '—'}
                        </div>
                        <div className="text-[11px] text-ach-navy/55">/5</div>
                      </div>
                      <ScoreBar value={Number(v ?? 0)} />
                    </div>
                  );
                })}
              </div>

              {latest.notes && (
                <div className="mt-5 pt-5 border-t-[0.5px] border-ach-border">
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">Reflections</div>
                  <p className="text-[13px] text-ach-navy/80 whitespace-pre-wrap">{latest.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {rows.length > 1 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Historical assessments</div>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b-[0.5px] border-ach-border">
                      <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Period</th>
                      {DIMENSION_LABELS.map(d => (
                        <th key={d.key} className="text-right py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">{d.short}</th>
                      ))}
                      <th className="text-right py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const scores = DIMENSION_LABELS.map(d => Number(r[d.key] ?? 0)).filter(v => v > 0);
                      const avg = scores.length > 0 ? (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2) : '—';
                      return (
                        <tr key={r.id} className="border-b-[0.5px] border-ach-border last:border-0">
                          <td className="py-2 text-ach-navy font-medium">{r.period_label}</td>
                          {DIMENSION_LABELS.map(d => (
                            <td key={d.key} className="py-2 text-right tabular-nums text-ach-navy/70">{r[d.key] ? Number(r[d.key]).toFixed(1) : '—'}</td>
                          ))}
                          <td className="py-2 text-right tabular-nums font-medium">{avg}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div className="mt-2 h-1 bg-ach-page rounded-full overflow-hidden">
      <div className="h-full bg-ach-navy" style={{ width: `${pct}%` }} />
    </div>
  );
}
