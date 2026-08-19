'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';

export async function updateTranslationAction(
  id: string,
  content: string,
  reviewed: boolean,
) {
  await requireUser(['ach_staff']);
  const supabase = createClient();
  await supabase
    .from('translations')
    .update({
      content: content || null,
      reviewed,
      last_edited_at: new Date().toISOString(),
    } as never)
    .eq('id', id);
  revalidatePath('/translations');
}

export async function toggleReviewedAction(id: string, reviewed: boolean) {
  await requireUser(['ach_staff']);
  const supabase = createClient();
  await supabase
    .from('translations')
    .update({ reviewed, last_edited_at: new Date().toISOString() } as never)
    .eq('id', id);
  revalidatePath('/translations');
}
