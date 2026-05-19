import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { HimResult } from '@/lib/scoring/types';

const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  education:  'Education & Skills',
  social:     'Social Participation',
  housing:    'Housing',
  health:     'Health & Wellbeing',
  belonging:  'Belonging & Identity',
  rights:     'Rights & Citizenship',
};

const DOMAIN_TONES: Record<string, string> = {
  employment: 'rgba(232,153,104,0.7)',
  education:  'rgba(181,164,216,0.7)',
  social:     'rgba(125,168,201,0.7)',
  housing:    'rgba(232,194,94,0.7)',
  health:     'rgba(149,182,112,0.7)',
  belonging:  'rgba(214,120,144,0.7)',
  rights:     'rgba(60,107,71,0.7)',
};

export function HimScoreCard({ result }: { result: HimResult }) {
  const pct = (n: number) => `${Math.round(n * 100)}`;

  return (
    <Card>
      <CardHeader>
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">HIM result</div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-4 mb-1">
          <div className="text-[42px] font-medium tracking-[-0.5px] text-ach-navy leading-none">
            {result.him.toFixed(3)}
          </div>
          <div className="text-[12px] text-ach-navy/60">
            {result.projectType} project · α {result.alpha.toFixed(2)} / β {result.beta.toFixed(2)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5">
          <div className="rounded-[12px] bg-ach-page p-4">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Core score</div>
            <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-1">{pct(result.coreScore)}%</div>
            <div className="text-[11.5px] text-ach-navy/60 mt-1">× α {result.alpha.toFixed(2)} = {(result.coreScore * result.alpha).toFixed(3)}</div>
          </div>
          <div className="rounded-[12px] bg-ach-page p-4">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Optional score</div>
            <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-1">{pct(result.optionalScore)}%</div>
            <div className="text-[11.5px] text-ach-navy/60 mt-1">× β {result.beta.toFixed(2)} = {(result.optionalScore * result.beta).toFixed(3)}</div>
          </div>
        </div>

        {result.stabilityScore !== undefined && (
          <div className="rounded-[12px] bg-ach-page p-4 mt-3">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Stability (V2)</div>
            <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-1">
              {result.stabilityScore.toFixed(3)}
            </div>
          </div>
        )}

        <div className="mt-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2.5">Per-domain breakdown</div>
          <div className="space-y-2">
            {result.domainBreakdown.map(d => (
              <div key={d.domain}>
                <div className="flex items-center justify-between text-[12px] mb-0.5">
                  <span className="text-ach-navy">
                    {DOMAIN_LABELS[d.domain] ?? d.domain}
                    <span className="ml-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50">
                      {d.role}
                    </span>
                  </span>
                  <span className="tabular-nums text-ach-navy/70">{d.domainMean.toFixed(2)} / 5</span>
                </div>
                <div className="h-2 rounded-full bg-ach-page overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(d.domainMean / 5) * 100}%`,
                      background: DOMAIN_TONES[d.domain] ?? 'rgba(10,31,61,0.5)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t-[0.5px] border-ach-border text-[11.5px] text-ach-navy/60 space-y-0.5">
          {result.trace.notes.map((n, i) => <div key={i}>{n}</div>)}
        </div>
      </CardContent>
    </Card>
  );
}
