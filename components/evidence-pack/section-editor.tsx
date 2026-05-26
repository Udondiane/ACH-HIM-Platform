'use client';

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { updateSectionContentAction, toggleSectionIncludedAction } from '@/lib/evidence-packs/actions';

interface Props {
  section: {
    id: string;
    section_key: string;
    label: string;
    content: string | null;
    included: boolean;
  };
  packId: string;
}

export function SectionEditor({ section, packId }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content ?? '');
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateSectionContentAction(section.id, packId, draft);
      setEditing(false);
    });
  }

  function toggleIncluded() {
    startTransition(async () => {
      await toggleSectionIncludedAction(section.id, packId, !section.included);
    });
  }

  return (
    <div className={`rounded-[10px] border-[0.5px] ${section.included ? 'border-ach-border bg-white' : 'border-ach-border/40 bg-ach-page/40'} p-4`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Section</div>
          <div className={`text-[14px] font-medium ${section.included ? 'text-ach-navy' : 'text-ach-navy/40'}`}>{section.label}</div>
        </div>
        <button
          type="button"
          onClick={toggleIncluded}
          disabled={pending}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] uppercase tracking-[1.2px] border-[0.5px] ${
            section.included
              ? 'bg-[#3C6B47]/15 text-[#3C6B47] border-[#3C6B47]/30'
              : 'bg-ach-page text-ach-navy/50 border-ach-border'
          }`}
        >
          {section.included ? <><Check className="h-3 w-3" /> Included</> : <><X className="h-3 w-3" /> Excluded</>}
        </button>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={8}
            placeholder={`Write the ${section.label.toLowerCase()} content here…`}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" type="button" onClick={save} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => { setDraft(section.content ?? ''); setEditing(false); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {section.content ? (
            <p className="text-[13px] text-ach-navy/80 whitespace-pre-wrap leading-relaxed">{section.content}</p>
          ) : (
            <p className="text-[12px] text-ach-navy/50 italic">No content yet.</p>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 text-[12px] text-ach-navy/70 underline-offset-4 hover:underline"
          >
            {section.content ? 'Edit' : 'Write section'}
          </button>
        </div>
      )}
    </div>
  );
}
