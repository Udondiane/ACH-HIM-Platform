import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { COHORT_STATUS_LABELS, COHORT_STRUCTURE_LABELS } from '@/lib/cohorts/schema';
import { LinkPartnerToCohort, LinkCandidateToCohort, UnlinkRow } from '@/components/cohorts/linkers';
import { PARTNER_TYPE_LABELS } from '@/lib/partners/schema';

export default async function CohortDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: cohort } = await supabase.from('cohorts').select('*').eq('id', params.id).maybeSingle();
  if (!cohort) notFound();
  const c = cohort as any;

  const [cohortPartners, cohortCandidates, allPartners, allCandidates] = await Promise.all([
    supabase.from('cohort_partners').select('id, partner_id, sponsorship_count, engagement_fee, is_lead_partner, partners(id, name, type)').eq('cohort_id', params.id),
    supabase.from('cohort_candidates').select('id, candidate_id, sponsoring_partner_id, candidates(id, candidate_ref, given_name, status), partners:sponsoring_partner_id(name)').eq('cohort_id', params.id),
    supabase.from('partners').select('id, name, type, status').neq('status', 'closed').order('name'),
    supabase.from('candidates').select('id, candidate_ref, given_name, status').order('candidate_ref'),
  ]);

  const linkedPartnerIds = new Set((cohortPartners.data as any[] | null)?.map(cp => cp.partner_id) ?? []);
  const linkedCandidateIds = new Set((cohortCandidates.data as any[] | null)?.map(cc => cc.candidate_id) ?? []);

  const availablePartners = (allPartners.data as any[] | null)?.filter(p => !linkedPartnerIds.has(p.id)) ?? [];
  const availableCandidates = (allCandidates.data as any[] | null)?.filter(cand => !linkedCandidateIds.has(cand.id)) ?? [];

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
          <Link href={`/cohorts/${c.id}/edit`}>
            <Button variant="secondary"><Pencil className="h-3.5 w-3.5" />Edit</Button>
          </Link>
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
                  <th className="text-right py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Fee</th>
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
                    <td className="py-2"><Badge variant={cp.partners?.type}>{PARTNER_TYPE_LABELS[cp.partners?.type as keyof typeof PARTNER_TYPE_LABELS]}</Badge></td>
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
            <LinkCandidateToCohort
              cohortId={c.id}
              availableCandidates={availableCandidates}
              cohortPartners={(cohortPartners.data as any[]) ?? []}
            />
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
                    <td className="py-2">{cc.candidates?.given_name}</td>
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
    </div>
  );
}
