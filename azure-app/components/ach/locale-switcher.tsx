'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { Globe, Check } from 'lucide-react';
import { locales, localeMeta, type Locale } from '@/lib/i18n/config';
import { setLocaleAction } from '@/lib/i18n/actions';

export function LocaleSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (locale: string) => {
    setOpen(false);
    startTransition(async () => {
      await setLocaleAction(locale);
    });
  };

  const meta = localeMeta[currentLocale];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[12px] text-ach-navy/70 hover:text-ach-navy px-2 py-1 rounded-[8px] hover:bg-ach-page transition-colors"
        title="Change language"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{meta.label}</span>
        {pending && <span className="text-[10.5px] text-ach-navy/55 ml-1">…</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[220px] bg-white rounded-[12px] border-[0.5px] border-ach-border shadow-lg overflow-hidden z-50">
          {locales.map(loc => {
            const m = localeMeta[loc];
            const tierTag = m.tier === 'A' ? 'Source'
              : m.tier === 'B' ? 'Translated'
              : 'English fallback';
            return (
              <button
                key={loc}
                type="button"
                onClick={() => pick(loc)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-ach-page transition-colors ${
                  loc === currentLocale ? 'bg-ach-page' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] text-ach-navy truncate" dir={m.dir}>{m.label}</span>
                  <span className="text-[10.5px] text-ach-navy/45">{m.englishLabel}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-ach-navy/45 uppercase tracking-[1px]">{tierTag}</span>
                  {loc === currentLocale && <Check className="h-3 w-3 text-ach-navy" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
