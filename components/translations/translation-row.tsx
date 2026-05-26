'use client';

import { useState, useTransition } from 'react';
import { Check, Languages } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { updateTranslationAction, toggleReviewedAction } from '@/lib/translations/actions';

interface Props {
  row: {
    id: string;
    message_key: string;
    locale: string;
    content: string | null;
    reviewed: boolean;
    needs_native_review: boolean;
    sourceContent: string | null;
    tier: 'A' | 'B' | 'C';
    isRtl: boolean;
  };
}

export function TranslationRow({ row }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.content ?? '');
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateTranslationAction(row.id, draft, row.reviewed);
      setEditing(false);
    });
  }

  function toggleReviewed() {
    startTransition(async () => {
      await toggleReviewedAction(row.id, !row.reviewed);
    });
  }

  return (
    <tr className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/30 transition-colors">
      <td className="px-3 py-2 align-top">
        <div className="text-[11px] text-ach-navy/55 font-mono">{row.message_key}</div>
      </td>
      <td className="px-3 py-2 align-top text-[12px] text-ach-navy/70">{row.sourceContent ?? '—'}</td>
      <td className="px-3 py-2 align-top" dir={row.isRtl ? 'rtl' : 'ltr'}>
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
              dir={row.isRtl ? 'rtl' : 'ltr'}
            />
            <Button size="sm" type="button" onClick={save} disabled={pending}>
              {pending ? '…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => { setDraft(row.content ?? ''); setEditing(false); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="text-[13px] text-ach-navy hover:underline text-left">
            {row.content || <span className="text-ach-navy/40 italic">(empty — English fallback)</span>}
          </button>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <button
          type="button"
          onClick={toggleReviewed}
          disabled={pending}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] uppercase tracking-[1.2px] border-[0.5px] ${
            row.reviewed
              ? 'bg-[#3C6B47]/15 text-[#3C6B47] border-[#3C6B47]/30'
              : row.needs_native_review
                ? 'bg-[#D67890]/15 text-[#8B3A4F] border-[#D67890]/40'
                : 'bg-[#E8C25E]/15 text-[#8B6914] border-[#E8C25E]/40'
          }`}
        >
          {row.reviewed ? <><Check className="h-3 w-3" /> Reviewed</> : row.needs_native_review ? <><Languages className="h-3 w-3" /> Native review needed</> : 'Machine — pending'}
        </button>
      </td>
    </tr>
  );
}
