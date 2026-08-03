'use client';

import { Printer } from 'lucide-react';

export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => { if (typeof window !== 'undefined') window.print(); }}
      className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-[8px] border border-ach-border text-ach-navy hover:bg-ach-page"
    >
      <Printer className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
