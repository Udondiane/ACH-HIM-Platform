'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { PROJECT_TYPES, WEIGHT_RATIOS, HYBRID_OPTIONS, OPTIONAL_SCHEMES } from './schema';
import { classify, type ClassificationResponses } from '@/lib/scoring/classification';

const adminSchema = z.object({
  type: z.enum(PROJECT_TYPES),
  weight_ratio: z.enum(WEIGHT_RATIOS),
  hybrid_option: z.enum(HYBRID_OPTIONS).optional().or(z.literal('')),
  optional_scheme: z.enum(OPTIONAL_SCHEMES),
  stability_blend: z.coerce.number().min(0).max(1),
  classification_q1: z.enum(['A','B','C']).optional().or(z.literal('')),
  classification_q2: z.enum(['A','B','C']).optional().or(z.literal('')),
  classification_q3: z.enum(['A','B','C']).optional().or(z.literal('')),
  classification_q4: z.enum(['A','B','C']).optional().or(z.literal('')),
});

export type AdminActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateProjectAdminAction(
  id: string,
  _prev: AdminActionResult | null,
  fd: FormData,
): Promise<AdminActionResult> {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) raw[k] = v;

  const parsed = adminSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Please fix the highlighted fields.' };
  }
  const input = parsed.data;

  let classification_total: number | null = null;
  const q1 = input.classification_q1 as 'A'|'B'|'C'|'';
  const q2 = input.classification_q2 as 'A'|'B'|'C'|'';
  const q3 = input.classification_q3 as 'A'|'B'|'C'|'';
  const q4 = input.classification_q4 as 'A'|'B'|'C'|'';
  if (q1 && q2 && q3 && q4) {
    classification_total = classify({
      q1_primary_objective: q1,
      q2_participation_intensity: q2,
      q3_service_delivery: q3,
      q4_expected_change_pattern: q4,
    } as ClassificationResponses).total;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('projects')
    .update({
      type: input.type,
      weight_ratio: input.weight_ratio,
      hybrid_option: input.hybrid_option || null,
      optional_scheme: input.optional_scheme,
      stability_blend: input.stability_blend,
      classification_q1: q1 || null,
      classification_q2: q2 || null,
      classification_q3: q3 || null,
      classification_q4: q4 || null,
      classification_total,
    } as never)
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${id}`);
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}
