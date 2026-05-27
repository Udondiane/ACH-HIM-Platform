insert into public.partners
  (id, name, type, status, sector, region, employee_count, consent_public_listing, notes)
values
  ('11111111-1111-1111-1111-000000000001', $bk$Burges Salmon$bk$,     'capability_investor', 'active', 'Legal', 'Bristol', 750, true,  $bk$ED&I/CSR-led; already paid for cultural awareness training. Annex H Family 2.$bk$),
  ('11111111-1111-1111-1111-000000000002', $bk$Pret A Manger$bk$,     'workforce_partner',   'active', 'Hospitality', $bk$Bristol & Birmingham$bk$, 380, true, $bk$Strongest historical 60% offer rate; in-kind to date.$bk$),
  ('11111111-1111-1111-1111-000000000003', $bk$Doyle Collection (The Bristol Hotel)$bk$, 'workforce_partner', 'active', 'Hospitality', 'Bristol', 220, false, $bk$Twin-signal: Visit West cohort + webinar attendee. Single property, modest hiring.$bk$),
  ('11111111-1111-1111-1111-000000000004', $bk$Bowmer & Kirkland$bk$, 'capability_investor', 'active', 'Construction',  'Bristol', 1600, true,  $bk$Public-sector framework bidders. Tender Support Pack target.$bk$),
  ('11111111-1111-1111-1111-000000000005', 'IKEA',              'workforce_partner',   'active', 'Retail',         $bk$Bristol & Birmingham$bk$, 11000, true, $bk$Largest paying partner historically; April 2026 cohort oversubscribed.$bk$),
  ('11111111-1111-1111-1111-000000000006', $bk$Aston Business School$bk$, 'training_partner', 'active', $bk$Higher Education$bk$, 'Birmingham', 4200, true, $bk$Academic partner; receives ACH training in inclusive employer practice. Not a sponsorship buyer.$bk$)
on conflict (id) do nothing;
insert into public.partner_contacts (partner_id, name, role, email, is_primary)
values
  ('11111111-1111-1111-1111-000000000001', $bk$Sarah Mitchell$bk$,  $bk$CSR & ESG Lead$bk$,         'sarah.mitchell@burgessalmon.example',     true),
  ('11111111-1111-1111-1111-000000000002', $bk$James Okafor$bk$,    $bk$Head of Talent (UK)$bk$,    'j.okafor@pret.example',                   true),
  ('11111111-1111-1111-1111-000000000003', $bk$Anika Patel$bk$,     $bk$Talent Acquisition$bk$,     'a.patel@doylecollection.example',         true),
  ('11111111-1111-1111-1111-000000000004', $bk$Mark Hughes$bk$,     $bk$Social Value Coordinator$bk$,'m.hughes@bandk.example',                 true),
  ('11111111-1111-1111-1111-000000000005', $bk$Linnea Bergström$bk$,$bk$Co-worker Resources Mgr$bk$,'l.bergstrom@ikea.example',                true),
  ('11111111-1111-1111-1111-000000000006', $bk$Dr Maya Iqbal$bk$,   $bk$CREME Director$bk$,         'm.iqbal@aston.example',                   true)
on conflict do nothing;
insert into public.cohorts
  (id, cohort_ref, name, structure, status, location, sector_focus, start_date, end_date, programme_weeks, target_size, delivery_cost, notes)
values
  ('22222222-2222-2222-2222-000000000001', 'BRI-2026-Q3', $bk$Bridge to Employment - Bristol Q3 2026$bk$, 'multi_partner', 'in_progress', 'Bristol', $bk$Hospitality + Retail + Construction support$bk$, '2026-07-15', '2026-10-07', 12, 11, 17570.00, $bk$Memo sec 9 realistic-cohort exemplar (11 starts, 2 CI + 9 WP, mid-conversion).$bk$)
on conflict (id) do nothing;
insert into public.cohort_partners (cohort_id, partner_id, sponsorship_count, engagement_fee, is_lead_partner)
values
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000001', 3, 6510.00, false),
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000004', 5, 10850.00,false),
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000002', 5, 10850.00,false),
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000003', 2,  4340.00,false),
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000005', 5, 10850.00,false)
on conflict do nothing;
insert into public.candidates
  (id, candidate_ref, given_name, family_name, preferred_locale, country_of_origin, arrival_year, english_level, status, career_goal_summary)
values
  ('33333333-3333-3333-3333-000000000001', 'C-2026-001', 'Amal',     'Naser',     'ar', 'Syria',       2023, 'B1', 'in_programme', $bk$Aspires to logistics management - IKEA is a stepping stone.$bk$),
  ('33333333-3333-3333-3333-000000000002', 'C-2026-002', 'Bashir',   'Karimi',    'fa', 'Afghanistan', 2024, 'A2', 'in_programme', $bk$Sector-progression intent recorded in development plan.$bk$),
  ('33333333-3333-3333-3333-000000000003', 'C-2026-003', 'Chiamaka', 'Eze',       'en', 'Nigeria',     2023, 'C1', 'in_programme', $bk$Long-term goal: chartered accountancy. Retail role bridges the gap.$bk$),
  ('33333333-3333-3333-3333-000000000004', 'C-2026-004', 'Dinara',   'Ismailova', 'uk', 'Ukraine',     2024, 'B2', 'in_programme', $bk$Background in design; UK retail role provides English and UK work experience.$bk$),
  ('33333333-3333-3333-3333-000000000005', 'C-2026-005', 'Eyob',     'Tesfaye',   'ti', 'Eritrea',     2022, 'B1', 'in_programme', $bk$Sector-progression intent recorded in development plan.$bk$),
  ('33333333-3333-3333-3333-000000000006', 'C-2026-006', 'Farah',    'Mahmoud',   'ar', 'Sudan',       2024, 'A2', 'in_programme', $bk$Sector-progression intent recorded in development plan.$bk$),
  ('33333333-3333-3333-3333-000000000007', 'C-2026-007', 'Ghadir',   'Al-Saadi',  'ar', 'Iraq',        2023, 'B1', 'in_programme', $bk$Sector-progression intent recorded in development plan.$bk$),
  ('33333333-3333-3333-3333-000000000008', 'C-2026-008', 'Hadi',     'Rahimi',    'fa', 'Iran',        2023, 'B1', 'in_programme', $bk$Sector-progression intent recorded in development plan.$bk$),
  ('33333333-3333-3333-3333-000000000009', 'C-2026-009', 'Iman',     'Younis',    'ar', 'Yemen',       2024, 'A2', 'in_programme', $bk$Sector-progression intent recorded in development plan.$bk$),
  ('33333333-3333-3333-3333-00000000000a', 'C-2026-010', 'Jelena',   'Hoxha',     'sq', 'Albania',     2023, 'B2', 'in_programme', $bk$Sector-progression intent recorded in development plan.$bk$),
  ('33333333-3333-3333-3333-00000000000b', 'C-2026-011', 'Khaled',   'Mansour',   'ar', 'Palestine',   2024, 'B1', 'in_programme', $bk$Sector-progression intent recorded in development plan.$bk$)
on conflict (id) do nothing;
insert into public.cohort_candidates (cohort_id, candidate_id, sponsoring_partner_id)
values
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000001', '11111111-1111-1111-1111-000000000005'),
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000002', '11111111-1111-1111-1111-000000000005'),
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000003', '11111111-1111-1111-1111-000000000005'),
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000004', '11111111-1111-1111-1111-000000000005'),
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000005', '11111111-1111-1111-1111-000000000005'),
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000006', '11111111-1111-1111-1111-000000000002'),
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000007', '11111111-1111-1111-1111-000000000002'),
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000008', '11111111-1111-1111-1111-000000000002'),
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000000009', '11111111-1111-1111-1111-000000000002'),
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-00000000000a', '11111111-1111-1111-1111-000000000003'),
  ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-00000000000b', '11111111-1111-1111-1111-000000000003')
on conflict do nothing;
insert into public.candidate_consent (candidate_id, may_be_quoted, may_appear_in_case_study, may_be_named)
select id, true, false, false from public.candidates
where candidate_ref in ('C-2026-001','C-2026-003','C-2026-006','C-2026-008','C-2026-010')
on conflict do nothing;
insert into public.projects
  (id, project_ref, name, description, type, weight_ratio, hybrid_option, start_date, end_date, status)
values
  ('44444444-4444-4444-4444-000000000001', 'PRJ-B2E', $bk$Bridge to Employment$bk$, $bk$12-week ACH employability programme combining pre-employment training, paid work-trial placements, and 12 months in-work support. The intervention design - capability mix, weight ratio, classification - applies to every B2E cohort regardless of partner sector.$bk$, 'depth', 'd3_1', 'A', '2024-03-01', null, 'active')
on conflict (id) do nothing;
update public.cohorts set project_id = '44444444-4444-4444-4444-000000000001'
  where id = '22222222-2222-2222-2222-000000000001' and project_id is null;
insert into public.project_capabilities (project_id, domain, role)
values
  ('44444444-4444-4444-4444-000000000001', 'employment', 'core'),
  ('44444444-4444-4444-4444-000000000001', 'education',  'core'),
  ('44444444-4444-4444-4444-000000000001', 'belonging',  'optional'),
  ('44444444-4444-4444-4444-000000000001', 'social',     'optional'),
  ('44444444-4444-4444-4444-000000000001', 'health',     'optional')
on conflict do nothing;
insert into public.placements (id, candidate_id, partner_id, cohort_id, role_title, salary_band, salary_actual, start_date, status, sponsored_placement) values
  ('55555555-5555-5555-5555-000000000001', '33333333-3333-3333-3333-000000000006', '11111111-1111-1111-1111-000000000002', '22222222-2222-2222-2222-000000000001', $bk$Team Member$bk$,  'standard', 22500, '2026-10-14', 'active', true),
  ('55555555-5555-5555-5555-000000000002', '33333333-3333-3333-3333-000000000007', '11111111-1111-1111-1111-000000000002', '22222222-2222-2222-2222-000000000001', $bk$Team Member$bk$,  'standard', 22500, '2026-10-14', 'active', true),
  ('55555555-5555-5555-5555-000000000003', '33333333-3333-3333-3333-000000000008', '11111111-1111-1111-1111-000000000002', '22222222-2222-2222-2222-000000000001', $bk$Team Leader$bk$,  'premium',  29000, '2026-10-21', 'active', true)
on conflict (id) do nothing;
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
insert into public.training_catalogue (provider, title, description, category, level, duration_weeks, total_cost, accreditation) values
  ('AAT',          $bk$Bookkeeping Level 2$bk$,        $bk$Foundation bookkeeping; pathway toward accountancy.$bk$, 'accredited_qual_l2_l5', $bk$Level 2$bk$, 24, 480.00, 'Ofqual-regulated'),
  ('AAT',          $bk$Accounting Level 3$bk$,         $bk$Diploma in accounting; bridge to qualification.$bk$,     'accredited_qual_l2_l5', $bk$Level 3$bk$, 36, 920.00, 'Ofqual-regulated'),
  ('CACHE',        $bk$Health and Social Care L2$bk$,  $bk$Sector certification for care roles.$bk$,                'sector_certification',  $bk$Level 2$bk$, 18, 360.00, 'Ofqual-regulated'),
  ($bk$Trinity College London$bk$, $bk$GESE Grade 7 (B2)$bk$, $bk$Speaking & Listening B2 - recognised for UK Skilled Worker visa progression.$bk$, 'language_qualification', 'B2', 12, 200.00, $bk$Trinity College London$bk$),
  ('CIEH',         $bk$Food Safety Level 2$bk$,        $bk$Hospitality sector entry.$bk$,                           'sector_certification',  $bk$Level 2$bk$,  2,  80.00, 'CIEH'),
  ('ILM',          $bk$Team Leading Level 3$bk$,       $bk$Progression into supervisory roles.$bk$,                 'soft_skills_progression',$bk$Level 3$bk$, 16, 540.00, $bk$City & Guilds (ILM)$bk$)
on conflict do nothing;
select public.recompute_partner_tier(id) from public.partners;
insert into public.development_fund_balances (candidate_id)
select id from public.candidates on conflict (candidate_id) do nothing;
insert into public.inclusion_assessments
  (partner_id, period_label, s_economic_security, s_skill_use_growth, s_workplace_dignity,
   s_voice_agency, s_social_belonging, s_wellbeing_confidence, respondent_count, status)
values
  ('11111111-1111-1111-1111-000000000001', '2026-Q1', 4.20, 3.80, 4.40, 3.70, 3.90, 4.10, 27, 'submitted')
on conflict do nothing;
insert into public.audit_entries (partner_id, kind, title, description, verification, audit_notes, audited_on) values
  ('11111111-1111-1111-1111-000000000006', 'practice_change',
   $bk$Refugee Recognition Policy adopted$bk$,
   $bk$Internal HR policy now explicitly recognises refugee candidates as a priority pipeline alongside graduate and apprenticeship routes.$bk$,
   'confirmed',
   $bk$Document review confirmed policy adoption March 2026. Interview with HR Director confirmed implementation.$bk$,
   '2026-04-12')
on conflict do nothing;
