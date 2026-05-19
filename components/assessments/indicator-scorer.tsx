'use client';

import { useState, useTransition } from 'react';
import { saveAssessmentResponseAction } from '@/lib/assessments/actions';

interface Indicator {
  id: string;
  name: string;
  factor_id: string;
  measurement_method: string;
}

interface Props {
  assessmentId: string;
  indicator: Indicator;
  initialValue: number | null;
  initialNarrative: string | null;
}

export function IndicatorScorer({ assessmentId, indicator, initialValue, initialNarrative }: Props) {
  const [value, setValue] = useState<number | null>(initialValue);
  const [narrative, setNarrative] = useState<string>(initialNarrative ?? '');
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const persist = (v: number | null, n: string | null) => {
    startTransition(async () => {
      await saveAssessmentResponseAction(assessmentId, indicator.id, v, n);
      setSavedAt(new Date());
    });
  };

  const onScore = (v: number) => {
    setValue(v);
    persist(v, narrative || null);
  };

  const onNarrativeBlur = () => {
    persist(value, narrative || null);
  };

  const isNarrative = indicator.measurement_method === 'narrative';
  const isYesNo = indicator.measurement_method === 'yes_no';

  return (
    <div className="py-3 first:pt-0 last:pb-0 border-b-[0.5px] border-ach-border last:border-0">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="text-[13px] text-ach-navy">{indicator.name}</div>
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50 shrink-0">
          {isNarrative ? 'Narrative' : isYesNo ? 'Yes / No' : '0 – 5'}
        </div>
      </div>

      {!isNarrative && (
        <div className="flex items-center gap-1.5 mb-2">
          {isYesNo ? (
            <>
              <ScoreBtn active={value === 0} onClick={() => onScore(0)}>No</ScoreBtn>
              <ScoreBtn active={value === 5} onClick={() => onScore(5)}>Yes</ScoreBtn>
            </>
          ) : (
            [0,1,2,3,4,5].map(n => (
              <ScoreBtn key={n} active={value === n} onClick={() => onScore(n)}>{n}</ScoreBtn>
            ))
          )}
        </div>
      )}

      <textarea
        value={narrative}
        onChange={e => setNarrative(e.target.value)}
        onBlur={onNarrativeBlur}
        rows={isNarrative ? 3 : 1}
        placeholder={isNarrative ? 'Describe the evidence and context…' : 'Optional evidence note'}
        className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
      />

      {savedAt && (
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/40 mt-1.5">
          {pending ? 'Saving…' : `Saved ${savedAt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`}
        </div>
      )}
    </div>
  );
}

function ScoreBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 min-w-[34px] px-2 rounded-[8px] text-[13px] font-medium border-[0.5px] transition-colors ${
        active ? 'bg-ach-navy text-ach-cream border-ach-navy' : 'bg-white text-ach-navy/60 border-ach-border hover:bg-ach-page'
      }`}
    >
      {children}
    </button>
  );
}
