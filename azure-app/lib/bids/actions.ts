'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function toStringArray(v: FormDataEntryValue | null): string[] {
  if (!v) return [];
  const s = String(v).trim();
  if (!s) return [];
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

function collectMulti(fd: FormData, name: string): string[] {
  const vals = fd.getAll(name).map(v => String(v).trim()).filter(Boolean);
  return vals;
}

export async function createBidAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const name = String(fd.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'Name is required.' };

  const payload = {
    name,
    funder_name:    String(fd.get('funder_name') ?? '').trim() || null,
    ask_amount_gbp: fd.get('ask_amount_gbp') ? Number(fd.get('ask_amount_gbp')) : null,
    deadline:       String(fd.get('deadline') ?? '').trim() || null,
    status:         'draft',
    focus_domains:  collectMulti(fd, 'focus_domains'),
    framework_key:  String(fd.get('framework_key') ?? '').trim() || null,
    scoped_project_ids: collectMulti(fd, 'scoped_project_ids'),
    scoped_cohort_ids:  collectMulti(fd, 'scoped_cohort_ids'),
    featured_quote_ids: collectMulti(fd, 'featured_quote_ids'),
    executive_summary:      String(fd.get('executive_summary') ?? '').trim() || null,
    methodology_note:       String(fd.get('methodology_note') ?? '').trim() || null,
    what_we_will_do:        String(fd.get('what_we_will_do') ?? '').trim() || null,
    what_change_looks_like: String(fd.get('what_change_looks_like') ?? '').trim() || null,
    created_by: user.user?.id ?? null,
  };

  const { data, error } = await supabase
    .from('bids')
    .insert(payload as never)
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath('/bids');
  redirect(`/bids/${(data as { id: string }).id}`);
}

export async function updateBidAction(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const name = String(fd.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'Name is required.' };

  const payload: Record<string, unknown> = {
    name,
    funder_name:    String(fd.get('funder_name') ?? '').trim() || null,
    ask_amount_gbp: fd.get('ask_amount_gbp') ? Number(fd.get('ask_amount_gbp')) : null,
    deadline:       String(fd.get('deadline') ?? '').trim() || null,
    focus_domains:  collectMulti(fd, 'focus_domains'),
    framework_key:  String(fd.get('framework_key') ?? '').trim() || null,
    scoped_project_ids: collectMulti(fd, 'scoped_project_ids'),
    scoped_cohort_ids:  collectMulti(fd, 'scoped_cohort_ids'),
    featured_quote_ids: collectMulti(fd, 'featured_quote_ids'),
    executive_summary:      String(fd.get('executive_summary') ?? '').trim() || null,
    methodology_note:       String(fd.get('methodology_note') ?? '').trim() || null,
    what_we_will_do:        String(fd.get('what_we_will_do') ?? '').trim() || null,
    what_change_looks_like: String(fd.get('what_change_looks_like') ?? '').trim() || null,
  };
  const status = String(fd.get('status') ?? '').trim();
  if (status) payload.status = status;
  const submitted_at = String(fd.get('submitted_at') ?? '').trim();
  if (submitted_at) payload.submitted_at = submitted_at;
  const outcome_notes = String(fd.get('outcome_notes') ?? '').trim();
  if (outcome_notes) payload.outcome_notes = outcome_notes;

  const { error } = await supabase.from('bids').update(payload as never).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/bids');
  revalidatePath(`/bids/${id}`);
  return { ok: true, id };
}
