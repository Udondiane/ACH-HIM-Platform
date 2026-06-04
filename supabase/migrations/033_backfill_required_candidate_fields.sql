-- The candidate schema now treats family_name, country_of_origin, and
-- arrival_year as required (zod min(1) / coerce.number()). Rows created
-- before this change may have NULL in any of them. Editing those rows
-- would fail validation on submit because the form sends back empty
-- strings.
--
-- Backfill placeholders so legacy rows can be opened and saved. Staff
-- can correct the placeholders during the next review pass; the values
-- are deliberately conspicuous so they don't blend in with real data.

UPDATE public.candidates
SET family_name = '— unknown —'
WHERE family_name IS NULL OR btrim(family_name) = '';

UPDATE public.candidates
SET country_of_origin = '— unknown —'
WHERE country_of_origin IS NULL OR btrim(country_of_origin) = '';

UPDATE public.candidates
SET arrival_year = EXTRACT(YEAR FROM created_at)::int
WHERE arrival_year IS NULL;
