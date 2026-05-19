'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    }
  }

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
          Enter your email and we'll send you a magic link to sign in.
        </p>

        {status === 'sent' ? (
          <div className="card-cream">
            <p className="text-ach-text" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Check <span style={{ fontVariantNumeric: 'tabular-nums' }}>{email}</span> for a sign-in
              link. It expires in 1 hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block mb-4">
              <span className="mini-label block mb-2">Email</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.org"
              />
            </label>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="btn-primary w-full justify-center"
            >
              {status === 'sending' ? 'Sending link…' : 'Send sign-in link'}
            </button>
            {errorMsg && (
              <p
                className="mt-3 text-ach-rose-deep"
                style={{ fontSize: 12 }}
              >
                {errorMsg}
              </p>
            )}
          </form>
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
