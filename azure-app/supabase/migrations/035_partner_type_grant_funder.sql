-- Add 'grant_funder' to the partner_type taxonomy.
--
-- The original three types (capability_investor, workforce_partner,
-- training_partner) are all commercial buyer relationships. They don't
-- accommodate grant-makers like Comic Relief, the National Lottery,
-- charitable trusts (Esmée Fairbairn, Henry Smith, Paul Hamlyn), or
-- statutory bodies (DWP, Home Office) and Combined Authorities (WMCA,
-- GMCA). These partners fund delivery via restricted grants and receive
-- outcome reports rather than placement milestones or commercial returns.
--
-- Postgres does not allow ADD VALUE inside a transaction block, so this
-- migration uses a single ALTER TYPE statement that supabase will run as
-- its own statement. IF NOT EXISTS makes the migration idempotent.

ALTER TYPE public.partner_type ADD VALUE IF NOT EXISTS 'grant_funder';
