# Embedded-join .select() call sites — Azure rewrite list

The Supabase JS client accepts `.select('cohorts(name)')` and joins the
foreign table inline. The Azure adapter (`lib/azure/query-builder.ts`)
does not translate this — it now throws a clear error at runtime when
it sees the pattern (fail loudly, not silently).

Each row below has to be rewritten before the Azure app can render that
page. Two options per call site:

- **Rewrite to an explicit JOIN** — pass raw SQL through the adapter's
  RPC or run through `getPool().query()` directly.
- **Rewrite to a follow-up query** — do the primary `.from(...)`, then
  do a second `.from(child_table).in('parent_id', parent_ids)`, then
  join in application code.

The follow-up-query path is easier and matches how the rest of the
Azure adapter already works; the explicit-JOIN path performs better
for deep hierarchies (e.g. `projects → cohorts → cohort_candidates`).

## Inventory (auto-generated)

Count: **63 call sites** across `app/`, `lib/`, `components/`.

Regenerate after each rewrite pass:

```bash
grep -rn "\\.select('.*(" app lib components --include="*.ts" --include="*.tsx" \
  | grep -v "\\.select('\\*')" \
  | grep -E "\\.select\\('[^']*[a-z_]+\\(" \
  | grep -v "\\.select('count(" \
  | sort > azure-app/docs/AZURE-JOIN-CALL-SITES.raw.txt
```

## Sites

- `app/(ach)/aggregate/page.tsx:37:    supabase.from('cohort_candidates').select('cohort_id, candidate_id, candidates(id, status)'),`
- `app/(ach)/candidates/[id]/assess/page.tsx:100:    .select('id, start_date, role_title, partners(name)')`
- `app/(ach)/candidates/[id]/assess/page.tsx:72:    .select('cohort_id, cohorts(id, cohort_ref, name, project_id, projects(id, project_ref, name))')`
- `app/(ach)/candidates/[id]/case-study/page.tsx:79:      .select('id, start_date, end_date, role_title, partners(id, name)')`
- `app/(ach)/candidates/[id]/case-study/page.tsx:96:      .select('id, status, programme:programme_id(name, category)')`
- `app/(ach)/candidates/[id]/interviews/page.tsx:16:      .select('*, partners(name), cohorts(cohort_ref)')`
- `app/(ach)/candidates/[id]/page.tsx:28:    supabase.from('placements').select('id, role_title, salary_band, start_date, status, partners(name)').eq('candidate_id', params.id).order('start_date', { ascending: false }).limit(5),`
- `app/(ach)/candidates/[id]/page.tsx:29:    supabase.from('cohort_candidates').select('id, enrolled_at, cohorts(id, name, cohort_ref, status, project_id, projects(id, name), cohort_partners(partner_id, partners(id, name, types)))').eq('candidate_id', params.id),`
- `app/(ach)/candidates/[id]/page.tsx:32:    supabase.from('training_enrolments').select('id, status, enrolled_date, completed_date, training_programmes(id, name, code, category)').eq('candidate_id', params.id).order('enrolled_date', { ascending: false }),`
- `app/(ach)/candidates/[id]/page.tsx:33:    supabase.from('training_certificates').select('id, certificate_number, issued_date, attendance_pct, training_programmes(name)').eq('candidate_id', params.id).order('issued_date', { ascending: false }),`
- `app/(ach)/candidates/[id]/placements/new/page.tsx:21:      .select('cohort_id, cohorts(id, cohort_ref, name)')`
- `app/(ach)/candidates/[id]/training/page.tsx:18:      .select('*, cohorts(cohort_ref)')`
- `app/(ach)/candidates/import/page.tsx:24:    .select('id, cohort_ref, name, project_id, projects(name), created_at')`
- `app/(ach)/cohorts/[id]/capability-investor-report/page.tsx:38:    safeFetch<any[]>(() => supabase.from('cohort_candidates').select('candidate_id, candidates(id, candidate_ref, status)').eq('cohort_id', params.id), []),`
- `app/(ach)/cohorts/[id]/capability-investor-report/page.tsx:43:    safeFetch<any[]>(() => supabase.from('cohort_partners').select('id, partners(id, name)').eq('cohort_id', params.id), []),`
- `app/(ach)/cohorts/[id]/close-out/page.tsx:20:    supabase.from('cohort_candidates').select('candidate_id, candidates(id, candidate_ref, given_name, family_name, status)').eq('cohort_id', params.id),`
- `app/(ach)/cohorts/[id]/close-out/page.tsx:26:    supabase.from('cohort_partners').select('id, partners(id, name)').eq('cohort_id', params.id),`
- `app/(ach)/cohorts/[id]/grant-funder-report/page.tsx:27:    safeFetch<any[]>(() => supabase.from('cohort_candidates').select('candidate_id, candidates(id, candidate_ref, status)').eq('cohort_id', params.id), []),`
- `app/(ach)/cohorts/[id]/grant-funder-report/page.tsx:34:    safeFetch<any[]>(() => supabase.from('cohort_partners').select('id, partners(id, name)').eq('cohort_id', params.id), []),`
- `app/(ach)/cohorts/[id]/impact-12mo/page.tsx:19:    supabase.from('cohort_candidates').select('candidate_id, candidates(id, candidate_ref, given_name, family_name, status)').eq('cohort_id', params.id),`
- `app/(ach)/cohorts/[id]/impact-12mo/page.tsx:26:    supabase.from('cohort_partners').select('id, partners(id, name)').eq('cohort_id', params.id),`
- `app/(ach)/cohorts/[id]/page.tsx:21:    supabase.from('cohort_partners').select('id, partner_id, sponsorship_count, engagement_fee, is_lead_partner, partners(id, name, types)').eq('cohort_id', params.id),`
- `app/(ach)/cohorts/[id]/page.tsx:22:    supabase.from('cohort_candidates').select('id, candidate_id, sponsoring_partner_id, candidates(id, candidate_ref, given_name, status), partners:sponsoring_partner_id(name)').eq('cohort_id', params.id),`
- `app/(ach)/cohorts/[id]/training/page.tsx:14:    supabase.from('cohorts').select('id, cohort_ref, name, status, is_rolling, intervention_start_date, start_date, projects(id, name)').eq('id', params.id).maybeSingle(),`
- `app/(ach)/cohorts/[id]/training/page.tsx:16:      .select('id, candidate_id, candidates(id, candidate_ref, given_name, family_name, status)')`
- `app/(ach)/cohorts/page.tsx:19:    .select('id, cohort_ref, name, structure, status, location, start_date, target_size, project_id, projects(id, project_ref, name)')`
- `app/(ach)/dashboard/page.tsx:56:    safeFetch<any[]>(() => supabase.from('candidate_change_log').select('id, changed_at, field_name, candidate_id, candidates(candidate_ref)').order('changed_at', { ascending: false }).limit(6), []),`
- `app/(ach)/dashboard/page.tsx:57:    safeFetch<any[]>(() => supabase.from('candidate_status_transitions').select('id, from_status, to_status, changed_at, candidate_id, candidates(candidate_ref)').order('changed_at', { ascending: false }).limit(6), []),`
- `app/(ach)/featured-quotes/page.tsx:22:      .select('id, quote_text, context, speaker_type, source_type, use_anonymised, display_name, tagged_at, candidate_id, cohort_id, candidates(candidate_ref, given_name), cohorts(name, project_id)')`
- `app/(ach)/partners/[id]/page.tsx:47:    .select('id, role_title, salary_band, start_date, status, cohort_id, cohorts(cohort_ref, name)')`
- `app/(ach)/placements/[id]/timepoints/page.tsx:16:      .select('id, role_title, start_date, status, candidate_id, candidates(candidate_ref, given_name, family_name), partners(id, name)')`
- `app/(ach)/placements/timepoints/page.tsx:59:      .select('id, candidate_id, role_title, start_date, status, candidates(id, candidate_ref, given_name, family_name), partners(id, name)')`
- `app/(ach)/pricing/[id]/page.tsx:23:    .select('*, partners(id, name, type), cohorts(id, name, cohort_ref)')`
- `app/(ach)/pricing/page.tsx:22:    .select('id, quote_ref, track, status, suggested_price, traffic_light, candidate_count, partner_id, partners(name), created_at, valid_until')`
- `app/(ach)/projects/[id]/assess/[assessmentId]/page.tsx:45:    supabase.from('assessments').select('*, closing_reflection_text, closing_reflection_captured_via, closing_reflection_language, closing_reflection_audio_id, candidates(candidate_ref, given_name, preferred_locale)').eq('id', params.assessmentId).maybeSingle(),`
- `app/(ach)/projects/[id]/assess/page.tsx:60:        .select('candidate_id, candidates(id, candidate_ref, given_name, family_name, status)')`
- `app/(ach)/projects/[id]/outcomes-report/page.tsx:60:    supabase.from('cohort_candidates').select('candidate_id, cohort_id, candidates(id, candidate_ref, given_name, family_name, status, country_of_origin, arrival_year)').limit(1000),`
- `app/(ach)/projects/[id]/outcomes-report/page.tsx:72:    supabase.from('featured_quotes').select('quote_text, context, speaker_type, use_anonymised, display_name, candidate_id, cohort_id, candidates(candidate_ref, given_name, country_of_origin, arrival_year)').is('archived_at', null).limit(200),`
- `app/(ach)/projects/[id]/outcomes-report/page.tsx:73:    supabase.from('cohort_partners').select('cohort_id, is_lead_partner, partners(id, name, types)'),`
- `app/(ach)/projects/[id]/page.tsx:75:      .select('id, timepoint, assessed_on, status, candidate_id, candidates(candidate_ref, given_name)')`
- `app/(ach)/projects/[id]/page.tsx:78:      .select('id, cohort_ref, name, status, location, start_date, target_size, cohort_candidates(id)')`
- `app/(ach)/projects/[id]/page.tsx:93:    supabase.from('project_training_programmes').select('programme_id, training_programmes(id, name, category, status, source_activity_id, total_sessions, duration_hours)').eq('project_id', params.id),`
- `app/(ach)/projects/[id]/page.tsx:99:    ? await supabase.from('cohort_candidates').select('candidate_id, candidates(id, candidate_ref, given_name, family_name)').in('cohort_id', cohortIdsForBen)`
- `app/(ach)/toms-crosswalk/page.tsx:21:    supabase.from('toms_crosswalk').select('*, toms_codes(measure, proxy_value_pence, play, unit)').order('sort_order'),`
- `app/(ach)/training/my/page.tsx:25:    .select('id, session_number, session_title, scheduled_date, scheduled_start, scheduled_end, room, tutor_name, tutor_id, status, training_programmes(id, name)')`
- `app/(ach)/training/page.tsx:25:      .select('id, scheduled_date, scheduled_start, room, tutor_name, status, training_programmes(name)')`
- `app/(ach)/training/programmes/[id]/effectiveness/page.tsx:43:    safeFetch<any[]>(() => supabase.from('project_training_programmes').select('project_id, projects(id, name, project_ref)').eq('programme_id', params.id), []),`
- `app/(ach)/training/programmes/[id]/page.tsx:28:    supabase.from('training_enrolments').select('id, candidate_id, status, enrolled_date, completed_date, candidates(id, candidate_ref, given_name, family_name)').eq('programme_id', params.id).order('enrolled_date', { ascending: false }),`
- `app/(ach)/training/programmes/[id]/page.tsx:33:    supabase.from('training_attendance').select('candidate_id, status, session_id, training_sessions!inner(programme_id)').eq('training_sessions.programme_id', params.id),`
- `app/(ach)/training/programmes/[id]/page.tsx:35:    supabase.from('project_training_programmes').select('project_id, projects(id, name, project_ref, status)').eq('programme_id', params.id),`
- `app/(ach)/training/sessions/[id]/page.tsx:19:    .select('*, training_programmes(id, name, code)')`
- `app/(ach)/training/sessions/[id]/page.tsx:29:      .select('candidate_id, status, candidates(id, candidate_ref, given_name, family_name)')`
- `app/(ach)/training/sessions/[id]/page.tsx:38:      .select('id, candidate_id, note_kind, note_text, created_at, candidates(candidate_ref)')`
- `app/(ach)/training/sessions/page.tsx:18:    .select('id, scheduled_date, scheduled_start, room, tutor_name, status, session_number, session_title, training_programmes(id, name)');`
- `app/api/training/export/route.ts:27:    supabase.from('training_enrolments').select('id, candidate_id, programme_id, status, enrolled_date, completed_date, candidates(candidate_ref, given_name, family_name)'),`
- `app/api/training/export/route.ts:29:    supabase.from('training_attendance').select('candidate_id, status, session_id, training_sessions!inner(programme_id)'),`
- `app/report/[token]/page.tsx:13:    .select('id, partner_id, project_id, label, expires_at, revoked_at, partners(id, name)')`
- `app/report/[token]/page.tsx:29:    .select('id, role_title, start_date, status, candidates(candidate_ref, given_name, family_name)')`
- `app/report/[token]/placement/[placementId]/page.tsx:19:    .select('id, partner_id, revoked_at, expires_at, partners(name)')`
- `app/report/[token]/placement/[placementId]/page.tsx:30:    .select('id, role_title, start_date, status, partner_id, candidates(candidate_ref, given_name, family_name)')`
- `components/partner-portal/workforce-partner-dashboard.tsx:22:      .select('id, role_title, salary_band, salary_actual, start_date, status, cohort_id, cohorts(project_id), candidates(id, candidate_ref, given_name, country_of_origin)')`
- `components/partner-portal/workforce-partner-dashboard.tsx:25:      .select('id, cohorts(id, cohort_ref, name, status, project_id)')`
- `lib/assessments/actions.ts:143:    .select('cohort_id, cohorts(project_id)')`
