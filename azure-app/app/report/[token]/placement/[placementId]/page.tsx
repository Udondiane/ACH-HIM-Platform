import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { PartnerExitForm } from '@/components/partner-timepoints/partner-exit-form';
import { RetentionCheckForm } from '@/components/partner-timepoints/retention-check-form';

export const dynamic = 'force-dynamic';

export default async function TokenPlacementReportPage({
  params,
}: {
  params: { token: string; placementId: string };
}) {
  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from('partner_access_tokens')
    .select('id, partner_id, revoked_at, expires_at, partners(name)')
    .eq('token', params.token)
    .maybeSingle();

  if (!tokenRow) notFound();
  const t = tokenRow as any;
  if (t.revoked_at) notFound();
  if (t.expires_at && new Date(t.expires_at) < new Date()) notFound();

  const { data: placementRow } = await supabase
    .from('placements')
    .select('id, role_title, start_date, status, partner_id, candidates(candidate_ref, given_name, family_name)')
    .eq('id', params.placementId)
    .maybeSingle();

  if (!placementRow) notFound();
  const p = placementRow as any;
  if (p.partner_id !== t.partner_id) notFound();

  const [growthRes, offerRes, retentionRes] = await Promise.all([
    supabase.from('partner_growth_observations').select('*').eq('placement_id', p.id),
    supabase.from('placement_offers').select('*').eq('placement_id', p.id).maybeSingle(),
    supabase.from('placement_retention_checks').select('*').eq('placement_id', p.id),
  ]);

  const growthByTimepoint = new Map<string, any>();
  for (const g of (growthRes.data as any[]) ?? []) growthByTimepoint.set(g.timepoint, g);
  const retentionByTimepoint = new Map<string, any>();
  for (const r of (retentionRes.data as any[]) ?? []) retentionByTimepoint.set(r.timepoint, r);

  const c = p.candidates;
  const name = c ? `${c.given_name ?? ''} ${c.family_name ?? ''}`.trim() || c.candidate_ref : '—';
  const partnerName = t.partners?.name ?? '';

  return (
    <div className="min-h-screen bg-ach-page">
      <div className="max-w-3xl mx-auto p-8">
        <Link
          href={`/report/${params.token}`}
          className="inline-flex items-center gap-1 text-[12px] text-ach-navy/65 hover:text-ach-navy mb-4"
        >
          <ChevronLeft className="h-3.5 w-3.5" />Back to all candidates
        </Link>

        <div className="mb-6">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{partnerName}</div>
          <h1 className="text-[22px] text-ach-navy mt-1">{name}</h1>
          <div className="text-[12.5px] text-ach-navy/65 mt-2">
            <strong>Role:</strong> {p.role_title ?? '—'} · <strong>Started:</strong> {p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'} · <strong>Status:</strong> {p.status}
          </div>
        </div>

        <div className="mb-5 rounded-[14px] border-[0.5px] border-ach-border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b-[0.5px] border-ach-border">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Timepoint 1</div>
            <div className="text-[15px] font-medium text-ach-navy mt-0.5">3-month exit report</div>
            <div className="text-[12px] text-ach-navy/60 mt-1">
              Please share your observations of growth over the placement, task performance, and your exit decision. All fields are optional — save what you can, come back to add more later.
            </div>
          </div>
          <div className="px-4 py-4">
            <PartnerExitForm
              placementId={p.id}
              initialGrowth={growthByTimepoint.get('exit_3mo') ?? null}
              initialOffer={offerRes.data ?? null}
            />
          </div>
        </div>

        <div className="mb-5 rounded-[14px] border-[0.5px] border-ach-border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b-[0.5px] border-ach-border">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Timepoint 2</div>
            <div className="text-[15px] font-medium text-ach-navy mt-0.5">6-month retention check</div>
            <div className="text-[12px] text-ach-navy/60 mt-1">
              Three months after the placement ended. Is this candidate still with {partnerName || 'your organisation'}?
            </div>
          </div>
          <div className="px-4 py-4">
            <RetentionCheckForm
              placementId={p.id}
              timepoint="retention_6mo"
              initial={retentionByTimepoint.get('retention_6mo') ?? null}
            />
          </div>
        </div>

        <div className="rounded-[14px] border-[0.5px] border-ach-border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b-[0.5px] border-ach-border">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Timepoint 3</div>
            <div className="text-[15px] font-medium text-ach-navy mt-0.5">12-month retention check</div>
            <div className="text-[12px] text-ach-navy/60 mt-1">
              Nine months after the placement ended — the final retention check for this candidate.
            </div>
          </div>
          <div className="px-4 py-4">
            <RetentionCheckForm
              placementId={p.id}
              timepoint="retention_12mo"
              initial={retentionByTimepoint.get('retention_12mo') ?? null}
              showProgression
            />
          </div>
        </div>
      </div>
    </div>
  );
}
