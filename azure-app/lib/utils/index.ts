import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format £ with no decimals for whole pounds, 2 dp otherwise. */
export function gbp(n: number): string {
  if (Number.isInteger(n)) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
  }
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(n);
}

/** Format a HIM score as decimal (e.g. 0.67) — per spec §8.4 (no bands). */
export function himScore(n: number): string {
  return n.toFixed(2);
}

/** Format a delta (e.g. +0.18). */
export function delta(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(2)}`;
}
