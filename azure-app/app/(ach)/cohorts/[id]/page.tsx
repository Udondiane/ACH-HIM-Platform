import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, GraduationCap, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { COHORT_STATUS_LABELS, COHORT_STRUCTURE_LABELS } from '@/lib/cohorts/schema';
import { LinkPartnerToCohort, LinkCandidateToCohort, UnlinkRow } from '@/components/cohorts/linkers';
import { PARTNER_TYPE_LABELS } from '@/lib/partners/schema';
import { CandidateIdentity } from '@/components/ui/candidate-identity';

export default async function CohortDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: cohort } = await supabase.from('cohorts').select('*').eq('id', params.id).maybeSingle();
  if (!cohort) notFound();
  const c = cohort as any;

  const [cohortPartners, cohortCandidates, allPartners, allCandidates, assessmentsRes, projectRes, placementsRes] = await Promise.all([
    supabase.from('cohort_partners').select('id, partner_id, sponsorship_count, engagement_fee, is_lead_partner, partners(id, name, types)').eq('cohort_id', params.id),
    supabase.from('cohort_candidates').select('id, candidate_id, sponsoring_partner_id, candidates(id, candidate_ref, given_name, status), partners:sponsoring_partner_id(name)').eq('cohort_id', params.id),
    supabase.from('partners').select('id, name, types, status').neq('status', 'closed').order('name'),
    supabase.from('candidates').select('id, candidate_ref, given_name, status').order('candidate_ref'),
    supabase.from('assessments').select('id, candidate_id, timepoint, status, assessed_on, project_id').eq('cohort_id', params.id),
    c.project_id ? supabase.from('projects').select('id, funding_model').eq('id', c.project_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('placements').select('candidate_id, start_date').order('start_date', { ascending: false }),
  ]);

  const cohortProject = projectRes.data as { funding_model?: string } | null;
  const isWorkforceProgramme = cohortProject?.funding_model === 'commercial' || cohortProject?.funding_model === 'hybrid';
  // Per-candidate placement start date (latest placement wins).
  const placementByCandidate = new Map<string, string>();
  for (const p of (placementsRes.data as { candidate_id: string; start_date: string | null }[]) ?? []) {
    if (p.start_date && !placementByCandidate.has(p.candidate_id)) {
      placementByCandidate.set(p.candidate_id, p.start_date);
    }
  }

  const linkedPartnerIds = new Set((cohortPartners.data as any[] | null)?.map(cp => cp.partner_id) ?? []);
  const linkedCandidateIds = new Set((cohortCandidates.data as any[] | null)?.map(cc => cc.candidate_id) ?? []);

  const availablePartners = (allPartners.data as any[] | null)?.filter(p => !linkedPartnerIds.has(p.id)) ?? [];
  const availableCandidates = (allCandidates.data as any[] | null)?.filter(cand => !linkedCandidateIds.has(cand.id)) ?? [];

  // Build the per-candidate × per-timepoint assessment grid.
  type AssessmentCell = {
    id?: string;
    status?: 'in_progress' | 'completed' | 'reviewed';
    assessed_on?: string;
    project_id?: string;
  };
  const TIMEPOINTS = ['baseline', 'mid_3mo', 'exit_6mo', 'followup_12mo'] as const;
  const TIMEPOINT_LABELS: Record<string, string> = isWorkforceProgramme ? {
    baseline:      'Baseline',
    mid_3mo:       'End of placement',
    exit_6mo:      '6mo retention',
    followup_12mo: '12mo retention',
  } : {
    baseline:      'Baseline',
    mid_3mo:       '3 months',
    exit_6mo:      '6 months',
    followup_12mo: '12 months',
  };
  const cellByKey = new Map<string, AssessmentCell>();
  for (const a of (assessmentsRes.data as any[]) ?? []) {
    cellByKey.set(`${a.candidate_id}::${a.timepoint}`, {
      id: a.id,
      status: a.status,
      assessed_on: a.assessed_on,
      project_id: a.project_id,
    });
  }
  // Anchor for "due in N days" calc.
  // Workforce programmes: post-baseline timepoints anchor to the candidate's
  //   placement start date (end-of-placement = +3mo, retention checks at 6mo
  //   and 12mo from placement).
  // Other programmes: anchored to intervention_start_date as before.
  const cohortAnchorIso = c.intervention_start_date || c.start_date || null;
  const cohortStart = cohortAnchorIso ? new Date(cohortAnchorIso) : null;
  const dueOffsetDays: Record<string, number> = {
    baseline:      0,
    mid_3mo:       90,
    exit_6mo:      180,
    followup_12mo: 365,
  };
  function dueDateFor(timepoint: string, candidateId?: string): Date | null {
    if (isWorkforceProgramme && candidateId) {
      const placementIso = placementByCandidate.get(candidateId);
      // Baseline still anchored to cohort (or intake); post-baseline anchored
      // to placement when one exists. No placement = no due date for those.
      if (timepoint === 'baseline') {
        if (!cohortStart) return null;
        return new Date(cohortStart);
      }
      if (!placementIso) return null;
      const d = new Date(`${placementIso}T00:00:00`);
      d.setDate(d.getDate() + (dueOffsetDays[timepoint] ?? 0));
      return d;
    }
    if (!cohortStart) return null;
    const d = new Date(cohortStart);
    d.setDate(d.getDate() + (dueOffsetDays[timepoint] ?? 0));
    return d;
  }
  const today = new Date();

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref="/cohorts"
        backLabel="Cohorts"
        miniLabel={c.cohort_ref}
        title={c.name}
        description={[
          COHORT_STRUCTURE_LABELS[c.structure as keyof typeof COHORT_STRUCTURE_LABELS],
          c.location,
          c.programme_weeks && `${c.programme_weeks} weeks`,
        ].filter(Boolean).join(' · ')}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/cohorts/${c.id}/training`}>
              <Button variant="secondary"><GraduationCap className="h-3.5 w-3.5" />Training roster</Button>
            </Link>
            <Link href={`/cohorts/${c.id}/close-out`}>
              <Button variant="secondary">Close-out</Button>
            </Link>
            <Link href={`/cohorts/${c.id}/impact-12mo`}>
              <Button variant="secondary">12-month impact</Button>
            </Link>
            <Link href={`/cohorts/${c.id}/grant-funder-report`}>
              <Button variant="secondary">Grant funder view</Button>
            </Link>
            <Link href={`/cohorts/${c.id}/capability-investor-report`}>
              <Button variant="secondary">Capability investor view</Button>
            </Link>
            <Link href={`/cohorts/${c.id}/toms-claims`}>
              <Button variant="secondary">TOMs £ claims</Button>
            </Link>
            <Link href={`/cohorts/${c.id}/edit`}>
              <Button variant="secondary"><Pencil className="h-3.5 w-3.5" />Edit</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Status</div>
          </CardHeader>
          <CardContent>
            <Badge>{COHORT_STATUS_LABELS[c.status as keyof typeof COHORT_STATUS_LABELS]}</Badge>
            {c.start_date && <div className="text-[12px] text-ach-navy/60 mt-3">Started {new Date(c.start_date).toLocaleDateString('en-GB')}</div>}
            {c.end_date && <div className="text-[12px] text-ach-navy/60 mt-0.5">Ends {new Date(c.end_date).toLocaleDateString('en-GB')}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Partners</div>
          </CardHeader>
          <CardContent>
            <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none">{cohortPartners.data?.length ?? 0}</div>
            <div className="text-[12px] text-ach-navy/60 mt-2">
              {(cohortPartners.data as any[] | null)?.reduce((s, cp) => s + (cp.sponsorship_count ?? 0), 0) ?? 0} sponsorships committed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Candidates</div>
          </CardHeader>
          <CardContent>
            <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none">
              {cohortCandidates.data?.length ?? 0}{c.target_size && <span className="text-[15px] text-ach-navy/40"> / {c.target_size}</span>}
            </div>
            <div className="text-[12px] text-ach-navy/60 mt-2">enrolled</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Engaged partners</div>
            <LinkPartnerToCohort cohortId={c.id} availablePartners={availablePartners} />
          </div>
        </CardHeader>
        <CardContent>
          {!cohortPartners.data || cohortPartners.data.length === 0 ? (
            <p className="text-[13px] text-ach-navy/60">No partners linked yet.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Partner</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Type</th>
                  <th className="text-right py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Sponsorships</th>
                  <th className="text-right py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Contribution</th>
                  <th className="py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {(cohortPartners.data as any[]).map(cp => (
                  <tr key={cp.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <td className="py-2">
                      <Link href={`/partners/${cp.partner_id}`} className="text-ach-navy font-medium hover:underline">
                        {cp.partners?.name}
                      </Link>
                      {cp.is_lead_partner && <span className="ml-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Lead</span>}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {((cp.partners?.types as string[] | null) ?? []).map((t: string) => (
                          <Badge key={t} variant={t as any}>{PARTNER_TYPE_LABELS[t as keyof typeof PARTNER_TYPE_LABELS] ?? t}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{cp.sponsorship_count}</td>
                    <td className="py-2 text-right tabular-nums">£{Number(cp.engagement_fee ?? 0).toFixed(0)}</td>
                    <td className="py-2 text-right">
                      <UnlinkRow kind="partner" id={cp.id} cohortId={c.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Enrolled candidates</div>
            <div className="flex items-center gap-2">
              <Link href={`/candidates/new?cohort=${c.id}`}>
                <Button variant="secondary" size="sm"><Plus className="h-3.5 w-3.5" />New candidate</Button>
              </Link>
              <LinkCandidateToCohort
                cohortId={c.id}
                availableCandidates={availableCandidates}
                cohortPartners={(cohortPartners.data as any[]) ?? []}
                isRolling={!!c.is_rolling}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!cohortCandidates.data || cohortCandidates.data.length === 0 ? (
            <p className="text-[13px] text-ach-navy/60">No candidates enrolled yet.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border">
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Reference</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Given name</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Sponsoring partner</th>
                  <th className="text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Status</th>
                  <th className="py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {(cohortCandidates.data as any[]).map(cc => (
                  <tr key={cc.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <td className="py-2">
                      <Link href={`/candidates/${cc.candidate_id}`} className="text-ach-navy font-medium hover:underline">
                        {cc.candidates?.candidate_ref}
                      </Link>
                    </td>
                    <td className="py-2">{cc.candidates && <CandidateIdentity candidate={cc.candidates} />}</td>
                    <td className="py-2 text-ach-navy/70">{cc.partners?.name ?? '—'}</td>
                    <td className="py-2"><Badge>{cc.candidates?.status}</Badge></td>
                    <td className="py-2 text-right">
                      <UnlinkRow kind="candidate" id={cc.id} cohortId={c.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Per-candidate assessment grid — replaces flat "Recent assessments"
           on the project page. Rows = candidate, columns = the 4 timepoints,
           cells = status with click-through to the assessment runner. */}
      <Card className="mt-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Assessment status</div>
          <div className="text-[11.5px] text-ach-navy/55 mt-0.5">
            Each row is a candidate; each column is a timepoint. Click any cell to open or start that assessment.
          </div>
        </CardHeader>
        <CardContent>
          {(!cohortCandidates.data || cohortCandidates.data.length === 0) ? (
            <p className="text-[13px] text-ach-navy/60">No candidates enrolled yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b-[0.5px] border-ach-border">
                    <th className="text-left py-2 pr-3 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Candidate</th>
                    {TIMEPOINTS.map(tp => (
                      <th key={tp} className="text-left py-2 px-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">
                        {TIMEPOINT_LABELS[tp]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(cohortCandidates.data as any[]).map(cc => {
                    const candId = cc.candidate_id as string;
                    return (
                      <tr key={cc.id} className="border-b-[0.5px] border-ach-border last:border-0">
                        <td className="py-2 pr-3 align-middle">
                          <Link href={`/candidates/${candId}`} className="text-ach-navy font-medium hover:underline">
                            {cc.candidates?.candidate_ref}
                          </Link>
                          {cc.candidates && (
                            <span className="text-ach-navy/55 ml-1.5 identity-name">{cc.candidates.given_name}</span>
                          )}
                        </td>
                        {TIMEPOINTS.map(tp => {
                          const cell = cellByKey.get(`${candId}::${tp}`);
                          const due = dueDateFor(tp, candId);
                          let chip: { text: string; cls: string };
                          let href: string | null = null;
                          if (cell && (cell.status === 'completed' || cell.status === 'reviewed')) {
                            chip = {
                              text: `✓ ${cell.assessed_on ? new Date(cell.assessed_on).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Done'}`,
                              cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                            };
                            if (cell.id && cell.project_id) href = `/projects/${cell.project_id}/assess/${cell.id}`;
                          } else if (cell && cell.status === 'in_progress') {
                            chip = {
                              text: 'In progress',
                              cls: 'bg-amber-50 text-amber-900 border-amber-200',
                            };
                            if (cell.id && cell.project_id) href = `/projects/${cell.project_id}/assess/${cell.id}`;
                          } else {
                            const daysFromDue = due ? Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : null;
                            if (daysFromDue == null) {
                              chip = { text: 'Not started', cls: 'bg-ach-page text-ach-navy/55 border-ach-border' };
                            } else if (daysFromDue > 14) {
                              chip = { text: `Overdue ${daysFromDue}d`, cls: 'bg-ach-rose/15 text-[#8B3A4F] border-ach-rose/40' };
                            } else if (daysFromDue >= 0) {
                              chip = { text: `Due ${daysFromDue === 0 ? 'today' : `${daysFromDue}d overdue`}`, cls: 'bg-amber-50 text-amber-900 border-amber-200' };
                            } else if (daysFromDue >= -30) {
                              chip = { text: `Due in ${Math.abs(daysFromDue)}d`, cls: 'bg-ach-slate-tint text-ach-slate-deep border-ach-slate-blue/30' };
                            } else {
                              chip = { text: 'Not yet due', cls: 'bg-white text-ach-navy/45 border-ach-border' };
                            }
                            href = `/candidates/${candId}/assess`;
                          }
                          const chipEl = (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] tabular-nums whitespace-nowrap ${chip.cls}`}>
                              {chip.text}
                            </span>
                          );
                          return (
                            <td key={tp} className="py-2 px-2 align-middle">
                              {href ? (
                                <Link href={href} className="inline-block">{chipEl}</Link>
                              ) : (
                                chipEl
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
