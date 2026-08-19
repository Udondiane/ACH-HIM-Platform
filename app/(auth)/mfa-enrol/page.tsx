'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Stage = 'loading' | 'ready' | 'verifying' | 'done';

export default function MfaEnrolPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        // If the user already has a verified factor, skip straight through.
        const { data: existing } = await supabase.auth.mfa.listFactors();
        if (existing?.totp?.some(f => f.status === 'verified')) {
          router.push('/dashboard');
          return;
        }
        // Clean up any unverified factor from a previous attempt.
        for (const f of existing?.totp ?? []) {
          if (f.status !== 'verified') {
            await supabase.auth.mfa.unenroll({ factorId: f.id });
          }
        }
        const { data, error: enrolError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
        });
        if (enrolError) throw enrolError;
        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setStage('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start enrolment.');
        setStage('ready');
      }
    })();
  }, [router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setStage('verifying');
    setError('');
    try {
      const supabase = createClient();
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;
      setStage('done');
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
      setStage('ready');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-ach-page px-6">
      <div className="card w-full max-w-lg">
        <p className="mini-label mb-3">Secure your account</p>
        <h1
          className="font-serif italic text-ach-navy mb-2"
          style={{ fontSize: 28, letterSpacing: '-0.4px' }}
        >
          {stage === 'done' ? 'Multi-factor enabled.' : 'Set up multi-factor authentication.'}
        </h1>
        <p className="text-ach-text-muted mb-6" style={{ fontSize: 13, lineHeight: 1.55 }}>
          {stage === 'done'
            ? 'Redirecting you to the dashboard…'
            : 'Multi-factor authentication protects your account if your password is ever compromised. You will need an authenticator app such as Microsoft Authenticator, Google Authenticator, or 1Password.'}
        </p>

        {stage === 'loading' && (
          <p className="text-ach-text-muted" style={{ fontSize: 12.5 }}>Preparing enrolment…</p>
        )}

        {(stage === 'ready' || stage === 'verifying') && qrCode && (
          <>
            <div className="rounded-[12px] border-[0.5px] border-ach-border bg-white p-4 flex flex-col items-center gap-4">
              {/* Supabase returns qr_code as an SVG data URL — safe to embed as an image src */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="Authenticator QR code" width={200} height={200} />
              {secret && (
                <div className="text-center">
                  <p className="mini-label mb-1">Or enter the code manually</p>
                  <code className="text-[12px] tracking-widest text-ach-navy bg-ach-page px-2 py-1 rounded">
                    {secret}
                  </code>
                </div>
              )}
            </div>

            <form onSubmit={handleVerify} className="mt-6">
              <label className="block mb-4">
                <span className="mini-label block mb-2">Enter the six-digit code from your app</span>
                <input
                  type="text"
                  required
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: 18 }}
                />
              </label>
              <button
                type="submit"
                disabled={stage === 'verifying' || code.length !== 6}
                className="btn-primary w-full justify-center"
              >
                {stage === 'verifying' ? 'Verifying…' : 'Verify and finish'}
              </button>
              <div className="mt-4 text-center">
                <Link
                  href="/dashboard"
                  className="text-ach-text-muted underline"
                  style={{ fontSize: 12 }}
                >
                  Skip for now
                </Link>
                <p className="text-ach-text-meta mt-2" style={{ fontSize: 11 }}>
                  You can set this up later from your account settings. Setting it up now is strongly recommended.
                </p>
              </div>
            </form>
          </>
        )}

        {error && (
          <p className="mt-4 text-ach-rose-deep" style={{ fontSize: 12 }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
