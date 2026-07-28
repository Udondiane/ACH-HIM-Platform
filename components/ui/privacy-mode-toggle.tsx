'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'ach_privacy_mode';
const BODY_CLASS  = 'privacy-mode';

/**
 * Silent privacy-mode listener.
 *
 * No visible button. No visible cue. Toggle via keyboard shortcut:
 *   Ctrl+Shift+P  (Mac and Windows)
 *
 * When toggled, a small transient toast confirms the new state, then
 * fades. On page load, privacy mode is ON by default (safer for demos
 * and screen-sharing) unless the user previously turned it off in this
 * browser.
 *
 * Rendering: an invisible element that owns the keyboard handler and
 * the fading toast. The signature stays compatible with older callers
 * that passed a `collapsed` prop.
 */
export function PrivacyModeToggle(_props: { collapsed?: boolean } = {}) {
  const [on, setOn] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    // Default = privacy mode ON. Only OFF if user explicitly set it to 'false'.
    const initial = saved === 'false' ? false : true;
    setOn(initial);
    if (typeof document !== 'undefined') {
      document.body.classList.toggle(BODY_CLASS, initial);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+Shift+P — works Mac + Windows without conflicting with common shortcuts
      if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setOn(prev => {
          const next = !prev;
          if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(next));
          if (typeof document !== 'undefined') document.body.classList.toggle(BODY_CLASS, next);
          setToastMsg(next ? 'Names hidden' : 'Names shown');
          window.setTimeout(() => setToastMsg(null), 1500);
          return next;
        });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!mounted) return null;

  // Only render the tiny fading toast, and only briefly.
  if (!toastMsg) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[100] pointer-events-none"
    >
      <div className="rounded-[8px] bg-ach-navy text-ach-cream text-[12px] px-3 py-1.5 shadow-lg opacity-90">
        {toastMsg}
      </div>
    </div>
  );
}
