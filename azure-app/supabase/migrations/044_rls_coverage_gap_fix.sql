-- ============================================================
-- Migration 044 — RLS coverage gap fix (Phase 2 security audit)
-- ============================================================
-- Post-audit finding from docs/deployment/02-security.md:
--   • cohort_toms_claims       — operational data, RLS missing
--   • sroi_proxies             — reference data, RLS defense-in-depth
--   • toms_codes               — reference data, RLS defense-in-depth
--   • toms_crosswalk           — reference data, RLS defense-in-depth
--
-- All four now enabled with the platform's standard permissive
-- authenticated-user policy.  RLS becomes real once SSO wires the
-- current-user context to the policies (Phase 3).
-- ============================================================

do $$
declare tbl text;
begin
  for tbl in
    select unnest(array[
      'cohort_toms_claims',
      'sroi_proxies',
      'toms_codes',
      'toms_crosswalk'
    ])
  loop
    if exists (select 1 from information_schema.tables
               where table_schema='public' and table_name=tbl) then
      execute format('alter table public.%I enable row level security', tbl);
      execute format('drop policy if exists "%s_all" on public.%I', tbl, tbl);
      execute format('create policy "%s_all" on public.%I for all to authenticated using (true) with check (true)', tbl, tbl);
    end if;
  end loop;
end $$;

commit;
