'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { partnerSchema } from './schema';

function fdToPlain(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k === 'types') {
      // multi-checkbox: collect all values for the same key into an array
      const existing = obj.types as string[] | undefined;
      obj.types = existing ? [...existing, v as string] : [v as string];
    } else {
      obj[k] = v;
    }
  }
  if (obj.employee_count === '') obj.employee_count = undefined;
  if (!obj.types) obj.types = [];
  return obj;
}

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createPartnerAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = partnerSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const supabase = createClient();
  const payload = {
    name: parsed.data.name,
    types: parsed.data.types,
    status: parsed.data.status,
    sector: parsed.data.sector || null,
    region: parsed.data.region || null,
    website: parsed.data.website || null,
    employee_count: parsed.data.employee_count === '' ? null : parsed.data.employee_count ?? null,
  };
  const { data, error } = await supabase
    .from('partners')
    .insert(payload as never)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  const row = data as { id: string } | null;
  revalidatePath('/partners');
  revalidatePath('/dashboard');
  redirect(`/partners/${row!.id}`);
}

export async function updatePartnerAction(
  id: string,
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = partnerSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const supabase = createClient();
  const payload = {
    name: parsed.data.name,
    types: parsed.data.types,
    status: parsed.data.status,
    sector: parsed.data.sector || null,
    region: parsed.data.region || null,
    website: parsed.data.website || null,
    employee_count: parsed.data.employee_count === '' ? null : parsed.data.employee_count ?? null,
  };
  const { error } = await supabase
    .from('partners')
    .update(payload as never)
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/partners');
  revalidatePath(`/partners/${id}`);
  return { ok: true, id };
}

export async function deletePartnerAction(id: string) {
  const supabase = createClient();
  // Soft-delete by setting status to 'closed' — partners with placements
  // cannot be hard-deleted due to FK on placements (on delete restrict).
  await supabase
    .from('partners')
    .update({ status: 'closed' } as never)
    .eq('id', id);

  revalidatePath('/partners');
  redirect('/partners');
}
