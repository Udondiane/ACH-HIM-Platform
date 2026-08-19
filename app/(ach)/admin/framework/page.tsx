import { Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { FrameworkBrowser } from '@/components/admin/framework-browser';

export const dynamic = 'force-dynamic';

const DOMAIN_ORDER: Record<string, number> = {
  employment: 1, education: 2, social: 3, housing: 4, health: 5, belonging: 6, rights: 7,
};
const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  education:  'Education & Skills',
  social:     'Social Participation',
  housing:    'Housing',
  health:     'Health & Wellbeing',
  belonging:  'Belonging & Identity',
  rights:     'Rights & Citizenship',
};

export default async function FrameworkLibraryPage() {
  const supabase = createClient();
  const [domainsRes, factorsRes, factorDomainsRes, indicatorsRes] = await Promise.all([
    supabase.from('domains').select('id, name, description, sort_order').order('sort_order'),
    supabase.from('factors').select('id, name, conversion_factor_type, measurement_question, behavioural_prompt, measurement_method'),
    supabase.from('factor_domains').select('factor_id, domain_id'),
    supabase.from('indicators').select('id, factor_id, name, sort_order').order('sort_order'),
  ]);

  const domains = (domainsRes.data as any[]) ?? [];
  const factors = (factorsRes.data as any[]) ?? [];
  const factorDomains = (factorDomainsRes.data as any[]) ?? [];
  const indicators = (indicatorsRes.data as any[]) ?? [];

  const indicatorsByFactor = new Map<string, any[]>();
  for (const ind of indicators) {
    if (!indicatorsByFactor.has(ind.factor_id)) indicatorsByFactor.set(ind.factor_id, []);
    indicatorsByFactor.get(ind.factor_id)!.push(ind);
  }
  const domainsByFactor = new Map<string, string[]>();
  for (const fd of factorDomains) {
    if (!domainsByFactor.has(fd.factor_id)) domainsByFactor.set(fd.factor_id, []);
    domainsByFactor.get(fd.factor_id)!.push(fd.domain_id);
  }

  const enriched = factors.map(f => ({
    ...f,
    indicators: indicatorsByFactor.get(f.id) ?? [],
    domains: (domainsByFactor.get(f.id) ?? []).sort((a, b) => (DOMAIN_ORDER[a] ?? 99) - (DOMAIN_ORDER[b] ?? 99)),
  }));

  const totalIndicators = indicators.length;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Admin · Reference"
        title="HIM framework library"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Domains" value={String(domains.length)} subline="capability areas" />
        <Stat label="Metrics" value={String(factors.length)} />
        <Stat label="Methodology" value="HIM v1.0" />
      </div>

      {factors.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-10 w-10" />}
            title="Framework not installed"
            description="The HIM measurement framework has not been loaded on this environment. Ask your ICT contact to complete platform setup."
          />
        </Card>
      ) : (
        <FrameworkBrowser
          factors={enriched}
          domains={domains.map(d => ({ id: d.id, name: DOMAIN_LABELS[d.id] ?? d.name, description: d.description }))}
        />
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
