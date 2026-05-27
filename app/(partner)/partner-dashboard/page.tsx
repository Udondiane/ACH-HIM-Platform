import { CapabilityInvestorDashboard } from '@/components/partner-portal/capability-investor-dashboard';
import { WorkforcePartnerDashboard } from '@/components/partner-portal/workforce-partner-dashboard';
import { TrainingPartnerDashboard } from '@/components/partner-portal/training-partner-dashboard';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';

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

  if (partner.type === 'capability_investor') return <CapabilityInvestorDashboard partner={partner} />;
  if (partner.type === 'workforce_partner')   return <WorkforcePartnerDashboard   partner={partner} />;
  if (partner.type === 'training_partner')    return <TrainingPartnerDashboard    partner={partner} />;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader miniLabel="Partner workspace" title={partner.name} description={`Unsupported partner type: ${partner.type}`} />
    </div>
  );
}
