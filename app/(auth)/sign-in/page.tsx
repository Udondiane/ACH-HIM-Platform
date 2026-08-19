'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Step = 'credentials' | 'mfa' | 'reset-request-sent';

export default function SignInPage() {
  const router = useRouter();
  const search = useSearchParams();
  const nextUrl = search?.get('next') ?? '/dashboard';
  const pending = search?.get('pending') === 'true';

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (signInError) throw signInError;
      if (!signInData.user) throw new Error('Sign-in did not return a user.');

      // Does the user have a verified MFA factor?
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = factorsData?.totp?.find(f => f.status === 'verified');

      if (verifiedTotp) {
        const { data: challengeData, error: challengeError } =
          await supabase.auth.mfa.challenge({ factorId: verifiedTotp.id });
        if (challengeError) throw challengeError;
        setMfaFactorId(verifiedTotp.id);
        setMfaChallengeId(challengeData.id);
        setStep('mfa');
        setSubmitting(false);
        return;
      }

      // No MFA — check if this is a first sign-in that still needs password setup
      const meta = signInData.user.user_metadata as { needs_password_setup?: boolean };
      if (meta?.needs_password_setup) {
        router.push('/set-password');
        return;
      }

      router.push(nextUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId) return;
    setSubmitting(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;
      router.push(nextUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email address first, then click Forgot password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?flow=reset`,
      });
      if (resetError) throw resetError;
      setStep('reset-request-sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setSubmitting(false);
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
          {step === 'mfa' ? 'Verify your identity.' :
           step === 'reset-request-sent' ? 'Check your inbox.' :
           'Sign in.'}
        </h1>
        <p className="text-ach-text-muted mb-6" style={{ fontSize: 13 }}>
          {step === 'mfa' ? 'Enter the six-digit code from your authenticator app.' :
           step === 'reset-request-sent' ? `A password reset link has been sent to ${email}. The link expires in 60 minutes.` :
           'Use your work email and password to continue.'}
        </p>

        {pending && step === 'credentials' && (
          <div className="card-cream mb-5">
            <p className="text-ach-text" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              Your account is set up but has no role assigned yet. Contact your ICT administrator to arrange access.
            </p>
          </div>
        )}

        {step === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit}>
            <label className="block mb-4">
              <span className="mini-label block mb-2">Email</span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@ach.org.uk"
              />
            </label>
            <label className="block mb-4">
              <span className="mini-label block mb-2">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={submitting}
                className="text-ach-text-muted underline"
                style={{ fontSize: 12 }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {step === 'mfa' && (
          <form onSubmit={handleMfaSubmit}>
            <label className="block mb-4">
              <span className="mini-label block mb-2">Six-digit code</span>
              <input
                type="text"
                required
                autoFocus
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: 18 }}
              />
            </label>
            <button
              type="submit"
              disabled={submitting || mfaCode.length !== 6}
              className="btn-primary w-full justify-center"
            >
              {submitting ? 'Verifying…' : 'Verify'}
            </button>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setStep('credentials'); setMfaCode(''); setError(''); }}
                className="text-ach-text-muted underline"
                style={{ fontSize: 12 }}
              >
                ← Use a different account
              </button>
            </div>
          </form>
        )}

        {error && (
          <p className="mt-3 text-ach-rose-deep" style={{ fontSize: 12 }}>
            {error}
          </p>
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
