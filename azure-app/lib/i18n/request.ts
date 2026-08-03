import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { locales, defaultLocale, type Locale } from './config';

function resolveLocale(): Locale {
  const cookieLocale = cookies().get('ach_locale')?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as Locale;
  }
  const acceptLang = headers().get('accept-language') ?? '';
  for (const part of acceptLang.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase();
    if (!tag) continue;
    const primary = tag.split('-')[0];
    if ((locales as readonly string[]).includes(primary)) {
      return primary as Locale;
    }
  }
  return defaultLocale;
}

/* Deep merge: locale-specific values override English source, but
   missing keys in the locale file fall through to English. Lets us
   add partial translations (e.g. Arabic gets the full assessment
   namespace; other Tier B locales still show English for that
   namespace without throwing). */
function deepMerge(base: any, overlay: any): any {
  if (overlay == null) return base;
  if (typeof overlay !== 'object' || Array.isArray(overlay)) return overlay;
  const out: any = { ...base };
  for (const k of Object.keys(overlay)) {
    if (k.startsWith('__')) continue; // skip metadata keys
    if (typeof overlay[k] === 'object' && !Array.isArray(overlay[k]) && overlay[k] !== null) {
      out[k] = deepMerge(base?.[k] ?? {}, overlay[k]);
    } else if (overlay[k] !== '' && overlay[k] !== null && overlay[k] !== undefined) {
      out[k] = overlay[k];
    }
  }
  return out;
}

export default getRequestConfig(async () => {
  const locale = resolveLocale();
  const enMessages = (await import(`../../messages/en/common.json`)).default;
  let messages = enMessages;

  if (locale !== 'en') {
    try {
      const loaded = (await import(`../../messages/${locale}/common.json`)).default as Record<string, unknown>;
      if (loaded?.__stub === true) {
        messages = enMessages;
      } else {
        // Deep-merge so missing keys fall back to English transparently
        messages = deepMerge(enMessages, loaded);
      }
    } catch {
      messages = enMessages;
    }
  }

  return { locale, messages };
});
