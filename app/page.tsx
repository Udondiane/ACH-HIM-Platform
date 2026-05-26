import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AUTH_DISABLED } from '@/lib/auth/dev-bypass';

export default async function HomePage() {
  if (AUTH_DISABLED) redirect('/dashboard');

  // Best-effort role-based redirect for signed-in users.
  // If Supabase env is missing (e.g. local first-boot) we just render the landing page.
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        const role = (data as { role?: string } | null)?.role;
        if (role === 'ach_staff') redirect('/dashboard');
        if (role === 'partner')   redirect('/partner-dashboard');
        if (role === 'candidate') redirect('/candidate-dashboard');
      }
    }
  } catch {
    // Supabase not configured yet — render public landing.
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-ach-page px-6">
      <div className="max-w-xl">
        <p className="mini-label mb-3">ACH · Holistic Impact Metric</p>
        <h1
          className="font-serif italic text-ach-navy mb-5"
          style={{ fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.5px' }}
        >
          Measure what changes for a person, and what their employer made possible.
        </h1>
        <p className="text-ach-text-muted mb-8" style={{ fontSize: 14, lineHeight: 1.6 }}>
          The HIM platform is ACH's consolidated system for project-level impact measurement,
          partner reporting, pricing, and the Candidate Development Fund. Sign in to continue.
        </p>
        <Link href="/sign-in" className="btn-primary inline-flex">
          Sign in
        </Link>
        <p className="mt-12 text-ach-text-meta" style={{ fontSize: 11, letterSpacing: 0.3 }}>
          Ashley Community &amp; Housing · in partnership with Aston Business School
        </p>
      </div>
    </main>
  );
}
