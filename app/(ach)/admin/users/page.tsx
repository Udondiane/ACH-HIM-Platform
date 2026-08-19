import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { requireUser } from '@/lib/supabase/auth';
import { canManageUsers } from '@/lib/auth/capabilities';
import { createServiceClient } from '@/lib/supabase/server';
import { UsersConsole } from '@/components/admin/users-console';
import type { AchTeamRole } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const user = await requireUser(['ach_staff']);

  if (!canManageUsers(user)) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader
          miniLabel="Administration"
          title="User management"
        />
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-[#8B3A4F] shrink-0 mt-0.5" />
              <div className="text-[13px] text-ach-navy/80">
                <p className="font-medium text-ach-navy mb-1">Access restricted.</p>
                <p>User administration is available to the ICT administrator role only. If you require access, contact your ICT team.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = createServiceClient();

  // Pull the auth.users list (email, sign-in timestamp) and the
  // application-side user_roles table (role + team_role) and join
  // them on user_id in memory.
  const [{ data: authList }, { data: roleRows }] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase.from('user_roles').select('user_id, role, team_role, created_at').eq('role', 'ach_staff'),
  ]);

  const roleByUserId = new Map(
    ((roleRows as any[]) ?? []).map(r => [
      r.user_id as string,
      { team_role: r.team_role as AchTeamRole | null, created_at: r.created_at as string },
    ]),
  );

  const users = ((authList?.users ?? [])
    .filter(u => roleByUserId.has(u.id))
    .map(u => {
      const meta = roleByUserId.get(u.id)!;
      return {
        user_id: u.id,
        email: u.email ?? null,
        team_role: meta.team_role,
        created_at: meta.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      };
    }))
    .sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        miniLabel="Administration"
        title="User management"
        description="Invite new colleagues, adjust the team role assigned to an existing user, or deactivate access. Team role controls which parts of HIM each user can see and change."
      />
      <UsersConsole users={users} currentUserId={user.id} />
    </div>
  );
}
