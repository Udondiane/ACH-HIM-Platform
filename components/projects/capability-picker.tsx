'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setProjectCapabilitiesAction } from '@/lib/projects/actions';
import type { DomainId } from '@/lib/scoring/types';

const ALL_DOMAINS: { id: DomainId; name: string; tone: string }[] = [
  { id: 'employment', name: 'Employment',          tone: 'rgba(232,153,104,0.15)' },
  { id: 'education',  name: 'Education & Skills',  tone: 'rgba(181,164,216,0.15)' },
  { id: 'social',     name: 'Social Participation',tone: 'rgba(125,168,201,0.15)' },
  { id: 'housing',    name: 'Housing',             tone: 'rgba(232,194,94,0.15)'  },
  { id: 'health',     name: 'Health & Wellbeing',  tone: 'rgba(149,182,112,0.15)' },
  { id: 'belonging',  name: 'Belonging & Identity',tone: 'rgba(214,120,144,0.15)' },
  { id: 'rights',     name: 'Rights & Citizenship',tone: 'rgba(60,107,71,0.15)'   },
];

type Role = 'core' | 'optional' | 'excluded';

interface Props {
  projectId: string;
  initial: { domain: DomainId; role: 'core' | 'optional' }[];
}

export function CapabilityPicker({ projectId, initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const initialMap: Record<DomainId, Role> = {} as Record<DomainId, Role>;
  for (const d of ALL_DOMAINS) initialMap[d.id] = 'excluded';
  for (const cap of initial) initialMap[cap.domain] = cap.role;

  const [picks, setPicks] = useState<Record<DomainId, Role>>(initialMap);

  const setRole = (d: DomainId, r: Role) => setPicks(p => ({ ...p, [d]: r }));

  const save = () => {
    const capabilities = ALL_DOMAINS
      .filter(d => picks[d.id] !== 'excluded')
      .map(d => ({ domain: d.id, role: picks[d.id] as 'core' | 'optional' }));
    startTransition(async () => {
      await setProjectCapabilitiesAction(projectId, capabilities);
      setSavedAt(new Date());
    });
  };

  const coreCount = Object.values(picks).filter(r => r === 'core').length;
  const optionalCount = Object.values(picks).filter(r => r === 'optional').length;

  return (
    <div>
      <div className="text-[12px] text-ach-navy/60 mb-4">
        Place each of the seven capability domains into Core, Optional, or Excluded.
        Core capabilities are the project&apos;s primary objectives; Optional capabilities are tracked
        but contribute via β; Excluded capabilities don&apos;t feed into the score.
      </div>

      <div className="space-y-2 mb-4">
        {ALL_DOMAINS.map(d => (
          <div
            key={d.id}
            className="flex items-center justify-between gap-3 p-3 rounded-[10px] border-[0.5px] border-ach-border bg-white"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                aria-hidden
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: d.tone.replace('0.15', '0.7') }}
              />
              <div className="text-[13px] text-ach-navy font-medium truncate">{d.name}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              {(['core','optional','excluded'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(d.id, r)}
                  className={`px-2.5 py-1 text-[11.5px] uppercase tracking-[0.6px] rounded-[8px] border-[0.5px] transition-colors ${
                    picks[d.id] === r
                      ? 'bg-ach-navy text-ach-cream border-ach-navy'
                      : 'bg-white text-ach-navy/60 border-ach-border hover:bg-ach-page'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] text-ach-navy/60">
          {coreCount} Core · {optionalCount} Optional · {7 - coreCount - optionalCount} Excluded
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[11px] text-ach-navy/50">Saved {savedAt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>}
          <Button onClick={save} disabled={pending} size="sm">
            {pending ? 'Saving…' : 'Save capability selection'}
          </Button>
        </div>
      </div>
    </div>
  );
}
