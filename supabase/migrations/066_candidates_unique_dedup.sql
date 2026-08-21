-- ============================================================
-- 066 · unique indexes on candidates for dedup enforcement
-- ============================================================
-- Adds DB-level uniqueness on the three natural keys that identify a
-- beneficiary — email, national insurance number, phone. Normalised
-- so casual variations (case, whitespace, dashes) still collide.
--
-- Backstop for the app-level dedup in bulkImportCandidatesAction +
-- createCandidateAction — if either has a bug or misses a variant,
-- Postgres refuses the duplicate insert.
--
-- Partial indexes (`where` clauses) mean rows with a NULL / empty
-- identifier don't participate. So a candidate with no email + no NI
-- + no phone can still exist (some walk-in cases). But once any one
-- of the three is populated, it must be unique across the platform.
--
-- If this migration fails with "could not create unique index" the
-- DB already has duplicate rows — run the diagnostic block at the
-- bottom (commented out) to find them, resolve, then re-run 066.
--
-- Belt-and-braces: also ADD the ni_number column itself if it's
-- missing. The app has always referenced this field but no earlier
-- migration ever created it on the candidates table, so any DB that
-- ran migration 064 got an index-on-nothing error and skipped the
-- index. This migration heals both the missing column AND the
-- missing index in one pass.
-- ============================================================

alter table public.candidates
  add column if not exists ni_number text;

create unique index if not exists uq_candidates_email_lower
  on public.candidates(lower(trim(email)))
  where email is not null and length(trim(email)) > 0;

create unique index if not exists uq_candidates_ni_upper
  on public.candidates(upper(regexp_replace(ni_number, '\s', '', 'g')))
  where ni_number is not null and length(trim(ni_number)) > 0;

create unique index if not exists uq_candidates_phone_digits
  on public.candidates(regexp_replace(phone, '[^0-9]', '', 'g'))
  where phone is not null and length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 10;

comment on index public.uq_candidates_email_lower is
  'Enforces case-insensitive, trim-insensitive email uniqueness across candidates. Backstop against duplicate imports.';
comment on index public.uq_candidates_ni_upper is
  'Enforces whitespace + case-normalised NI-number uniqueness. Backstop against duplicate imports.';
comment on index public.uq_candidates_phone_digits is
  'Enforces digits-only phone uniqueness (min 10 digits) across candidates. Ignores spaces, dashes, parens, plus signs.';

-- ── Duplicate diagnostic (commented — run standalone if the CREATE fails) ──
--
-- select 'email' as kind, lower(trim(email)) as key, count(*), array_agg(candidate_ref) as refs
-- from public.candidates
-- where email is not null and length(trim(email)) > 0
-- group by lower(trim(email)) having count(*) > 1
-- union all
-- select 'ni', upper(regexp_replace(ni_number, '\s', '', 'g')), count(*), array_agg(candidate_ref)
-- from public.candidates
-- where ni_number is not null and length(trim(ni_number)) > 0
-- group by upper(regexp_replace(ni_number, '\s', '', 'g')) having count(*) > 1
-- union all
-- select 'phone', regexp_replace(phone, '[^0-9]', '', 'g'), count(*), array_agg(candidate_ref)
-- from public.candidates
-- where phone is not null and length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 10
-- group by regexp_replace(phone, '[^0-9]', '', 'g') having count(*) > 1;
