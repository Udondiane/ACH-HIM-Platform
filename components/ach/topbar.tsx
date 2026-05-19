import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOutAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';

export async function AchTopbar() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <header className="h-14 border-b-[0.5px] border-ach-border bg-white px-6 flex items-center justify-end gap-3">
      {user && (
        <>
          <span className="text-[12px] text-ach-navy/60">{user.email}</span>
          <form action={signOutAction}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </>
      )}
    </header>
  );
}
