import Link from 'next/link';
import { Languages } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { TranslationRow } from '@/components/translations/translation-row';
import { locales, localeMeta, type Locale } from '@/lib/i18n/config';

type Search = { locale?: string; status?: string };

const TIER_BADGE: Record<'A' | 'B' | 'C', 'active' | 'paused' | 'closed'> = {
  A: 'active',
  B: 'paused',
  C: 'closed',
};

export default async function TranslationsPage({ searchParams }: { searchParams?: Search }) {
  const supabase = createClient();

  const selectedLocale = (searchParams?.locale && locales.includes(searchParams.locale as Locale))
    ? (searchParams.locale as Locale)
    : ('ar' as Locale);
  const meta = localeMeta[selectedLocale];

  const { data: allRows } = await supabase
    .from('translations')
    .select('id, message_key, locale, content, reviewed, needs_native_review')
    .in('locale', [selectedLocale, 'en'])
    .order('message_key');

  const rows = (allRows as any[]) ?? [];
  const sources = new Map<string, string>();
  for (const r of rows) {
    if (r.locale === 'en') sources.set(r.message_key, r.content ?? '');
  }

  let targetRows = rows.filter(r => r.locale === selectedLocale);
  if (searchParams?.status === 'reviewed') targetRows = targetRows.filter(r => r.reviewed);
  if (searchParams?.status === 'pending') targetRows = targetRows.filter(r => !r.reviewed && !r.needs_native_review);
  if (searchParams?.status === 'needs_native') targetRows = targetRows.filter(r => r.needs_native_review && !r.reviewed);

  // Per-locale counts for the locale switcher
  const { data: counts } = await supabase
    .from('translations')
    .select('locale, reviewed, needs_native_review, content');
  const localeStats: Record<string, { total: number; reviewed: number; empty: number }> = {};
  for (const c of (counts as any[]) ?? []) {
    const k = c.locale as string;
    localeStats[k] ||= { total: 0, reviewed: 0, empty: 0 };
    localeStats[k].total++;
    if (c.reviewed) localeStats[k].reviewed++;
    if (!c.content) localeStats[k].empty++;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Admin"
        title="Translations"
        description="11 locales · 3-tier review policy (English source, machine-translated pending review, needs native review). Edit strings inline, mark reviewed when validated by a native speaker."
      />

      <Card className="mb-5">
        <CardContent className="pt-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Locales</div>
          <div className="flex flex-wrap gap-2">
            {locales.map(loc => {
              const m = localeMeta[loc];
              const stats = localeStats[loc];
              const isActive = loc === selectedLocale;
              return (
                <Link
                  key={loc}
                  href={`/translations?locale=${loc}`}
                  className={`px-3 py-2 rounded-[10px] border-[0.5px] text-[12px] ${
                    isActive
                      ? 'bg-ach-navy text-ach-cream border-ach-navy'
                      : 'bg-white text-ach-navy/80 border-ach-border hover:bg-ach-page'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{loc}</span>
                    <span className={`text-[10.5px] uppercase tracking-[1px] ${isActive ? 'text-ach-cream/70' : 'text-ach-navy/50'}`}>{m.tier}</span>
                  </div>
                  <div className={`text-[10.5px] mt-0.5 ${isActive ? 'text-ach-cream/70' : 'text-ach-navy/55'}`}>
                    {m.englishLabel} · {stats ? `${stats.reviewed}/${stats.total}` : '0/0'}
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Filter:</span>
        <FilterPill href={`/translations?locale=${selectedLocale}`} label="All" active={!searchParams?.status} />
        <FilterPill href={`/translations?locale=${selectedLocale}&status=reviewed`} label="Reviewed" active={searchParams?.status === 'reviewed'} />
        <FilterPill href={`/translations?locale=${selectedLocale}&status=pending`} label="Pending" active={searchParams?.status === 'pending'} />
        <FilterPill href={`/translations?locale=${selectedLocale}&status=needs_native`} label="Needs native review" active={searchParams?.status === 'needs_native'} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{meta.englishLabel}</div>
              <div className="text-[15px] font-medium text-ach-navy">{meta.label}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={TIER_BADGE[meta.tier]}>Tier {meta.tier}</Badge>
              <Badge>{meta.dir.toUpperCase()}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {targetRows.length === 0 ? (
            <EmptyState
              icon={<Languages className="h-10 w-10" />}
              title="No translation strings"
              description={
                meta.tier === 'A'
                  ? 'English is the source — no rows needed in this view.'
                  : 'No strings stored for this locale yet. The seed pipeline populates rows from messages/<locale>/*.json.'
              }
            />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <Th>Key</Th>
                  <Th>English source</Th>
                  <Th>{meta.englishLabel}</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {targetRows.map(r => (
                  <TranslationRow
                    key={r.id}
                    row={{
                      id: r.id,
                      message_key: r.message_key,
                      locale: r.locale,
                      content: r.content,
                      reviewed: r.reviewed,
                      needs_native_review: r.needs_native_review,
                      sourceContent: sources.get(r.message_key) ?? null,
                      tier: meta.tier,
                      isRtl: meta.dir === 'rtl',
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">{children}</th>;
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-[12px] border-[0.5px] transition-colors ${
        active
          ? 'bg-ach-navy text-ach-cream border-ach-navy'
          : 'bg-white text-ach-navy/70 border-ach-border hover:bg-ach-page'
      }`}
    >
      {label}
    </Link>
  );
}
