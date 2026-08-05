'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function SignInPage() {
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard';
  const externalIdEnabled = process.env.NEXT_PUBLIC_EXTERNAL_ID_ENABLED === 'true';

  return (
    <main className="min-h-screen flex items-center justify-center bg-ach-page px-6">
      <div className="card w-full max-w-md">
        <p className="mini-label mb-3">Sign in</p>
        <h1
          className="font-serif italic text-ach-navy mb-2"
          style={{ fontSize: 28, letterSpacing: '-0.4px' }}
        >
          Welcome back.
        </h1>
        <p className="text-ach-text-muted mb-6" style={{ fontSize: 13 }}>
          ACH staff and Microsoft-account partners sign in with Microsoft.
          {externalIdEnabled ? ' Partners without Microsoft can use the email code option below.' : ''}
        </p>

        <button
          onClick={() => signIn('microsoft-entra-id', { callbackUrl })}
          className="btn-primary w-full justify-center flex items-center gap-2"
        >
          <MicrosoftLogo />
          Continue with Microsoft
        </button>

        {externalIdEnabled && (
          <>
            <div className="flex items-center gap-2 my-4 text-[11px] text-ach-text-muted uppercase tracking-widest">
              <span className="flex-1 h-px bg-ach-navy/10" />
              or
              <span className="flex-1 h-px bg-ach-navy/10" />
            </div>
            <button
              onClick={() => signIn('entra-external-id', { callbackUrl })}
              className="btn-secondary w-full justify-center"
            >
              Email me a one-time code
            </button>
            <p className="text-[11px] text-ach-text-muted mt-2 text-center">
              For partners without a work Microsoft account.
            </p>
          </>
        )}

        <div
          className="mt-8 pt-6"
          style={{ borderTop: '0.5px solid var(--ach-border)' }}
        >
          <Link
            href="/"
            className="text-ach-text-muted"
            style={{ fontSize: 12 }}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

function MicrosoftLogo() {
  // Inline SVG — no external asset dep.
  return (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}
