import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionEditor } from '@/components/evidence-pack/section-editor';
import { setPackStatusAction } from '@/lib/evidence-packs/actions';
import { SECTION_GROUPS, SECTION_LABELS, type SectionKey } from '@/lib/evidence-packs/sections';
import { formatDate } from '@/lib/utils/format';

const STATUS_VARIANTS: Record<string, 'default' | 'active' | 'paused' | 'closed' | 'prospect'> = {
  draft: 'prospect',
  finalised: 'active',
  exported_word: 'active',
  exported_pdf: 'active',
  archived: 'closed',
};

export default async function EvidencePackDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pack } = await supabase
    .from('evidence_packs')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!pack) notFound();
  const p = pack as any;

  const { data: sections } = await supabase
    .from('evidence_pack_sections')
    .select('id, section_key, content, included, sort_order')
    .eq('pack_id', params.id)
    .order('sort_order');

  const rows = (sections as any[]) ?? [];
  const byKey = new Map(rows.map(s => [s.section_key, s]));

  async function setStatus(formData: FormData) {
    'use server';
    const status = String(formData.get('status') ?? '');
    if (status) await setPackStatusAction(params.id, status);
  }

  const included = rows.filter(s => s.included).length;

  return (
    <div className="max-w-6xl mx-auto">
      <Link href="/evidence-pack" className="text-[12px] text-ach-navy/60 hover:text-ach-navy inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to evidence packs
      </Link>

      <PageHeader
        miniLabel="Reports · Evidence Pack"
        title={p.title}
        description={`${p.funder ?? '—'}${p.funding_window ? ` · ${p.funding_window}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANTS[p.status] ?? 'default'}>{p.status.replace('_', ' ')}</Badge>
            <span className="text-[11px] text-ach-navy/55">Method {p.methodology_version}</span>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <div className="space-y-5">
          {SECTION_GROUPS.map(group => (
            <div key={group.title}>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">{group.title}</div>
              <div className="space-y-2.5">
                {group.keys.map((key: SectionKey) => {
                  const s = byKey.get(key);
                  if (!s) return null;
                  return (
                    <SectionEditor
                      key={s.id}
                      packId={params.id}
                      section={{
                        id: s.id,
                        section_key: s.section_key,
                        label: SECTION_LABELS[key],
                        content: s.content,
                        included: s.included,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Pack summary</div>
              <dl className="mt-2 space-y-1.5 text-[12px]">
                <Row label="Sections included" value={`${included} / ${rows.length}`} />
                <Row label="Anonymisation" value={p.anonymisation_level} />
                <Row label="Method version" value={p.methodology_version} />
                <Row label="Created" value={formatDate(p.created_at)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Status</div>
              <form action={setStatus} className="flex flex-wrap gap-2">
                {['draft', 'finalised', 'exported_word', 'exported_pdf', 'archived'].map(s => (
                  <button
                    key={s}
                    name="status"
                    value={s}
                    type="submit"
                    disabled={p.status === s}
                    className={`px-3 py-1 rounded-full text-[11px] border-[0.5px] ${
                      p.status === s
                        ? 'bg-ach-navy text-ach-cream border-ach-navy cursor-default'
                        : 'bg-white text-ach-navy/70 border-ach-border hover:bg-ach-page'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">AI drafting</div>
              <p className="text-[12px] text-ach-navy/70 leading-relaxed">
                AI-assisted section drafting via Gemini 1.5 Flash. Drafts are cached for 24 hours and rate-limited to 10 calls per user per hour to stay within the free tier. Drafts never auto-merge — they're shown alongside the section for review.
              </p>
              <p className="text-[11px] text-ach-navy/50 mt-2">
                Set <code>GEMINI_API_KEY</code> in environment to enable.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ach-navy/60">{label}</dt>
      <dd className="text-ach-navy capitalize text-right">{value}</dd>
    </div>
  );
}
