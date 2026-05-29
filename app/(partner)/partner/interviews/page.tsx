import Link from 'next/link';
import { Plus, MessageSquare, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { INTERVIEW_OUTCOME_LABELS } from '@/lib/interviews/schema';

export default async function PartnerInterviewsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);
  if (!partner) return null;

  const supabase = createClient();

  // Find candidates who are linked to one of this partner's cohorts and
  // who have either already had a partner_interview with this partner OR
  // are eligible (in a cohort the partner sponsors / leads).
  const [cohortPartnersRes, interviewsRes] = await Promise.all([
    supabase.from('cohort_partners')
      .select(`
        cohorts(
          id, cohort_ref, name,
          cohort_candidates(candidate_id, candidates(id, candidate_ref, given_name, country_of_origin, status, journey_stage))
        )
      `)
      .eq('partner_id', partner.id),
    supabase.from('candidate_interviews')
      .select('*, candidates(candidate_ref, given_name, country_of_origin)')
      .eq('partner_id', partner.id)
      .eq('kind', 'partner_interview')
      .order('conducted_on', { ascending: false, nullsFirst: true }),
  ]);

  // Build candidate pool grouped by cohort, deduped
  const cohortMap = new Map<string, { cohort: any; candidates: any[] }>();
  for (const cp of (cohortPartnersRes.data as any[]) ?? []) {
    const co = cp.cohorts;
    if (!co) continue;
    const list = (co.cohort_candidates ?? []).map((cc: any) => cc.candidates).filter(Boolean);
    cohortMap.set(co.id, { cohort: co, candidates: list });
  }

  const interviews = (interviewsRes.data as any[]) ?? [];
  const interviewedIds = new Set(interviews.map(i => i.candidate_id));

  const allCandidates = Array.from(cohortMap.values())
    .flatMap(({ cohort, candidates }) => candidates.map(c => ({ ...c, cohort })));
  const dedupedCandidates = Array.from(new Map(allCandidates.map(c => [c.id, c])).values());
  const awaitingInterview = dedupedCandidates.filter(c => !interviewedIds.has(c.id));

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Interviews"
        title="Candidates to interview"
        description="Candidates ACH has shortlisted into a cohort you sponsor. Record your interview feedback once you have met them; ACH uses your input to inform placement decisions."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Kpi label="Awaiting interview" value={String(awaitingInterview.length)} sub="from your sponsored cohorts" />
        <Kpi label="Interviewed" value={String(interviewedIds.size)} sub="feedback recorded" />
        <Kpi
          label="Proceed-recommended"
          value={String(interviews.filter(i => i.outcome === 'proceed').length)}
          sub="passed your interview"
        />
      </div>

      {awaitingInterview.length === 0 && interviews.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessageSquare className="h-10 w-10" />}
            title="No interview activity yet"
            description="Candidates from your sponsored cohorts will appear here once ACH has shortlisted them. Then you can record interview feedback per candidate."
          />
        </Card>
      ) : (
        <>
          {awaitingInterview.length > 0 && (
            <Card className="mb-4">
              <CardContent className="pt-5">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Awaiting your interview</div>
                <div className="space-y-2">
                  {awaitingInterview.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-[10px] border-[0.5px] border-ach-border bg-white">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-ach-navy">{c.candidate_ref}</div>
                        <div className="text-[12px] text-ach-navy/65">
                          {[c.country_of_origin, c.cohort?.cohort_ref].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <Link href={`/partner/interviews/new?candidate=${c.id}&cohort=${c.cohort?.id ?? ''}`}>
                        <Button size="sm"><Plus className="h-3 w-3" />Record feedback</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {interviews.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Interview feedback recorded</div>
                <div className="space-y-3">
                  {interviews.map(i => (
                    <div key={i.id} className="p-3 rounded-[10px] border-[0.5px] border-ach-border bg-white">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div>
                          <div className="text-[13px] font-medium text-ach-navy">{i.candidates?.candidate_ref}</div>
                          <div className="text-[11.5px] text-ach-navy/60">
                            {[i.candidates?.country_of_origin, i.interviewer_name, i.interviewer_role].filter(Boolean).join(' · ')}
                          </div>
                          <div className="text-[11px] text-ach-navy/55 mt-0.5">
                            {i.conducted_on
                              ? `Conducted ${new Date(i.conducted_on).toLocaleDateString('en-GB')}`
                              : `Logged ${new Date(i.created_at).toLocaleDateString('en-GB')}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {i.fit_score && (
                            <span className="text-[11px] font-medium bg-ach-page text-ach-navy/80 px-2 py-0.5 rounded-full border-[0.5px] border-ach-border">
                              Fit {i.fit_score}/5
                            </span>
                          )}
                          <Badge variant={i.outcome === 'proceed' ? 'active' : i.outcome === 'reject' ? 'closed' : 'default'}>
                            {i.outcome === 'proceed' && <Check className="h-3 w-3 mr-1" />}
                            {INTERVIEW_OUTCOME_LABELS[i.outcome as keyof typeof INTERVIEW_OUTCOME_LABELS]}
                          </Badge>
                          <Link href={`/partner/interviews/${i.id}/edit`}>
                            <Button size="sm" variant="secondary">Edit</Button>
                          </Link>
                        </div>
                      </div>
                      {(i.strengths || i.development_areas || i.general_feedback) && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 pt-2 border-t-[0.5px] border-ach-border">
                          {i.strengths && <FeedbackBlock label="Strengths" text={i.strengths} />}
                          {i.development_areas && <FeedbackBlock label="Development" text={i.development_areas} />}
                          {i.general_feedback && <FeedbackBlock label="General" text={i.general_feedback} />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
        <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-1.5 tabular-nums">{value}</div>
        {sub && <div className="text-[11px] text-ach-navy/55 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function FeedbackBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[1.1px] text-ach-navy/55 mb-0.5">{label}</div>
      <p className="text-[12px] text-ach-navy/80 whitespace-pre-wrap">{text}</p>
    </div>
  );
}
