import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { locales, defaultLocale, type Locale } from './config';

function resolveLocale(): Locale {
  // 1. Cookie preference (set by language switcher / user prefs)
  const cookieLocale = cookies().get('ach_locale')?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as Locale;
  }
  // 2. Accept-Language header (best effort)
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

export default getRequestConfig(async () => {
  const locale = resolveLocale();

  // Load English as ultimate fallback, plus the requested locale.
  // Tier-C locales return the English message bundle (i.e. show English
  // strings) while UI still renders the language switcher / banner.
  const enMessages = (await import(`../../messages/en/common.json`)).default;
  let messages = enMessages;

  if (locale !== 'en') {
    try {
      const loaded = (await import(`../../messages/${locale}/common.json`)).default as Record<string, unknown>;
      // If the file is the stub (Tier-C), fall back to English silently;
      // banner.json handles the user-facing notice.
      if (loaded?.__stub === true) {
        messages = enMessages;
      } else {
        messages = loaded as typeof enMessages;
      }
    } catch {
      messages = enMessages;
    }
  }

  return { locale, messages };
});
