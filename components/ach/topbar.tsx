import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOutAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { AUTH_DISABLED, DEV_BYPASS_USER } from '@/lib/auth/dev-bypass';

export async function AchTopbar() {
  let user: { email: string | null } | null = null;

  if (AUTH_DISABLED) {
    user = { email: DEV_BYPASS_USER.email };
  } else {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      // Supabase env missing or unreachable — render the topbar without a user.
    }
  }

  return (
    <header className="h-14 border-b-[0.5px] border-ach-border bg-white px-6 flex items-center justify-end gap-3">
      {user && (
        <>
          <span className="text-[12px] text-ach-navy/60">{user.email}</span>
          {!AUTH_DISABLED && (
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          )}
        </>
      )}
    </header>
  );
}
