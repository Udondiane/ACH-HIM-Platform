import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CandidateIdentity } from '@/components/ui/candidate-identity';
import { PartnerExitForm } from '@/components/partner-timepoints/partner-exit-form';
import { RetentionCheckForm } from '@/components/partner-timepoints/retention-check-form';

export const dynamic = 'force-dynamic';

export default async function PlacementTimepointsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [placementRes, growthRes, offerRes, retentionRes] = await Promise.all([
    supabase.from('placements')
      .select('id, role_title, start_date, status, candidate_id, candidates(candidate_ref, given_name, family_name), partners(id, name)')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('partner_growth_observations').select('*').eq('placement_id', params.id),
    supabase.from('placement_offers').select('*').eq('placement_id', params.id).maybeSingle(),
    supabase.from('placement_retention_checks').select('*').eq('placement_id', params.id),
  ]);

  if (!placementRes.data) notFound();
  const p = placementRes.data as any;
  const candidate = p.candidates;
  const partner = p.partners;

  const growthByTimepoint = new Map<string, any>();
  for (const g of (growthRes.data as any[]) ?? []) growthByTimepoint.set(g.timepoint, g);

  const retentionByTimepoint = new Map<string, any>();
  for (const r of (retentionRes.data as any[]) ?? []) retentionByTimepoint.set(r.timepoint, r);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        backHref={`/candidates/${p.candidate_id}`}
        backLabel={candidate?.candidate_ref ?? 'Candidate'}
        miniLabel={`Placement · ${partner?.name ?? '—'}`}
        title={<>Partner timepoint reports · <CandidateIdentity candidate={candidate} /></>}
        description={`Record IKEA's observations at each timepoint (or enter on IKEA's behalf while paper forms flow in). Save is idempotent — updating a form overwrites the previous entry.`}
      />

      <div className="text-[12.5px] text-ach-navy/70 mb-4">
        <strong>Role:</strong> {p.role_title ?? '—'} · <strong>Started:</strong> {p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'} · <strong>Status:</strong> {p.status}
      </div>

      {/* 3-month exit */}
      <Card className="mb-5">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Timepoint 1</div>
          <div className="text-[15px] font-medium text-ach-navy mt-0.5">3-month exit report</div>
          <div className="text-[12px] text-ach-navy/60 mt-1">
            Growth observations, task performance, DEI target flag, and exit decision. Save to record; return anytime to update.
          </div>
        </CardHeader>
        <CardContent>
          <PartnerExitForm
            placementId={p.id}
            initialGrowth={growthByTimepoint.get('exit_3mo') ?? null}
            initialOffer={offerRes.data ?? null}
          />
        </CardContent>
      </Card>

      {/* 6-month retention */}
      <Card className="mb-5">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Timepoint 2</div>
          <div className="text-[15px] font-medium text-ach-navy mt-0.5">6-month retention check</div>
          <div className="text-[12px] text-ach-navy/60 mt-1">
            Three months post-placement. Is the candidate still employed at {partner?.name ?? 'the partner'}?
          </div>
        </CardHeader>
        <CardContent>
          <RetentionCheckForm
            placementId={p.id}
            timepoint="retention_6mo"
            initial={retentionByTimepoint.get('retention_6mo') ?? null}
          />
        </CardContent>
      </Card>

      {/* 12-month retention */}
      <Card>
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Timepoint 3</div>
          <div className="text-[15px] font-medium text-ach-navy mt-0.5">12-month retention check</div>
          <div className="text-[12px] text-ach-navy/60 mt-1">
            Nine months post-placement. Final retention outcome for the pilot.
          </div>
        </CardHeader>
        <CardContent>
          <RetentionCheckForm
            placementId={p.id}
            timepoint="retention_12mo"
            initial={retentionByTimepoint.get('retention_12mo') ?? null}
            showProgression
          />
        </CardContent>
      </Card>
    </div>
  );
}
