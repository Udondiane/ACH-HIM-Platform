'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'ach_privacy_mode';
const BODY_CLASS  = 'privacy-mode';

/**
 * Toggle button that switches the app into "Privacy mode" — candidate
 * names are hidden and replaced with the candidate reference throughout
 * the app. Useful when screen-sharing during meetings, demos, or when
 * an unauthorised person may see the screen briefly.
 *
 * Setting is persisted in localStorage so it survives page navigations
 * and reloads. On mount, the toggle syncs its state from localStorage
 * and applies the body class immediately so the very first render after
 * a page load already reflects the user's chosen mode.
 *
 * The visual swap is achieved via CSS rules in globals.css that key off
 * the `privacy-mode` class on <body>. Individual name displays should
 * use the CandidateIdentity component (or a matching pair of spans with
 * classes `identity-name` and `identity-ref`) so the swap works.
 */
export function PrivacyModeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [on, setOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const initial = saved === 'true';
    setOn(initial);
    if (typeof document !== 'undefined') {
      document.body.classList.toggle(BODY_CLASS, initial);
    }
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(next));
    }
    if (typeof document !== 'undefined') {
      document.body.classList.toggle(BODY_CLASS, next);
    }
  };

  const Icon = on ? EyeOff : Eye;
  const label = on ? 'Show names' : 'Hide names';
  const title = on
    ? 'Names are hidden — click to show'
    : 'Show only candidate references (safe for screen sharing)';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={on}
      title={title}
      suppressHydrationWarning
      className={cn(
        'border-t-[0.5px] border-ach-border flex items-center transition-colors',
        'text-[11.5px] hover:bg-ach-page',
        on ? 'text-[#8B3A4F] hover:text-[#8B3A4F]' : 'text-ach-navy/55 hover:text-ach-navy',
        collapsed ? 'h-12 justify-center' : 'h-10 px-4 gap-2',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', collapsed ? '' : 'h-3.5 w-3.5')} />
      {!collapsed && <span>{mounted ? label : 'Hide names'}</span>}
    </button>
  );
}
