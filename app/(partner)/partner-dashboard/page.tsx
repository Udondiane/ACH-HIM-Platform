import { CapabilityInvestorDashboard } from '@/components/partner-portal/capability-investor-dashboard';
import { WorkforcePartnerDashboard } from '@/components/partner-portal/workforce-partner-dashboard';
import { TrainingPartnerDashboard } from '@/components/partner-portal/training-partner-dashboard';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { PARTNER_TYPE_LABELS } from '@/lib/partners/schema';

export default async function PartnerDashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const partner = await resolveCurrentPartner(searchParams);

  if (!partner) {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader miniLabel="Partner workspace" title="No partner selected" />
        <Card>
          <CardContent className="pt-6 text-[13px] text-ach-navy/70">
            No partner account is linked to this session, and no <code>?as=</code> parameter was supplied.
            ACH staff: open this page from a partner&apos;s detail page using the &quot;View as this partner&quot; link.
          </CardContent>
        </Card>
      </div>
    );
  }

  const types = partner.types ?? [];
  const isMulti = types.length > 1;

  return (
    <div className="max-w-6xl mx-auto">
      {isMulti && (
        <div className="mb-6">
          <PageHeader
            miniLabel="Partner workspace"
            title={`Welcome, ${partner.name}`}
          />
          <div className="flex items-center gap-2 -mt-3 mb-1 flex-wrap">
            {types.map(t => (
              <Badge key={t} variant={t as any}>{PARTNER_TYPE_LABELS[t as keyof typeof PARTNER_TYPE_LABELS] ?? t}</Badge>
            ))}
            <span className="text-[11.5px] text-ach-navy/55 ml-1">
              You hold {types.length} relationships with ACH. Each section below covers one of them.
            </span>
          </div>
        </div>
      )}

      <div className="space-y-10">
        {types.includes('workforce_partner') && (
          <WorkforcePartnerDashboard partner={partner} hideHeader={isMulti} />
        )}
        {types.includes('capability_investor') && (
          <CapabilityInvestorDashboard partner={partner} hideHeader={isMulti} />
        )}
        {types.includes('training_partner') && (
          <TrainingPartnerDashboard partner={partner} hideHeader={isMulti} />
        )}
        {types.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-[13px] text-ach-navy/70">
              No partner type is set on this partner. An ACH admin needs to assign at least one type
              (Workforce Partner, Capability Investor, or Training Partner) for the dashboard to populate.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
