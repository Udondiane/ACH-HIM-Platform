'use client';

import { useState, useTransition } from 'react';
import { submitSelfAssessmentAction } from '@/lib/self-assessment/actions';

type Factor = {
  id: string;
  name: string;
  measurement_question: string | null;
};

type Response = {
  score: number | null;
  narrative: string;
};

export function SelfAssessmentForm({ token, factors }: { token: string; factors: Factor[] }) {
  const [responses, setResponses] = useState<Record<string, Response>>(() => {
    const init: Record<string, Response> = {};
    for (const f of factors) init[f.id] = { score: null, narrative: '' };
    return init;
  });
  const [reflection, setReflection] = useState('');
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setScore(factorId: string, score: number) {
    setResponses(prev => ({ ...prev, [factorId]: { ...prev[factorId], score } }));
  }

  function setNarrative(factorId: string, narrative: string) {
    setResponses(prev => ({ ...prev, [factorId]: { ...prev[factorId], narrative } }));
  }

  const scored = Object.values(responses).filter(r => r.score !== null).length;
  const canSubmit = scored > 0 && !pending && !submitted;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const payload = {
        token,
        responses: factors.map(f => ({
          factor_id: f.id,
          score:     responses[f.id].score,
          narrative: responses[f.id].narrative,
        })),
        reflection,
      };
      const res = await submitSelfAssessmentAction(payload);
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(res.error);
      }
    });
  }

  if (submitted) {
    return (
      <div className="rounded-[14px] bg-white border-[0.5px] border-ach-border p-8 text-center">
        <div className="text-[46px] mb-3">✓</div>
        <h2 className="text-[20px] font-medium text-ach-navy mb-2">Thank you</h2>
        <p className="text-[13.5px] text-ach-navy/75">
          Your responses have been sent to your ACH caseworker. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {factors.map((f, idx) => {
        const r = responses[f.id];
        return (
          <div key={f.id} className="rounded-[14px] bg-white border-[0.5px] border-ach-border p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/55 shrink-0 mt-1">
                {idx + 1} / {factors.length}
              </div>
              <div>
                <div className="text-[14.5px] font-medium text-ach-navy leading-tight">
                  {f.name}
                </div>
                {f.measurement_question && (
                  <div className="text-[13px] text-ach-navy/70 mt-1 leading-relaxed">
                    {f.measurement_question}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/55 mb-2">
                Your rating (0 = not at all, 5 = very strong)
              </div>
              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScore(f.id, n)}
                    className={`h-10 min-w-[42px] px-2 rounded-[10px] text-[14.5px] font-medium border-[0.5px] transition-colors ${
                      r.score === n
                        ? 'bg-ach-navy text-ach-cream border-ach-navy'
                        : 'bg-white text-ach-navy/70 border-ach-border hover:bg-ach-page'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/55 mb-2">
                Anything you'd like to add? (optional)
              </div>
              <textarea
                value={r.narrative}
                onChange={e => setNarrative(f.id, e.target.value)}
                rows={2}
                placeholder="A sentence or two about where you are with this."
                className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
              />
            </div>
          </div>
        );
      })}

      <div className="rounded-[14px] bg-white border-[0.5px] border-ach-border p-5">
        <div className="text-[14.5px] font-medium text-ach-navy mb-1">One last question</div>
        <div className="text-[13px] text-ach-navy/70 mb-3">
          Looking back, what has changed for you most since joining the programme?
        </div>
        <textarea
          value={reflection}
          onChange={e => setReflection(e.target.value)}
          rows={4}
          placeholder="In your own words."
          className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
        />
      </div>

      {error && (
        <div className="rounded-[10px] bg-[#F7E3E7] border-[0.5px] border-[#D08EA0] px-4 py-3 text-[13px] text-[#7B2A3C]">
          {error}
        </div>
      )}

      <div className="sticky bottom-4 pt-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full h-12 rounded-[12px] bg-ach-navy text-ach-cream text-[14.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {pending ? 'Sending…' : scored === 0 ? 'Rate at least one to continue' : `Submit (${scored} of ${factors.length} rated)`}
        </button>
      </div>
    </div>
  );
}
