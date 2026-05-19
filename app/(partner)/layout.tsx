import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PartnerSidebar } from '@/components/partner-portal/sidebar';
import { PartnerTopbar } from '@/components/partner-portal/topbar';

export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: roleRow } = await supabase
    .from('user_roles').select('role, partner_id').eq('user_id', user.id).maybeSingle();
  const r = roleRow as { role: string; partner_id: string | null } | null;

  if (!r) redirect('/sign-in');
  if (r.role === 'ach_staff') redirect('/dashboard');
  if (r.role === 'candidate') redirect('/candidate-dashboard');
  if (r.role !== 'partner') redirect('/sign-in');

  // Pull partner basics for the topbar/sidebar
  const { data: partnerRow } = r.partner_id
    ? await supabase.from('partners').select('id, name, type').eq('id', r.partner_id).maybeSingle()
    : { data: null };
  const partner = partnerRow as { id: string; name: string; type: string } | null;

  return (
    <div className="min-h-screen flex bg-ach-page">
      <PartnerSidebar partner={partner} />
      <div className="flex-1 flex flex-col min-w-0">
        <PartnerTopbar partner={partner} userEmail={user.email ?? null} />
        <main className="flex-1 p-8 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
