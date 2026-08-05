'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyButton({ text, label = 'Copy', variant = 'inline' }: {
  text: string;
  label?: string;
  variant?: 'inline' | 'block';
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: nothing much we can do without clipboard access
    }
  };

  const base = 'inline-flex items-center gap-1 text-[11.5px] rounded-[6px] transition-colors';
  const inlineCls = 'text-ach-navy/60 hover:text-ach-navy px-1.5 py-0.5';
  const blockCls = 'border border-ach-border px-2.5 py-1.5 text-ach-navy hover:bg-ach-page';

  return (
    <button type="button" onClick={copy} className={`${base} ${variant === 'block' ? blockCls : inlineCls}`}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}
