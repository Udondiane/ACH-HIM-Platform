-- ============================================================
-- 064 · candidates comprehensive intake schema
-- ============================================================
-- Rebuilds the candidates row to hold everything ACH realistically
-- captures on beneficiary application forms — Microsoft Forms exports,
-- Google Forms sheets, hand-typed CSVs from partner organisations. Two
-- concerns rolled into one migration:
--
-- 1. CRITICAL FIX. The bulk import in lib/candidates/actions.ts has
--    been writing to columns that never existed (email, phone,
--    date_of_birth, address_line1, postcode, preferred_name). Every
--    imported row silently failed at insert. This migration adds those
--    columns so the existing import code path works end-to-end.
--
-- 2. EXPANSION. Adds the full slate of intake fields refugee-support
--    charities routinely collect: demographics, immigration status,
--    location/housing, family/dependants, employment history,
--    qualifications, skills, health/accessibility, referral source,
--    communication preferences, emergency contact, programme fit.
--    Anything unmatched by an application-form column still falls
--    through to application_source_data (jsonb) as before — nothing
--    is lost, more is now first-class.
--
-- All columns are NULLABLE by design. The two hard requirements at
-- import time stay: a name + one contact method. Everything else is
-- optional and best-effort.
-- ============================================================

-- ── 1. Fix the columns the import already tries to write ──────────
alter table public.candidates
  add column if not exists email          text,
  add column if not exists phone          text,
  add column if not exists date_of_birth  date,
  add column if not exists preferred_name text,
  add column if not exists address_line1  text,
  add column if not exists address_line2  text,
  add column if not exists city           text,
  add column if not exists postcode       text;

create index if not exists idx_candidates_email    on public.candidates(lower(email))    where email is not null;
create index if not exists idx_candidates_ni       on public.candidates(ni_number)       where ni_number is not null;
create index if not exists idx_candidates_postcode on public.candidates(postcode)        where postcode is not null;

-- ── 2. Demographics ──────────────────────────────────────────────
alter table public.candidates
  add column if not exists gender     text,
  add column if not exists pronouns   text,
  add column if not exists ethnicity  text,
  add column if not exists religion   text;

-- ── 3. Immigration status ─────────────────────────────────────────
alter table public.candidates
  add column if not exists immigration_status     text,
  add column if not exists home_office_reference  text,
  add column if not exists brp_number             text,
  add column if not exists right_to_work_status   text,
  add column if not exists visa_expires_on        date;

-- ── 4. Location / housing ─────────────────────────────────────────
alter table public.candidates
  add column if not exists local_authority        text,
  add column if not exists housing_type           text,
  add column if not exists accommodation_provider text;

-- ── 5. Family / household ─────────────────────────────────────────
alter table public.candidates
  add column if not exists dependants_count            integer,
  add column if not exists children_ages               text,
  add column if not exists has_caring_responsibilities boolean;

-- ── 6. Employment history + qualifications ────────────────────────
alter table public.candidates
  add column if not exists previous_occupation       text,
  add column if not exists highest_qualification     text,
  add column if not exists qualification_country     text,
  add column if not exists qualifications_recognised_uk boolean,
  add column if not exists current_employment_status text;

-- ── 7. Skills ─────────────────────────────────────────────────────
alter table public.candidates
  add column if not exists languages_spoken        text[],
  add column if not exists driving_licence         text,
  add column if not exists digital_skills_self_reported text;

-- ── 8. Health / accessibility ─────────────────────────────────────
alter table public.candidates
  add column if not exists disability_status           text,
  add column if not exists accessibility_needs         text,
  add column if not exists long_term_health_conditions text;

-- ── 9. Referral route ─────────────────────────────────────────────
alter table public.candidates
  add column if not exists referral_source        text,
  add column if not exists referrer_organisation  text,
  add column if not exists referrer_contact       text;

-- ── 10. Communication preferences ─────────────────────────────────
alter table public.candidates
  add column if not exists interpreter_needed        boolean,
  add column if not exists interpreter_language      text,
  add column if not exists preferred_contact_channel text,
  add column if not exists preferred_contact_time    text;

-- ── 11. Emergency contact ─────────────────────────────────────────
alter table public.candidates
  add column if not exists emergency_contact_name         text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists emergency_contact_phone        text;

-- ── 12. Programme fit ─────────────────────────────────────────────
alter table public.candidates
  add column if not exists programme_hopes           text,
  add column if not exists availability              text,
  add column if not exists barriers_to_engagement    text,
  add column if not exists prior_engagement_with_ach boolean;

-- ── 13. Extended consent (photograph, partner share, research) ────
alter table public.candidate_consent
  add column if not exists may_be_photographed      boolean not null default false,
  add column if not exists may_share_with_partners  boolean not null default false,
  add column if not exists may_share_with_researchers boolean not null default false;

-- Comments — auditable spec of what each column represents, useful
-- when ICT hands off to a downstream analyst later.
comment on column public.candidates.email is 'Primary email address collected on the application form.';
comment on column public.candidates.phone is 'Primary UK phone number, digits+spacing preserved as entered.';
comment on column public.candidates.date_of_birth is 'DOB parsed from the intake form (ISO date).';
comment on column public.candidates.gender is 'Self-reported gender identity. Free-text or one of male/female/non_binary/self_describe/prefer_not_say.';
comment on column public.candidates.immigration_status is 'Refugee status label (asylum_seeker / refugee_status / ilr / eu_settled / citizen / other). Kept as text so partner-specific taxonomies survive.';
comment on column public.candidates.right_to_work_status is 'e.g. share_code, brp_valid, awaiting_decision, restricted, no_recourse. Text to accommodate the Home Office labels du jour.';
comment on column public.candidates.local_authority is 'Council/borough name for outreach targeting and reporting rolls-up.';
comment on column public.candidates.dependants_count is 'Number of dependants living with the candidate (typically children under 18).';
comment on column public.candidates.previous_occupation is 'Job the candidate held in their country of origin — feeds skills-recognition conversations.';
comment on column public.candidates.qualifications_recognised_uk is 'Whether their overseas qualifications have been UK-ENIC recognised.';
comment on column public.candidates.languages_spoken is 'Array of language names the candidate speaks. Distinct from preferred_locale, which is the app language.';
comment on column public.candidates.referral_source is 'Who introduced the candidate to ACH (self / ngo / gp / jcp / partner / other).';
comment on column public.candidates.interpreter_needed is 'Whether an interpreter is required for assessments and coaching.';
comment on column public.candidates.availability is 'Days/hours the candidate can attend sessions — free text captured verbatim.';
comment on column public.candidates.barriers_to_engagement is 'Anything the candidate flagged that might get in the way — childcare, transport, health, work hours.';
comment on column public.candidate_consent.may_be_photographed is 'Consent to being photographed at ACH events and having those photos used in ACH materials.';
comment on column public.candidate_consent.may_share_with_partners is 'Consent to sharing identifiable candidate data with named workforce/grant partners.';
comment on column public.candidate_consent.may_share_with_researchers is 'Consent to inclusion in anonymised research datasets shared with academic collaborators.';
