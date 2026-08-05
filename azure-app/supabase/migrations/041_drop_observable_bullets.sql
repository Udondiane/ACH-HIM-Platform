-- ============================================================
-- Migration 041 — drop factors.observable_bullets (D9 from audit)
-- ============================================================
-- The `observable_bullets` jsonb column on `factors` was a convenience
-- copy of the same rows that live in `indicators` (per the comment in
-- 029_him_reference_taxonomy.sql:31 — "the indicators table still holds
-- the structured rows; this is a convenience copy"). Two-source drift
-- risk with no upside — readers have been migrated to `indicators`.
--
-- Data safety: indicators has already been populated from
-- observable_bullets in 029:189-198, so all bullet content survives
-- this drop. No user-collected data lives on this column.
-- ============================================================

-- Sanity backfill for any factor that has observable_bullets but zero
-- indicators rows (should not occur given 029, but defensive against
-- hand-edits). Idempotent.
insert into public.indicators (id, factor_id, name, sort_order)
select
  f.id || '.b' || ord::text as id,
  f.id                       as factor_id,
  t.bullet                   as name,
  ord::int                   as sort_order
from public.factors f
cross join lateral jsonb_array_elements_text(coalesce(f.observable_bullets, '[]'::jsonb)) with ordinality as t(bullet, ord)
where f.observable_bullets is not null
  and not exists (select 1 from public.indicators i where i.factor_id = f.id)
on conflict (id) do nothing;

alter table public.factors drop column if exists observable_bullets;
