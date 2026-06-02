'use client';

import { useState, useTransition, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setProjectFactorsAction } from '@/lib/projects/actions';
import type { DomainId } from '@/lib/scoring/types';

interface Factor {
  id: string;
  name: string;
  conversion_factor_type: 'personal' | 'social' | 'environmental';
  measurement_question: string | null;
  behavioural_prompt: string | null;
}

interface Capability {
  domain: DomainId;
  role: 'core' | 'optional';
  selected_factors: string[];
}

interface Props {
  projectId: string;
  capabilities: Capability[];
  factorsByDomain: Record<string, Factor[]>;
  locked?: boolean;
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

const TYPE_ORDER: Record<string, number> = { personal: 0, social: 1, environmental: 2 };
const TYPE_LABELS: Record<string, string> = { personal: 'Personal', social: 'Social', environmental: 'Environmental' };

export function FactorPicker({ projectId, capabilities, factorsByDomain, locked }: Props) {
  const sorted = useMemo(() => {
    const order: Record<string, number> = { employment: 1, education: 2, social: 3, housing: 4, health: 5, belonging: 6, rights: 7 };
    return [...capabilities].sort((a, b) => (order[a.domain] ?? 99) - (order[b.domain] ?? 99));
  }, [capabilities]);

  if (sorted.length === 0) {
    return (
      <p className="text-[13px] text-ach-navy/60">
        Select Core or Optional capabilities above before customising factor selection.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-ach-navy/65">
        Within each selected capability, choose which factors to assess. The default uses every factor in the
        reference taxonomy — narrow the selection to reduce candidate session length without losing methodological
        discipline. Once any cohort under this project has assessments, factor selection is locked.
      </p>
      {sorted.map(cap => (
        <DomainPanel
          key={cap.domain}
          projectId={projectId}
          cap={cap}
          factors={factorsByDomain[cap.domain] ?? []}
          locked={locked}
        />
      ))}
    </div>
  );
}

function DomainPanel({
  projectId, cap, factors, locked,
}: {
  projectId: string;
  cap: Capability;
  factors: Factor[];
  locked?: boolean;
}) {
  const initialMode: 'all' | 'custom' = cap.selected_factors.length === 0 ? 'all' : 'custom';
  const [mode, setMode] = useState<'all' | 'custom'>(initialMode);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(cap.selected_factors.length === 0 ? factors.map(f => f.id) : cap.selected_factors)
  );
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const total = factors.length;
  const active = mode === 'all' ? total : selected.size;

  const grouped = useMemo(() => {
    const byType: Record<string, Factor[]> = { personal: [], social: [], environmental: [] };
    for (const f of factors) byType[f.conversion_factor_type]?.push(f);
    for (const t of Object.keys(byType)) {
      byType[t].sort((a, b) => a.name.localeCompare(b.name));
    }
    return byType;
  }, [factors]);

  const toggle = (id: string) => {
    if (locked) return;
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (locked) return;
    setSelected(new Set(factors.map(f => f.id)));
  };
  const selectNone = () => {
    if (locked) return;
    setSelected(new Set());
  };

  const save = () => {
    if (locked) return;
    const payload = mode === 'all' ? [] : Array.from(selected);
    startTransition(async () => {
      const res = await setProjectFactorsAction(projectId, cap.domain, payload);
      if (res.ok) setSavedAt(new Date());
    });
  };

  return (
    <div className="rounded-[10px] border-[0.5px] border-ach-border bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-ach-page transition-colors rounded-t-[10px]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown className={`h-4 w-4 text-ach-navy/50 shrink-0 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} />
          <div className="text-[13px] text-ach-navy font-medium truncate">{DOMAIN_LABELS[cap.domain] ?? cap.domain}</div>
          <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 shrink-0">{cap.role}</span>
        </div>
        <div className="text-[11.5px] text-ach-navy/65 tabular-nums shrink-0">
          {active} of {total} factor{total === 1 ? '' : 's'}
          {mode === 'all' && <span className="ml-1.5 text-ach-navy/45">(default)</span>}
        </div>
      </button>

      {open && (
        <div className="border-t-[0.5px] border-ach-border px-3 py-3">
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              disabled={locked}
              onClick={() => setMode('all')}
              className={`text-[11.5px] uppercase tracking-[0.6px] px-2.5 py-1 rounded-[8px] border-[0.5px] transition-colors ${
                mode === 'all'
                  ? 'bg-ach-navy text-ach-cream border-ach-navy'
                  : 'bg-white text-ach-navy/60 border-ach-border hover:bg-ach-page'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Use methodology default
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => setMode('custom')}
              className={`text-[11.5px] uppercase tracking-[0.6px] px-2.5 py-1 rounded-[8px] border-[0.5px] transition-colors ${
                mode === 'custom'
                  ? 'bg-ach-navy text-ach-cream border-ach-navy'
                  : 'bg-white text-ach-navy/60 border-ach-border hover:bg-ach-page'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Customise
            </button>
            {mode === 'custom' && (
              <div className="ml-auto flex items-center gap-1.5">
                <button type="button" disabled={locked} onClick={selectAll} className="text-[11px] text-ach-navy/60 hover:text-ach-navy underline disabled:opacity-50">Select all</button>
                <span className="text-ach-navy/30">·</span>
                <button type="button" disabled={locked} onClick={selectNone} className="text-[11px] text-ach-navy/60 hover:text-ach-navy underline disabled:opacity-50">Select none</button>
              </div>
            )}
          </div>

          {mode === 'all' ? (
            <p className="text-[12px] text-ach-navy/60 italic">
              All {total} factors in this domain will be assessed. Switch to Customise to pick a subset.
            </p>
          ) : (
            <div className="space-y-3">
              {(['personal','social','environmental'] as const).map(type => {
                const list = grouped[type] ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={type}>
                    <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50 mb-1.5">{TYPE_LABELS[type]}</div>
                    <div className="space-y-1">
                      {list.map(f => {
                        const checked = selected.has(f.id);
                        return (
                          <label
                            key={f.id}
                            className={`flex items-start gap-2.5 p-2 rounded-[8px] cursor-pointer border-[0.5px] transition-colors ${
                              checked
                                ? 'bg-ach-page border-ach-border'
                                : 'bg-white border-transparent hover:bg-ach-page/50'
                            } ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={locked}
                              onChange={() => toggle(f.id)}
                              className="sr-only"
                            />
                            <span className={`h-4 w-4 rounded-[5px] border-[1px] shrink-0 mt-0.5 flex items-center justify-center ${
                              checked ? 'bg-ach-navy border-ach-navy' : 'bg-white border-ach-navy/30'
                            }`}>
                              {checked && <Check className="h-3 w-3 text-ach-cream" strokeWidth={3} />}
                            </span>
                            <div className="min-w-0">
                              <div className="text-[12.5px] text-ach-navy font-medium">{f.name}</div>
                              {f.measurement_question && (
                                <div className="text-[11.5px] text-ach-navy/60 mt-0.5 italic">{f.measurement_question}</div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!locked && (
            <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t-[0.5px] border-ach-border">
              {savedAt && (
                <span className="text-[11px] text-ach-navy/50">
                  Saved {savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Button onClick={save} disabled={pending} size="sm">
                {pending ? 'Saving…' : 'Save factor selection'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
