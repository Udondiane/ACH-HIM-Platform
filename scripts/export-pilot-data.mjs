#!/usr/bin/env node
/**
 * Pilot data export (pseudonymised).
 *
 * Reads the production Supabase database and writes one CSV per entity
 * into ./pilot-data-export/. Candidate names are stripped from the main
 * sheets and from free-text fields; each candidate is assigned a stable
 * code R001, R002, … in order of created_at. The name → code mapping is
 * written to a SEPARATE file (00_mapping_key.csv) so you can decide
 * whether to include it in what you send on to ACH.
 *
 * Required environment variables (set these before running):
 *   NEXT_PUBLIC_SUPABASE_URL      — your production Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY     — service-role key (server-only secret)
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=...  \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/export-pilot-data.mjs
 *
 * The script is read-only. It never writes to the database.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUT_DIR       = process.env.OUT_DIR ?? './pilot-data-export';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    'Missing required env vars. Set NEXT_PUBLIC_SUPABASE_URL and ' +
    'SUPABASE_SERVICE_ROLE_KEY before running this script.',
  );
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') v = JSON.stringify(v);
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function writeCsv(filename, rows, columns) {
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => csvEscape(r[c])).join(',')).join('\n');
  const file = path.join(OUT_DIR, filename);
  fs.writeFileSync(file, header + '\n' + body + '\n');
  console.log(`  ✓ ${filename}  (${rows.length} rows)`);
}

async function fetchAll(table, select = '*', orderBy = 'created_at') {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .order(orderBy, { ascending: true, nullsFirst: true });
  if (error) {
    // Some tables may not exist in older schemas — surface and continue.
    console.warn(`  ! ${table}: ${error.message}`);
    return [];
  }
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────────
// Fetch
// ──────────────────────────────────────────────────────────────────

console.log('\nFetching from Supabase…');
const candidates       = await fetchAll('candidates');
const consent          = await fetchAll('candidate_consent', '*', 'given_at');
const cohorts          = await fetchAll('cohorts');
const cohortCandidates = await fetchAll('cohort_candidates', '*', 'cohort_id');
const cohortPartners   = await fetchAll('cohort_partners', '*', 'cohort_id');
const partners         = await fetchAll('partners');
const projects         = await fetchAll('projects');
const projectCaps      = await fetchAll('project_capabilities', '*', 'project_id');
const assessments      = await fetchAll('assessments', '*', 'assessed_on');
const responses        = await fetchAll('assessment_responses', '*', 'assessment_id');
const factors          = await fetchAll('factors', '*', 'id');
const indicators       = await fetchAll('indicators', '*', 'id');
const interviews       = await fetchAll('candidate_interviews', '*', 'interview_date');
const training         = await fetchAll('candidate_training', '*', 'completed_at');
const support          = await fetchAll('candidate_support', '*', 'logged_at');
const placements       = await fetchAll('placements', '*', 'start_date');

// ──────────────────────────────────────────────────────────────────
// Pseudonymisation setup
// ──────────────────────────────────────────────────────────────────

// Each candidate → stable R-code based on created_at order.
const codeFor = new Map();
candidates.forEach((c, i) => {
  codeFor.set(c.id, `R${String(i + 1).padStart(3, '0')}`);
});

// Name → code regex set, sorted longest-name first so "Jon Smith" is
// replaced before "Jon".
const nameEntries = [];
for (const c of candidates) {
  const code = codeFor.get(c.id);
  if (c.given_name)  nameEntries.push({ name: c.given_name,  code });
  if (c.family_name) nameEntries.push({ name: c.family_name, code });
}
nameEntries.sort((a, b) => b.name.length - a.name.length);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scrub(text) {
  if (text === null || text === undefined || text === '') return text;
  let out = String(text);
  for (const { name, code } of nameEntries) {
    out = out.replace(new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi'), code);
  }
  return out;
}

// Replace UUID of candidate with R-code where it appears as a key.
function codeFromId(id) {
  return id ? (codeFor.get(id) ?? '') : '';
}

// ──────────────────────────────────────────────────────────────────
// Write sheets
// ──────────────────────────────────────────────────────────────────

console.log(`\nWriting CSVs to ${OUT_DIR}/ …`);

// 00 — Mapping key (CONFIDENTIAL).
writeCsv(
  '00_mapping_key_CONFIDENTIAL.csv',
  candidates.map(c => ({
    beneficiary_ref: codeFor.get(c.id),
    original_candidate_ref: c.candidate_ref,
    given_name:  c.given_name,
    family_name: c.family_name,
    arrival_year: c.arrival_year,
  })),
  ['beneficiary_ref', 'original_candidate_ref', 'given_name', 'family_name', 'arrival_year'],
);

// 01 — Beneficiaries (no names).
writeCsv(
  '01_beneficiaries.csv',
  candidates.map(c => ({
    beneficiary_ref:    codeFor.get(c.id),
    original_candidate_ref: c.candidate_ref,
    status:             c.status,
    preferred_locale:   c.preferred_locale,
    country_of_origin:  c.country_of_origin,
    arrival_year:       c.arrival_year,
    english_level:      c.english_level,
    career_goal:        scrub(c.career_goal_summary),
    development_plan:   scrub(c.development_plan),
    notes:              scrub(c.notes),
    created_at:         c.created_at,
    updated_at:         c.updated_at,
  })),
  ['beneficiary_ref', 'original_candidate_ref', 'status', 'preferred_locale',
   'country_of_origin', 'arrival_year', 'english_level',
   'career_goal', 'development_plan', 'notes', 'created_at', 'updated_at'],
);

// 02 — Consents.
writeCsv(
  '02_consents.csv',
  consent.map(r => ({
    beneficiary_ref:                     codeFromId(r.candidate_id),
    may_be_named:                        r.may_be_named,
    may_be_quoted:                       r.may_be_quoted,
    may_appear_in_case_study:            r.may_appear_in_case_study,
    may_share_career_goal_with_partner:  r.may_share_career_goal_with_partner,
    given_at:                            r.given_at,
    withdrawn_at:                        r.withdrawn_at,
    signed_form_ref:                     r.signed_form_ref,
    notes:                               scrub(r.notes),
  })),
  ['beneficiary_ref', 'may_be_named', 'may_be_quoted', 'may_appear_in_case_study',
   'may_share_career_goal_with_partner', 'given_at', 'withdrawn_at',
   'signed_form_ref', 'notes'],
);

// 03 — Cohorts.
writeCsv(
  '03_cohorts.csv',
  cohorts,
  Object.keys(cohorts[0] ?? {}),
);

// 04 — Cohort → Candidates.
writeCsv(
  '04_cohort_members.csv',
  cohortCandidates.map(r => ({
    cohort_id:       r.cohort_id,
    beneficiary_ref: codeFromId(r.candidate_id),
    enrolled_at:     r.enrolled_at,
    exit_at:         r.exit_at,
    exit_reason:     r.exit_reason,
  })),
  ['cohort_id', 'beneficiary_ref', 'enrolled_at', 'exit_at', 'exit_reason'],
);

// 05 — Projects.
writeCsv('05_projects.csv', projects, Object.keys(projects[0] ?? {}));

// 06 — Project capability selections.
writeCsv('06_project_capabilities.csv', projectCaps, Object.keys(projectCaps[0] ?? {}));

// 07 — Assessments.
writeCsv(
  '07_assessments.csv',
  assessments.map(a => ({
    assessment_id:   a.id,
    beneficiary_ref: codeFromId(a.candidate_id),
    project_id:      a.project_id,
    cohort_id:       a.cohort_id,
    timepoint:       a.timepoint,
    assessed_on:     a.assessed_on,
    status:          a.status,
    him_score:       a.him_score,
    core_score:      a.core_score,
    optional_score:  a.optional_score,
    assessment_source: a.assessment_source,
    notes:           scrub(a.notes),
    created_at:      a.created_at,
    updated_at:      a.updated_at,
  })),
  ['assessment_id', 'beneficiary_ref', 'project_id', 'cohort_id', 'timepoint',
   'assessed_on', 'status', 'him_score', 'core_score', 'optional_score',
   'assessment_source', 'notes', 'created_at', 'updated_at'],
);

// 08 — Assessment responses (factor-level).
const assessmentToCandidate = new Map(assessments.map(a => [a.id, a.candidate_id]));
writeCsv(
  '08_assessment_responses.csv',
  responses.map(r => ({
    assessment_id:        r.assessment_id,
    beneficiary_ref:      codeFromId(assessmentToCandidate.get(r.assessment_id)),
    indicator_id:         r.indicator_id,
    numeric_value:        r.numeric_value,
    narrative:            scrub(r.narrative),
    observable_changes:   scrub(r.observable_changes),
    practices:            scrub(r.practices),
    evidence:             scrub(r.evidence),
    is_self_scored:       r.is_self_scored,
    captured_via:         r.captured_via,
    responded_at:         r.responded_at,
  })),
  ['assessment_id', 'beneficiary_ref', 'indicator_id', 'numeric_value',
   'narrative', 'observable_changes', 'practices', 'evidence',
   'is_self_scored', 'captured_via', 'responded_at'],
);

// 09 — Framework reference (factors + indicators) — no PII, included for context.
writeCsv('09_framework_factors.csv', factors, Object.keys(factors[0] ?? {}));
writeCsv('10_framework_indicators.csv', indicators, Object.keys(indicators[0] ?? {}));

// 11 — Interviews.
writeCsv(
  '11_interviews.csv',
  interviews.map(r => ({
    interview_id:     r.id,
    beneficiary_ref:  codeFromId(r.candidate_id),
    project_id:       r.project_id,
    partner_id:       r.partner_id,
    interview_date:   r.interview_date,
    stage:            r.stage,
    outcome:          r.outcome,
    role_title:       r.role_title,
    ach_feedback:     scrub(r.ach_feedback),
    partner_feedback: scrub(r.partner_feedback),
    notes:            scrub(r.notes),
  })),
  ['interview_id', 'beneficiary_ref', 'project_id', 'partner_id', 'interview_date',
   'stage', 'outcome', 'role_title', 'ach_feedback', 'partner_feedback', 'notes'],
);

// 12 — Training.
writeCsv(
  '12_training.csv',
  training.map(r => ({
    training_id:     r.id,
    beneficiary_ref: codeFromId(r.candidate_id),
    activity_title:  r.activity_title,
    provider:        r.provider,
    completed_at:    r.completed_at,
    duration_hours:  r.duration_hours,
    outcome:         r.outcome,
    notes:           scrub(r.notes),
  })),
  ['training_id', 'beneficiary_ref', 'activity_title', 'provider',
   'completed_at', 'duration_hours', 'outcome', 'notes'],
);

// 13 — Support.
writeCsv(
  '13_support.csv',
  support.map(r => ({
    support_id:      r.id,
    beneficiary_ref: codeFromId(r.candidate_id),
    logged_at:       r.logged_at,
    support_type:    r.support_type,
    delivered_by:    r.delivered_by,
    duration_mins:   r.duration_mins,
    notes:           scrub(r.notes),
  })),
  ['support_id', 'beneficiary_ref', 'logged_at', 'support_type',
   'delivered_by', 'duration_mins', 'notes'],
);

// 14 — Placements.
writeCsv(
  '14_placements.csv',
  placements.map(r => ({
    placement_id:    r.id,
    beneficiary_ref: codeFromId(r.candidate_id),
    partner_id:      r.partner_id,
    role_title:      r.role_title,
    start_date:      r.start_date,
    end_date:        r.end_date,
    salary_band:     r.salary_band,
    retention_3mo:   r.retention_3mo,
    retention_6mo:   r.retention_6mo,
    retention_12mo:  r.retention_12mo,
    notes:           scrub(r.notes),
  })),
  ['placement_id', 'beneficiary_ref', 'partner_id', 'role_title',
   'start_date', 'end_date', 'salary_band',
   'retention_3mo', 'retention_6mo', 'retention_12mo', 'notes'],
);

// 15 — Partners (no PII; included for cross-reference).
writeCsv('15_partners.csv', partners, Object.keys(partners[0] ?? {}));

// ──────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────

console.log('\nDone.');
console.log(`  Beneficiaries pseudonymised: ${candidates.length}`);
console.log(`  Output directory: ${path.resolve(OUT_DIR)}`);
console.log('\nBefore sending to ACH:');
console.log('  1. Review 00_mapping_key_CONFIDENTIAL.csv — delete if you do not want');
console.log('     to share the name → code mapping.');
console.log('  2. Spot-check 08_assessment_responses.csv for any names the scrubber');
console.log('     may have missed (nicknames, misspellings, partial names).');
console.log('  3. Zip the folder before transmitting.\n');
