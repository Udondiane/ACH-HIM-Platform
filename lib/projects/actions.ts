'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { projectSchema, deriveCapabilitiesFromAnswers, CAP_DOMAINS, type CapAnswer, type CapDomain } from './schema';
import { classify, type ClassificationResponses } from '@/lib/scoring/classification';
import type { DomainId } from '@/lib/scoring/types';

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fdToPlain(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

async function nextProjectRef(supabase: ReturnType<typeof createClient>): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PRJ-${year}-`;
  const { data } = await supabase
    .from('projects').select('project_ref').like('project_ref', `${prefix}%`);
  const refs = ((data ?? []) as { project_ref: string }[]).map(r => r.project_ref);
  const pattern = new RegExp(`^PRJ-${year}-(\\d+)$`);
  let max = 0;
  for (const r of refs) {
    const m = r.match(pattern);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function normalisePayload(input: ReturnType<typeof projectSchema.parse>, ref: string) {
  // Compute classification_total if all four questions answered
  let classification_total: number | null = null;
  const q1 = input.classification_q1 as 'A'|'B'|'C'|'';
  const q2 = input.classification_q2 as 'A'|'B'|'C'|'';
  const q3 = input.classification_q3 as 'A'|'B'|'C'|'';
  const q4 = input.classification_q4 as 'A'|'B'|'C'|'';
  if (q1 && q2 && q3 && q4) {
    const cls = classify({
      q1_primary_objective: q1,
      q2_participation_intensity: q2,
      q3_service_delivery: q3,
      q4_expected_change_pattern: q4,
    } as ClassificationResponses);
    classification_total = cls.total;
  }
  const capabilityQuestionnaire = {
    employment: input.cap_employment || null,
    housing:    input.cap_housing    || null,
    education:  input.cap_education  || null,
    health:     input.cap_health     || null,
    belonging:  input.cap_belonging  || null,
    social:     input.cap_social     || null,
    rights:     input.cap_rights     || null,
  };
  return {
    project_ref: ref,
    name: input.name,
    description: input.description || null,
    funding_model: input.funding_model || null,
    funder_name: input.funder_name || null,
    type: input.type,
    weight_ratio: input.weight_ratio,
    hybrid_option: input.hybrid_option || null,
    stability_blend: input.stability_blend,
    optional_scheme: input.optional_scheme,
    classification_q1: q1 || null,
    classification_q2: q2 || null,
    classification_q3: q3 || null,
    classification_q4: q4 || null,
    classification_total,
    capability_questionnaire: capabilityQuestionnaire,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    status: input.status,
  };
}

async function syncCapabilitiesFromAnswers(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  answers: Record<string, CapAnswer | '' | null | undefined>,
) {
  // Caller passes cap_employment, cap_housing, etc. Strip the prefix before
  // handing to deriveCapabilitiesFromAnswers, which expects bare domain keys.
  const stripped: Partial<Record<CapDomain, CapAnswer | ''>> = {};
  for (const d of CAP_DOMAINS) {
    const v = answers[`cap_${d}`];
    if (v != null) stripped[d as CapDomain] = v as CapAnswer | '';
  }
  const derived = deriveCapabilitiesFromAnswers(stripped);
  const anyAnswered = CAP_DOMAINS.some(d => {
    const a = answers[`cap_${d}`];
    return a != null && a !== '';
  });
  if (!anyAnswered) return;
  await supabase.from('project_capabilities').delete().eq('project_id', projectId);
  if (derived.length > 0) {
    await supabase.from('project_capabilities').insert(
      derived.map(c => ({
        project_id: projectId, domain: c.domain, role: c.role, selected_factors: [],
      })) as never,
    );
  }
}

export async function createProjectAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = projectSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = createClient();
  const submittedRef = (parsed.data.project_ref ?? '').trim();
  const ref = submittedRef || (await nextProjectRef(supabase));
  const { data, error } = await supabase
    .from('projects')
    .insert(normalisePayload(parsed.data, ref) as never)
    .select('id').single();
  if (error) return { ok: false, error: error.message };
  const row = data as { id: string } | null;
  await syncCapabilitiesFromAnswers(supabase, row!.id, {
    cap_employment: parsed.data.cap_employment,
    cap_housing:    parsed.data.cap_housing,
    cap_education:  parsed.data.cap_education,
    cap_health:     parsed.data.cap_health,
    cap_belonging:  parsed.data.cap_belonging,
    cap_social:     parsed.data.cap_social,
    cap_rights:     parsed.data.cap_rights,
  });
  revalidatePath('/projects');
  revalidatePath('/dashboard');
  redirect(`/projects/${row!.id}`);
}

export async function updateProjectAction(
  id: string, _prev: ActionResult | null, fd: FormData,
): Promise<ActionResult> {
  const parsed = projectSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) {
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = createClient();
  const submittedRef = (parsed.data.project_ref ?? '').trim();
  const ref = submittedRef || (await nextProjectRef(supabase));
  const { error } = await supabase
    .from('projects').update(normalisePayload(parsed.data, ref) as never).eq('id', id);
  if (error) return { ok: false, error: error.message };
  await syncCapabilitiesFromAnswers(supabase, id, {
    cap_employment: parsed.data.cap_employment,
    cap_education:  parsed.data.cap_education,
    cap_belonging:  parsed.data.cap_belonging,
    cap_social:     parsed.data.cap_social,
    cap_health:     parsed.data.cap_health,
  });
  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
  return { ok: true, id };
}

export async function setProjectCapabilitiesAction(
  projectId: string,
  capabilities: { domain: DomainId; role: 'core' | 'optional' }[],
) {
  const supabase = createClient();
  // Strategy: delete all then re-insert
  await supabase.from('project_capabilities').delete().eq('project_id', projectId);
  if (capabilities.length > 0) {
    await supabase.from('project_capabilities').insert(
      capabilities.map(c => ({
        project_id: projectId, domain: c.domain, role: c.role, selected_factors: [],
      })) as never,
    );
  }
  revalidatePath(`/projects/${projectId}`);
}
