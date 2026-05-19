import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CANDIDATE_STATUS_LABELS, LOCALE_NAMES } from '@/lib/candidates/schema';
import { ConsentForm } from '@/components/candidates/consent-form';

export default async function CandidateDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: candidate } = await supabase
    .from('candidates').select('*').eq('id', params.id).maybeSingle();
  if (!candidate) notFound();
  const c = candidate as any;

  const [consents, balance, placements, cohortCandidates] = await Promise.all([
    supabase.from('candidate_consent').select('*').eq('candidate_id', params.id).order('given_at', { ascending: false }).limit(5),
    supabase.from('development_fund_balances').select('*').eq('candidate_id', params.id).maybeSingle(),
    supabase.from('placements').select('id, role_title, salary_band, start_date, status, partners(name)').eq('candidate_id', params.id).order('start_date', { ascending: false }).limit(5),
    supabase.from('cohort_candidates').select('id, enrolled_at, cohorts(id, name, cohort_ref, status)').eq('candidate_id', params.id),
  ]);

  const latestConsent = (consents.data as any[])?.[0];
  const bal = balance.data as any;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref="/candidates"
        backLabel="Candidates"
        miniLabel={c.candidate_ref}
        title={c.given_name}
        description={[c.country_of_origin, c.english_level && `English ${c.english_level}`].filter(Boolean).join(' · ') || undefined}
        actions={
          <Link href={`/candidates/${c.id}/edit`}>
            <Button variant="secondary"><Pencil className="h-3.5 w-3.5" />Edit</Button>
          </Link>
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
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Latest consent</div>
            </CardHeader>
            <CardContent className="text-[12.5px] space-y-1.5">
              {latestConsent ? (
                <>
                  <ConsentLine label="May be named" v={latestConsent.may_be_named} />
                  <ConsentLine label="May be quoted" v={latestConsent.may_be_quoted} />
                  <ConsentLine label="In case study" v={latestConsent.may_appear_in_case_study} />
                  <ConsentLine label="Career goal shared w/ partner" v={latestConsent.may_share_career_goal_with_partner} />
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
                  <Badge>{p.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Record new consent</div>
        </CardHeader>
        <CardContent>
          <p className="text-[12px] text-ach-navy/60 mb-3">
            Capture a new consent decision. Consents are stored as dated rows — withdrawing a previously-granted consent
            is done by recording a new consent decision with the relevant flag set to off.
          </p>
          <ConsentForm candidateId={c.id} />
        </CardContent>
      </Card>
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
