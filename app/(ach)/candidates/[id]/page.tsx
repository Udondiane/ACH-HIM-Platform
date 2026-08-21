import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, MessageSquare, GraduationCap, LifeBuoy, ClipboardCheck, Briefcase, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CANDIDATE_STATUS_LABELS, LOCALE_NAMES, PROGRESSION_TYPE_LABELS } from '@/lib/candidates/schema';
import { ConsentForm } from '@/components/candidates/consent-form';
import { CandidateIdentity } from '@/components/ui/candidate-identity';
import { ShortlistForPartner } from '@/components/candidates/shortlist-for-partner';
import { AudioConsentToggle } from '@/components/candidates/audio-consent-toggle';
import { ChangeHistoryPanel } from '@/components/candidates/change-history-panel';
import { logCandidateAccess } from '@/lib/audit/access-log';

export default async function CandidateDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: candidate } = await supabase
    .from('candidates').select('*').eq('id', params.id).maybeSingle();
  if (!candidate) notFound();
  const c = candidate as any;

  const [consents, balance, placements, cohortCandidates, workforcePartners, shortlists, trainingEnrols, trainingCerts, changeLog, statusTransitions, accessLog] = await Promise.all([
    supabase.from('candidate_consent').select('*').eq('candidate_id', params.id).order('given_at', { ascending: false }).limit(5),
    supabase.from('development_fund_balances').select('*').eq('candidate_id', params.id).maybeSingle(),
    supabase.from('placements').select('id, role_title, salary_band, start_date, status, partners(name)').eq('candidate_id', params.id).order('start_date', { ascending: false }).limit(5),
    supabase.from('cohort_candidates').select('id, enrolled_at, cohorts(id, name, cohort_ref, status, cohort_partners(partner_id, partners(id, name, types)))').eq('candidate_id', params.id),
    supabase.from('partners').select('id, name, types'),
    supabase.from('partner_shortlist').select('partner_id, withdrawn_at, notes').eq('candidate_id', params.id),
    supabase.from('training_enrolments').select('id, status, enrolled_date, completed_date, training_programmes(id, name, code, category)').eq('candidate_id', params.id).order('enrolled_date', { ascending: false }),
    supabase.from('training_certificates').select('id, certificate_number, issued_date, attendance_pct, training_programmes(name)').eq('candidate_id', params.id).order('issued_date', { ascending: false }),
    supabase.from('candidate_change_log').select('id, changed_at, changed_by, field_name, old_value, new_value').eq('candidate_id', params.id).order('changed_at', { ascending: false }).limit(200),
    supabase.from('candidate_status_transitions').select('id, from_status, to_status, changed_at, changed_by').eq('candidate_id', params.id).order('changed_at', { ascending: false }).limit(50),
    supabase.from('candidate_access_log').select('id, accessed_at, accessed_by, access_type, route').eq('candidate_id', params.id).order('accessed_at', { ascending: false }).limit(50),
  ]);

  // Log THIS view — fire-and-forget, never blocks the render.
  void logCandidateAccess(params.id, { accessType: 'view', route: '/candidates/[id]' });

  const latestConsent = (consents.data as any[])?.[0];
  const bal = balance.data as any;

  // Only workforce partners are eligible for shortlisting.
  const availableWorkforcePartners = ((workforcePartners.data as any[]) ?? [])
    .filter(p => Array.isArray(p.types) && p.types.includes('workforce_partner'))
    .map(p => ({ id: p.id, name: p.name }));
  const shortlistRows = (shortlists.data as any[]) ?? [];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref="/candidates"
        backLabel="Candidates"
        miniLabel={c.candidate_ref}
        title={<CandidateIdentity candidate={c} />}
        description={[c.country_of_origin, c.english_level && `English ${c.english_level}`].filter(Boolean).join(' · ') || undefined}
        actions={
          <div className="flex items-center gap-2">
            {c.is_ach_tenant && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] bg-ach-slate-tint text-ach-slate-deep border-ach-slate-blue/30">
                ACH tenant
              </span>
            )}
            <Link href={`/candidates/${c.id}/assess`}>
              <Button><ClipboardCheck className="h-3.5 w-3.5" />Start assessment</Button>
            </Link>
            <Link href={`/candidates/${c.id}/support`}>
              <Button variant="secondary"><LifeBuoy className="h-3.5 w-3.5" />Support</Button>
            </Link>
            <Link href={`/candidates/${c.id}/training`}>
              <Button variant="secondary"><GraduationCap className="h-3.5 w-3.5" />Training</Button>
            </Link>
            <Link href={`/candidates/${c.id}/interviews`}>
              <Button variant="secondary"><MessageSquare className="h-3.5 w-3.5" />Interviews</Button>
            </Link>
            <Link href={`/candidates/${c.id}/placements/new`}>
              <Button variant="secondary"><Briefcase className="h-3.5 w-3.5" />Record placement</Button>
            </Link>
            <Link href={`/candidates/${c.id}/case-study`}>
              <Button variant="secondary"><FileText className="h-3.5 w-3.5" />Case study</Button>
            </Link>
            <Link href={`/candidates/${c.id}/edit`}>
              <Button variant="secondary"><Pencil className="h-3.5 w-3.5" />Edit</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Profile</div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
              <DT label="Reference">{c.candidate_ref}</DT>
              <DT label="Status"><Badge>{CANDIDATE_STATUS_LABELS[c.status as keyof typeof CANDIDATE_STATUS_LABELS]}</Badge></DT>
              <DT label="Country of origin">{c.country_of_origin ?? '—'}</DT>
              <DT label="Arrival year">{c.arrival_year ?? '—'}</DT>
              <DT label="Preferred language">{LOCALE_NAMES[c.preferred_locale as keyof typeof LOCALE_NAMES] ?? c.preferred_locale}</DT>
              <DT label="English level">{c.english_level ?? '—'}</DT>
              <DT label="ACH tenant">{c.is_ach_tenant ? 'Yes' : 'No'}</DT>
            </dl>

            {(c.career_goal_summary || c.development_plan) && (
              <div className="mt-5 pt-5 border-t-[0.5px] border-ach-border space-y-4">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Private — staff only</div>
                {c.career_goal_summary && (
                  <div>
                    <div className="text-[12px] font-medium text-ach-navy mb-1">Career goal</div>
                    <p className="text-[13px] text-ach-navy/80 whitespace-pre-wrap">{c.career_goal_summary}</p>
                  </div>
                )}
                {c.development_plan && (
                  <div>
                    <div className="text-[12px] font-medium text-ach-navy mb-1">Development plan</div>
                    <p className="text-[13px] text-ach-navy/80 whitespace-pre-wrap">{c.development_plan}</p>
                  </div>
                )}
              </div>
            )}

            {c.status === 'progressed' && (c.progression_type || c.progression_notes) && (
              <div className="mt-5 pt-5 border-t-[0.5px] border-ach-border">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">Progression</div>
                {c.progression_type && (
                  <div className="text-[13px] text-ach-navy">
                    {PROGRESSION_TYPE_LABELS[c.progression_type as keyof typeof PROGRESSION_TYPE_LABELS] ?? c.progression_type}
                  </div>
                )}
                {c.progression_notes && (
                  <p className="text-[13px] text-ach-navy/80 whitespace-pre-wrap mt-1">{c.progression_notes}</p>
                )}
              </div>
            )}

            {c.notes && (
              <div className="mt-5 pt-5 border-t-[0.5px] border-ach-border">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">Internal notes</div>
                <p className="text-[13px] text-ach-navy/80 whitespace-pre-wrap">{c.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Audio recording consent</div>
            </CardHeader>
            <CardContent>
              <AudioConsentToggle
                candidateId={c.id}
                initialConsent={!!latestConsent?.may_ai_analyse_transcript}
                initialDate={latestConsent?.given_at ? String(latestConsent.given_at).slice(0, 10) : null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Reporting consent</div>
            </CardHeader>
            <CardContent className="text-[12.5px] space-y-1.5">
              {latestConsent ? (
                <>
                  <ConsentLine label="May be named" v={latestConsent.may_be_named} />
                  <ConsentLine label="May be quoted" v={latestConsent.may_be_quoted} />
                  <ConsentLine label="In case study" v={latestConsent.may_appear_in_case_study} />
                  <div className="text-ach-navy/60 mt-2 pt-2 border-t-[0.5px] border-ach-border">
                    Given {new Date(latestConsent.given_at).toLocaleDateString('en-GB')}
                  </div>
                </>
              ) : (
                <div className="text-ach-navy/60">No consent recorded yet.</div>
              )}
            </CardContent>
          </Card>

          {bal && (
            <Card>
              <CardHeader>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Development fund</div>
              </CardHeader>
              <CardContent className="text-[13px] space-y-1.5">
                <div className="flex justify-between"><span className="text-ach-navy/60">Credited</span><span className="tabular-nums">£{Number(bal.total_credited).toFixed(0)}</span></div>
                <div className="flex justify-between"><span className="text-ach-navy/60">Spent</span><span className="tabular-nums">£{Number(bal.total_spent).toFixed(0)}</span></div>
                <div className="flex justify-between font-medium pt-1 border-t-[0.5px] border-ach-border mt-1"><span>Balance</span><span className="tabular-nums">£{(Number(bal.total_credited) - Number(bal.total_spent)).toFixed(0)}</span></div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {cohortCandidates.data && cohortCandidates.data.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Cohorts</div>
          </CardHeader>
          <CardContent>
            <ul className="text-[13px] space-y-2">
              {(cohortCandidates.data as any[]).map(cc => (
                <li key={cc.id} className="flex items-center justify-between">
                  <Link href={`/cohorts/${cc.cohorts?.id}`} className="text-ach-navy font-medium hover:underline">
                    {cc.cohorts?.name ?? cc.cohorts?.cohort_ref}
                  </Link>
                  <Badge>{cc.cohorts?.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {availableWorkforcePartners.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Workforce partner shortlist</div>
            <div className="text-[12px] text-ach-navy/60 mt-0.5">
              Toggle to explicitly forward this candidate to a workforce partner.
              Partners only see candidates ACH has shortlisted for them.
            </div>
          </CardHeader>
          <CardContent>
            <ShortlistForPartner
              candidateId={c.id}
              availablePartners={availableWorkforcePartners}
              currentShortlists={shortlistRows}
            />
          </CardContent>
        </Card>
      )}

      {((trainingEnrols.data as any[]) ?? []).length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Training</div>
            <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Enrolments and certificates — evidence linked to HIM factors via each programme's learning outcomes.</div>
          </CardHeader>
          <CardContent>
            <ul className="text-[13px] space-y-2 mb-3">
              {((trainingEnrols.data as any[]) ?? []).map((e: any) => (
                <li key={e.id} className="flex items-center justify-between">
                  <div>
                    <Link href={`/training/programmes/${e.training_programmes?.id}`} className="text-ach-navy font-medium hover:underline">
                      {e.training_programmes?.name ?? '—'}
                    </Link>
                    <div className="text-[12px] text-ach-navy/60">
                      {e.training_programmes?.code ? `${e.training_programmes.code} · ` : ''}
                      Enrolled {e.enrolled_date ? new Date(e.enrolled_date).toLocaleDateString('en-GB') : '—'}
                      {e.completed_date && ` · Completed ${new Date(e.completed_date).toLocaleDateString('en-GB')}`}
                    </div>
                  </div>
                  <Badge>{e.status}</Badge>
                </li>
              ))}
            </ul>
            {((trainingCerts.data as any[]) ?? []).length > 0 && (
              <div className="border-t-[0.5px] border-ach-border pt-3">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">Certificates</div>
                <ul className="text-[12.5px] space-y-1">
                  {((trainingCerts.data as any[]) ?? []).map((c: any) => (
                    <li key={c.id} className="flex items-center justify-between">
                      <span>
                        <span className="text-ach-navy font-medium">{c.training_programmes?.name ?? '—'}</span>
                        <span className="text-ach-navy/55 ml-2">{c.certificate_number}</span>
                      </span>
                      <span className="text-ach-navy/60">
                        {c.attendance_pct !== null ? `${Number(c.attendance_pct).toFixed(0)}% · ` : ''}
                        {new Date(c.issued_date).toLocaleDateString('en-GB')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {placements.data && placements.data.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Placements</div>
          </CardHeader>
          <CardContent>
            <ul className="text-[13px] space-y-2">
              {(placements.data as any[]).map(p => (
                <li key={p.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-ach-navy font-medium">{p.role_title}</div>
                    <div className="text-[12px] text-ach-navy/60">{p.partners?.name} · {new Date(p.start_date).toLocaleDateString('en-GB')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/placements/${p.id}/timepoints`} className="text-[11.5px] text-ach-navy/70 underline underline-offset-2 hover:text-ach-navy">Timepoint feedback</Link>
                    <Badge>{p.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Record reporting consent</div>
        </CardHeader>
        <CardContent>
          <ConsentForm candidateId={c.id} />
        </CardContent>
      </Card>

      {/* Change history — automatic audit trail from migration 065.
          Every field edit, status transition, and record view logged
          to the corresponding audit table. Newest first, capped at 100
          rendered rows. */}
      <div className="mt-4">
        <ChangeHistoryPanel
          changes={(changeLog.data as any[]) ?? []}
          transitions={(statusTransitions.data as any[]) ?? []}
          accesses={(accessLog.data as any[]) ?? []}
        />
      </div>
    </div>
  );
}

function DT({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-0.5">{label}</dt>
      <dd className="text-ach-navy">{children}</dd>
    </div>
  );
}

function ConsentLine({ label, v }: { label: string; v: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ach-navy/70">{label}</span>
      <span className={v ? 'text-[#3C6B47]' : 'text-ach-navy/40'}>{v ? 'Yes' : 'No'}</span>
    </div>
  );
}
