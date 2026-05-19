import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AchSidebar } from '@/components/ach/sidebar';
import { AchTopbar } from '@/components/ach/topbar';

export default async function AchLayout({ children }: { children: React.ReactNode }) {
  // Auth-gate: must be ACH staff to enter this segment.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const role = roleRow as { role: string } | null;
  if (!role || role.role !== 'ach_staff') {
    // Soft fallback: send to whichever workspace they belong to.
    if (role?.role === 'partner') redirect('/partner-dashboard');
    if (role?.role === 'candidate') redirect('/candidate-dashboard');
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen flex bg-ach-page">
      <AchSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AchTopbar />
        <main className="flex-1 p-8 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
