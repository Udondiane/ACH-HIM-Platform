'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * If a factor's stored `name` value looks like a raw key
 * (all-caps snake_case, or lowercase snake_case that matches the id
 * shape), prettify it for display: strip the domain-prefix + type
 * marker (e.g. BELONG_P_ / emp_e_), replace underscores with spaces,
 * and Title-Case it. Otherwise return the name unchanged.
 *
 * Defensive: framework data seeded from earlier taxonomy migrations
 * had raw keys in the name column; the reseed migration (059) fixed
 * this, but this formatter guards against display leakage in any
 * environment where the reseed has not yet been applied.
 */
function displayName(name: string): string {
  if (!name) return '';
  const looksLikeKey = /^[A-Z0-9_]+$/.test(name) || /^[a-z0-9_]+$/.test(name);
  if (!looksLikeKey) return name;

  // Strip common domain + type prefixes (e.g. "BELONG_P_", "emp_e_", "rights_s_")
  const stripped = name.replace(
    /^(?:BELONG|EMP|EMPLOYMENT|EDU|EDUCATION|HEALTH|HOUSING|SOCIAL|RIGHTS)_[PSCEC]_/i,
    '',
  );

  const spaced = stripped.replace(/_/g, ' ').toLowerCase().trim();
  // Title-case each word, but keep short connectors lowercase
  const smallWords = new Set(['and', 'or', 'the', 'of', 'in', 'to', 'a', 'for', 'on']);
  return spaced
    .split(' ')
    .map((w, i) =>
      i === 0 || !smallWords.has(w)
        ? w.charAt(0).toUpperCase() + w.slice(1)
        : w,
    )
    .join(' ');
}

interface Factor {
  id: string;
  name: string;
  conversion_factor_type: 'personal' | 'social' | 'environmental';
  measurement_question: string | null;
  behavioural_prompt: string | null;
  measurement_method: string;
  indicators: { id: string; name: string; sort_order: number }[];
  domains: string[];
}

interface Domain {
  id: string;
  name: string;
  description: string | null;
}

interface Props {
  factors: Factor[];
  domains: Domain[];
}

const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  education:  'Education & Skills',
  social:     'Social Participation',
  housing:    'Housing',
  health:     'Health & Wellbeing',
  belonging:  'Belonging & Identity',
  rights:     'Rights & Citizenship',
};
const TYPE_LABELS: Record<string, string> = {
  personal: 'Personal',
  social: 'Social',
  environmental: 'Environmental',
};
const TYPE_ORDER: Record<string, number> = { personal: 0, social: 1, environmental: 2 };

export function FrameworkBrowser({ factors, domains }: Props) {
  const [activeDomain, setActiveDomain] = useState<string>('all');
  const [activeType, setActiveType] = useState<string>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return factors
      .filter(f => activeDomain === 'all' || f.domains.includes(activeDomain))
      .filter(f => activeType === 'all' || f.conversion_factor_type === activeType)
      .filter(f => {
        if (!q) return true;
        const haystack = [
          f.name,
          f.measurement_question ?? '',
          f.behavioural_prompt ?? '',
          ...(f.indicators ?? []).map(i => i.name),
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const da = a.domains[0] ?? '';
        const db = b.domains[0] ?? '';
        if (da !== db) return da.localeCompare(db);
        const ta = TYPE_ORDER[a.conversion_factor_type] ?? 9;
        const tb = TYPE_ORDER[b.conversion_factor_type] ?? 9;
        if (ta !== tb) return ta - tb;
        return a.name.localeCompare(b.name);
      });
  }, [factors, activeDomain, activeType, query]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ach-navy/40" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search metric names, questions, prompts, indicators…"
                className="w-full pl-9 pr-3 py-2 rounded-[10px] border-[0.5px] border-ach-border bg-white text-[13px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <FilterGroup label="Domain" active={activeDomain} onChange={setActiveDomain} options={[
                { id: 'all', label: 'All' },
                ...domains.map(d => ({ id: d.id, label: d.name })),
              ]} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <FilterGroup label="Type" active={activeType} onChange={setActiveType} options={[
              { id: 'all', label: 'All' },
              { id: 'personal', label: 'Personal' },
              { id: 'social', label: 'Social' },
              { id: 'environmental', label: 'Environmental' },
            ]} />
            <div className="ml-auto text-[11.5px] text-ach-navy/55 tabular-nums">
              {filtered.length} of {factors.length} metric{factors.length === 1 ? '' : 's'}
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <p className="text-[13px] text-ach-navy/60">No metrics match your filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(f => <FactorCard key={f.id} factor={f} />)}
        </div>
      )}
    </div>
  );
}

function FactorCard({ factor }: { factor: Factor }) {
  const bullets = factor.indicators?.map(i => i.name) ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">
              <code className="font-mono">{factor.id}</code>
            </div>
            <div className="text-[16px] font-medium text-ach-navy">{displayName(factor.name)}</div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {factor.domains.map(d => (
              <Badge key={d}>{DOMAIN_LABELS[d] ?? d}</Badge>
            ))}
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] bg-ach-page text-ach-navy/80 border-ach-border">
              {TYPE_LABELS[factor.conversion_factor_type]}
            </span>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] bg-white text-ach-navy/60 border-ach-border">
              {factor.measurement_method.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {factor.measurement_question && (
          <Block label="Measurement question (methodology)" body={factor.measurement_question} />
        )}
        {factor.behavioural_prompt && (
          <Block
            label="Behavioural prompt (read verbatim to candidate)"
            body={factor.behavioural_prompt}
            tone="prompt"
          />
        )}
        {bullets.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1.5">
              Observable indicators ({bullets.length}, each scored 0-5 unless Yes/No)
            </div>
            <ul className="space-y-1">
              {bullets.map((b, i) => (
                <li key={i} className="text-[13px] text-ach-navy/85 flex items-start gap-2">
                  <span className="text-ach-navy/35 tabular-nums shrink-0 mt-0.5">{i + 1}.</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Block({ label, body, tone }: { label: string; body: string; tone?: 'prompt' }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{label}</div>
      <div className={
        tone === 'prompt'
          ? 'text-[13px] text-ach-navy bg-ach-page rounded-[8px] px-3 py-2 border-l-[2px] border-ach-navy/30'
          : 'text-[13px] text-ach-navy/85'
      }>
        {body}
      </div>
    </div>
  );
}

function FilterGroup({
  label, active, onChange, options,
}: {
  label: string;
  active: string;
  onChange: (id: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50 mr-1">{label}</div>
      <div className="flex items-center gap-1 flex-wrap">
        {options.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`px-2.5 py-1 text-[11.5px] uppercase tracking-[0.6px] rounded-[8px] border-[0.5px] transition-colors ${
              active === o.id
                ? 'bg-ach-navy text-ach-cream border-ach-navy'
                : 'bg-white text-ach-navy/60 border-ach-border hover:bg-ach-page'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
