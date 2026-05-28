import { createClient } from '@/lib/supabase/server';
import { AUTH_DISABLED } from '@/lib/auth/dev-bypass';
import { cookies } from 'next/headers';

export type ResolvedPartner = {
  id: string;
  name: string;
  type: string;
  types: string[];
  sector?: string | null;
  region?: string | null;
  status?: string | null;
  isImpersonating: boolean;
};

/**
 * Resolve which partner the current request is "viewing as".
 *
 * Order of precedence:
 *   1. ?as=<partner_id> in the URL (if AUTH_DISABLED or staff)
 *   2. ach_view_as cookie (sticky impersonation)
 *   3. user_roles.partner_id (real auth)
 *   4. First active workforce_partner (last-ditch fallback for demos)
 */
export async function resolveCurrentPartner(
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<ResolvedPartner | null> {
  const supabase = createClient();
  const cookieStore = cookies();
  const asParam = typeof searchParams?.as === 'string' ? searchParams.as : null;
  const cookieAs = cookieStore.get('ach_view_as')?.value ?? null;

  // Authenticated path: prefer the user's bound partner unless impersonating.
  let partnerId: string | null = null;
  let impersonating = false;

  if (!AUTH_DISABLED) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleRow } = await supabase
        .from('user_roles').select('partner_id, role').eq('user_id', user.id).maybeSingle();
      const row = roleRow as { partner_id?: string; role?: string } | null;
      // ACH staff can impersonate; partners cannot.
      if (row?.role === 'ach_staff' && (asParam || cookieAs)) {
        partnerId = asParam ?? cookieAs;
        impersonating = true;
      } else {
        partnerId = row?.partner_id ?? null;
      }
    }
  } else {
    // AUTH_DISABLED demo path
    if (asParam) {
      partnerId = asParam;
      impersonating = true;
    } else if (cookieAs) {
      partnerId = cookieAs;
      impersonating = true;
    } else {
      const { data: defaultPartner } = await supabase
        .from('partners')
        .select('id')
        .eq('type', 'workforce_partner')
        .eq('status', 'active')
        .order('name')
        .limit(1)
        .maybeSingle();
      partnerId = (defaultPartner as { id: string } | null)?.id ?? null;
      impersonating = true;
    }
  }

  if (!partnerId) return null;

  const { data: partner } = await supabase
    .from('partners')
    .select('id, name, type, types, sector, region, status')
    .eq('id', partnerId)
    .maybeSingle();

  const p = partner as any;
  if (!p) return null;
  // Normalise: prefer types array; fall back to wrapping legacy type.
  const types: string[] = Array.isArray(p.types) && p.types.length > 0
    ? p.types
    : p.type ? [p.type] : [];
  return { ...p, types, isImpersonating: impersonating };
}
