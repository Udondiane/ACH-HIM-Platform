-- ============================================================
-- azure-finalize.sql · run AFTER data-restore, before app cutover
-- ============================================================
-- Adds the last-resort deny-all restrictive policy on every public
-- table. This closes the window where a stripped-but-partially-
-- surviving Supabase policy would silently grant access on Azure.
--
-- ────────────────────────────────────────────────────────────
-- ⚠️  DO NOT RUN AS PART OF SCHEMA MIGRATION  ⚠️
--
-- azure-post-migrate.sql (fail-safe predicates + `enable row level
-- security` on every table) runs at the end of migrate.mjs. That is
-- safe on an empty DB.
--
-- THIS file (azure-finalize.sql) adds `azure_deny_all` as a
-- RESTRICTIVE policy — meaning it stacks with any other policy and
-- always denies unless a PERMISSIVE policy exists. Running it
-- BEFORE data-restore would block the restore because pg_restore's
-- inserts would hit the deny-all.
--
-- Correct sequence (see scripts/migrate.mjs and migrate-data.mjs):
--   1. migrate.mjs                     (schema + post-migrate stubs)
--   2. migrate-data.mjs --step=restore (data load; RLS bypass via
--                                       session_replication_role=replica)
--   3. THIS file                        (deny-all floor)
--   4. Real policy rewrites             (Entra-ID-backed; design work)
--   5. Cutover
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select tablename
      from pg_tables
     where schemaname = 'public'
       and tablename <> '_azure_migration_history'
  loop
    execute format(
      'drop policy if exists azure_deny_all on public.%I',
      r.tablename
    );
    execute format(
      'create policy azure_deny_all on public.%I as restrictive for all using (false) with check (false)',
      r.tablename
    );
  end loop;
end $$;

-- Diagnostic: how many public tables now have policies vs how many
-- are relying solely on the deny-all floor. Zero real policies means
-- the Entra-ID policy rewrite work has not been done yet.
do $$
declare
  tables_with_real_policies int;
  total_public_tables int;
begin
  select count(*) into total_public_tables
    from pg_tables where schemaname = 'public'
      and tablename <> '_azure_migration_history';

  select count(distinct tablename) into tables_with_real_policies
    from pg_policies where schemaname = 'public' and policyname <> 'azure_deny_all';

  raise notice
    'azure-finalize.sql applied. %/% public tables have policies beyond azure_deny_all. If this ratio is 0/%, the Entra-ID policy rewrite is still pending and the app cannot function.',
    tables_with_real_policies, total_public_tables, total_public_tables;
end $$;
