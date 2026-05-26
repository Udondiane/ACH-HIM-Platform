import { CircleDollarSign, BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { formatGbp, formatGbpDetailed, formatDate } from '@/lib/utils/format';
import { TrainingRequestRow } from '@/components/dev-fund/training-request-row';

const STATE_TONES: Record<string, 'default' | 'active' | 'paused' | 'closed' | 'prospect'> = {
  submitted: 'prospect',
  in_review: 'paused',
  approved: 'active',
  declined: 'closed',
  appealed: 'paused',
  enrolled: 'active',
  completed: 'active',
  withdrawn: 'closed',
};

const CAT_LABELS: Record<string, string> = {
  accredited_qual_l2_l5: 'Accredited L2–L5',
  sector_certification: 'Sector cert',
  language_qualification: 'Language',
  soft_skills_progression: 'Soft skills',
  pre_degree_access: 'Pre-degree access',
  ineligible: 'Ineligible',
};

export default async function DevelopmentFundPage() {
  const supabase = createClient();
  const [balanceRes, requestsRes, catalogueRes] = await Promise.all([
    supabase
      .from('development_fund_balances')
      .select('candidate_id, total_credited, total_spent, total_match_funding, candidates(candidate_ref, given_name, family_name, status)')
      .order('total_credited', { ascending: false }),
    supabase
      .from('training_requests')
      .select('id, candidate_id, training_id, custom_title, custom_provider, custom_cost, career_rationale, state, review_notes, created_at, candidates(candidate_ref), training_catalogue(title, provider, total_cost)')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('training_catalogue')
      .select('id, provider, title, category, level, duration_weeks, total_cost, is_active')
      .eq('is_active', true)
      .order('provider'),
  ]);

  const balances = (balanceRes.data as any[]) ?? [];
  const requests = (requestsRes.data as any[]) ?? [];
  const catalogue = (catalogueRes.data as any[]) ?? [];

  const totals = balances.reduce(
    (acc, b) => {
      acc.credited += Number(b.total_credited ?? 0);
      acc.spent += Number(b.total_spent ?? 0);
      acc.match += Number(b.total_match_funding ?? 0);
      return acc;
    },
    { credited: 0, spent: 0, match: 0 },
  );
  const available = totals.credited + totals.match - totals.spent;

  const pendingRequests = requests.filter(r => r.state === 'submitted' || r.state === 'in_review' || r.state === 'appealed');

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Operations"
        title="Candidate Development Fund"
        description="Spec §14 — retention milestone payments ringfenced for candidate-led development training. Approve, decline, or appeal training requests."
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
        <Stat label="Total credited" value={formatGbp(totals.credited)} subline="from milestones + match" />
        <Stat label="Total spent" value={formatGbp(totals.spent)} subline={`across ${balances.length} candidates`} />
        <Stat label="Available fund" value={formatGbp(available)} subline="credited − spent" />
        <Stat label="Pending requests" value={String(pendingRequests.length)} subline="awaiting decision" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Training requests</div>
          </CardHeader>
          <CardContent className="pt-0">
            {requests.length === 0 ? (
              <EmptyState
                icon={<CircleDollarSign className="h-8 w-8" />}
                title="No requests yet"
                description="Candidate-led training requests will appear here once submitted."
              />
            ) : (
              <div className="space-y-2.5">
                {requests.map(r => (
                  <TrainingRequestRow
                    key={r.id}
                    request={{
                      id: r.id,
                      title: r.training_catalogue?.title ?? r.custom_title ?? 'Custom training',
                      provider: r.training_catalogue?.provider ?? r.custom_provider ?? '—',
                      cost: Number(r.training_catalogue?.total_cost ?? r.custom_cost ?? 0),
                      candidateRef: r.candidates?.candidate_ref ?? '—',
                      state: r.state,
                      rationale: r.career_rationale ?? '',
                      reviewNotes: r.review_notes ?? '',
                      stateVariant: STATE_TONES[r.state] ?? 'default',
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Per-candidate balances</div>
            </CardHeader>
            <CardContent className="pt-0">
              {balances.length === 0 ? (
                <p className="text-[13px] text-ach-navy/60 py-4">No candidate balances yet.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b-[0.5px] border-ach-border">
                      <Th>Candidate</Th>
                      <Th className="text-right">Credited</Th>
                      <Th className="text-right">Spent</Th>
                      <Th className="text-right">Available</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map(b => {
                      const credit = Number(b.total_credited ?? 0);
                      const match = Number(b.total_match_funding ?? 0);
                      const spent = Number(b.total_spent ?? 0);
                      const avail = credit + match - spent;
                      return (
                        <tr key={b.candidate_id} className="border-b-[0.5px] border-ach-border last:border-0">
                          <Td>
                            <div className="text-ach-navy font-medium">{b.candidates?.candidate_ref ?? '—'}</div>
                            <div className="text-[11px] text-ach-navy/50">{b.candidates?.status ?? ''}</div>
                          </Td>
                          <Td className="text-right tabular-nums text-ach-navy/80">{formatGbpDetailed(credit + match)}</Td>
                          <Td className="text-right tabular-nums text-ach-navy/80">{formatGbpDetailed(spent)}</Td>
                          <Td className="text-right tabular-nums font-medium text-ach-navy">{formatGbpDetailed(avail)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Training catalogue</div>
                <BookOpen className="h-4 w-4 text-ach-navy/40" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {catalogue.length === 0 ? (
                <p className="text-[13px] text-ach-navy/60 py-4">Catalogue is empty.</p>
              ) : (
                <div className="space-y-2">
                  {catalogue.slice(0, 10).map(t => (
                    <div key={t.id} className="flex items-start justify-between gap-3 py-2 border-b-[0.5px] border-ach-border last:border-0">
                      <div className="min-w-0">
                        <div className="text-[13px] text-ach-navy font-medium">{t.title}</div>
                        <div className="text-[11px] text-ach-navy/60">{t.provider} · {t.level ?? '—'} · {t.duration_weeks ?? '—'} wks</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[13px] text-ach-navy tabular-nums">{formatGbpDetailed(t.total_cost)}</div>
                        <Badge>{CAT_LABELS[t.category] ?? t.category}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, subline }: { label: string; value: string; subline?: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className="text-[22px] font-medium tracking-[-0.5px] text-ach-navy mt-2 leading-none tabular-nums">{value}</div>
      {subline && <div className="text-[11px] text-ach-navy/60 mt-2">{subline}</div>}
    </Card>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2 ${className}`}>{children}</td>;
}
