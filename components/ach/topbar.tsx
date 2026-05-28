import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { signOutAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { AUTH_DISABLED, DEV_BYPASS_USER } from '@/lib/auth/dev-bypass';
import { LocaleSwitcher } from './locale-switcher';
import type { Locale } from '@/lib/i18n/config';

export async function AchTopbar() {
  let email: string | null = null;

  if (AUTH_DISABLED) {
    email = DEV_BYPASS_USER.email;
  } else {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      email = data.user?.email ?? null;
    } catch {
      // Supabase env missing or unreachable — render the topbar without a user.
    }
  }

  const locale = (await getLocale()) as Locale;

  return (
    <header className="h-14 border-b-[0.5px] border-ach-border bg-white px-6 flex items-center justify-end gap-3">
      <LocaleSwitcher currentLocale={locale} />
      {email && (
        <>
          <span className="text-[12px] text-ach-navy/60">{email}</span>
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
