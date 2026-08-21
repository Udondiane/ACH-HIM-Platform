'use client';

import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CandidatePicker } from '@/components/candidates/candidate-picker';

interface CandidateOption {
  id: string;
  candidate_ref: string;
  given_name?: string | null;
  family_name?: string | null;
}

interface Timepoint {
  id: 'baseline' | 'mid_3mo' | 'exit_6mo' | 'followup_12mo';
  label: string;
}

interface Props {
  candidates: CandidateOption[];
  timepoints: readonly Timepoint[];
  baselineLocked: boolean;
  baselineDeadline: string | null;
  windowDays: number;
  // Bound server action — accepts (prevState, formData) and returns a state.
  // Kept as a plain function reference so the parent can bind projectId
  // context. On success it redirects; on failure it returns { error }.
  startAction: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string } | null>;
}

/**
 * Client-side wrapper around the assessment-start server action so we
 * can surface errors (baseline window closed, network failure, etc.)
 * instead of silently swallowing them.
 *
 * Also auto-selects the first non-locked timepoint so the form never
 * ships a value the server will immediately reject.
 */
export function StartAssessmentForm({ candidates, timepoints, baselineLocked, baselineDeadline, windowDays, startAction }: Props) {
  const [state, formAction, pending] = useActionState<{ error?: string } | null, FormData>(
    async (prev, fd) => startAction(prev, fd),
    null,
  );

  // Pick the default-checked timepoint: baseline if available, else the
  // first non-locked option. Guarantees a value goes back to the server.
  const firstUnlockedIndex = timepoints.findIndex(t => !(t.id === 'baseline' && baselineLocked));

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Beneficiary</label>
        <CandidatePicker name="candidate_id" required options={candidates as any[]} />
      </div>

      <div className="space-y-2">
        <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Timepoint</label>
        <div className="grid grid-cols-2 gap-2">
          {timepoints.map((t, i) => {
            const locked = t.id === 'baseline' && baselineLocked;
            return (
              <label
                key={t.id}
                className={`flex items-center gap-2 p-3 rounded-[10px] border-[0.5px] ${
                  locked
                    ? 'border-ach-border bg-ach-page/40 cursor-not-allowed opacity-60'
                    : 'border-ach-border cursor-pointer hover:bg-ach-page'
                }`}
              >
                <input
                  type="radio" name="timepoint" value={t.id}
                  defaultChecked={i === firstUnlockedIndex}
                  disabled={locked}
                  className="h-4 w-4 border-ach-border text-ach-navy focus:ring-ach-navy/40"
                />
                <span className={`text-[13px] ${locked ? 'text-ach-navy/50' : 'text-ach-navy'}`}>
                  {t.label}
                  {locked && <span className="ml-1 text-[10.5px] uppercase tracking-[1.2px] text-[#8B3A4F]/70">· closed</span>}
                </span>
              </label>
            );
          })}
        </div>
        {baselineLocked && (
          <div className="text-[11.5px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30 mt-2">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Baseline window closed</div>
                <div className="mt-0.5">
                  The baseline recording window ended on{' '}
                  {baselineDeadline ? new Date(baselineDeadline).toLocaleDateString('en-GB') : '—'} ({windowDays} days after project start).
                  Baseline can no longer be recorded, but the later timepoints (3 months, 6 months, 12 months) are still available. Pick one of those to continue.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {state?.error && (
        <div className="text-[12.5px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Starting…' : 'Start assessment'}
        </Button>
      </div>
    </form>
  );
}
