import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PartnerTokenLandingPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from('partner_access_tokens')
    .select('id, partner_id, project_id, label, expires_at, revoked_at, partners(id, name)')
    .eq('token', params.token)
    .maybeSingle();

  if (!tokenRow) notFound();
  const t = tokenRow as any;
  if (t.revoked_at) return <RevokedOrExpired reason="revoked" />;
  if (t.expires_at && new Date(t.expires_at) < new Date()) return <RevokedOrExpired reason="expired" />;

  await supabase
    .from('partner_access_tokens')
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq('id', t.id);

  const { data: placementsRes } = await supabase
    .from('placements')
    .select('id, role_title, start_date, status, candidates(candidate_ref, given_name, family_name)')
    .eq('partner_id', t.partner_id)
    .order('start_date', { ascending: false });
  const placements = (placementsRes as any[]) ?? [];

  const partnerName = t.partners?.name ?? 'Your organisation';

  return (
    <div className="min-h-screen bg-ach-page">
      <div className="max-w-3xl mx-auto p-8">
        <div className="mb-6">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">ACH — {partnerName}</div>
          <h1 className="text-[22px] text-ach-navy mt-1">Timepoint reports</h1>
          <p className="text-[13px] text-ach-navy/70 mt-2">
            Thank you for taking the time to record your observations of each candidate you hosted through ACH's Bridge to Employment programme. Your reports feed directly into the outcome evidence we share with funders and use to improve the programme.
          </p>
          {t.label && (
            <p className="text-[12px] text-ach-navy/55 mt-2">Signed in as: <span className="text-ach-navy/75">{t.label}</span></p>
          )}
        </div>

        <div className="rounded-[14px] border-[0.5px] border-ach-border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b-[0.5px] border-ach-border">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Your candidates</div>
            <div className="text-[11.5px] text-ach-navy/55 mt-0.5">Click a candidate to fill in or update their 3-month, 6-month, or 12-month report.</div>
          </div>
          {placements.length === 0 ? (
            <div className="px-4 py-6 text-[12.5px] text-ach-navy/60">No placements have been recorded for {partnerName} yet.</div>
          ) : (
            <ul>
              {placements.map(p => {
                const c = p.candidates;
                const name = c ? `${c.given_name ?? ''} ${c.family_name ?? ''}`.trim() || c.candidate_ref : '—';
                return (
                  <li key={p.id} className="border-b-[0.5px] border-ach-border last:border-0">
                    <Link
                      href={`/report/${params.token}/placement/${p.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-ach-page/50"
                    >
                      <div>
                        <div className="text-[13.5px] text-ach-navy">{name}</div>
                        <div className="text-[11.5px] text-ach-navy/60 mt-0.5">
                          {p.role_title ?? '—'} · Started {p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'} · {p.status}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-ach-navy/40" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="text-[11px] text-ach-navy/50 mt-6">
          This is a private link. Please do not forward — request an additional link if a colleague also needs to submit reports.
        </p>
      </div>
    </div>
  );
}

function RevokedOrExpired({ reason }: { reason: 'revoked' | 'expired' }) {
  return (
    <div className="min-h-screen bg-ach-page flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Access {reason}</div>
        <h1 className="text-[18px] text-ach-navy mt-2">This link is no longer active</h1>
        <p className="text-[13px] text-ach-navy/70 mt-3">
          Please contact your ACH programme lead to request a new access link.
        </p>
      </div>
    </div>
  );
}
