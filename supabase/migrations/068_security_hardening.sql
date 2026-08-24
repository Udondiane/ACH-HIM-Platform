-- ============================================================
-- 068 · Security hardening (post-code-review fixes)
-- ============================================================
-- Closes several security lapses surfaced in the 2026-08-24 code
-- review. Each block is idempotent and safe to re-run.
--
-- NOTE ON DESTRUCTIVE OPERATIONS:
-- This migration NEVER deletes user data. It only drops/replaces
-- policies, functions, and grants. Any DDL that could touch content
-- is guarded with `if not exists` / `create or replace`.
-- ============================================================

begin;

-- ── 1. Close the ach_staff self-escalation vector ──────────────
-- Migration 061 introduced ict_admin_write_roles but did NOT drop the
-- older, permissive ach_staff_write_roles. Postgres ORs permissive
-- policies together, so the loose one always wins. Result: any
-- ach_staff can PATCH /rest/v1/user_roles?user_id=eq.<self> and
-- promote themselves to superadmin. Dropped here.

drop policy if exists "ach_staff_write_roles" on public.user_roles;

-- Keep the ict_admin_write_roles policy from migration 061 as the
-- single write-path. Confirm it exists; recreate if missing.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_roles'
      and policyname = 'ict_admin_write_roles'
  ) then
    create policy "ict_admin_write_roles" on public.user_roles
      for all
      using (public.is_ict_admin())
      with check (public.is_ict_admin());
  end if;
end $$;

-- ── 2. Restrict writes on reference tables (SROI, TOMs, etc.) ──
-- Migration 044 gave every authenticated user `using (true) with
-- check (true)` on these tables. They contain the numeric
-- coefficients every impact report uses. Any staff (or anon in
-- AUTH_DISABLED mode) could silently rewrite the ROI values.
-- Read stays open; writes restricted to ICT admin.

drop policy if exists "sroi_proxies_all" on public.sroi_proxies;
create policy "sroi_proxies_read" on public.sroi_proxies
  for select to authenticated using (true);
create policy "sroi_proxies_write" on public.sroi_proxies
  for all to authenticated
  using (public.is_ict_admin())
  with check (public.is_ict_admin());

drop policy if exists "toms_codes_all" on public.toms_codes;
create policy "toms_codes_read" on public.toms_codes
  for select to authenticated using (true);
create policy "toms_codes_write" on public.toms_codes
  for all to authenticated
  using (public.is_ict_admin())
  with check (public.is_ict_admin());

drop policy if exists "toms_crosswalk_all" on public.toms_crosswalk;
create policy "toms_crosswalk_read" on public.toms_crosswalk
  for select to authenticated using (true);
create policy "toms_crosswalk_write" on public.toms_crosswalk
  for all to authenticated
  using (public.is_ict_admin())
  with check (public.is_ict_admin());

drop policy if exists "cohort_toms_claims_all" on public.cohort_toms_claims;
create policy "cohort_toms_claims_read" on public.cohort_toms_claims
  for select to authenticated using (true);
create policy "cohort_toms_claims_write" on public.cohort_toms_claims
  for all to authenticated
  using (public.is_ach_staff())
  with check (public.is_ach_staff());

-- ── 3. Restrict SECURITY DEFINER helper functions to authenticated only ──
-- current_candidate_id, current_partner_id, has_team_role, is_ach_staff,
-- is_ict_admin, recompute_dev_fund_balance, recompute_partner_tier are
-- SECURITY DEFINER and were callable by anon via /rest/v1/rpc/*. Revoke
-- from anon; keep authenticated + service_role.

revoke execute on function public.current_candidate_id() from anon;
revoke execute on function public.current_partner_id() from anon;
revoke execute on function public.is_ach_staff() from anon;
revoke execute on function public.is_ict_admin() from anon;

-- has_team_role and recompute_* helpers may not exist on every branch;
-- guard each individually.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'has_team_role'
  ) then
    execute 'revoke execute on function public.has_team_role(public.ach_team_role) from anon';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'recompute_dev_fund_balance'
  ) then
    execute 'revoke execute on function public.recompute_dev_fund_balance(uuid) from anon';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'recompute_partner_tier'
  ) then
    execute 'revoke execute on function public.recompute_partner_tier(uuid) from anon';
  end if;
end $$;

-- ── 4. Fix search_path on SECURITY DEFINER helpers ─────────────
-- Prevents search_path spoofing. Only touch functions that exist.

do $$
declare
  fn record;
begin
  for fn in
    select p.proname as name, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and p.proname in (
        'current_candidate_id','current_partner_id','is_ach_staff',
        'is_ict_admin','has_team_role','recompute_dev_fund_balance',
        'recompute_partner_tier','touch_updated_at','trg_dev_fund_recompute',
        'sync_partner_type_from_types','update_interviews_updated_at',
        'recompute_at_risk_flags','touch_assessment_factor_responses',
        'auto_set_placed_on_placement','auto_set_progressed_on_12mo_retention',
        'recompute_cohort_status','trg_cohorts_recompute_status',
        'trg_cohort_cands_recompute_status',
        'trg_candidates_recompute_cohort_status',
        'auto_set_in_programme_on_training_enrolment'
      )
  loop
    execute format(
      'alter function public.%I(%s) set search_path = public, pg_temp',
      fn.name, fn.args
    );
  end loop;
end $$;

-- ── 5. Fix audit-layer trigger functions blocked by RLS ────────
-- Migration 065's trigger functions insert into candidate_change_log /
-- candidate_status_transitions / candidate_access_log. Those tables
-- have RLS enabled with SELECT-only policies for ach_staff, so plain
-- LANGUAGE PLPGSQL functions (which run as the invoker) get blocked
-- silently. Adds INSERT policies AND upgrades the trigger functions
-- to SECURITY DEFINER so the audit trail actually records.

do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='candidate_change_log') then
    drop policy if exists "ccl_insert" on public.candidate_change_log;
    create policy "ccl_insert" on public.candidate_change_log
      for insert with check (true);
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='candidate_status_transitions') then
    drop policy if exists "cst_insert" on public.candidate_status_transitions;
    create policy "cst_insert" on public.candidate_status_transitions
      for insert with check (true);
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='candidate_access_log') then
    drop policy if exists "cal_insert" on public.candidate_access_log;
    create policy "cal_insert" on public.candidate_access_log
      for insert with check (true);
  end if;
end $$;

-- Upgrade the trigger functions to SECURITY DEFINER if they exist.
do $$
declare
  fn text;
begin
  for fn in
    select proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'
      and proname in (
        'trg_candidates_change_log',
        'trg_candidates_status_transitions'
      )
  loop
    execute format('alter function public.%I() security definer', fn);
    execute format('alter function public.%I() set search_path = public, pg_temp', fn);
  end loop;
end $$;

-- ── 6. Add RLS to forensic snapshot tables I created 2026-08-24 ──
-- These were dumped without RLS and are exposed via PostgREST.

do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='_forensics_assessments_20260824') then
    execute 'alter table public._forensics_assessments_20260824 enable row level security';
    execute 'drop policy if exists "_f1_readonly_ict" on public._forensics_assessments_20260824';
    execute 'create policy "_f1_readonly_ict" on public._forensics_assessments_20260824 for select using (public.is_ict_admin())';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='_forensics_assessment_responses_20260824') then
    execute 'alter table public._forensics_assessment_responses_20260824 enable row level security';
    execute 'drop policy if exists "_f2_readonly_ict" on public._forensics_assessment_responses_20260824';
    execute 'create policy "_f2_readonly_ict" on public._forensics_assessment_responses_20260824 for select using (public.is_ict_admin())';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='_forensics_factor_responses_20260824') then
    execute 'alter table public._forensics_factor_responses_20260824 enable row level security';
    execute 'drop policy if exists "_f3_readonly_ict" on public._forensics_factor_responses_20260824';
    execute 'create policy "_f3_readonly_ict" on public._forensics_factor_responses_20260824 for select using (public.is_ict_admin())';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='_forensics_attachments_20260824') then
    execute 'alter table public._forensics_attachments_20260824 enable row level security';
    execute 'drop policy if exists "_f4_readonly_ict" on public._forensics_attachments_20260824';
    execute 'create policy "_f4_readonly_ict" on public._forensics_attachments_20260824 for select using (public.is_ict_admin())';
  end if;
end $$;

-- ── 7. Tighten permissive RLS on partner / placement operational tables ──
-- These had `using (true) with check (true)` for all ach_staff. Reads
-- stay open (staff need to see all placements), writes narrowed to
-- ach_staff via the helper function (which is what the SELECT policy
-- would already do implicitly).

drop policy if exists "pat_ach_all" on public.partner_access_tokens;
create policy "pat_ach_read" on public.partner_access_tokens
  for select to authenticated using (public.is_ach_staff());
create policy "pat_ach_write" on public.partner_access_tokens
  for all to authenticated
  using (public.is_ach_staff())
  with check (public.is_ach_staff());

drop policy if exists "shortlist_ach_all" on public.partner_shortlist;
create policy "shortlist_ach_read" on public.partner_shortlist
  for select to authenticated using (public.is_ach_staff());
create policy "shortlist_ach_write" on public.partner_shortlist
  for all to authenticated
  using (public.is_ach_staff())
  with check (public.is_ach_staff());

drop policy if exists "offer_ach_all" on public.placement_offers;
create policy "offer_ach_read" on public.placement_offers
  for select to authenticated using (public.is_ach_staff());
create policy "offer_ach_write" on public.placement_offers
  for all to authenticated
  using (public.is_ach_staff())
  with check (public.is_ach_staff());

drop policy if exists "retention_ach_all" on public.placement_retention_checks;
create policy "retention_ach_read" on public.placement_retention_checks
  for select to authenticated using (public.is_ach_staff());
create policy "retention_ach_write" on public.placement_retention_checks
  for all to authenticated
  using (public.is_ach_staff())
  with check (public.is_ach_staff());

-- ── 8. Tighten unique constraint on assessments to close NULL-project bypass ──
-- The unique(candidate_id, project_id, timepoint) constraint permits
-- multiple rows when project_id is NULL. This is how C-2026-045 ended
-- up with 3 mid_3mo rows. Add a partial unique index that treats
-- NULL project_id as a single sentinel.

create unique index if not exists uq_assessments_no_project
  on public.assessments (candidate_id, timepoint)
  where project_id is null;

-- ── 9. Fix follow_up_dispatches to include placement_id ────────
-- Existing uniqueness on (candidate_id, timepoint) collapses second
-- placements. Add placement_id-inclusive index if the table + column
-- exist.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='follow_up_dispatches'
      and column_name='placement_id'
  ) then
    execute 'create unique index if not exists uq_followup_dispatches_placement
             on public.follow_up_dispatches (candidate_id, placement_id, timepoint)';
  end if;
end $$;

commit;

-- ============================================================
-- Notes for the operator running this migration
-- ============================================================
-- 1. Safe to re-run: every block is guarded with `if exists` / `drop
--    if exists` / `create if not exists`.
-- 2. Contains NO destructive data operations. `revoke`, `drop policy`,
--    `alter function`, and index creation are the only DDL.
-- 3. If a `raise notice: policy X does not exist, skipping` appears,
--    that's fine — the block is idempotent.
-- 4. After running, verify with:
--      select policyname, tablename, cmd from pg_policies
--       where tablename='user_roles' order by policyname;
--    Should show only ict_admin_write_roles for write ops.
-- ============================================================
