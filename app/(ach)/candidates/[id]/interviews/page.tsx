import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { INTERVIEW_KIND_LABELS, INTERVIEW_OUTCOME_LABELS } from '@/lib/interviews/schema';

export default async function CandidateInterviewsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [candidateRes, interviewsRes] = await Promise.all([
    supabase.from('candidates').select('id, candidate_ref, given_name, family_name').eq('id', params.id).maybeSingle(),
    supabase.from('candidate_interviews')
      .select('*, partners(name), cohorts(cohort_ref)')
      .eq('candidate_id', params.id)
      .order('conducted_on', { ascending: false, nullsFirst: true })
      .order('scheduled_for', { ascending: false, nullsFirst: true }),
  ]);

  if (!candidateRes.data) notFound();
  const c = candidateRes.data as any;
  const interviews = (interviewsRes.data as any[]) ?? [];

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        backHref={`/candidates/${params.id}`}
        backLabel={c.candidate_ref}
        miniLabel="Interviews"
        title={`Interview history`}
        description={`Selection interviews held by ACH and partner-side interviews held by employers, with structured feedback.`}
        actions={
          <Link href={`/candidates/${params.id}/interviews/new`}>
            <Button><Plus className="h-3.5 w-3.5" />Record interview</Button>
          </Link>
        }
      />

      {interviews.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-[13px] text-ach-navy/60">
            No interviews recorded for this candidate yet. Click <span className="font-medium">Record interview</span> above to log an ACH selection interview or a partner-side interview.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {interviews.map(i => (
            <Card key={i.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={i.kind === 'partner_interview' ? 'workforce_partner' : 'default'}>
                        {INTERVIEW_KIND_LABELS[i.kind as keyof typeof INTERVIEW_KIND_LABELS]}
                      </Badge>
                      <Badge variant={i.outcome === 'proceed' ? 'active' : i.outcome === 'reject' ? 'closed' : 'default'}>
                        {INTERVIEW_OUTCOME_LABELS[i.outcome as keyof typeof INTERVIEW_OUTCOME_LABELS]}
                      </Badge>
                      {i.fit_score && (
                        <span className="text-[11px] font-medium bg-ach-page text-ach-navy/80 px-2 py-0.5 rounded-full border-[0.5px] border-ach-border">
                          Fit {i.fit_score}/5
                        </span>
                      )}
                    </div>
                    <div className="text-[12.5px] text-ach-navy/70">
                      {[i.partners?.name, i.cohorts?.cohort_ref, i.interviewer_name, i.interviewer_role].filter(Boolean).join(' · ')}
                    </div>
                    <div className="text-[11.5px] text-ach-navy/55 mt-0.5">
                      {i.conducted_on
                        ? `Conducted ${new Date(i.conducted_on).toLocaleDateString('en-GB')}`
                        : i.scheduled_for
                          ? `Scheduled ${new Date(i.scheduled_for).toLocaleDateString('en-GB')}`
                          : `Logged ${new Date(i.created_at).toLocaleDateString('en-GB')}`}
                    </div>
                  </div>
                  <Link href={`/candidates/${params.id}/interviews/${i.id}/edit`}>
                    <Button size="sm" variant="secondary"><Pencil className="h-3 w-3" />Edit</Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  {i.strengths && <FeedbackBlock label="Strengths" text={i.strengths} />}
                  {i.development_areas && <FeedbackBlock label="Development areas" text={i.development_areas} />}
                  {i.general_feedback && <FeedbackBlock label="General feedback" text={i.general_feedback} />}
                </div>
                {i.notes_internal && (
                  <div className="mt-3 pt-3 border-t-[0.5px] border-ach-border">
                    <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">Internal notes (ACH only)</div>
                    <p className="text-[12.5px] text-ach-navy/75 whitespace-pre-wrap">{i.notes_internal}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">{label}</div>
      <p className="text-[12.5px] text-ach-navy/80 whitespace-pre-wrap">{text}</p>
    </div>
  );
}
