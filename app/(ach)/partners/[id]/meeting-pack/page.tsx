import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PARTNER_TYPE_LABELS } from '@/lib/partners/schema';
import { ClientPrintBtn } from '@/components/dashboard/client-print-btn';

export const dynamic = 'force-dynamic';

export default async function PartnerMeetingPackPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [partnerRes, placementsRes, sponsorshipsRes, candidateRes] = await Promise.all([
    supabase.from('partners').select('*').eq('id', params.id).maybeSingle(),
    supabase
      .from('placements')
      .select('id, candidate_id, role_title, salary_band, salary_actual, start_date, end_date, status, sponsored_placement, candidates(candidate_ref, given_name)')
      .eq('partner_id', params.id)
      .order('start_date', { ascending: false }),
    supabase
      .from('cohort_partners')
      .select('id, cohort_id, sponsorship_count, engagement_fee, is_lead_partner, cohorts(cohort_ref, name, status, intervention_start_date, start_date)')
      .eq('partner_id', params.id),
    supabase
      .from('cohort_candidates')
      .select('candidate_id, candidates(id, candidate_ref, given_name, status), cohorts!inner(id, cohort_ref)')
      .eq('sponsoring_partner_id', params.id),
  ]);

  if (!partnerRes.data) notFound();
  const partner = partnerRes.data as any;
  const placements = (placementsRes.data as any[]) ?? [];
  const sponsorships = (sponsorshipsRes.data as any[]) ?? [];
  const sponsoredCandidates = ((candidateRes.data as any[]) ?? []).filter(s => s.candidates);

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;

  const ytdPlacements = placements.filter(p => p.start_date >= yearStart);
  const lifetimePlacements = placements.length;

  // Status counts
  const statusCount = (status: string) => placements.filter(p => p.status === status).length;
  const activeCount = ['started', 'active', 'completed_12mo']
    .reduce((s, st) => s + statusCount(st), 0);
  const sustained6 = statusCount('active') + statusCount('completed_12mo');
  const sustained12 = statusCount('completed_12mo');

  // Average salary
  const salariesWithValue = placements
    .map(p => Number(p.salary_actual))
    .filter(v => Number.isFinite(v) && v > 0);
  const avgSalary = salariesWithValue.length
    ? salariesWithValue.reduce((s, v) => s + v, 0) / salariesWithValue.length
    : null;

  // Salary band mix
  const bandCount: Record<string, number> = { volume: 0, standard: 0, premium: 0 };
  for (const p of placements) {
    if (p.salary_band && bandCount[p.salary_band] != null) bandCount[p.salary_band] += 1;
  }

  // Sponsorship totals
  const totalFee = sponsorships.reduce((s, c) => s + (Number(c.engagement_fee) || 0), 0);
  const totalSponsorships = sponsorships.reduce((s, c) => s + (Number(c.sponsorship_count) || 0), 0);

  const retentionRate6mo = lifetimePlacements > 0
    ? (sustained6 / lifetimePlacements) * 100
    : null;

  const meetingDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="max-w-4xl mx-auto print:max-w-none">
      {/* Print-suppressed nav */}
      <div className="print:hidden mb-4 flex items-center justify-between">
        <Link href={`/partners/${params.id}`} className="inline-flex items-center gap-1.5 text-[12.5px] text-ach-navy/70 hover:text-ach-navy">
          <ArrowLeft className="h-3.5 w-3.5" />Back to {partner.name}
        </Link>
        <ClientPrintBtn />
      </div>

      {/* Print-friendly cover */}
      <div className="bg-white rounded-[12px] border-[0.5px] border-ach-border p-8 print:border-0 print:rounded-none print:p-0">
        <div className="border-b-[0.5px] border-ach-border pb-5 mb-6 print:pb-3 print:mb-4">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">Meeting pack — {meetingDate}</div>
          <h1 className="text-[28px] font-medium tracking-[-0.5px] text-ach-navy leading-tight">{partner.name}</h1>
          <div className="text-[13px] text-ach-navy/70 mt-1">
            {PARTNER_TYPE_LABELS[partner.type as keyof typeof PARTNER_TYPE_LABELS] ?? partner.type}
            {partner.sector && ` · ${partner.sector}`}
            {partner.status && ` · ${partner.status}`}
          </div>
          <div className="text-[11.5px] text-ach-navy/55 mt-2">
            Prepared by ACH for your conversation with {partner.name}. Headline metrics, sponsorship summary, role mix, and active engagements.
          </div>
        </div>

        {/* Headline KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <PackStat label="Placements YTD" value={String(ytdPlacements.length)} sub={`${lifetimePlacements} lifetime`} />
          <PackStat label="Currently active" value={String(activeCount)} sub={`${sustained6} at 6mo · ${sustained12} at 12mo`} />
          <PackStat
            label="Average salary"
            value={avgSalary != null ? `£${avgSalary.toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : '—'}
            sub={salariesWithValue.length ? `n=${salariesWithValue.length}` : 'no values recorded'}
          />
          <PackStat
            label="6-month retention"
            value={retentionRate6mo != null ? `${retentionRate6mo.toFixed(0)}%` : '—'}
            sub={lifetimePlacements > 0 ? `${sustained6} of ${lifetimePlacements}` : 'no placements yet'}
          />
        </div>

        {/* Investment summary */}
        <SectionHeading>Investment</SectionHeading>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <SmallStat label="Cohorts sponsored" value={String(sponsorships.length)} />
          <SmallStat label="Candidates sponsored" value={String(totalSponsorships)} />
          <SmallStat label="Partner investment" value={`£${totalFee.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`} />
        </div>

        {sponsorships.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-0">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 border-b-[0.5px] border-ach-border">
                    <th className="px-3 py-2 font-normal">Cohort</th>
                    <th className="px-3 py-2 font-normal">Status</th>
                    <th className="px-3 py-2 font-normal">Sponsored</th>
                    <th className="px-3 py-2 font-normal text-right">Fee</th>
                    <th className="px-3 py-2 font-normal">Lead</th>
                  </tr>
                </thead>
                <tbody>
                  {sponsorships.map(s => (
                    <tr key={s.id} className="border-b-[0.5px] border-ach-border last:border-0">
                      <td className="px-3 py-2 text-ach-navy">
                        {s.cohorts?.cohort_ref ?? '—'}
                        <div className="text-[11px] text-ach-navy/55">{s.cohorts?.name}</div>
                      </td>
                      <td className="px-3 py-2 text-ach-navy/70">{s.cohorts?.status ?? '—'}</td>
                      <td className="px-3 py-2 text-ach-navy/70 tabular-nums">{s.sponsorship_count ?? 0}</td>
                      <td className="px-3 py-2 text-ach-navy/85 tabular-nums text-right">£{Number(s.engagement_fee).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>
                      <td className="px-3 py-2 text-ach-navy/70">{s.is_lead_partner ? 'Yes' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Role mix */}
        <SectionHeading>Role mix</SectionHeading>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <SmallStat label="Volume (£20–23k)" value={String(bandCount.volume)} />
          <SmallStat label="Standard (£23–28k)" value={String(bandCount.standard)} />
          <SmallStat label="Premium (£28k+)" value={String(bandCount.premium)} />
        </div>

        {/* Recent placements */}
        {placements.length > 0 && (
          <>
            <SectionHeading>Recent placements</SectionHeading>
            <Card className="mb-6">
              <CardContent className="p-0">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 border-b-[0.5px] border-ach-border">
                      <th className="px-3 py-2 font-normal">Candidate</th>
                      <th className="px-3 py-2 font-normal">Role</th>
                      <th className="px-3 py-2 font-normal">Band</th>
                      <th className="px-3 py-2 font-normal">Start</th>
                      <th className="px-3 py-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placements.slice(0, 10).map(p => (
                      <tr key={p.id} className="border-b-[0.5px] border-ach-border last:border-0">
                        <td className="px-3 py-2 text-ach-navy">
                          {p.candidates?.candidate_ref ?? '—'}
                          <div className="text-[11px] text-ach-navy/55">{p.candidates?.given_name}</div>
                        </td>
                        <td className="px-3 py-2 text-ach-navy/85">{p.role_title}</td>
                        <td className="px-3 py-2 text-ach-navy/70">{p.salary_band}</td>
                        <td className="px-3 py-2 text-ach-navy/70 tabular-nums">{p.start_date}</td>
                        <td className="px-3 py-2 text-ach-navy/70">{p.status.replace(/_/g, ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Sponsored candidates in pipeline */}
        {sponsoredCandidates.length > 0 && (
          <>
            <SectionHeading>Sponsored candidates currently in programme</SectionHeading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
              {sponsoredCandidates.slice(0, 12).map(s => (
                <div key={s.candidate_id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] border-[0.5px] border-ach-border bg-white">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-ach-navy truncate">{s.candidates?.candidate_ref} · {s.candidates?.given_name}</div>
                    <div className="text-[11px] text-ach-navy/60">{s.cohorts?.cohort_ref}</div>
                  </div>
                  <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/65 shrink-0">{s.candidates?.status}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="text-[10.5px] text-ach-navy/45 mt-8 pt-4 border-t-[0.5px] border-ach-border">
          Generated by ACH-HIM · {meetingDate} · Internal preparation document.
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2 mt-4">
      {children}
    </div>
  );
}

function PackStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[10px] bg-white border-[0.5px] border-ach-border p-3">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">{label}</div>
      <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy mt-1 leading-none">{value}</div>
      {sub && <div className="text-[10.5px] text-ach-navy/55 mt-1.5">{sub}</div>}
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-ach-page border-[0.5px] border-ach-border px-3 py-2">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">{label}</div>
      <div className="text-[16px] font-medium text-ach-navy mt-0.5 leading-none tabular-nums">{value}</div>
    </div>
  );
}

