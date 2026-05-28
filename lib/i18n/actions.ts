'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { locales } from './config';

export async function setLocaleAction(locale: string) {
  if (!(locales as readonly string[]).includes(locale)) return;
  cookies().set('ach_locale', locale, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  revalidatePath('/', 'layout');
}
