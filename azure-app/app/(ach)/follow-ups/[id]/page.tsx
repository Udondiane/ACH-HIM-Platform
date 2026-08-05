import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { FollowUpResponseForm } from '@/components/follow-ups/response-form';

export const metadata = { title: 'Follow-up response' };

const TIMEPOINT_LABELS: Record<string, string> = {
  mid_3mo:       '3-month check',
  exit_6mo:      '6-month check',
  followup_12mo: '12-month check',
};

const TIMEPOINT_PROMPTS: Record<string, string[]> = {
  mid_3mo: [
    'How is the placement going for you so far?',
    'Anything that has surprised you?',
    'Anything that is harder than we prepared you for?',
  ],
  exit_6mo: [
    'Are you still in the same role?',
    'How are you feeling about the work six months in?',
    'Anything you would want a future candidate to know?',
  ],
  followup_12mo: [
    'Are you still employed?',
    'Have you moved role, been promoted, or changed employer?',
    'Looking back a year, what has this year meant for you?',
    'What advice would you give someone starting the programme now?',
  ],
};

export default async function FollowUpDispatchPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: row } = await supabase
    .from('follow_ups_queue')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!row) notFound();
  const r = row as any;

  const displayName = r.given_name || r.candidate_ref;
  const isRetention = r.timepoint === 'exit_6mo' || r.timepoint === 'followup_12mo';
  const is12mo = r.timepoint === 'followup_12mo';

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="mb-4">
        <Link href="/follow-ups" className="inline-flex items-center gap-1.5 text-[12px] text-ach-navy/70 hover:text-ach-navy">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
        </Link>
      </div>

      <PageHeader
        miniLabel={TIMEPOINT_LABELS[r.timepoint] ?? r.timepoint}
        title={displayName}
        description={[r.cohort_name, r.placement_role, r.placement_partner].filter(Boolean).join(' · ')}
      />

      {/* Existing response snapshot */}
      {r.response_text && (
        <Card className="mb-4">
          <CardContent className="pt-5">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">Previously captured</div>
            {r.flag_reason && (
              <div className="text-[11.5px] text-[#8B3E52] mb-1">⚑ {r.flag_reason}</div>
            )}
            <div className="text-[13px] text-ach-navy leading-relaxed whitespace-pre-wrap">{r.response_text}</div>
            <div className="text-[11.5px] text-ach-navy/55 mt-2">
              Captured via {r.channel ?? 'unknown channel'} · {r.responded_at ? new Date(r.responded_at).toLocaleString('en-GB') : '—'}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggested prompts */}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-2">Suggested prompts</div>
          <ul className="list-disc list-inside space-y-1.5 text-[13px] text-ach-navy/80">
            {(TIMEPOINT_PROMPTS[r.timepoint] ?? []).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <div className="text-[11.5px] text-ach-navy/55 mt-3 italic">
            Use these as conversation openers. Capture the candidate&rsquo;s own words below, verbatim if possible.
          </div>
        </CardContent>
      </Card>

      {/* Response capture form */}
      <FollowUpResponseForm
        dispatchId={r.id}
        candidateId={r.candidate_id}
        cohortId={r.cohort_id ?? null}
        placementId={r.placement_id ?? null}
        timepoint={r.timepoint}
        isRetention={isRetention}
        is12mo={is12mo}
        initialResponse={r.response_text ?? ''}
      />
    </div>
  );
}
