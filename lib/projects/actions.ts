'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { projectSchema, deriveCapabilitiesFromAnswers, CAP_DOMAINS, type CapAnswer, type CapDomain } from './schema';
import { classify, type ClassificationResponses } from '@/lib/scoring/classification';
import type { DomainId } from '@/lib/scoring/types';
import { PROGRAMME_ACTIVITIES, TRAINING_ACTIVITY_IDS } from '@/lib/activities/definitions';

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fdToPlain(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    // Collect multi-value fields (checkbox groups) into arrays.
    if (k === 'activities' || k === 'training_programme_ids') {
      const existing = obj[k];
      if (Array.isArray(existing)) (existing as unknown[]).push(v);
      else obj[k] = [v];
    } else {
      obj[k] = v;
    }
  }
  if (!('activities' in obj)) obj.activities = [];
  if (!('training_programme_ids' in obj)) obj.training_programme_ids = [];
  // Unchecked checkboxes are omitted by the browser — coerce to false.
  if (!('partner_provides_standard_data' in obj)) obj.partner_provides_standard_data = false;
  return obj;
}

/**
 * Sync the project_activities rows to match the user's tick list.
 *
 * Historical implementation was DELETE-all-then-INSERT with no error
 * capture — if the DELETE succeeded but the INSERT failed, the project
 * silently lost every activity. Now uses a diff (compute the set of
 * to-add and to-remove) so a failure in one operation doesn't wipe
 * the other's rows.
 */
async function syncProjectActivities(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  activities: string[],
): Promise<void> {
  const wanted = new Set(activities);
  const { data: existing, error: readErr } = await supabase
    .from('project_activities')
    .select('activity')
    .eq('project_id', projectId);
  if (readErr) throw new Error(`project_activities read failed: ${readErr.message}`);
  const have = new Set(((existing as { activity: string }[] | null) ?? []).map(r => r.activity));

  const toAdd = [...wanted].filter(a => !have.has(a));
  const toRemove = [...have].filter(a => !wanted.has(a));

  if (toAdd.length > 0) {
    const { error: addErr } = await supabase
      .from('project_activities')
      .insert(toAdd.map(activity => ({ project_id: projectId, activity })) as never);
    if (addErr) throw new Error(`project_activities insert failed: ${addErr.message}`);
  }
  if (toRemove.length > 0) {
    const { error: rmErr } = await supabase
      .from('project_activities')
      .delete()
      .eq('project_id', projectId)
      .in('activity', toRemove);
    if (rmErr) throw new Error(`project_activities delete failed: ${rmErr.message}`);
  }
}

/**
 * Sync the project_training_programmes link rows to match the user's
 * tick list. Diff-based for the same reason as syncProjectActivities.
 */
async function syncProjectTrainingProgrammes(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  programmeIds: string[],
): Promise<void> {
  const wanted = new Set(programmeIds);
  const { data: existing, error: readErr } = await supabase
    .from('project_training_programmes')
    .select('programme_id')
    .eq('project_id', projectId);
  if (readErr) throw new Error(`project_training_programmes read failed: ${readErr.message}`);
  const have = new Set(((existing as { programme_id: string }[] | null) ?? []).map(r => r.programme_id));

  const toAdd = [...wanted].filter(p => !have.has(p));
  const toRemove = [...have].filter(p => !wanted.has(p));

  if (toAdd.length > 0) {
    const { error: addErr } = await supabase
      .from('project_training_programmes')
      .insert(toAdd.map(programme_id => ({ project_id: projectId, programme_id })) as never);
    if (addErr) throw new Error(`project_training_programmes insert failed: ${addErr.message}`);
  }
  if (toRemove.length > 0) {
    const { error: rmErr } = await supabase
      .from('project_training_programmes')
      .delete()
      .eq('project_id', projectId)
      .in('programme_id', toRemove);
    if (rmErr) throw new Error(`project_training_programmes delete failed: ${rmErr.message}`);
  }
}

/**
 * Auto-spawn training programmes from ticked activities.
 *
 * For each activity in `activities` that is flagged as isTraining, ensure
 * a training_programmes row exists that is spawned from this (project,
 * activity) pair, and that it is linked via project_training_programmes.
 * Idempotent: re-saving the project does not create duplicates thanks to
 * the unique index on (spawned_from_project_id, source_activity_id).
 *
 * Auto-spawned programmes that are no longer ticked are unlinked from
 * the project but NOT deleted — enrolments and sessions may already exist
 * on them, and quietly deleting a training programme could destroy data
 * ACH still needs. The programme is left as an orphan (spawned_from_project_id
 * still set) and can be manually archived from /training/programmes if
 * ACH decides.
 */
/**
 * ACH typically delivers ONE combined training programme per project
 * that covers the ticked training activities as modules — not a
 * separate programme per activity. So we spawn a single programme
 * per project whose description lists the modules it covers.
 *
 * Idempotency key: (spawned_from_project_id, source_activity_id='combined').
 * On resave with a changed activity list, we update the name/description
 * of the existing programme rather than creating a new one.
 *
 * If no training activities are ticked, we do NOT create a programme
 * and we don't delete an existing one either — the training row may
 * already have enrolments and sessions ACH still needs.
 */
async function autoSpawnTrainingProgrammesFromActivities(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  projectRef: string,
  activities: string[],
): Promise<void> {
  const trainingActivities = activities.filter(a => TRAINING_ACTIVITY_IDS.has(a));
  if (trainingActivities.length === 0) return;

  const moduleLabels = trainingActivities
    .map(id => PROGRAMME_ACTIVITIES.find(a => a.id === id)?.label)
    .filter((l): l is string => !!l);

  const programmeName = `Training programme — ${projectRef}`;
  const description = `Covers: ${moduleLabels.join(', ')}.`;

  // Look up the single combined programme for this project.
  const { data: existingRows } = await supabase
    .from('training_programmes')
    .select('id')
    .eq('spawned_from_project_id', projectId)
    .eq('source_activity_id', 'combined');
  const existingRow = (existingRows as { id: string }[] | null)?.[0];

  let programmeId: string;
  if (existingRow) {
    programmeId = existingRow.id;
    // Refresh description in case the ticked modules changed.
    await supabase.from('training_programmes').update({
      name: programmeName,
      description,
      category: 'Combined training',
    } as never).eq('id', programmeId);
  } else {
    const { data: created, error } = await supabase
      .from('training_programmes')
      .insert({
        name: programmeName,
        description,
        category: 'Combined training',
        source_activity_id: 'combined',
        spawned_from_project_id: projectId,
        status: 'active',
      } as never)
      .select('id')
      .single();
    if (error) return;
    programmeId = (created as { id: string }).id;
  }

  await supabase.from('project_training_programmes').upsert({
    project_id: projectId,
    programme_id: programmeId,
  } as never, { onConflict: 'project_id,programme_id' });
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
    baseline_window_days: input.baseline_window_days,
    status: input.status,
    partner_provides_standard_data: input.partner_provides_standard_data,
    custom_activities: input.custom_activities || null,
  };
}

/** Persist the newline-separated email list captured on the project form
 *  into project_data_providers. Replace-all semantics so unticking removes
 *  the list. */
async function syncDataProviders(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  provides: boolean,
  rawEmails: string | null | undefined,
): Promise<void> {
  await supabase.from('project_data_providers').delete().eq('project_id', projectId);
  if (!provides || !rawEmails) return;
  const emails = rawEmails
    .split(/[\n,;]+/)
    .map(e => e.trim())
    .filter(e => /.+@.+\..+/.test(e));
  if (emails.length === 0) return;
  // De-duplicate case-insensitively — matches the DB unique index.
  const seen = new Set<string>();
  const rows = emails
    .filter(e => { const k = e.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(email => ({ project_id: projectId, email }));
  if (rows.length > 0) await supabase.from('project_data_providers').insert(rows as never);
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
  await syncProjectTrainingProgrammes(supabase, row!.id, (parsed.data as any).training_programme_ids ?? []);
  await autoSpawnTrainingProgrammesFromActivities(supabase, row!.id, ref, parsed.data.activities ?? []);
  await syncPartnersFromFunderName(supabase, parsed.data.funder_name, parsed.data.funding_model);
  await syncDataProviders(supabase, row!.id, parsed.data.partner_provides_standard_data, parsed.data.data_provider_emails);
  revalidatePath('/projects');
  revalidatePath('/partners');
  revalidatePath('/cohorts/new');
  revalidatePath('/cohorts');
  revalidatePath('/dashboard');
  revalidatePath('/training/programmes');
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
  await syncProjectTrainingProgrammes(supabase, id, (parsed.data as any).training_programme_ids ?? []);
  await autoSpawnTrainingProgrammesFromActivities(supabase, id, ref, parsed.data.activities ?? []);
  await syncPartnersFromFunderName(supabase, parsed.data.funder_name, parsed.data.funding_model);
  await syncDataProviders(supabase, id, parsed.data.partner_provides_standard_data, parsed.data.data_provider_emails);
  revalidatePath('/projects');
  revalidatePath('/partners');
  revalidatePath(`/projects/${id}`);
  revalidatePath('/training/programmes');
  return { ok: true, id };
}

/**
 * Soft-delete a project.
 *
 * Historical behaviour: hard DELETE, which cascaded through cohorts,
 * cohort_candidates, cohort_partners, and orphaned every assessment
 * (assessments.project_id = ON DELETE SET NULL). One misclick from a
 * programme lead could destroy an entire live project's structural
 * data with no recovery.
 *
 * New behaviour: refuse to hard-delete a project that has any live
 * data attached. Set status='archived' instead. If the caller
 * genuinely wants a hard delete of an empty project (e.g. a mis-
 * created "gg" test project), pass hardDelete:true AND the project
 * must have zero assessments, zero placements, zero cohorts with
 * candidates. Anything else archives.
 */
export async function deleteProjectAction(
  id: string,
  opts?: { hardDelete?: boolean },
): Promise<{ ok: true; softDeleted: boolean } | { ok: false; error: string }> {
  const supabase = createClient();

  // Count attached content so we can refuse a hard delete when the
  // project has anything valuable hanging off it.
  const [{ count: assessCount }, { count: placeCount }, { count: cohortCandCount }] = await Promise.all([
    supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('project_id', id),
    supabase.from('placements').select('id', { count: 'exact', head: true })
      .in('cohort_id',
        (await supabase.from('cohorts').select('id').eq('project_id', id))
          .data?.map((r: any) => r.id) ?? []),
    supabase.from('cohort_candidates').select('id', { count: 'exact', head: true })
      .in('cohort_id',
        (await supabase.from('cohorts').select('id').eq('project_id', id))
          .data?.map((r: any) => r.id) ?? []),
  ]);
  const hasContent = (assessCount ?? 0) > 0 || (placeCount ?? 0) > 0 || (cohortCandCount ?? 0) > 0;

  if (opts?.hardDelete === true && !hasContent) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/projects');
    revalidatePath('/dashboard');
    redirect('/projects');
  }

  // Default: soft-delete via status update.
  const { error } = await supabase
    .from('projects')
    .update({ status: 'archived' } as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/projects');
  revalidatePath('/dashboard');
  return { ok: true, softDeleted: true };
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

/**
 * Ensure a default cohort exists for the project. If none, create one
 * named "Main — <project ref>" and auto-link every partner already on
 * the project (via funder_name → partners). Returns the cohort id.
 *
 * Idempotent: reruns return the existing default without duplicating.
 * "Default" here means the oldest cohort under the project — if staff
 * later add named cohorts (e.g. Q3 intake), the default stays as the
 * first row and we don't create a new one.
 */
async function ensureDefaultCohortForProject(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('cohorts')
    .select('id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

  const { data: project } = await supabase
    .from('projects')
    .select('project_ref, name, funder_name, start_date, end_date')
    .eq('id', projectId)
    .single();
  if (!project) return null;
  const p = project as { project_ref: string; name: string; funder_name: string | null; start_date: string | null; end_date: string | null };

  const cohortRef = `${p.project_ref}-MAIN`;
  const { data: created, error: cErr } = await supabase
    .from('cohorts')
    .insert({
      cohort_ref: cohortRef,
      name: `Main — ${p.project_ref}`,
      project_id: projectId,
      structure: 'multi_partner',
      service_type: 'full_programme',
      status: 'recruiting',
      start_date: p.start_date,
      end_date: p.end_date,
    } as never)
    .select('id')
    .single();
  if (cErr) return null;
  const cohortId = (created as { id: string }).id;

  // Auto-link every partner named in project.funder_name (they were
  // upserted by syncPartnersFromFunderName on project save). Match
  // case-insensitively on partner name.
  if (p.funder_name) {
    const names = p.funder_name
      .split(/[,&+]|\s+and\s+/i)
      .map(n => n.replace(/\([^)]*\)/g, '').trim())
      .filter(n => n.length > 1);
    if (names.length > 0) {
      const { data: partnerRows } = await supabase
        .from('partners')
        .select('id, name')
        .in('name', names);
      const partners = (partnerRows as { id: string; name: string }[] | null) ?? [];
      if (partners.length > 0) {
        await supabase.from('cohort_partners').insert(
          partners.map(p => ({
            cohort_id: cohortId,
            partner_id: p.id,
            sponsorship_count: 0,
            engagement_fee: 0,
            is_lead_partner: false,
          })) as never,
        );
      }
    }
  }
  return cohortId;
}

/**
 * Add candidates to a project. Auto-creates a default cohort if the
 * project has none, and inherits the project's partners onto that
 * cohort — so staff never have to manually create a cohort or wire up
 * partner sponsorships just to enrol people.
 */
/**
 * Mark a project as completed. Captures the three end-of-project narrative
 * answers alongside the completion timestamp so the outcomes report has its
 * qualitative spine. Idempotent — re-running just refreshes the narrative
 * and the timestamp.
 */
export async function markProjectCompletedAction(
  projectId: string,
  narrative: { what_worked: string; challenges: string; unexpected: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('projects')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      end_narrative_what_worked: narrative.what_worked || null,
      end_narrative_challenges: narrative.challenges || null,
      end_narrative_unexpected: narrative.unexpected || null,
    } as never)
    .eq('id', projectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/outcomes-report`);
  return { ok: true };
}

export async function enrolBeneficiariesToProjectAction(
  projectId: string,
  candidateIds: string[],
): Promise<{ ok: true; count: number; cohortId: string } | { ok: false; error: string }> {
  if (candidateIds.length === 0) return { ok: false, error: 'Pick at least one candidate.' };
  const supabase = createClient();
  const cohortId = await ensureDefaultCohortForProject(supabase, projectId);
  if (!cohortId) return { ok: false, error: 'Could not create or find a cohort for this project.' };

  await supabase.from('cohort_candidates').upsert(
    candidateIds.map(candidate_id => ({
      cohort_id: cohortId,
      candidate_id,
      sponsoring_partner_id: null,
    })) as never,
    { onConflict: 'cohort_id,candidate_id' },
  );
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/cohorts/${cohortId}`);
  revalidatePath('/dashboard');
  return { ok: true, count: candidateIds.length, cohortId };
}
