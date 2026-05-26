import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CapabilityInvestorDashboard } from '@/components/partner-portal/capability-investor-dashboard';
import { WorkforcePartnerDashboard } from '@/components/partner-portal/workforce-partner-dashboard';
import { TrainingPartnerDashboard } from '@/components/partner-portal/training-partner-dashboard';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { AUTH_DISABLED } from '@/lib/auth/dev-bypass';

export default async function PartnerDashboardPage() {
  if (AUTH_DISABLED) redirect('/dashboard');

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: roleRow } = await supabase
    .from('user_roles').select('partner_id').eq('user_id', user.id).maybeSingle();
  const partnerId = (roleRow as { partner_id?: string } | null)?.partner_id;

  if (!partnerId) {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader miniLabel="Partner workspace" title="No partner linked to your account" />
        <Card>
          <CardContent className="pt-6 text-[13px] text-ach-navy/70">
            Your account isn&apos;t linked to a partner yet. Please contact ACH staff and ask them
            to set up your access on the Partners screen.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: partner } = await supabase
    .from('partners').select('*').eq('id', partnerId).maybeSingle();
  const p = partner as any;
  if (!p) {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader miniLabel="Partner workspace" title="Partner record not found" />
      </div>
    );
  }

  if (p.type === 'capability_investor') return <CapabilityInvestorDashboard partner={p} />;
  if (p.type === 'workforce_partner')   return <WorkforcePartnerDashboard   partner={p} />;
  if (p.type === 'training_partner')    return <TrainingPartnerDashboard    partner={p} />;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader miniLabel="Partner workspace" title={p.name} description={`Unsupported partner type: ${p.type}`} />
    </div>
  );
}
