'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const MIN_LENGTH = 12;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function validate(): string | null {
    if (password.length < MIN_LENGTH) {
      return `Password must be at least ${MIN_LENGTH} characters.`;
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return 'Password must include an upper-case letter, a lower-case letter, and a number.';
    }
    if (password !== confirm) {
      return 'The two passwords do not match.';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) { setError(problem); return; }

    setSubmitting(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-ach-page px-6">
      <div className="card w-full max-w-md">
        <p className="mini-label mb-3">Reset password</p>
        <h1
          className="font-serif italic text-ach-navy mb-2"
          style={{ fontSize: 28, letterSpacing: '-0.4px' }}
        >
          {success ? 'Password updated.' : 'Choose a new password.'}
        </h1>
        <p className="text-ach-text-muted mb-6" style={{ fontSize: 13, lineHeight: 1.55 }}>
          {success
            ? 'Signing you in…'
            : 'Enter a new password to complete the reset. You will be signed in automatically.'}
        </p>

        {!success && (
          <form onSubmit={handleSubmit}>
            <label className="block mb-4">
              <span className="mini-label block mb-2">New password</span>
              <input
                type="password"
                required
                autoFocus
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </label>
            <label className="block mb-3">
              <span className="mini-label block mb-2">Confirm password</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
            </label>
            <p className="text-ach-text-meta mb-5" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
              At least {MIN_LENGTH} characters, including an upper-case letter, a lower-case letter, and a number.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center"
            >
              {submitting ? 'Updating…' : 'Update password'}
            </button>
            {error && (
              <p className="mt-3 text-ach-rose-deep" style={{ fontSize: 12 }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
