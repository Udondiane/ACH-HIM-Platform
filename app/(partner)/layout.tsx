import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PartnerSidebar } from '@/components/partner-portal/sidebar';
import { PartnerTopbar } from '@/components/partner-portal/topbar';
import { ImpersonationBanner } from '@/components/partner-portal/impersonation-banner';
import { resolveCurrentPartner } from '@/lib/partners/resolve-current';
import { AUTH_DISABLED } from '@/lib/auth/dev-bypass';

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userEmail: string | null = null;

  if (!AUTH_DISABLED) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/sign-in');
    userEmail = user.email ?? null;
  }

  // Layout cannot read searchParams in Next.js; the resolver falls back to
  // the ach_view_as cookie that middleware persists from the ?as= query.
  const partner = await resolveCurrentPartner();

  return (
    <div className="min-h-screen flex bg-ach-page">
      <PartnerSidebar partner={partner} />
      <div className="flex-1 flex flex-col min-w-0">
        <PartnerTopbar partner={partner} userEmail={userEmail} />
        {partner?.isImpersonating && (
          <ImpersonationBanner partnerName={partner.name} partnerId={partner.id} />
        )}
        <main className="flex-1 p-8 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
