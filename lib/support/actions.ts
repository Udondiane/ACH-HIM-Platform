'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supportSchema } from './schema';

export type SupportResult = { ok: true; id: string } | { ok: false; error: string };

function fdToPlain(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  if (obj.duration_mins === '') obj.duration_mins = undefined;
  return obj;
}

export async function createSupportAction(_prev: SupportResult | null, fd: FormData): Promise<SupportResult> {
  const parsed = supportSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.errors.map(e => e.message).join('; ') };
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('candidate_support')
    .insert({
      candidate_id: parsed.data.candidate_id,
      kind: parsed.data.kind,
      provided_on: parsed.data.provided_on,
      duration_mins: parsed.data.duration_mins === '' ? null : parsed.data.duration_mins ?? null,
      caseworker: parsed.data.caseworker || null,
      summary: parsed.data.summary,
      next_action: parsed.data.next_action || null,
      next_action_by: parsed.data.next_action_by || null,
      recorded_by: user.user?.id ?? null,
    } as never)
    .select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/candidates/${parsed.data.candidate_id}`);
  revalidatePath(`/candidates/${parsed.data.candidate_id}/support`);
  return { ok: true, id: (data as { id: string }).id };
}

export async function deleteSupportAction(id: string, candidateId: string) {
  const supabase = createClient();
  await supabase.from('candidate_support').delete().eq('id', id);
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath(`/candidates/${candidateId}/support`);
}
