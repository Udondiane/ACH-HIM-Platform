import { createClient } from '@/lib/supabase/server';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ShieldCheck } from 'lucide-react';

const KIND_LABELS: Record<string, string> = {
  practice_change:     'Practice change',
  policy_update:       'Policy update',
  internal_initiative: 'Internal initiative',
  narrative_quote:     'Narrative quote',
};

const VERIFICATION_LABELS: Record<string, string> = {
  self_reported:        'Self-reported',
  confirmed:            'Independently confirmed',
  partially_confirmed:  'Partially confirmed',
  not_substantiated:    'Not substantiated',
  pending:              'Pending review',
};

export default async function PartnerAuditEntriesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);
  if (!partner) return null;

  const supabase = createClient();
  const { data: entries } = await supabase
    .from('audit_entries')
    .select('*')
    .eq('partner_id', partner.id)
    .order('created_at', { ascending: false });

  const rows = (entries as any[]) ?? [];
  const counts = {
    practice_change: rows.filter(r => r.kind === 'practice_change').length,
    policy_update: rows.filter(r => r.kind === 'policy_update').length,
    internal_initiative: rows.filter(r => r.kind === 'internal_initiative').length,
    narrative_quote: rows.filter(r => r.kind === 'narrative_quote').length,
  };
  const confirmedCount = rows.filter(r => r.verification === 'confirmed').length;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Audit entries"
        title="Practice change audit"
        description="Record changes you have made to your hiring, training, or organisational practices. ACH may independently verify a subset of entries for inclusion in your evidence pack."
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
        <Kpi label="Practice changes" value={String(counts.practice_change)} />
        <Kpi label="Policy updates" value={String(counts.policy_update)} />
        <Kpi label="Initiatives" value={String(counts.internal_initiative)} />
        <Kpi label="Confirmed entries" value={`${confirmedCount}/${rows.length - counts.narrative_quote}`} sub="independently verified" />
      </div>

      <Card className="mb-5">
        <CardContent className="pt-6 text-[13px] text-ach-navy/80 max-w-prose">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">How verification works</div>
          <p className="mb-3">
            Audit entries start as <span className="font-medium">Self-reported</span>. ACH reviews evidence (policies, internal comms, training logs, photos, screenshots) and updates the verification status to <span className="font-medium">Independently confirmed</span> or, where evidence is partial, to <span className="font-medium">Partially confirmed</span>.
          </p>
          <p>
            Only confirmed entries appear in your evidence pack. Narrative quotes are exempt from verification — they sit alongside the audited evidence as colour.
          </p>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck className="h-10 w-10" />}
            title="No audit entries yet"
            description="Practice changes, policy updates, and internal initiatives will appear here once recorded."
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {rows.map(r => (
                <div key={r.id} className="border-b-[0.5px] border-ach-border pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="text-[14px] font-medium text-ach-navy">{r.title}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge>{KIND_LABELS[r.kind] ?? r.kind}</Badge>
                      <Badge variant={r.verification === 'confirmed' ? 'active' : 'default'}>
                        {VERIFICATION_LABELS[r.verification] ?? r.verification}
                      </Badge>
                    </div>
                  </div>
                  {r.description && (
                    <p className="text-[12.5px] text-ach-navy/75 mt-1.5 whitespace-pre-wrap">{r.description}</p>
                  )}
                  <div className="text-[11.5px] text-ach-navy/55 mt-2 flex items-center gap-3 flex-wrap">
                    <span>Logged {new Date(r.created_at).toLocaleDateString('en-GB')}</span>
                    {r.evidence_url && (
                      <a href={r.evidence_url} target="_blank" rel="noreferrer" className="underline">View evidence</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
        <div className="text-[24px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5 tabular-nums">{value}</div>
        {sub && <div className="text-[12px] text-ach-navy/60 mt-2">{sub}</div>}
      </CardContent>
    </Card>
  );
}
