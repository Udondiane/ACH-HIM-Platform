'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function AchErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[ach] route error caught by group error.tsx', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">ACH</div>
        <h1 className="text-[22px] font-medium text-ach-navy">Something went wrong on this page</h1>
      </div>

      <div className="rounded-[12px] bg-white border-[0.5px] border-ach-border p-5 space-y-3">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 text-[#8B3A4F] shrink-0 mt-0.5" />
          <div className="space-y-2 text-[13px] text-ach-navy/80">
            <p className="font-medium text-ach-navy">The page crashed during render.</p>
            <p>
              <span className="font-medium">Error message:</span>{' '}
              <code className="text-[11.5px] bg-ach-page px-1.5 py-0.5 rounded">
                {error.message || '(no message provided)'}
              </code>
            </p>
            {error.digest && (
              <p className="text-[12px] text-ach-navy/60">
                Digest: <code className="text-[11.5px]">{error.digest}</code>
              </p>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button type="button" onClick={reset} className="text-[12.5px] text-ach-navy underline">
                Try again
              </button>
              <Link href="/dashboard" className="text-[12.5px] text-ach-navy underline">
                ← Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
