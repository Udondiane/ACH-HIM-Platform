-- ============================================================
-- seed.sql · demo data (memo's worked examples)
-- ============================================================
-- Run AFTER all numbered migrations. Idempotent - safe to re-run;
-- existing rows skipped via ON CONFLICT.
--
-- Examples populated (memo sec 8):
--   1. Burges Salmon (Bristol law firm)    - Capability Investor / Family 2
--   2. Pret A Manger (Bristol & Birmingham) - Workforce Partner / Family 1
--   3. Doyle Collection (Bristol Hotel)     - Workforce Partner, no-hire path
--   4. Bowmer & Kirkland (construction)     - Capability Investor + Tender Pack
--   5. IKEA (Bristol & Birmingham)          - Workforce Partner, largest
-- ============================================================

-- -- PARTNERS ----------------------------------------------
insert into public.partners
  (id, name, type, status, sector, region, employee_count, consent_public_listing, notes)
values
  ('11111111-1111-1111-1111-000000000001', 'Burges Salmon',     'capability_investor', 'active', 'Legal', 'Bristol', 750, true,  'ED&I/CSR-led; already paid for cultural awareness training. Annex H Family 2.'),
  ('11111111-1111-1111-1111-000000000002', 'Pret A Manger',     'workforce_partner',   'active', 'Hospitality', 'Bristol & Birmingham', 380, true, 'Strongest historical 60% offer rate; in-kind to date.'),
  ('11111111-1111-1111-1111-000000000003', 'Doyle Collection (The Bristol Hotel)', 'workforce_partner', 'active', 'Hospitality', 'Bristol', 220, false, 'Twin-signal: Visit West cohort + webinar attendee. Single property, modest hiring.'),
  ('11111111-1111-1111-1111-000000000004', 'Bowmer & Kirkland', 'capability_investor', 'active', 'Construction',  'Bristol', 1600, true,  'Public-sector framework bidders. Tender Support Pack target.'),
  ('11111111-1111-1111-1111-000000000005', 'IKEA',              'workforce_partner',   'active', 'Retail',         'Bristol & Birmingham', 11000, true, 'Largest paying partner historically; April 2026 cohort oversubscribed.'),
  ('11111111-1111-1111-1111-000000000006', 'Aston Business School', 'training_partner', 'active', 'Higher Education', 'Birmingham', 4200, true, 'Academic partner; receives ACH training in inclusive employer practice. Not a sponsorship buyer.')
on conflict (id) do nothing;

insert into public.partner_contacts (partner_id, name, role, email, is_primary)
values
  ('11111111-1111-1111-1111-000000000001', 'Sarah Mitchell',  'CSR & ESG Lead',         'sarah.mitchell@burgessalmon.example',     true),
  ('11111111-1111-1111-1111-000000000002', 'James Okafor',    'Head of Talent (UK)',    'j.okafor@pret.example',                   true),
  ('11111111-1111-1111-1111-000000000003', 'Anika Patel',     'Talent Acquisition',     'a.patel@doylecollection.example',         true),
  ('11111111-1111-1111-1111-000000000004', 'Mark Hughes',     'Social Value Coordinator','m.hughes@bandk.example',                 true),
  ('11111111-1111-1111-1111-000000000005', 'Linnea Bergström','Co-worker Resources Mgr','l.bergstrom@ikea.example',                true),
  ('11111111-1111-1111-1111-000000000006', 'Dr Maya Iqbal',   'CREME Director',         'm.iqbal@aston.example',                   true)
on conflict do nothing;

-- -- COHORT ------------------------------------------------
insert into public.cohorts
  (id, cohort_ref, name, structure, status, location, sector_focus, start_date, end_date, programme_weeks, target_size, delivery_cost, notes)
values
  ('22222222-2222-2222-2222-000000000001', 'BRI-2026-Q3', 'Bridge to Employment - Bristol Q3 2026', 'multi_partner', 'in_progress', 'Bristol', 'Hospitality + Retail + Construction support', '2026-07-15', '2026-10-07', 12, 11, 17570.00, 'Memo sec 9 realistic-cohort exemplar (11 starts, 2 CI + 9 WP, mid-conversion).')
on conflict (id) do nothing;

insert into public.cohort_partners (cohort_id, partner_id, sponsorship_count, engagement_fee, is_lead_partner)
values
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000001', 3, 6510.00, false),  -- Burges Salmon 3 x GBP 2,170
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000004', 5, 10850.00,false),  -- B&K 5 x GBP 2,170
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000002', 5, 10850.00,false),  -- Pret
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000003', 2,  4340.00,false),  -- Doyle
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000005', 5, 10850.00,false)   -- IKEA
on conflict do nothing;

-- -- CANDIDATES (11) ---------------------------------------
-- Memo sec 3: anonymised. Each has a candidate_ref + first name + country.

insert into public.candidates
  (id, candidate_ref, given_name, family_name, preferred_locale, country_of_origin, arrival_year, english_level, status, career_goal_summary)
values
  ('33333333-3333-3333-3333-000000000001', 'C-2026-001', 'Amal',     'Naser',     'ar', 'Syria',       2023, 'B1', 'in_programme', 'Aspires to logistics management - IKEA is a stepping stone.'),
  ('33333333-3333-3333-3333-000000000002', 'C-2026-002', 'Bashir',   'Karimi',    'fa', 'Afghanistan', 2024, 'A2', 'in_programme', 'Sector-progression intent recorded in development plan.'),
  ('33333333-3333-3333-3333-000000000003', 'C-2026-003', 'Chiamaka', 'Eze',       'en', 'Nigeria',     2023, 'C1', 'in_programme', 'Long-term goal: chartered accountancy. Retail role bridges the gap.'),
  ('33333333-3333-3333-3333-000000000004', 'C-2026-004', 'Dinara',   'Ismailova', 'uk', 'Ukraine',     2024, 'B2', 'in_programme', 'Background in design; UK retail role provides English and UK work experience.'),
  ('33333333-3333-3333-3333-000000000005', 'C-2026-005', 'Eyob',     'Tesfaye',   'ti', 'Eritrea',     2022, 'B1', 'in_programme', 'Sector-progression intent recorded in development plan.'),
  ('33333333-3333-3333-3333-000000000006', 'C-2026-006', 'Farah',    'Mahmoud',   'ar', 'Sudan',       2024, 'A2', 'in_programme', 'Sector-progression intent recorded in development plan.'),
  ('33333333-3333-3333-3333-000000000007', 'C-2026-007', 'Ghadir',   'Al-Saadi',  'ar', 'Iraq',        2023, 'B1', 'in_programme', 'Sector-progression intent recorded in development plan.'),
  ('33333333-3333-3333-3333-000000000008', 'C-2026-008', 'Hadi',     'Rahimi',    'fa', 'Iran',        2023, 'B1', 'in_programme', 'Sector-progression intent recorded in development plan.'),
  ('33333333-3333-3333-3333-000000000009', 'C-2026-009', 'Iman',     'Younis',    'ar', 'Yemen',       2024, 'A2', 'in_programme', 'Sector-progression intent recorded in development plan.'),
  ('33333333-3333-3333-3333-00000000000a', 'C-2026-010', 'Jelena',   'Hoxha',     'sq', 'Albania',     2023, 'B2', 'in_programme', 'Sector-progression intent recorded in development plan.'),
  ('33333333-3333-3333-3333-00000000000b', 'C-2026-011', 'Khaled',   'Mansour',   'ar', 'Palestine',   2024, 'B1', 'in_programme', 'Sector-progression intent recorded in development plan.')
on conflict (id) do nothing;

-- Link each candidate to the cohort with their sponsoring partner
insert into public.cohort_candidates (cohort_id, candidate_id, sponsoring_partner_id)
values
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000001', '11111111-1111-1111-1111-000000000005'),  -- Amal     -> IKEA
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000002', '11111111-1111-1111-1111-000000000005'),  -- Bashir   -> IKEA
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000003', '11111111-1111-1111-1111-000000000005'),  -- Chiamaka -> IKEA
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000004', '11111111-1111-1111-1111-000000000005'),  -- Dinara   -> IKEA
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000005', '11111111-1111-1111-1111-000000000005'),  -- Eyob     -> IKEA
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000006', '11111111-1111-1111-1111-000000000002'),  -- Farah    -> Pret
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000007', '11111111-1111-1111-1111-000000000002'),  -- Ghadir   -> Pret
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000008', '11111111-1111-1111-1111-000000000002'),  -- Hadi     -> Pret
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000009', '11111111-1111-1111-1111-000000000002'),  -- Iman     -> Pret
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-00000000000a', '11111111-1111-1111-1111-000000000003'),  -- Jelena   -> Doyle
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-00000000000b', '11111111-1111-1111-1111-000000000003')   -- Khaled   -> Doyle
on conflict do nothing;

-- Consent records (most candidates consented to anonymised quoting; named/case-study less common)
insert into public.candidate_consent (candidate_id, may_be_quoted, may_appear_in_case_study, may_be_named)
select id, true, false, false from public.candidates
where candidate_ref in ('C-2026-001','C-2026-003','C-2026-006','C-2026-008','C-2026-010')
on conflict do nothing;

-- -- PROJECT ------------------------------------------------
-- Bridge to Employment programme. Depth-oriented (vocational training, language).
insert into public.projects
  (id, project_ref, name, description, cohort_id, type, weight_ratio, hybrid_option, start_date, end_date, status)
values
  ('44444444-4444-4444-4444-000000000001', 'PRJ-2026-B2E-Q3', 'Bridge to Employment - Q3 cohort', 'Memo sec A - 12-week B2E programme.', '22222222-2222-2222-2222-000000000001', 'depth', 'd3_1', 'A', '2026-07-15', '2026-10-07', 'active')
on conflict (id) do nothing;

-- Project capabilities: Core = Employment, Education; Optional = Belonging, Social, Health
insert into public.project_capabilities (project_id, domain, role)
values
  ('44444444-4444-4444-4444-000000000001', 'employment', 'core'),
  ('44444444-4444-4444-4444-000000000001', 'education',  'core'),
  ('44444444-4444-4444-4444-000000000001', 'belonging',  'optional'),
  ('44444444-4444-4444-4444-000000000001', 'social',     'optional'),
  ('44444444-4444-4444-4444-000000000001', 'health',     'optional')
on conflict do nothing;

-- -- PLACEMENTS (selected - Pret has 3 hires per memo sec 8 example) -
insert into public.placements (id, candidate_id, partner_id, cohort_id, role_title, salary_band, salary_actual, start_date, status, sponsored_placement) values
  ('55555555-5555-5555-5555-000000000001', '33333333-3333-3333-3333-000000000006', '11111111-1111-1111-1111-000000000002', '22222222-2222-2222-2222-000000000001', 'Team Member',  'standard', 22500, '2026-10-14', 'active', true),
  ('55555555-5555-5555-5555-000000000002', '33333333-3333-3333-3333-000000000007', '11111111-1111-1111-1111-000000000002', '22222222-2222-2222-2222-000000000001', 'Team Member',  'standard', 22500, '2026-10-14', 'active', true),
  ('55555555-5555-5555-5555-000000000003', '33333333-3333-3333-3333-000000000008', '11111111-1111-1111-1111-000000000002', '22222222-2222-2222-2222-000000000001', 'Team Leader',  'premium',  29000, '2026-10-21', 'active', true)
on conflict (id) do nothing;

-- Milestones (memo sec 5 band totals)
insert into public.placement_milestones (placement_id, kind, amount, due_on, state) values
  ('55555555-5555-5555-5555-000000000001', 'placement',     1500.00, '2026-10-14', 'paid'),
  ('55555555-5555-5555-5555-000000000001', 'retention_6mo',  250.00, '2027-04-14', 'pending'),
  ('55555555-5555-5555-5555-000000000001', 'retention_12mo', 325.00, '2027-10-14', 'pending'),
  ('55555555-5555-5555-5555-000000000002', 'placement',     1500.00, '2026-10-14', 'paid'),
  ('55555555-5555-5555-5555-000000000002', 'retention_6mo',  250.00, '2027-04-14', 'pending'),
  ('55555555-5555-5555-5555-000000000002', 'retention_12mo', 325.00, '2027-10-14', 'pending'),
  ('55555555-5555-5555-5555-000000000003', 'placement',     2500.00, '2026-10-21', 'paid'),
  ('55555555-5555-5555-5555-000000000003', 'retention_6mo',  300.00, '2027-04-21', 'pending'),
  ('55555555-5555-5555-5555-000000000003', 'retention_12mo', 375.00, '2027-10-21', 'pending')
on conflict do nothing;

-- -- TRAINING CATALOGUE (sample) ----------------------------
insert into public.training_catalogue (provider, title, description, category, level, duration_weeks, total_cost, accreditation) values
  ('AAT',          'Bookkeeping Level 2',        'Foundation bookkeeping; pathway toward accountancy.', 'accredited_qual_l2_l5', 'Level 2', 24, 480.00, 'Ofqual-regulated'),
  ('AAT',          'Accounting Level 3',         'Diploma in accounting; bridge to qualification.',     'accredited_qual_l2_l5', 'Level 3', 36, 920.00, 'Ofqual-regulated'),
  ('CACHE',        'Health and Social Care L2',  'Sector certification for care roles.',                'sector_certification',  'Level 2', 18, 360.00, 'Ofqual-regulated'),
  ('Trinity College London', 'GESE Grade 7 (B2)', 'Speaking & Listening B2 - recognised for UK Skilled Worker visa progression.', 'language_qualification', 'B2', 12, 200.00, 'Trinity College London'),
  ('CIEH',         'Food Safety Level 2',        'Hospitality sector entry.',                           'sector_certification',  'Level 2',  2,  80.00, 'CIEH'),
  ('ILM',          'Team Leading Level 3',       'Progression into supervisory roles.',                 'soft_skills_progression','Level 3', 16, 540.00, 'City & Guilds (ILM)')
on conflict do nothing;

-- -- PARTNER TIER RECOMPUTE --------------------------------
-- Run recompute for seeded partners so the tier_status table populates.
select public.recompute_partner_tier(id) from public.partners;

-- -- DEV FUND BALANCES -------------------------------------
-- Seed empty balance rows so dashboards have something to read.
insert into public.development_fund_balances (candidate_id)
select id from public.candidates on conflict (candidate_id) do nothing;

-- -- INCLUSION ASSESSMENT (Burges Salmon, sample) ----------
insert into public.inclusion_assessments
  (partner_id, period_label, s_economic_security, s_skill_use_growth, s_workplace_dignity,
   s_voice_agency, s_social_belonging, s_wellbeing_confidence, respondent_count, status)
values
  ('11111111-1111-1111-1111-000000000001', '2026-Q1', 4.20, 3.80, 4.40, 3.70, 3.90, 4.10, 27, 'submitted')
on conflict do nothing;

-- -- AUDIT ENTRY (Aston as Training Partner, sample) -------
insert into public.audit_entries (partner_id, kind, title, description, verification, audit_notes, audited_on) values
  ('11111111-1111-1111-1111-000000000006', 'practice_change',
   'Refugee Recognition Policy adopted',
   'Internal HR policy now explicitly recognises refugee candidates as a priority pipeline alongside graduate and apprenticeship routes.',
   'confirmed',
   'Document review confirmed policy adoption March 2026. Interview with HR Director confirmed implementation.',
   '2026-04-12')
on conflict do nothing;
