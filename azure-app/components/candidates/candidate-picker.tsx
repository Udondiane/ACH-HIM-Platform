'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Privacy-aware candidate picker.
 *
 * A native <select> renders <option> text as plain strings that the
 * browser draws itself, so it does not respect body-class CSS overrides
 * used by Privacy Mode. This custom listbox uses div-based options with
 * `identity-name` / `identity-ref` spans so Privacy Mode hides real
 * names correctly.
 *
 * Submits via a hidden input under the given `name` so it drops into any
 * existing <form> with no other changes.
 */
export interface CandidateOption {
  id: string;
  candidate_ref: string;
  given_name?: string | null;
  family_name?: string | null;
  preferred_name?: string | null;
}

export function CandidatePicker({
  name,
  options,
  required = false,
  placeholder = 'Choose a candidate…',
}: {
  name: string;
  options: CandidateOption[];
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selected = useMemo(
    () => options.find(o => o.id === selectedId) ?? null,
    [selectedId, options],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o =>
      o.candidate_ref.toLowerCase().includes(q) ||
      (o.given_name ?? '').toLowerCase().includes(q) ||
      (o.family_name ?? '').toLowerCase().includes(q) ||
      (o.preferred_name ?? '').toLowerCase().includes(q),
    );
  }, [query, options]);

  const displayName = (c: CandidateOption) =>
    [c.preferred_name || c.given_name, c.family_name].filter(Boolean).join(' ').trim() ||
    c.candidate_ref;

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name={name} value={selectedId} required={required} />

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px]',
          'focus:outline-none focus:ring-1 focus:ring-ach-navy/40',
          selected ? 'text-ach-navy' : 'text-ach-navy/45',
        )}
      >
        {selected ? (
          <span className="truncate">
            <span className="identity-name">
              <span className="text-ach-navy/55">{selected.candidate_ref}</span>
              {' · '}
              <span>{displayName(selected)}</span>
            </span>
            <span className="identity-ref">{selected.candidate_ref}</span>
          </span>
        ) : (
          <span>{placeholder}</span>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-ach-navy/40 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[10px] border-[0.5px] border-ach-border bg-white shadow-lg max-h-80 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="border-b-[0.5px] border-ach-border px-2.5 py-2 flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-ach-navy/40" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              placeholder="Search by ref or name…"
              className="flex-1 text-[12.5px] text-ach-navy bg-transparent focus:outline-none placeholder:text-ach-navy/40"
            />
          </div>

          {/* Options */}
          <div className="overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-ach-navy/55 italic">
                No matches.
              </div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { setSelectedId(o.id); setOpen(false); setQuery(''); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-ach-page',
                    o.id === selectedId && 'bg-ach-page',
                  )}
                >
                  <span className="flex-1 truncate">
                    <span className="identity-name">
                      <span className="text-ach-navy/55 mr-2">{o.candidate_ref}</span>
                      <span className="text-ach-navy">{displayName(o)}</span>
                    </span>
                    <span className="identity-ref text-ach-navy">{o.candidate_ref}</span>
                  </span>
                  {o.id === selectedId && <Check className="h-3.5 w-3.5 text-ach-navy shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
