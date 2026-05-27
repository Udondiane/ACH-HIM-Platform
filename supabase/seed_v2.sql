-- ============================================================
-- seed_v2.sql · session 6/7/8 demo data
-- ============================================================
-- Run AFTER seed.sql. Augments the existing memo sec 8 worked examples
-- with realistic data for pricing quotes, dev fund credits/requests,
-- equivalence applications, delphi panel, evidence pack, translations,
-- and Career Progression / Engagement Reports - derived from the
-- ACH Bridge to Employment Master Model spreadsheet (Mar 2024-Apr 2026
-- programme data) and the Comic Relief grant transition plan.
--
-- Idempotent - every insert uses ON CONFLICT DO NOTHING.
-- ============================================================

-- -- PRICING QUOTES -------------------------------------------
-- Each existing partner gets:
--   1. an "Accepted" historical quote reflecting what they actually paid
--      (per the spreadsheet - these flag RED because they're below cost-recovery)
--   2. a "Draft" recommended quote at the proper tier
-- The traffic_light values were pre-computed using lib/pricing/calculator.ts
-- defaults (cost GBP 1,670, sustainability margin GBP 500, etc.).

insert into public.pricing_quotes (
  id, quote_ref, partner_id, cohort_id, track,
  candidate_count, expected_hires_volume, expected_hires_standard, expected_hires_premium,
  retention_6mo_rate, retention_12mo_rate, tender_pack_fee,
  delivery_cost_internal, cost_recovery_floor, sustainability_floor,
  suggested_price, margin_amount, margin_pct, traffic_light,
  status, notes
) values
  -- IKEA - Dec'25 cohort, what they actually paid
  ('66666666-6666-6666-6666-000000000001', 'QT-2025-001',
   '11111111-1111-1111-1111-000000000005', null, 'workforce_partner',
   10, 5, 3, 0,
   0.70, 0.55, 0,
   16700.00, 18370.00, 21710.00,
   8000.00, -8700.00, -52.10, 'red',
   'accepted', 'Historical IKEA quote (Dec 2025 cohort). Covers ~19% of true delivery cost. Flagged RED - below cost-recovery floor. Renegotiate per transition plan.'),
  -- IKEA - recommended large-corporate tier
  ('66666666-6666-6666-6666-000000000002', 'QT-2026-001',
   '11111111-1111-1111-1111-000000000005', '22222222-2222-2222-2222-000000000001', 'workforce_partner',
   10, 5, 3, 0,
   0.70, 0.55, 0,
   16700.00, 18370.00, 21710.00,
   43410.00, 26710.00, 159.94, 'green',
   'draft', 'Recommended IKEA pricing - large corporate tier. GBP 43,410 = full programme cost + ACH expertise loading. Frame as L&D/recruitment investment, not CSR donation.'),

  -- Pret - current state (GBP 0 - fully grant-funded)
  ('66666666-6666-6666-6666-000000000003', 'QT-2025-002',
   '11111111-1111-1111-1111-000000000002', null, 'workforce_partner',
   12, 0, 5, 0,
   0.70, 0.55, 0,
   20040.00, 22044.00, 26052.00,
   0.00, -20040.00, -100.00, 'red',
   'accepted', 'Historical Pret arrangement - no cash fee. Comic Relief grant covers full delivery. Q1 2026 fee introduction planned.'),
  -- Pret - recommended
  ('66666666-6666-6666-6666-000000000004', 'QT-2026-002',
   '11111111-1111-1111-1111-000000000002', null, 'workforce_partner',
   12, 0, 5, 0,
   0.70, 0.55, 0,
   20040.00, 22044.00, 26052.00,
   30000.00, 9960.00, 49.70, 'green',
   'sent', 'Recommended Pret cohort - anchored to L&D budget. Start with in-kind valuation (venue, staff time ~ GBP 5k) then move to cash fee.'),

  -- Doyle Collection (Visit West proxy) - current state
  ('66666666-6666-6666-6666-000000000005', 'QT-2025-003',
   '11111111-1111-1111-1111-000000000003', null, 'workforce_partner',
   10, 2, 0, 0,
   0.50, 0.40, 0,
   16700.00, 18370.00, 21710.00,
   0.00, -16700.00, -100.00, 'red',
   'declined', 'Doyle Collection / Visit West historical - no cash fee. Vacancy timing misalignment per programme learning log. Under review.'),

  -- Burges Salmon - Capability Investor (memo sec 8)
  ('66666666-6666-6666-6666-000000000006', 'QT-2026-003',
   '11111111-1111-1111-1111-000000000001', '22222222-2222-2222-2222-000000000001', 'capability_investor',
   3, 0, 0, 0,
   0.70, 0.55, 0,
   5010.00, 5511.00, 6513.00,
   6510.00, 1500.00, 29.94, 'green',
   'accepted', '3 sponsorships @ GBP 2,170 - Capability Investor (ED&I/CSR-led). Family 2 per Annex H. Already paid for separate cultural awareness training.'),

  -- Bowmer & Kirkland - CI + Tender Pack
  ('66666666-6666-6666-6666-000000000007', 'QT-2026-004',
   '11111111-1111-1111-1111-000000000004', '22222222-2222-2222-2222-000000000001', 'capability_investor',
   5, 0, 0, 0,
   0.70, 0.55, 500,
   8350.00, 9185.00, 10855.00,
   11350.00, 3000.00, 35.93, 'green',
   'sent', 'B&K 5 sponsorships + Tender Support Pack (GBP 500) for upcoming public-sector framework bid. Construction sector.')

on conflict (id) do nothing;

-- Quote line items
insert into public.pricing_quote_lines (quote_id, sort_order, kind, band, quantity, unit_amount, line_total, label)
values
  -- IKEA accepted (the GBP 8k flat)
  ('66666666-6666-6666-6666-000000000001', 0, 'sponsorship', null, 10, 800.00, 8000.00, 'Flat sponsorship deal x 10 candidates (historical pricing)'),

  -- IKEA recommended
  ('66666666-6666-6666-6666-000000000002', 0, 'sponsorship',   null,       10, 2170.00, 21700.00, 'Sponsorship x 10 candidates'),
  ('66666666-6666-6666-6666-000000000002', 1, 'placement',     'volume',    5,  750.00,  3750.00, 'Placement fee - Volume GBP 20-23k'),
  ('66666666-6666-6666-6666-000000000002', 2, 'placement',     'standard',  3, 1500.00,  4500.00, 'Placement fee - Standard GBP 23-28k'),
  ('66666666-6666-6666-6666-000000000002', 3, 'discount',      null,        1, -1650.00,-1650.00, 'Volume discount (20% on placement, 8 hires)'),
  ('66666666-6666-6666-6666-000000000002', 4, 'retention_6mo', 'volume',    4,  225.00,   900.00, 'Retention 6mo - Volume (expected 70%)'),
  ('66666666-6666-6666-6666-000000000002', 5, 'retention_6mo', 'standard',  2,  250.00,   500.00, 'Retention 6mo - Standard'),
  ('66666666-6666-6666-6666-000000000002', 6, 'retention_12mo','volume',    3,  300.00,   900.00, 'Retention 12mo - Volume (expected 55%)'),
  ('66666666-6666-6666-6666-000000000002', 7, 'retention_12mo','standard',  2,  325.00,   650.00, 'Retention 12mo - Standard'),

  -- Pret accepted (just sponsorship at GBP 0)
  ('66666666-6666-6666-6666-000000000003', 0, 'sponsorship', null, 12, 0.00, 0.00, 'Grant-funded - no employer fee'),

  -- Pret recommended
  ('66666666-6666-6666-6666-000000000004', 0, 'sponsorship',    null,       12, 2170.00, 26040.00, 'Sponsorship x 12 candidates'),
  ('66666666-6666-6666-6666-000000000004', 1, 'placement',      'standard',  5, 1500.00,  7500.00, 'Placement fee - Standard GBP 23-28k'),
  ('66666666-6666-6666-6666-000000000004', 2, 'discount',       null,        1, -1500.00,-1500.00, 'Volume discount (20% on placement, 5+ hires)'),
  ('66666666-6666-6666-6666-000000000004', 3, 'retention_6mo',  'standard',  4,  250.00,  1000.00, 'Retention 6mo - Standard (expected 70%)'),
  ('66666666-6666-6666-6666-000000000004', 4, 'retention_12mo', 'standard',  3,  325.00,   975.00, 'Retention 12mo - Standard (expected 55%)'),

  -- Doyle declined
  ('66666666-6666-6666-6666-000000000005', 0, 'sponsorship', null, 10, 0.00, 0.00, 'Visit West / Doyle - no fee under previous arrangement'),

  -- Burges Salmon
  ('66666666-6666-6666-6666-000000000006', 0, 'sponsorship', null, 3, 2170.00, 6510.00, 'Sponsorship x 3 candidates - Family 2'),

  -- Bowmer & Kirkland
  ('66666666-6666-6666-6666-000000000007', 0, 'sponsorship', null, 5, 2170.00, 10850.00, 'Sponsorship x 5 candidates'),
  ('66666666-6666-6666-6666-000000000007', 1, 'tender_pack', null, 1,  500.00,   500.00, 'Tender Support Pack - public-sector framework bid')
on conflict do nothing;


-- -- DEV FUND CREDITS -----------------------------------------
-- The existing seed creates 3 placements (Farah, Ghadir, Hadi at Pret) with
-- 'paid' placement milestones. Mirror those payments as ringfenced credits
-- in the candidates' dev fund balances.

insert into public.dev_fund_credits (candidate_id, source_milestone_id, partner_id, amount, source, notes)
select
  pl.candidate_id,
  m.id,
  pl.partner_id,
  m.amount * 0.30,  -- spec sec 14: 30% of milestone payment is ringfenced
  'milestone',
  'Auto-credited from paid placement milestone (30% ringfenced per spec sec 14).'
from public.placement_milestones m
join public.placements pl on pl.id = m.placement_id
where m.state = 'paid'
on conflict do nothing;

-- Match funding from a hypothetical grant
insert into public.dev_fund_credits (candidate_id, partner_id, amount, source, notes)
values
  ('33333333-3333-3333-3333-000000000003', null, 500.00, 'match_funding', 'Chiamaka - match funding toward accountancy pathway.'),
  ('33333333-3333-3333-3333-000000000006', null, 250.00, 'match_funding', 'Farah - small match top-up.')
on conflict do nothing;

-- Recompute balances now credits exist
select public.recompute_dev_fund_balance(id) from public.candidates;


-- -- TRAINING REQUESTS ----------------------------------------
-- Realistic candidate-led requests aligned to seeded candidates' career goals.

insert into public.training_requests (id, candidate_id, training_id, career_rationale, state, review_notes, decided_at)
select
  '77777777-7777-7777-7777-000000000001',
  '33333333-3333-3333-3333-000000000003',  -- Chiamaka, accountancy goal
  tc.id,
  'My long-term goal is chartered accountancy. The AAT Level 3 builds directly on bookkeeping fundamentals and is the standard pathway used by employers in Bristol. I will continue working part-time while studying.',
  'approved',
  'Strong alignment with documented career goal. Budget available from milestone credits + match funding. Approved.',
  now() - interval '14 days'
from public.training_catalogue tc where tc.title = 'Accounting Level 3' limit 1
on conflict (id) do nothing;

insert into public.training_requests (id, candidate_id, training_id, career_rationale, state)
select
  '77777777-7777-7777-7777-000000000002',
  '33333333-3333-3333-3333-000000000001',  -- Amal, logistics goal
  tc.id,
  'IKEA promotes from within once you complete Team Leading. This is the standard internal progression and my line manager has confirmed she will support my application once certified.',
  'submitted'
from public.training_catalogue tc where tc.title = 'Team Leading Level 3' limit 1
on conflict (id) do nothing;

insert into public.training_requests (id, candidate_id, training_id, career_rationale, state, review_notes)
select
  '77777777-7777-7777-7777-000000000003',
  '33333333-3333-3333-3333-000000000004',  -- Dinara, design history
  tc.id,
  'Bookkeeping L2 will let me transition from retail floor work into office finance - a clearer pathway given my prior design and admin experience.',
  'in_review',
  'Awaiting confirmation that the AAT provider has capacity for the Sep intake.'
from public.training_catalogue tc where tc.title = 'Bookkeeping Level 2' limit 1
on conflict (id) do nothing;

insert into public.training_requests (id, candidate_id, custom_title, custom_provider, custom_cost, career_rationale, state, review_notes, decided_at)
values (
  '77777777-7777-7777-7777-000000000004',
  '33333333-3333-3333-3333-00000000000b',  -- Khaled
  'IELTS UKVI Preparation Course',
  'British Council Birmingham',
  450.00,
  'I need IELTS UKVI Academic 6.5 to apply for a top-up degree at BCU. The British Council course is the recognised preparation route.',
  'declined',
  'Decline - IELTS prep is not classified as accredited L2-L5 or sector certification per spec sec 14.2. Suggested alternative: Trinity GESE Grade 7 (B2) from the catalogue, which IS dev-fund eligible.',
  now() - interval '7 days'
) on conflict (id) do nothing;


-- -- DELPHI PANEL ---------------------------------------------
-- Methodology validation panel - weight ratio for hospitality programmes.

insert into public.delphi_panels (id, name, research_question, options, state, consensus_option, consensus_method, consensus_reached_at)
values (
  '88888888-8888-8888-8888-000000000001',
  'B2E weight ratio - hospitality',
  'For depth-oriented Bridge-to-Employment programmes in hospitality (Pret, IKEA, Visit West cohorts), what α:β ratio best reflects the relative weight of Core vs Optional capabilities?',
  array['d3_1','d4_1','d5_1','hybrid_A','hybrid_B'],
  'consensus_reached',
  'd3_1',
  'agreement_70',
  now() - interval '21 days'
) on conflict (id) do nothing;

insert into public.delphi_experts (id, panel_id, name, email, role) values
  ('99999999-9999-9999-9999-000000000001', '88888888-8888-8888-8888-000000000001', 'Dr Maya Iqbal',     'm.iqbal@aston.example',         'academic'),
  ('99999999-9999-9999-9999-000000000002', '88888888-8888-8888-8888-000000000001', 'Prof Adrian Brown', 'a.brown@aston.example',         'academic'),
  ('99999999-9999-9999-9999-000000000003', '88888888-8888-8888-8888-000000000001', 'Sarah Mitchell',    'sarah.mitchell@burgessalmon.example',  'practitioner'),
  ('99999999-9999-9999-9999-000000000004', '88888888-8888-8888-8888-000000000001', 'James Okafor',      'j.okafor@pret.example',         'practitioner'),
  ('99999999-9999-9999-9999-000000000005', '88888888-8888-8888-8888-000000000001', 'Linnea Bergström',  'l.bergstrom@ikea.example',      'practitioner'),
  ('99999999-9999-9999-9999-000000000006', '88888888-8888-8888-8888-000000000001', 'Rachel Wood',       'rachel.wood@comicrelief.example','funder'),
  ('99999999-9999-9999-9999-000000000007', '88888888-8888-8888-8888-000000000001', 'Amira Hassan',      'a.hassan@beneficiary.example',  'beneficiary_advocate'),
  ('99999999-9999-9999-9999-000000000008', '88888888-8888-8888-8888-000000000001', 'Tom Patel',         't.patel@ach.example',           'practitioner'),
  ('99999999-9999-9999-9999-000000000009', '88888888-8888-8888-8888-000000000001', 'Janet Murray',      'j.murray@dwp.example',          'funder'),
  ('99999999-9999-9999-9999-00000000000a', '88888888-8888-8888-8888-000000000001', 'Yusuf Rahman',      'y.rahman@beneficiary.example',  'beneficiary_advocate')
on conflict (panel_id, email) do nothing;

insert into public.delphi_rounds (id, panel_id, round_number, opened_at, closed_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000001', '88888888-8888-8888-8888-000000000001', 1, now() - interval '60 days', now() - interval '40 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', '88888888-8888-8888-8888-000000000001', 2, now() - interval '35 days', now() - interval '21 days')
on conflict (panel_id, round_number) do nothing;

-- Round 2 responses - 8 of 10 experts voted, 6 chose d3_1 -> 75% -> Rule A consensus.
insert into public.delphi_responses (round_id, expert_id, selected_option, rationale) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', '99999999-9999-9999-9999-000000000001', 'd3_1',     'Aligned with empirical α/β patterns in 2024 hospitality pilots.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', '99999999-9999-9999-9999-000000000002', 'd3_1',     'Saaty α=0.75 matches the prior literature on depth interventions.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', '99999999-9999-9999-9999-000000000003', 'd3_1',     'From a practitioner view, Core is clearly dominant in B2E.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', '99999999-9999-9999-9999-000000000004', 'd3_1',     'Optional shouldn''t be negligible - 1:3 feels right.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', '99999999-9999-9999-9999-000000000005', 'hybrid_B', 'Prefer letting classification math choose - varies per partner.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', '99999999-9999-9999-9999-000000000006', 'd3_1',     'Funders need defensible ratios; d3:1 is the most cited.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', '99999999-9999-9999-9999-000000000007', 'd3_1',     'Maintains visibility for Optional outcomes refugees value.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', '99999999-9999-9999-9999-000000000009', 'd4_1',     'Lean further into Core given employment-outcome priority.')
on conflict (round_id, expert_id) do nothing;


-- -- EVIDENCE PACK --------------------------------------------
-- The Comic Relief grant transition story.

insert into public.evidence_packs (id, title, funder, funding_window, description, status, anonymisation_level, methodology_version) values (
  'bbbbbbbb-bbbb-bbbb-bbbb-000000000001',
  'Comic Relief - Bridge to Employment transition pack',
  'Comic Relief',
  '2026/27',
  'Evidence pack supporting transition from grant-funded to commercially-viable model. Demonstrates 52.5% employment outcome rate, 7 active employer partners, and the GBP 78k annual funding gap to close by Oct 2026.',
  'draft',
  'standard',
  'v1.0'
) on conflict (id) do nothing;

-- Create the 14 sections, with content for the most-relevant ones drawn from the spreadsheet.
insert into public.evidence_pack_sections (pack_id, section_key, sort_order, content, included) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'organisational_overview', 0,
   'Ashley Community & Housing (ACH) has supported refugee resettlement in Bristol and Birmingham since 2008. The Bridge to Employment programme operationalises ACH''s holistic capability framework with named employer partners, delivering measurable employment, education, and progression outcomes for refugee candidates.', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'programme_overview', 1,
   'Bridge to Employment (B2E) is a 12-week structured programme combining pre-employment training, paid work-trial placements, and 12 months of in-work support. Each cohort is co-designed with one or more employer partners around specific vacancy pipelines. Cohorts run between 8 and 14 candidates.', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'current_scale_reach', 2,
   '7 active employer partners across hospitality, retail, construction, waste/recycling, and legal sectors. 81 programme starts across 8 completed cohorts (Mar 2024 - Mar 2026). 424 applications. Recruitment for the Dec 2025 IKEA cohort closed oversubscribed within 3 weeks (115 EOIs).', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'outcomes_evidence', 3,
   '74.1% programme completion (69/81 starts). 52.5% of programme starts into any employment within 3 months. 28.4% direct placement with the partner employer. The employer-linked model significantly outperforms our IAG service line (34% Bristol, 12.6% Birmingham) for employment outcomes.', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'partner_case_studies', 4,
   'Pret A Manger (Bristol & Birmingham): three cohorts run, every cohort requested a repeat. 60% offer rate - the highest in the network.\n\nIKEA Bristol: now on third programme, December 2025 cohort attracted 115 applicants in 3 weeks. 5/10 candidates secured offers in the prior cohort.\n\nBurges Salmon: 25 staff completed cultural-awareness training, separate from the candidate programme - demonstrating the standalone ED&I training product.', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'candidate_stories', 5,
   'Tanya (Visit West cohort, 2024) - secured a University of the West of England undergraduate place following programme completion. Multiple other candidates progressed into Business English and Accounting Level 1.', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'methodology_academic_grounding', 6,
   'Scoring follows the HIM Methodology Specification v1.0 (Udondian, Aston Business School CREME, May 2026). The seven-domain capability framework, two-step indicator-to-domain rollup, asymmetric depth/breadth weight ratios, and universal-factor deduplication are all peer-reviewed.', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'distinctiveness_innovation', 7,
   'Three differentiators: (1) Matrix-accredited IAG service. (2) Lived-experience staff team. (3) Documented CSR evidence base via named global brand partnerships (IKEA, Pret).', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'theory_of_change', 8, null, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'financial_operational', 9,
   'True cohort cost (loaded): GBP 16,696 (GBP 1,670 per candidate base + 20% overhead + 5% contingency). Recommended sale prices range from GBP 26,914 (public sector/NGO) to GBP 43,410 (large corporate). Current IKEA contribution of GBP 8,000 per cohort covers only 19% of true cost. The GBP 78,164 annual funding gap from the Oct 2026 Comic Relief end-date is closeable via repriced employer fees + IAG statutory commissioning.', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'funder_citation_blocks', 10, null, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'evidence_references', 11,
   '• ACH Annual Reports 2024, 2025\n• Programme Performance Data (Mar 2024 - Apr 2026)\n• HIM Methodology Specification v1.0 (Aston CREME, May 2026)\n• Sustainable Revenue Model memo (May 2026)\n• Matrix Standard accreditation (Jun 2025)', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'visual_material', 12, null, false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'ach_attestation', 13,
   'This pack is generated from primary ACH operational data. Methodology version v1.0. ACH staff have reviewed each section for accuracy prior to submission.', true)
on conflict (pack_id, section_key) do nothing;


-- -- CAREER PROGRESSION REPORTS ------------------------------
-- Annual 2026 CPRs for the partners that had paid milestones in seed.sql.

insert into public.career_progression_reports (
  partner_id, period_label,
  total_milestone_payments, total_dev_fund_contribution, match_funding_amplification,
  candidates_contributed_to, training_enrolments_funded, transitions, earnings_uplift_attributed,
  retention_in_progressed_roles, methodology_version
) values
  ('11111111-1111-1111-1111-000000000002', '2026 annual',
    5500.00, 1650.00, 750.00,
    3, 1, 1, 4800.00,
    2, 'v1.0'),
  ('11111111-1111-1111-1111-000000000005', '2026 annual',
    0.00, 0.00, 0.00,
    0, 0, 0, 0.00,
    0, 'v1.0'),
  ('11111111-1111-1111-1111-000000000001', '2026 annual',
    0.00, 0.00, 0.00,
    3, 0, 0, 0.00,
    0, 'v1.0')
on conflict (partner_id, period_label) do nothing;


-- -- ENGAGEMENT REPORTS --------------------------------------
-- For a hypothetical sub-milestone exit - Doyle Collection candidate
-- (Jelena, Albanian, completed but left pre-6mo retention).

insert into public.placements (id, candidate_id, partner_id, cohort_id, role_title, salary_band, salary_actual, start_date, end_date, status, sponsored_placement)
values
  ('55555555-5555-5555-5555-000000000004', '33333333-3333-3333-3333-00000000000a', '11111111-1111-1111-1111-000000000003', '22222222-2222-2222-2222-000000000001', 'Front Desk Assistant', 'volume', 21000, '2026-10-14', '2027-01-30', 'left_pre_6mo', true)
on conflict (id) do nothing;

insert into public.engagement_reports (
  placement_id, partner_id,
  engagement_summary, placement_outcomes_factual, candidate_development_trajectory,
  partial_sv_attribution, learnings, methodology_version
) values (
  '55555555-5555-5555-5555-000000000004',
  '11111111-1111-1111-1111-000000000003',
  'Candidate started at Doyle Collection (The Bristol Hotel) as Front Desk Assistant on 14 Oct 2026, exited on 30 Jan 2027 (just under 4 months in role).',
  'Confirmed start; confirmed exit. Exit was candidate-initiated to take a higher-paid role in the same sector. Doyle confirms positive working relationship throughout.',
  'Strong progression - candidate gained UK customer-service experience and moved up-band within the sector. ACH continues 12-month tracking through the candidate''s new role.',
  1800.00,
  'Sub-milestone exits driven by candidate progression (not by adverse conditions) should be celebrated - they evidence the programme working as intended, even though no retention milestone fee is due.',
  'v1.0'
) on conflict (placement_id) do nothing;


-- -- EQUIVALENCE APPLICATIONS --------------------------------
-- Apply the seeded equivalence values to the 3 active Pret placements.

insert into public.equivalence_applications (equivalence_id, applied_to_kind, applied_to_id, units, resulting_value)
select
  ev.id,
  'cohort_outcome',
  '22222222-2222-2222-2222-000000000001',
  3,
  3 * ev.value_per_unit
from public.equivalence_values ev
where ev.outcome_code = 'employment_outcome_3mo' and ev.methodology = 'ach_local'
limit 1;

insert into public.equivalence_applications (equivalence_id, applied_to_kind, applied_to_id, units, resulting_value)
select
  ev.id,
  'partner_report',
  '11111111-1111-1111-1111-000000000002',
  2,
  2 * ev.value_per_unit
from public.equivalence_values ev
where ev.outcome_code = 'retention_savings_standard' and ev.methodology = 'ach_local'
limit 1;


-- -- TRANSLATIONS --------------------------------------------
-- Seed common UI strings for English (source) and Tier B locales (ar, fr, es, uk).
-- Tier C locales get rows but content null (English shown when null) + needs review flag.

with keys as (
  select unnest(array[
    'nav.dashboard',     'nav.partners',     'nav.candidates',  'nav.cohorts',
    'nav.projects',      'nav.pricing',      'nav.devFund',     'nav.equivalence',
    'nav.evidencePack',  'nav.reports',      'nav.translations','nav.verifiedNetwork',
    'common.save',       'common.cancel',    'common.delete',   'common.edit',
    'common.signIn',     'common.signOut',
    'banner.translationPending'
  ]) as k
)
insert into public.translations (message_key, locale, content, reviewed, needs_native_review, source_method)
select k, 'en', content, true, false, 'manual'
from keys
cross join lateral (values
  (case k
    when 'nav.dashboard'         then 'Dashboard'
    when 'nav.partners'          then 'Partners'
    when 'nav.candidates'        then 'Candidates'
    when 'nav.cohorts'           then 'Cohorts'
    when 'nav.projects'          then 'Projects'
    when 'nav.pricing'           then 'Pricing tool'
    when 'nav.devFund'           then 'Development fund'
    when 'nav.equivalence'       then 'Equivalence'
    when 'nav.evidencePack'      then 'Evidence packs'
    when 'nav.reports'           then 'Other reports'
    when 'nav.translations'      then 'Translations'
    when 'nav.verifiedNetwork'   then 'Verified network'
    when 'common.save'           then 'Save'
    when 'common.cancel'         then 'Cancel'
    when 'common.delete'         then 'Delete'
    when 'common.edit'           then 'Edit'
    when 'common.signIn'         then 'Sign in'
    when 'common.signOut'        then 'Sign out'
    when 'banner.translationPending' then 'Translation pending - please use English for now or contact your caseworker.'
  end)
) as v(content)
on conflict (message_key, locale) do nothing;

-- Arabic (Tier B - machine translated, pending review)
insert into public.translations (message_key, locale, content, reviewed, needs_native_review, source_method) values
  ('nav.dashboard',    'ar', 'لوحة التحكم',       false, false, 'machine_gemini'),
  ('nav.partners',     'ar', 'الشركاء',           false, false, 'machine_gemini'),
  ('nav.candidates',   'ar', 'المرشحون',          false, false, 'machine_gemini'),
  ('nav.cohorts',      'ar', 'المجموعات',         false, false, 'machine_gemini'),
  ('nav.projects',     'ar', 'المشاريع',          false, false, 'machine_gemini'),
  ('nav.pricing',      'ar', 'أداة التسعير',      false, false, 'machine_gemini'),
  ('nav.devFund',      'ar', 'صندوق التطوير',     false, false, 'machine_gemini'),
  ('common.save',      'ar', 'حفظ',               false, false, 'machine_gemini'),
  ('common.cancel',    'ar', 'إلغاء',             false, false, 'machine_gemini'),
  ('common.signIn',    'ar', 'تسجيل الدخول',      false, false, 'machine_gemini'),
  ('common.signOut',   'ar', 'تسجيل الخروج',      false, false, 'machine_gemini'),
  ('banner.translationPending', 'ar', 'الترجمة قيد المراجعة - يرجى استخدام اللغة الإنجليزية أو الاتصال بالأخصائي.', true, false, 'manual')
on conflict (message_key, locale) do nothing;

-- French (Tier B)
insert into public.translations (message_key, locale, content, reviewed, needs_native_review, source_method) values
  ('nav.dashboard',    'fr', 'Tableau de bord',     false, false, 'machine_gemini'),
  ('nav.partners',     'fr', 'Partenaires',         false, false, 'machine_gemini'),
  ('nav.candidates',   'fr', 'Candidats',           false, false, 'machine_gemini'),
  ('nav.cohorts',      'fr', 'Cohortes',            false, false, 'machine_gemini'),
  ('nav.projects',     'fr', 'Projets',             false, false, 'machine_gemini'),
  ('nav.pricing',      'fr', 'Outil de tarification', false, false, 'machine_gemini'),
  ('common.save',      'fr', 'Enregistrer',         false, false, 'machine_gemini'),
  ('common.cancel',    'fr', 'Annuler',             false, false, 'machine_gemini'),
  ('common.signIn',    'fr', 'Se connecter',        false, false, 'machine_gemini'),
  ('common.signOut',   'fr', 'Se déconnecter',      false, false, 'machine_gemini')
on conflict (message_key, locale) do nothing;

-- Spanish (Tier B)
insert into public.translations (message_key, locale, content, reviewed, needs_native_review, source_method) values
  ('nav.dashboard',    'es', 'Panel',              false, false, 'machine_gemini'),
  ('nav.partners',     'es', 'Socios',             false, false, 'machine_gemini'),
  ('nav.candidates',   'es', 'Candidatos',         false, false, 'machine_gemini'),
  ('nav.cohorts',      'es', 'Cohortes',           false, false, 'machine_gemini'),
  ('common.save',      'es', 'Guardar',            false, false, 'machine_gemini'),
  ('common.cancel',    'es', 'Cancelar',           false, false, 'machine_gemini'),
  ('common.signIn',    'es', 'Iniciar sesión',     false, false, 'machine_gemini')
on conflict (message_key, locale) do nothing;

-- Ukrainian (Tier B)
insert into public.translations (message_key, locale, content, reviewed, needs_native_review, source_method) values
  ('nav.dashboard',    'uk', 'Панель',             false, false, 'machine_gemini'),
  ('nav.partners',     'uk', 'Партнери',           false, false, 'machine_gemini'),
  ('nav.candidates',   'uk', 'Кандидати',          false, false, 'machine_gemini'),
  ('nav.cohorts',      'uk', 'Когорти',            false, false, 'machine_gemini'),
  ('common.save',      'uk', 'Зберегти',           false, false, 'machine_gemini'),
  ('common.cancel',    'uk', 'Скасувати',          false, false, 'machine_gemini'),
  ('common.signIn',    'uk', 'Увійти',             false, false, 'machine_gemini')
on conflict (message_key, locale) do nothing;

-- Tier C locales (fa, ps, ti, so, ckb, sq) get null content (English shown when null)
-- and needs_native_review flag set true.
insert into public.translations (message_key, locale, content, reviewed, needs_native_review, source_method)
select t.k, loc, null, false, true, 'manual'
from (select unnest(array['nav.dashboard','nav.partners','nav.candidates','nav.cohorts','nav.projects','common.save','common.cancel','common.signIn','common.signOut']) as k) t
cross join unnest(array['fa','ps','ti','so','ckb','sq']) loc
on conflict (message_key, locale) do nothing;

-- The one human-reviewed banner sentence for each Tier C locale.
insert into public.translations (message_key, locale, content, reviewed, needs_native_review, source_method) values
  ('banner.translationPending', 'fa',  'ترجمه در حال بررسی است - لطفاً فعلاً از انگلیسی استفاده کنید یا با مددکار خود تماس بگیرید.', true, false, 'manual'),
  ('banner.translationPending', 'ps',  'ژباړه د بیاکتنې په حال کې ده - مهرباني وکړئ د اوس لپاره انګلیسي وکاروئ یا د خپل مرستندوی سره اړیکه ونیسئ.', true, false, 'manual'),
  ('banner.translationPending', 'ti',  'ትርጉም ይምርመር ኣሎ - ብኽብረትኩም ሕጂ ብእንግሊዝ ተጠቐሙ ወይ ብናይ ጉዳይ ሰብኩም ተራኸቡ።', true, false, 'manual'),
  ('banner.translationPending', 'so',  'Tarjumaadu way socotaa - fadlan hadda isticmaal Ingiriisi ama la xiriir kiiskaaga.', true, false, 'manual'),
  ('banner.translationPending', 'ckb', 'وەرگێڕان لە چاودێریدایە - تکایە لە ئێستادا ئینگلیزی بەکاربهێنە یان پەیوەندی بە کارمەندەکەتەوە بکە.', true, false, 'manual'),
  ('banner.translationPending', 'sq',  'Përkthimi është në shqyrtim - ju lutemi përdorni anglishten tani ose kontaktoni punonjësin e çështjes tuaj.', true, false, 'manual')
on conflict (message_key, locale) do nothing;
