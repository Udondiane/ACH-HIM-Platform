import { requireUser } from '@/lib/supabase/auth';
import { getLocale } from 'next-intl/server';
import { localeMeta, type Locale } from '@/lib/i18n/config';
import { getMessages } from 'next-intl/server';

export default async function CandidateDashboard() {
  const locale = (await getLocale()) as Locale;
  const tier = localeMeta[locale]?.tier ?? 'A';

  let userEmail: string | null = null;
  try {
    const u = await requireUser(['candidate']);
    userEmail = u.email;
  } catch {
    /* placeholder */
  }

  // Pull the banner sentence — for Tier C this is the one human-reviewed string.
  const messages = (await getMessages()) as {
    banner?: { translationPending?: string };
  };
  const bannerText = messages?.banner?.translationPending ?? '';

  return (
    <main className="max-w-3xl mx-auto p-8">
      {tier === 'C' && bannerText && (
        <div
          className="card-cream mb-6"
          style={{ borderLeft: '3px solid var(--ach-honey)' }}
        >
          <p className="mini-label mb-2">Notice</p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{bannerText}</p>
        </div>
      )}
      <p className="mini-label mb-3">My workspace</p>
      <h1
        className="font-serif italic text-ach-navy mb-4"
        style={{ fontSize: 36, letterSpacing: '-0.5px' }}
      >
        Welcome.
      </h1>
      <p
        className="text-ach-text-muted mb-8"
        style={{ fontSize: 14, lineHeight: 1.6, maxWidth: '60ch' }}
      >
        Your assessment, your Development Fund, and your consent settings live here. The full
        candidate surface is built in session 8 with multilingual support.
      </p>
      {userEmail && (
        <p className="text-ach-text-meta" style={{ fontSize: 12 }}>
          Signed in as {userEmail}
        </p>
      )}
    </main>
  );
}
