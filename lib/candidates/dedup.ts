/**
 * Shared normaliser + duplicate-lookup for candidate identity fields.
 *
 * Called from bulkImportCandidatesAction (server), createCandidateAction
 * (server), and previewDuplicatesAction (server, for the UI preview
 * check). Keeping the normalisation logic in one place means the
 * import path and the DB unique indexes (migration 066) agree on what
 * "same email" or "same phone" means.
 */

export function normaliseEmail(v: string | null | undefined): string | null {
  if (!v) return null;
  const trimmed = v.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function normaliseNi(v: string | null | undefined): string | null {
  if (!v) return null;
  const stripped = v.replace(/\s+/g, '').toUpperCase();
  return stripped.length > 0 ? stripped : null;
}

/**
 * Normalise a phone number to digits only. Returns null for values
 * with fewer than 10 digits (partial data isn't reliable to match on).
 */
export function normalisePhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = v.replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits : null;
}
