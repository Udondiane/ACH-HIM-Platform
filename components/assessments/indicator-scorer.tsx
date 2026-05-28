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
  initialObservableChanges?: string | null;
  initialPractices?: string | null;
  locked?: boolean;
}

export function IndicatorScorer({
  assessmentId, indicator, initialValue, initialNarrative,
  initialObservableChanges, initialPractices, locked,
}: Props) {
  const [value, setValue] = useState<number | null>(initialValue);
  const [narrative, setNarrative] = useState<string>(initialNarrative ?? '');
  const [observable, setObservable] = useState<string>(initialObservableChanges ?? '');
  const [practices, setPractices] = useState<string>(initialPractices ?? '');
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const persist = (v: number | null, n: string | null, o: string | null, p: string | null) => {
    if (locked) return;
    startTransition(async () => {
      await saveAssessmentResponseAction(assessmentId, indicator.id, v, n, o, p);
      setSavedAt(new Date());
    });
  };

  const onScore = (v: number) => {
    if (locked) return;
    setValue(v);
    persist(v, narrative || null, observable || null, practices || null);
  };

  const onBlurAll = () => persist(value, narrative || null, observable || null, practices || null);

  const isNarrative = indicator.measurement_method === 'narrative';
  const isYesNo = indicator.measurement_method === 'yes_no';

  return (
    <div className="py-3 first:pt-0 last:pb-0 border-b-[0.5px] border-ach-border last:border-0">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="text-[13px] text-ach-navy font-medium">{indicator.name}</div>
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50 shrink-0">
          {isNarrative ? 'Narrative' : isYesNo ? 'Yes / No' : '0 – 5'}
        </div>
      </div>

      {!isNarrative && (
        <div className="flex items-center gap-1.5 mb-2">
          {isYesNo ? (
            <>
              <ScoreBtn active={value === 0} disabled={locked} onClick={() => onScore(0)}>No</ScoreBtn>
              <ScoreBtn active={value === 5} disabled={locked} onClick={() => onScore(5)}>Yes</ScoreBtn>
            </>
          ) : (
            [0,1,2,3,4,5].map(n => (
              <ScoreBtn key={n} active={value === n} disabled={locked} onClick={() => onScore(n)}>{n}</ScoreBtn>
            ))
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <RichField
          label="Observable changes"
          hint="What has changed for the candidate? (concrete, observable)"
          value={observable}
          onChange={setObservable}
          onBlur={onBlurAll}
          disabled={!!locked}
        />
        <RichField
          label="Practices / supports"
          hint="What is the candidate doing differently? What supports it?"
          value={practices}
          onChange={setPractices}
          onBlur={onBlurAll}
          disabled={!!locked}
        />
      </div>

      {(isNarrative || narrative) && (
        <textarea
          value={narrative}
          onChange={e => setNarrative(e.target.value)}
          onBlur={onBlurAll}
          rows={isNarrative ? 3 : 1}
          disabled={!!locked}
          placeholder={isNarrative ? 'Describe the evidence and context…' : 'Additional context (optional)'}
          className="mt-2 w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40 disabled:bg-ach-page disabled:text-ach-navy/55"
        />
      )}

      {savedAt && !locked && (
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/40 mt-1.5">
          {pending ? 'Saving…' : `Saved ${savedAt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`}
        </div>
      )}
    </div>
  );
}

function RichField({ label, hint, value, onChange, onBlur, disabled }: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{label}</div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        rows={2}
        disabled={disabled}
        placeholder={hint}
        className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40 disabled:bg-ach-page disabled:text-ach-navy/55"
      />
    </div>
  );
}

function ScoreBtn({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-8 min-w-[34px] px-2 rounded-[8px] text-[13px] font-medium border-[0.5px] transition-colors ${
        active ? 'bg-ach-navy text-ach-cream border-ach-navy' : 'bg-white text-ach-navy/60 border-ach-border hover:bg-ach-page'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
