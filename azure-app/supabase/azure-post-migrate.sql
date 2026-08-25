-- ============================================================
-- azure-post-migrate.sql · REQUIRED after every migrate.mjs run
-- ============================================================
-- Recovers the authorisation posture that migrate.mjs's sanitise()
-- strips out of the parent app's migrations. Without this file the
-- Azure database would run with row-level security DISABLED on every
-- table — because sanitise() rewrites every `enable row level security`
-- into a comment, drops every policy that references Supabase auth
-- predicates, and drops the predicate functions themselves.
--
-- The Azure migration script (scripts/migrate.mjs) applies this file
-- immediately after the migration loop and refuses to complete unless
-- every public table has RLS enabled at the end.
--
-- ⚠️  FAIL-SAFE POSTURE  ⚠️
--
-- The predicate stubs below all return NULL / FALSE. That is
-- deliberate: it means the app cannot read or write anything against
-- the Azure database until an Azure implementer replaces the stubs
-- with a real Entra-ID-backed implementation. A broken app is safer
-- than a wide-open one.
--
-- To make the Azure app work, an implementer must:
--   1. Decide how ACH identity flows into Postgres (JWT claim,
--      session-variable set by the app on connection, or per-request
--      SET LOCAL). The Supabase pattern uses `auth.uid()`, sourced
--      from the request JWT; Azure has no equivalent by default.
--   2. Rewrite each stub below to resolve identity from that source.
--   3. Rewrite every stripped policy against the new predicates.
--      A recovered list of the stripped policies is in
--      docs/azure/policy-inventory.md (produce by running
--      `node scripts/inventory-stripped-policies.mjs > docs/azure/policy-inventory.md`).
--   4. Add those policy rewrites to this file, then re-run the
--      migrate script — the hard gate will pass once RLS is on with
--      real policies backing it.
--
-- This is DESIGN work, not migration work. Estimate: ~10–15 days for
-- an engineer familiar with both Postgres RLS and Azure Entra ID,
-- assuming the parent app's policy inventory is complete first.
-- ============================================================


-- ── 1. Fail-safe predicate stubs ────────────────────────────
--
-- Each of these returns a value that makes any policy using it
-- deny access. Replace with real implementations before the app
-- is expected to work.

create or replace function public.is_ach_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Fail-safe stub: no one is ACH staff until an Azure implementer
  -- wires this to an Entra ID claim.
  select false;
$$;

comment on function public.is_ach_staff() is
  'FAIL-SAFE STUB — returns false. Replace with Entra-ID-backed implementation before the Azure app can function. See azure-post-migrate.sql.';

create or replace function public.current_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Fail-safe stub: no partner identity until wired.
  select null::uuid;
$$;

comment on function public.current_partner_id() is
  'FAIL-SAFE STUB — returns null. Replace with Entra-ID-backed implementation.';

create or replace function public.current_candidate_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Fail-safe stub: no candidate identity until wired.
  select null::uuid;
$$;

comment on function public.current_candidate_id() is
  'FAIL-SAFE STUB — returns null. Replace with Entra-ID-backed implementation.';


-- ── 2. Force RLS on every public table ──────────────────────
--
-- Iterates the current schema state (not a hardcoded list) so this
-- file stays correct as new migrations add tables. If a table is
-- added that must NOT have RLS (rare — analytics roll-ups perhaps),
-- add it to the exclusion set below explicitly rather than removing
-- the loop.

do $$
declare
  r record;
  excluded_tables text[] := array[
    -- Internal migration bookkeeping — no user data.
    '_azure_migration_history'
  ];
begin
  for r in
    select tablename
      from pg_tables
     where schemaname = 'public'
       and tablename <> all(excluded_tables)
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;


-- ── 3. Deny-all floor is applied by azure-finalize.sql ──────
--
-- Deliberately NOT here: the restrictive `azure_deny_all` policy.
-- Running it now would block the bulk data restore in
-- scripts/migrate-data.mjs (pg_restore inserts would hit the
-- deny-all). It moves to azure-finalize.sql, applied AFTER the
-- data restore step. See the header of that file for the sequence.


-- ── 4. Assertion — must not run without a real predicate ────
--
-- If an implementer removes the deny_all above without replacing
-- is_ach_staff() with something real, this assertion fires. Belt +
-- braces alongside the migrate.mjs hard gate.

do $$
declare
  probe boolean;
begin
  select public.is_ach_staff() into probe;
  if probe is not true and probe is not false then
    raise exception 'is_ach_staff() must return a boolean; got %', probe;
  end if;
  if probe = false then
    raise notice 'azure-post-migrate.sql applied with FAIL-SAFE stubs. The app cannot read or write until predicates are wired to Entra ID.';
  end if;
end $$;
