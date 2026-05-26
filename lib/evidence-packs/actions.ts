'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SECTION_KEYS, type SectionKey } from './sections';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createEvidencePackAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const title = String(fd.get('title') ?? '').trim();
  if (!title) return { ok: false, error: 'Title is required.' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('evidence_packs')
    .insert({
      title,
      funder: String(fd.get('funder') ?? '') || null,
      funding_window: String(fd.get('funding_window') ?? '') || null,
      description: String(fd.get('description') ?? '') || null,
      anonymisation_level: String(fd.get('anonymisation_level') ?? 'standard'),
      methodology_version: 'v1.0',
    } as never)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  const row = data as { id: string };

  // Auto-create the 14 sections in order, empty
  const sectionRows = SECTION_KEYS.map((key, i) => ({
    pack_id: row.id,
    section_key: key,
    sort_order: i,
    content: null,
  }));
  await supabase.from('evidence_pack_sections').insert(sectionRows as never);

  revalidatePath('/evidence-pack');
  redirect(`/evidence-pack/${row.id}`);
}

export async function updateSectionContentAction(
  sectionId: string,
  packId: string,
  content: string,
) {
  const supabase = createClient();
  await supabase
    .from('evidence_pack_sections')
    .update({ content } as never)
    .eq('id', sectionId);
  revalidatePath(`/evidence-pack/${packId}`);
}

export async function toggleSectionIncludedAction(
  sectionId: string,
  packId: string,
  included: boolean,
) {
  const supabase = createClient();
  await supabase
    .from('evidence_pack_sections')
    .update({ included } as never)
    .eq('id', sectionId);
  revalidatePath(`/evidence-pack/${packId}`);
}

export async function setPackStatusAction(packId: string, status: string) {
  const supabase = createClient();
  await supabase.from('evidence_packs').update({ status } as never).eq('id', packId);
  revalidatePath('/evidence-pack');
  revalidatePath(`/evidence-pack/${packId}`);
}
