import { BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { formatGbpDetailed, formatDate } from '@/lib/utils/format';

const METHOD_LABELS: Record<string, string> = {
  ach_local: 'ACH local',
  hact: 'HACT',
  toms: 'TOMs',
};

export default async function EquivalencePage() {
  const supabase = createClient();
  const [valuesRes, appsRes] = await Promise.all([
    supabase
      .from('equivalence_values')
      .select('*')
      .order('methodology')
      .order('outcome_label'),
    supabase
      .from('equivalence_applications')
      .select('id, applied_to_kind, units, resulting_value, applied_at, equivalence_values(outcome_label, methodology)')
      .order('applied_at', { ascending: false })
      .limit(10),
  ]);

  const values = (valuesRes.data as any[]) ?? [];
  const apps = (appsRes.data as any[]) ?? [];

  const grouped = values.reduce<Record<string, any[]>>((acc, v) => {
    (acc[v.methodology] ||= []).push(v);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Operations"
        title="Equivalence library"
        description="V2 spec §11.4 — locally-derived social value equivalences with full citation. Used by Career Progression Reports, Evidence Packs, and Tender Support Packs."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Stat label="Active values" value={String(values.filter(v => v.is_active).length)} subline={`across ${Object.keys(grouped).length} methodologies`} />
        <Stat label="Applications (recent)" value={String(apps.length)} subline="audit trail entries" />
        <Stat label="Default methodology" value="ACH local" subline="conservative lower bounds" />
      </div>

      {values.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="h-10 w-10" />}
            title="No equivalence values"
            description="Seed the library to enable social-value calculations."
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([method, rows]) => (
            <Card key={method}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{METHOD_LABELS[method] ?? method}</div>
                    <div className="text-[15px] font-medium text-ach-navy mt-0.5">
                      {method === 'ach_local' ? 'Locally-derived (public sources)' : method === 'hact' ? 'HACT social value' : 'TOMs framework'}
                    </div>
                  </div>
                  <Badge>{rows.length} values</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b-[0.5px] border-ach-border">
                      <Th>Outcome</Th>
                      <Th>Code</Th>
                      <Th className="text-right">Value (£)</Th>
                      <Th>Source</Th>
                      <Th className="text-right">Year</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(v => (
                      <tr key={v.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/30 transition-colors">
                        <Td>
                          <div className="text-ach-navy font-medium">{v.outcome_label}</div>
                          {v.source_notes && <div className="text-[11px] text-ach-navy/55 mt-0.5">{v.source_notes}</div>}
                        </Td>
                        <Td className="text-[11px] text-ach-navy/60 font-mono">{v.outcome_code}</Td>
                        <Td className="text-right tabular-nums font-medium text-ach-navy">{formatGbpDetailed(v.value_per_unit)}</Td>
                        <Td>
                          <div className="text-[12px] text-ach-navy/80">{v.source_name}</div>
                          {v.source_url && <a href={v.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-ach-navy/60 underline">link →</a>}
                        </Td>
                        <Td className="text-right text-ach-navy/70 tabular-nums">{v.source_year ?? '—'}</Td>
                        <Td><Badge variant={v.is_active ? 'active' : 'closed'}>{v.is_active ? 'active' : 'retired'}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}

          {apps.length > 0 && (
            <Card>
              <CardHeader>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Recent applications</div>
                <div className="text-[12px] text-ach-navy/60 mt-1">Each application is an audit-trail entry — equivalences used in a specific report or pack.</div>
              </CardHeader>
              <CardContent className="pt-0">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b-[0.5px] border-ach-border">
                      <Th>Outcome</Th>
                      <Th>Applied to</Th>
                      <Th className="text-right">Units</Th>
                      <Th className="text-right">Resulting value</Th>
                      <Th>When</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map(a => (
                      <tr key={a.id} className="border-b-[0.5px] border-ach-border last:border-0">
                        <Td>
                          <div className="text-ach-navy">{a.equivalence_values?.outcome_label ?? '—'}</div>
                          <div className="text-[11px] text-ach-navy/55">{METHOD_LABELS[a.equivalence_values?.methodology] ?? ''}</div>
                        </Td>
                        <Td className="text-ach-navy/80">{a.applied_to_kind.replace('_', ' ')}</Td>
                        <Td className="text-right tabular-nums text-ach-navy/80">{Number(a.units).toLocaleString('en-GB')}</Td>
                        <Td className="text-right tabular-nums text-ach-navy">{formatGbpDetailed(a.resulting_value)}</Td>
                        <Td className="text-ach-navy/70">{formatDate(a.applied_at)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
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
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2 ${className}`}>{children}</td>;
}
