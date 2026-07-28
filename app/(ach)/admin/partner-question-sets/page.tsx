import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Partner question sets' };

async function safeFetch<T>(fn: () => any, fallback: T): Promise<T> {
  try {
    const r = await fn();
    if (r?.error) return fallback;
    return (r?.data ?? fallback) as T;
  } catch { return fallback; }
}

const TIMEPOINT_LABELS: Record<string, string> = {
  exit_3mo: '3-month exit',
  retention_6mo: '6-month retention',
  retention_12mo: '12-month retention',
};

const TYPE_LABELS: Record<string, string> = {
  narrative: 'Free text',
  yes_no: 'Yes / no',
  likert_1_5: '1–5 scale',
  text_short: 'Short answer',
};

export default async function PartnerQuestionSetsPage() {
  const supabase = createClient();

  const [sets, items] = await Promise.all([
    safeFetch<any[]>(() => supabase.from('partner_question_sets').select('key, label, description').order('key'), []),
    safeFetch<any[]>(
      () => supabase.from('partner_question_items').select('id, set_key, timepoint, ordering, prompt, response_type, guidance, is_required').order('ordering'),
      [],
    ),
  ]);

  const itemsBySet = new Map<string, any[]>();
  for (const i of items) {
    const arr = itemsBySet.get(i.set_key) ?? [];
    arr.push(i);
    itemsBySet.set(i.set_key, arr);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        miniLabel="Methodology"
        title="Partner question sets"
        description="Standardised question templates for the partner-facing tokenised reports. Each project links to one set. Same tokenised UX, tailored questions."
      />

      {sets.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-[13px] text-ach-navy/70">
            No question sets defined yet. Run migration 048 to seed the default three (workforce, wellbeing, housing).
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sets.map((s: any) => {
            const setItems = itemsBySet.get(s.key) ?? [];
            const byTp: Record<string, any[]> = {};
            for (const it of setItems) {
              (byTp[it.timepoint] ??= []).push(it);
            }
            return (
              <Card key={s.key}>
                <CardHeader>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <div className="text-[16px] font-serif font-semibold text-ach-navy">{s.label}</div>
                    <code className="font-mono text-[11px] text-ach-navy/50">{s.key}</code>
                  </div>
                  {s.description && (
                    <div className="text-[12.5px] text-ach-navy/70 mt-1">{s.description}</div>
                  )}
                </CardHeader>
                <CardContent>
                  {['exit_3mo', 'retention_6mo', 'retention_12mo'].map(tp => {
                    const list = byTp[tp] ?? [];
                    if (list.length === 0) return null;
                    return (
                      <div key={tp} className="mb-4 last:mb-0">
                        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-2 font-medium">
                          {TIMEPOINT_LABELS[tp] ?? tp}
                        </div>
                        <div className="space-y-2">
                          {list.map((q: any) => (
                            <div key={q.id} className="rounded-[8px] border-[0.5px] border-ach-border bg-white px-3 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-[13px] text-ach-navy leading-relaxed flex-1">
                                  {q.prompt}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Badge>{TYPE_LABELS[q.response_type] ?? q.response_type}</Badge>
                                  {q.is_required && (
                                    <span className="text-[10.5px] uppercase tracking-[1.1px] text-[#8B3E52]">required</span>
                                  )}
                                </div>
                              </div>
                              {q.guidance && (
                                <div className="text-[11.5px] text-ach-navy/55 italic mt-1">{q.guidance}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <section className="mt-8 text-[11.5px] text-ach-navy/60 leading-relaxed">
        <div className="font-medium text-ach-navy/75 mb-1">How this works</div>
        <p>
          Every project links to one partner question set via <code className="font-mono">projects.partner_question_set_key</code>.
          When a partner opens their tokenised report, the questions shown are pulled from the set linked to that project's cohort.
          Editing a set updates the questions for every project that uses it — methodology change flows through in one place.
        </p>
      </section>
    </div>
  );
}
