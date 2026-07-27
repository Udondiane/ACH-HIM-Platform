'use client';

import { useTransition } from 'react';
import { archiveFeaturedQuoteAction } from '@/lib/featured-quotes/actions';

export function ArchiveQuoteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        await archiveFeaturedQuoteAction(id, 'Archived from library');
      })}
      className="text-[11px] text-ach-navy/50 hover:text-red-700 underline underline-offset-2 disabled:opacity-50"
    >
      {pending ? 'Archiving…' : 'Archive'}
    </button>
  );
}
