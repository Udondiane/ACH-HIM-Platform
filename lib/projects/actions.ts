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
  for (const [k, v] of fd.entries()) {
    // Collect any 'activities' form field (multiple checkboxes share the
    // same name) into an array on the parsed object.
    if (k === 'activities') {
      const existing = obj.activities;
      if (Array.isArray(existing)) (existing as unknown[]).push(v);
      else obj.activities = [v];
    } else {
      obj[k] = v;
    }
  }
  if (!('activities' in obj)) obj.activities = [];
  return obj;
}

/** Sync the project_activities rows to match the user's tick list. */
async function syncProjectActivities(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  activities: string[],
): Promise<void> {
  // Replace-all semantics: clear then insert. Safer than computing the diff.
  await supabase.from('project_activities').delete().eq('project_id', projectId);
  if (activities.length === 0) return;
  const rows = activities.map(activity => ({ project_id: projectId, activity }));
  await supabase.from('project_activities').insert(rows as never);
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
    evaluation_type: input.evaluation_type || null,
    personnel: input.personnel || null,
    focus_area: input.focus_area || null,
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

/**
 * Parse the free-text funder_name field into individual partner names and
 * upsert each one into the partners table with a sensible type. Run after a
 * project is created/updated so the partners list stays in sync with what
 * staff typed when scoping the project.
 *
 * - Funded model: every name becomes a grant_funder.
 * - Commercial model: every name becomes a workforce_partner.
 * - Hybrid model: names matching grant-side keywords become grant_funder;
 *   the rest default to workforce_partner. Hybrid still wins clarity from
 *   a single field, even if it isn't perfect.
 *
 * Existing partners are matched case-insensitively by name and left
 * untouched (we never overwrite their type or status).
 */
const GRANT_KEYWORDS = [
  'trust', 'foundation', 'lottery', 'relief', 'council', 'authority',
  'charity', 'fund', 'government', 'ministry', 'wmca', 'gmca', 'dwp',
  'home office', 'nhs', 'esf', 'uksfp', 'ukspf',
];

function inferPartnerType(name: string, fundingModel: string | null | undefined): 'grant_funder' | 'workforce_partner' {
  if (fundingModel === 'funded') return 'grant_funder';
  if (fundingModel === 'commercial') return 'workforce_partner';
  // hybrid (or unset) — smart match on name
  const lower = name.toLowerCase();
  for (const kw of GRANT_KEYWORDS) {
    if (lower.includes(kw)) return 'grant_funder';
  }
  return 'workforce_partner';
}

async function syncPartnersFromFunderName(
  supabase: ReturnType<typeof createClient>,
  funderName: string | null | undefined,
  fundingModel: string | null | undefined,
): Promise<void> {
  if (!funderName) return;
  // Split on commas, ampersands, plus signs, " and ", " + " — typical
  // separators staff use when listing multiple funders.
  const names = funderName
    .split(/[,&+]|\s+and\s+/i)
    .map(n => n.replace(/\([^)]*\)/g, '').trim()) // strip "(grant)" / "(corporate)" hints
    .filter(n => n.length > 1);

  if (names.length === 0) return;

  // Pull existing partner names so we don't duplicate.
  const { data: existingRows } = await supabase
    .from('partners')
    .select('name');
  const existingLower = new Set(
    ((existingRows as { name: string }[] | null) ?? []).map(p => p.name.trim().toLowerCase()),
  );

  const toInsert = names
    .filter(n => !existingLower.has(n.toLowerCase()))
    .map(name => {
      const t = inferPartnerType(name, fundingModel);
      // partners has both `type` (legacy) and `types[]` columns (mig 021)
      // — populate both so triggers and reports stay consistent.
      return {
        name,
        type: t,
        types: [t],
        status: 'active',
      };
    });

  if (toInsert.length === 0) return;
  await supabase.from('partners').insert(toInsert as never);
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
  await syncProjectActivities(supabase, row!.id, parsed.data.activities ?? []);
  await syncPartnersFromFunderName(supabase, parsed.data.funder_name, parsed.data.funding_model);
  revalidatePath('/projects');
  revalidatePath('/partners');
  revalidatePath('/cohorts/new');
  revalidatePath('/cohorts');
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
    cap_housing:    parsed.data.cap_housing,
    cap_education:  parsed.data.cap_education,
    cap_health:     parsed.data.cap_health,
    cap_belonging:  parsed.data.cap_belonging,
    cap_social:     parsed.data.cap_social,
    cap_rights:     parsed.data.cap_rights,
  });
  await syncProjectActivities(supabase, id, parsed.data.activities ?? []);
  await syncPartnersFromFunderName(supabase, parsed.data.funder_name, parsed.data.funding_model);
  revalidatePath('/projects');
  revalidatePath('/partners');
  revalidatePath(`/projects/${id}`);
  return { ok: true, id };
}

export async function deleteProjectAction(id: string) {
  const supabase = createClient();
  await supabase.from('projects').delete().eq('id', id);
  revalidatePath('/projects');
  revalidatePath('/dashboard');
  redirect('/projects');
}

export async function setProjectCapabilitiesAction(
  projectId: string,
  capabilities: { domain: DomainId; role: 'core' | 'optional' }[],
) {
  const supabase = createClient();
  // Preserve existing factor selections when re-saving capability roles —
  // dropping the row would silently reset custom factor picks.
  const { data: existing } = await supabase
    .from('project_capabilities')
    .select('domain, selected_factors')
    .eq('project_id', projectId);
  const factorsByDomain = new Map<string, string[]>(
    ((existing ?? []) as { domain: string; selected_factors: string[] | null }[])
      .map(r => [r.domain, r.selected_factors ?? []])
  );

  await supabase.from('project_capabilities').delete().eq('project_id', projectId);
  if (capabilities.length > 0) {
    await supabase.from('project_capabilities').insert(
      capabilities.map(c => ({
        project_id: projectId,
        domain: c.domain,
        role: c.role,
        selected_factors: factorsByDomain.get(c.domain) ?? [],
      })) as never,
    );
  }
  revalidatePath(`/projects/${projectId}`);
}

export async function setProjectFactorsAction(
  projectId: string,
  domain: DomainId,
  factorIds: string[],
) {
  const supabase = createClient();
  const { error } = await supabase
    .from('project_capabilities')
    .update({ selected_factors: factorIds } as never)
    .eq('project_id', projectId)
    .eq('domain', domain);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
