import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';

const VERIFICATION_LABELS: Record<string, string> = {
  self_reported: 'Self-reported',
  pending: 'Pending audit',
  confirmed: 'Confirmed',
  partially_confirmed: 'Partially confirmed',
  not_substantiated: 'Not substantiated',
};

const VERIFICATION_TONES: Record<string, string> = {
  self_reported: 'rgba(10,31,61,0.08)',
  pending: 'rgba(232,194,94,0.15)',
  confirmed: 'rgba(60,107,71,0.15)',
  partially_confirmed: 'rgba(125,168,201,0.15)',
  not_substantiated: 'rgba(214,120,144,0.15)',
};

const AUDIT_KIND_LABELS: Record<string, string> = {
  practice_change: 'Practice change',
  policy_update: 'Policy update',
  internal_initiative: 'Internal initiative',
  narrative_quote: 'Narrative quote',
};

export async function TrainingPartnerDashboard({ partner }: { partner: any }) {
  const supabase = createClient();

  const [auditEntries, inclusionAssessments] = await Promise.all([
    supabase.from('audit_entries')
      .select('*').eq('partner_id', partner.id).order('reported_on', { ascending: false }),
    supabase.from('inclusion_assessments')
      .select('*').eq('partner_id', partner.id).order('assessed_on', { ascending: false }),
  ]);

  const entries = (auditEntries.data as any[]) ?? [];
  const assessments = (inclusionAssessments.data as any[]) ?? [];

  const confirmed = entries.filter(e => e.verification === 'confirmed').length;
  const pending = entries.filter(e => e.verification === 'pending').length;
  const selfReported = entries.filter(e => e.verification === 'self_reported').length;

  const latestInclusion = assessments[0];
  const previousInclusion = assessments[1];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Training partner"
        title={`Welcome, ${partner.name}`}
        description="Track the practice changes you've adopted, the policy updates verified by ACH audit, and your year-over-year Inclusion Assessment."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard label="Audit entries" value={String(entries.length)} sub={`${confirmed} confirmed`} />
        <KpiCard label="Pending audit" value={String(pending)} sub="awaiting ACH review" />
        <KpiCard label="Self-reported" value={String(selfReported)} sub="not yet audit-verified" />
        <KpiCard
          label="Inclusion score"
          value={latestInclusion ? overallInclusion(latestInclusion).toFixed(2) : '—'}
          sub={previousInclusion
            ? deltaLabel(overallInclusion(latestInclusion!), overallInclusion(previousInclusion))
            : 'baseline'}
        />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
                Practice change &amp; policy updates
              </div>
            </div>
            <Link href="/partner/audit-entries">
              <Button variant="secondary" size="sm">
                <ShieldCheck className="h-3.5 w-3.5" />Add entry
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-[13px] text-ach-navy/60">
              No entries yet. Once you record a practice change, policy update, or internal
              initiative, ACH can review and verify it.
            </p>
          ) : (
            <div className="space-y-3">
              {entries.slice(0, 8).map(e => (
                <div key={e.id} className="p-4 rounded-[12px] border-[0.5px] border-ach-border bg-white">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
                        {AUDIT_KIND_LABELS[e.kind] ?? e.kind}
                      </span>
                      <span
                        className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy font-medium px-2 py-0.5 rounded-full border-[0.5px] border-ach-border"
                        style={{ background: VERIFICATION_TONES[e.verification] }}
                      >
                        {VERIFICATION_LABELS[e.verification] ?? e.verification}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-ach-navy/60 shrink-0">
                      {new Date(e.reported_on).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                  <div className="text-[13px] font-medium text-ach-navy mb-1">{e.title}</div>
                  <div className="text-[12.5px] text-ach-navy/70 line-clamp-3">{e.description}</div>
                  {e.audit_notes && (
                    <div className="text-[11.5px] text-ach-navy/60 mt-2 pt-2 border-t-[0.5px] border-ach-border">
                      <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/50 mr-2">Auditor</span>
                      {e.audit_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
                Inclusion assessment (6 dimensions)
              </div>
            </div>
            <Link href="/partner/inclusion">
              <Button variant="secondary" size="sm">New period</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!latestInclusion ? (
            <p className="text-[13px] text-ach-navy/60">
              No inclusion assessments recorded yet. Complete an assessment to begin
              tracking your year-over-year inclusion scores.
            </p>
          ) : (
            <>
              <div className="text-[12px] text-ach-navy/60 mb-3">
                Latest period: <span className="text-ach-navy">{latestInclusion.period_label}</span>
                {latestInclusion.respondent_count && (
                  <span> · {latestInclusion.respondent_count} respondents</span>
                )}
              </div>
              <div className="space-y-2">
                {DIM_KEYS.map(k => {
                  const v = Number(latestInclusion[`s_${k.id}`] ?? 0);
                  const prev = previousInclusion ? Number(previousInclusion[`s_${k.id}`] ?? 0) : null;
                  return (
                    <div key={k.id}>
                      <div className="flex items-center justify-between text-[12px] mb-0.5">
                        <span className="text-ach-navy">{k.label}</span>
                        <span className="tabular-nums text-ach-navy/70">
                          {v.toFixed(2)} / 5
                          {prev !== null && (
                            <span className={`ml-2 text-[11px] ${v >= prev ? 'text-[#3C6B47]' : 'text-[#8B3A4F]'}`}>
                              {v >= prev ? '↑' : '↓'} {Math.abs(v - prev).toFixed(2)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-ach-page overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(v / 5) * 100}%`, background: 'rgba(125,168,201,0.7)' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const DIM_KEYS = [
  { id: 'economic_security', label: 'Economic Security & Stability' },
  { id: 'skill_use_growth', label: 'Skill Use & Growth' },
  { id: 'workplace_dignity', label: 'Workplace Dignity & Respect' },
  { id: 'voice_agency', label: 'Voice & Agency' },
  { id: 'social_belonging', label: 'Social Belonging & Inclusion' },
  { id: 'wellbeing_confidence', label: 'Wellbeing & Confidence' },
];

function overallInclusion(a: any): number {
  const sum = DIM_KEYS.reduce((s, k) => s + Number(a[`s_${k.id}`] ?? 0), 0);
  return sum / DIM_KEYS.length;
}

function deltaLabel(current: number, previous: number): string {
  const d = current - previous;
  if (Math.abs(d) < 0.01) return 'no change vs prior';
  return `${d > 0 ? '+' : ''}${d.toFixed(2)} vs prior`;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
        <div className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-none mt-2.5">{value}</div>
        <div className="text-[12px] text-ach-navy/60 mt-2">{sub}</div>
      </CardContent>
    </Card>
  );
}
