/**
 * Translation tiering policy
 * ──────────────────────────
 * Per ACH guidance (May 2026), translations are tiered by review status:
 *
 *   Tier A — source of truth
 *     en (English)
 *
 *   Tier B — machine-translated, pending native review
 *     ar (Arabic), fr (French), es (Spanish), uk (Ukrainian)
 *     All strings marked { "reviewed": false }
 *
 *   Tier C — needs native review (untranslated, English fallback shown
 *            with a per-page banner directing user to caseworker/English)
 *     fa (Farsi/Dari), ps (Pashto), ti (Tigrinya), so (Somali),
 *     ckb (Kurdish Sorani), sq (Albanian)
 *
 * The locale switcher exposes all locales. Tier-C locales render with
 * an English fallback and an in-page banner using the one human-reviewed
 * sentence stored in messages/<locale>/banner.json.
 */

export const locales = [
  'en',  // Tier A — source
  'ar',  // Tier B — machine, RTL
  'fr',  // Tier B — machine
  'es',  // Tier B — machine
  'uk',  // Tier B — machine
  'fa',  // Tier C — needs native review, RTL
  'ps',  // Tier C — needs native review, RTL
  'ti',  // Tier C — needs native review
  'so',  // Tier C — needs native review
  'ckb', // Tier C — needs native review, RTL
  'sq',  // Tier C — needs native review
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeMeta: Record<Locale, {
  label: string;       // native name
  englishLabel: string;
  dir: 'ltr' | 'rtl';
  tier: 'A' | 'B' | 'C';
}> = {
  en:  { label: 'English',          englishLabel: 'English',          dir: 'ltr', tier: 'A' },
  ar:  { label: 'العربية',           englishLabel: 'Arabic',           dir: 'rtl', tier: 'B' },
  fr:  { label: 'Français',         englishLabel: 'French',           dir: 'ltr', tier: 'B' },
  es:  { label: 'Español',          englishLabel: 'Spanish',          dir: 'ltr', tier: 'B' },
  uk:  { label: 'Українська',       englishLabel: 'Ukrainian',        dir: 'ltr', tier: 'B' },
  fa:  { label: 'فارسی / دری',       englishLabel: 'Farsi / Dari',     dir: 'rtl', tier: 'C' },
  ps:  { label: 'پښتو',              englishLabel: 'Pashto',           dir: 'rtl', tier: 'C' },
  ti:  { label: 'ትግርኛ',              englishLabel: 'Tigrinya',         dir: 'ltr', tier: 'C' },
  so:  { label: 'Soomaali',         englishLabel: 'Somali',           dir: 'ltr', tier: 'C' },
  ckb: { label: 'کوردیی سۆرانی',     englishLabel: 'Kurdish Sorani',   dir: 'rtl', tier: 'C' },
  sq:  { label: 'Shqip',            englishLabel: 'Albanian',         dir: 'ltr', tier: 'C' },
};

export function isRtl(locale: Locale): boolean {
  return localeMeta[locale].dir === 'rtl';
}

export function tierOf(locale: Locale): 'A' | 'B' | 'C' {
  return localeMeta[locale].tier;
}
