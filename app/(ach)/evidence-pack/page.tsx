import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils/format';

const STATUS_VARIANTS: Record<string, 'default' | 'active' | 'paused' | 'closed' | 'prospect'> = {
  draft: 'prospect',
  finalised: 'active',
  exported_word: 'active',
  exported_pdf: 'active',
  archived: 'closed',
};

export default async function EvidencePackPage() {
  const supabase = createClient();
  const { data: packs } = await supabase
    .from('evidence_packs')
    .select('id, title, funder, funding_window, status, methodology_version, created_at, anonymisation_level, evidence_pack_sections(included)')
    .order('created_at', { ascending: false });

  const rows = (packs as any[]) ?? [];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Reports"
        title="Funding & Bid Evidence Packs"
        description="Spec §18 — 14-section funder & bid pack. Each section is editable; AI drafting via Gemini available with 24-hour cache and 10/hour rate limit. Export to Word or PDF."
        actions={
          <Link href="/evidence-pack/new">
            <Button><Plus className="h-4 w-4" />New pack</Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="No evidence packs yet"
            description="Create your first pack — pull together programme overview, outcomes evidence, methodology grounding, and case studies for a specific funder."
            action={
              <Link href="/evidence-pack/new">
                <Button><Plus className="h-4 w-4" />New pack</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-ach-page border-b-[0.5px] border-ach-border">
              <tr>
                <Th>Title</Th>
                <Th>Funder</Th>
                <Th>Window</Th>
                <Th className="text-right">Sections (incl.)</Th>
                <Th>Status</Th>
                <Th>Method</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => {
                const sections = (p.evidence_pack_sections ?? []) as { included: boolean }[];
                const included = sections.filter(s => s.included).length;
                return (
                  <tr key={p.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/50 transition-colors">
                    <Td>
                      <Link href={`/evidence-pack/${p.id}`} className="text-ach-navy font-medium hover:underline">
                        {p.title}
                      </Link>
                    </Td>
                    <Td className="text-ach-navy/80">{p.funder ?? '—'}</Td>
                    <Td className="text-ach-navy/70">{p.funding_window ?? '—'}</Td>
                    <Td className="text-right tabular-nums text-ach-navy/80">{included} / {sections.length}</Td>
                    <Td><Badge variant={STATUS_VARIANTS[p.status] ?? 'default'}>{p.status.replace('_', ' ')}</Badge></Td>
                    <Td className="text-ach-navy/70 text-[11px]">{p.methodology_version}</Td>
                    <Td className="text-ach-navy/70">{formatDate(p.created_at)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-4 py-3 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
