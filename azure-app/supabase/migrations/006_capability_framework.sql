-- ============================================================
-- 006 · capability framework (domains · factors · indicators)
-- ============================================================
-- Spec §7: seven domains × three conversion factor types × N factors.
-- Each factor has 2–4 behavioural indicators describing what good looks like.
-- A subset of factors are "universal" — assessed once per candidate per
-- timepoint and propagated to all domains where they apply (spec §7.4).
-- ============================================================

do $$ begin
  create type public.conversion_factor_type as enum (
    'personal', 'social', 'environmental'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.measurement_method as enum (
    'likert_1_5', 'likert_1_10', 'yes_no', 'count', 'checklist', 'narrative'
  );
exception when duplicate_object then null; end $$;

-- ── DOMAINS ───────────────────────────────────────────────
create table if not exists public.domains (
  id          text primary key,                      -- 'employment', 'housing', ...
  name        text not null,
  description text,
  sort_order  integer not null
);

insert into public.domains (id, name, description, sort_order) values
  ('employment',  'Employment Capability',          'Capacity to access, sustain and progress in paid work.', 1),
  ('housing',     'Housing Capability',             'Capacity to secure and maintain stable housing.', 2),
  ('education',   'Education and Skills Capability','Capacity to acquire and use skills and qualifications.', 3),
  ('health',      'Health and Wellbeing Capability','Physical and mental health, agency over wellbeing.', 4),
  ('belonging',   'Belonging and Identity Capability','Sense of belonging, identity, dignity in community.', 5),
  ('social',      'Social Participation Capability','Networks, civic life, social connection.', 6),
  ('rights',      'Rights and Citizenship Capability','Knowledge and exercise of rights, citizenship pathway.', 7)
on conflict (id) do nothing;

-- ── FACTORS ───────────────────────────────────────────────
-- A factor sits within a (domain, conversion-factor-type) cell.
-- Universal factors propagate across multiple domains via the
-- factor_domains join table below.
create table if not exists public.factors (
  id                       text primary key,         -- stable slug: 'digital_literacy', 'self_efficacy', etc.
  name                     text not null,
  conversion_factor_type   public.conversion_factor_type not null,
  measurement_question     text not null,
  measurement_method       public.measurement_method not null default 'likert_1_5',
  is_universal             boolean not null default false,
  notes                    text
);

create index if not exists idx_factors_universal on public.factors(is_universal);

-- Join table: which domains a factor applies to.
-- Non-universal factors appear in exactly one row here.
-- Universal factors (e.g. digital_literacy) appear in multiple rows.
create table if not exists public.factor_domains (
  factor_id  text not null references public.factors(id) on delete cascade,
  domain_id  text not null references public.domains(id) on delete cascade,
  primary key (factor_id, domain_id)
);

-- ── INDICATORS ────────────────────────────────────────────
-- 2–4 indicators per factor, scored 0–5 (spec §7.3).
create table if not exists public.indicators (
  id           text primary key,                     -- e.g. 'work_readiness.cv_in_place'
  factor_id    text not null references public.factors(id) on delete cascade,
  name         text not null,
  description  text,
  sort_order   integer not null default 0
);

create index if not exists idx_indicators_factor on public.indicators(factor_id);

-- ── SEED THE FRAMEWORK ────────────────────────────────────
-- Universal factors that recur across multiple domains.
insert into public.factors (id, name, conversion_factor_type, measurement_question, measurement_method, is_universal) values
  ('digital_literacy',  'Digital literacy',  'personal', 'Can the person use digital tools relevant to their goals?', 'likert_1_5', true),
  ('self_efficacy',     'Self-efficacy',     'personal', 'Does the person believe in their ability to act effectively?', 'likert_1_5', true),
  ('english_fluency',   'English fluency',   'personal', 'Can the person communicate effectively in English for context-appropriate tasks?', 'likert_1_5', true)
on conflict (id) do nothing;

-- ── EMPLOYMENT (spec §7) ─────────────────────────────────
insert into public.factors (id, name, conversion_factor_type, measurement_question, measurement_method) values
  ('work_readiness',           'Work readiness',                 'personal',      'Is the person ready to enter UK employment?', 'likert_1_5'),
  ('sector_knowledge',         'Sector knowledge',               'personal',      'Does the person understand their target sector?', 'likert_1_5'),
  ('professional_network',     'Professional network',           'social',        'Does the person have professional contacts in their target sector?', 'count'),
  ('workplace_cultural_fluency','Workplace cultural fluency',    'social',        'Can the person read UK workplace norms?', 'likert_1_5'),
  ('right_to_work_clarity',    'Right-to-work clarity',          'environmental', 'Are right-to-work documents and employer-side clarity in place?', 'yes_no'),
  ('vacancy_access',           'Access to suitable vacancies',   'environmental', 'Can the person reach vacancies matched to their capability?', 'likert_1_5')
on conflict (id) do nothing;

insert into public.factor_domains (factor_id, domain_id) values
  ('work_readiness','employment'),
  ('sector_knowledge','employment'),
  ('professional_network','employment'),
  ('workplace_cultural_fluency','employment'),
  ('right_to_work_clarity','employment'),
  ('vacancy_access','employment'),
  ('digital_literacy','employment'),
  ('self_efficacy','employment'),
  ('english_fluency','employment')
on conflict do nothing;

-- ── HOUSING ───────────────────────────────────────────────
insert into public.factors (id, name, conversion_factor_type, measurement_question, measurement_method) values
  ('housing_literacy',         'Housing system literacy',        'personal',      'Does the person understand UK housing rights and processes?', 'likert_1_5'),
  ('housing_support_network',  'Housing support network',        'social',        'Does the person have people to call on for housing help?', 'likert_1_5'),
  ('tenure_stability',         'Tenure stability',               'environmental', 'Is the person in stable, secure accommodation?', 'likert_1_5'),
  ('housing_affordability',    'Housing affordability',          'environmental', 'Is the person able to meet housing costs sustainably?', 'likert_1_5')
on conflict (id) do nothing;

insert into public.factor_domains (factor_id, domain_id) values
  ('housing_literacy','housing'),
  ('housing_support_network','housing'),
  ('tenure_stability','housing'),
  ('housing_affordability','housing')
on conflict do nothing;

-- ── EDUCATION & SKILLS ───────────────────────────────────
insert into public.factors (id, name, conversion_factor_type, measurement_question, measurement_method) values
  ('learning_disposition',     'Learning disposition',           'personal',      'Is the person disposed to and confident with learning?', 'likert_1_5'),
  ('credential_recognition',   'Prior credential recognition',   'environmental', 'Are the person''s prior qualifications recognised or being recognised in the UK?', 'yes_no'),
  ('access_to_learning',       'Access to learning provision',   'environmental', 'Can the person access appropriate UK learning provision?', 'likert_1_5'),
  ('peer_learning_network',    'Peer learning network',          'social',        'Does the person have peers they learn alongside?', 'likert_1_5')
on conflict (id) do nothing;

insert into public.factor_domains (factor_id, domain_id) values
  ('learning_disposition','education'),
  ('credential_recognition','education'),
  ('access_to_learning','education'),
  ('peer_learning_network','education'),
  ('digital_literacy','education'),
  ('self_efficacy','education'),
  ('english_fluency','education')
on conflict do nothing;

-- ── HEALTH & WELLBEING ──────────────────────────────────
insert into public.factors (id, name, conversion_factor_type, measurement_question, measurement_method) values
  ('health_self_management',   'Health self-management',         'personal',      'Does the person manage their own physical and mental health?', 'likert_1_5'),
  ('mental_wellbeing',         'Mental wellbeing',               'personal',      'How does the person describe their mental wellbeing?', 'likert_1_5'),
  ('healthcare_access',        'Healthcare access',              'environmental', 'Can the person access UK healthcare appropriate to their needs?', 'likert_1_5'),
  ('wellbeing_support_network','Wellbeing support network',      'social',        'Does the person have people to call on for emotional support?', 'likert_1_5')
on conflict (id) do nothing;

insert into public.factor_domains (factor_id, domain_id) values
  ('health_self_management','health'),
  ('mental_wellbeing','health'),
  ('healthcare_access','health'),
  ('wellbeing_support_network','health')
on conflict do nothing;

-- ── BELONGING & IDENTITY ────────────────────────────────
insert into public.factors (id, name, conversion_factor_type, measurement_question, measurement_method) values
  ('sense_of_belonging',       'Sense of belonging',             'personal',      'Does the person feel they belong in their local community?', 'likert_1_5'),
  ('identity_continuity',      'Identity continuity',            'personal',      'Can the person maintain meaningful aspects of identity in UK context?', 'likert_1_5'),
  ('community_connection',     'Community connection',           'social',        'Is the person connected to community networks?', 'likert_1_5'),
  ('experience_of_dignity',    'Experience of dignity',          'environmental', 'Does the person experience dignity in everyday encounters?', 'likert_1_5')
on conflict (id) do nothing;

insert into public.factor_domains (factor_id, domain_id) values
  ('sense_of_belonging','belonging'),
  ('identity_continuity','belonging'),
  ('community_connection','belonging'),
  ('experience_of_dignity','belonging'),
  ('self_efficacy','belonging')
on conflict do nothing;

-- ── SOCIAL PARTICIPATION ────────────────────────────────
insert into public.factors (id, name, conversion_factor_type, measurement_question, measurement_method) values
  ('civic_engagement',         'Civic engagement',               'personal',      'Does the person engage in civic life (volunteering, local groups, etc.)?', 'likert_1_5'),
  ('peer_network_breadth',     'Peer network breadth',           'social',        'How many distinct social networks is the person part of?', 'count'),
  ('local_inclusion',          'Local inclusion',                'environmental', 'Are local services and spaces accessible to the person?', 'likert_1_5')
on conflict (id) do nothing;

insert into public.factor_domains (factor_id, domain_id) values
  ('civic_engagement','social'),
  ('peer_network_breadth','social'),
  ('local_inclusion','social')
on conflict do nothing;

-- ── RIGHTS & CITIZENSHIP ────────────────────────────────
insert into public.factors (id, name, conversion_factor_type, measurement_question, measurement_method) values
  ('rights_literacy',          'Rights literacy',                'personal',      'Does the person know their rights in the UK?', 'likert_1_5'),
  ('legal_support_access',     'Legal support access',           'environmental', 'Can the person access appropriate immigration / legal advice?', 'yes_no'),
  ('citizenship_pathway',      'Citizenship pathway clarity',    'environmental', 'Is the person''s pathway to settled status / citizenship clear?', 'likert_1_5'),
  ('advocacy_network',         'Advocacy network',               'social',        'Does the person have advocates / supporters in their corner?', 'likert_1_5')
on conflict (id) do nothing;

insert into public.factor_domains (factor_id, domain_id) values
  ('rights_literacy','rights'),
  ('legal_support_access','rights'),
  ('citizenship_pathway','rights'),
  ('advocacy_network','rights')
on conflict do nothing;

-- ── INDICATORS — 2–4 per factor ─────────────────────────
-- Employment
insert into public.indicators (id, factor_id, name, sort_order) values
  ('work_readiness.cv',          'work_readiness',           'CV in place and tailored', 1),
  ('work_readiness.interview',   'work_readiness',           'Interview competence',     2),
  ('work_readiness.attendance',  'work_readiness',           'Reliable attendance habits',3),
  ('sector_knowledge.roles',     'sector_knowledge',         'Knows realistic role types',1),
  ('sector_knowledge.routes',    'sector_knowledge',         'Knows progression routes', 2),
  ('professional_network.contacts','professional_network',   'Has ≥1 named contact in sector',1),
  ('professional_network.referrer','professional_network',   'Has ≥1 person willing to refer',2),
  ('workplace_cultural_fluency.norms','workplace_cultural_fluency','Reads UK workplace norms',1),
  ('workplace_cultural_fluency.feedback','workplace_cultural_fluency','Receives feedback constructively',2),
  ('right_to_work_clarity.docs', 'right_to_work_clarity',    'Documents present and current',1),
  ('right_to_work_clarity.employer','right_to_work_clarity','Employer-side clarity confirmed',2),
  ('vacancy_access.pipeline',    'vacancy_access',           'Active pipeline of suitable vacancies',1),
  ('vacancy_access.channels',    'vacancy_access',           'Reaches vacancies through ≥2 channels',2)
on conflict (id) do nothing;

-- Universal-factor indicators
insert into public.indicators (id, factor_id, name, sort_order) values
  ('digital_literacy.email',     'digital_literacy',         'Uses email and online forms confidently',1),
  ('digital_literacy.search',    'digital_literacy',         'Uses search and job-search tools',     2),
  ('digital_literacy.learning',  'digital_literacy',         'Uses online learning tools',           3),
  ('self_efficacy.action',       'self_efficacy',            'Acts on intentions',                   1),
  ('self_efficacy.belief',       'self_efficacy',            'Believes own efforts will succeed',    2),
  ('english_fluency.daily',      'english_fluency',          'Holds everyday conversations',         1),
  ('english_fluency.task',       'english_fluency',          'Completes context-appropriate written tasks',2),
  ('english_fluency.confidence', 'english_fluency',          'Speaks with confidence in unfamiliar settings',3)
on conflict (id) do nothing;

-- Housing
insert into public.indicators (id, factor_id, name, sort_order) values
  ('housing_literacy.rights',    'housing_literacy',         'Knows tenant rights',                  1),
  ('housing_literacy.process',   'housing_literacy',         'Can navigate application process',     2),
  ('housing_support_network.help','housing_support_network', 'Has ≥1 person to call for housing help',1),
  ('tenure_stability.length',    'tenure_stability',         'Stable in current accommodation ≥6mo', 1),
  ('housing_affordability.share','housing_affordability',    'Housing cost ≤40% of income',          1)
on conflict (id) do nothing;

-- Education
insert into public.indicators (id, factor_id, name, sort_order) values
  ('learning_disposition.engagement','learning_disposition', 'Engages with learning opportunities',  1),
  ('learning_disposition.persistence','learning_disposition','Persists through difficulty',          2),
  ('credential_recognition.process','credential_recognition','Recognition in progress or completed', 1),
  ('access_to_learning.suitable','access_to_learning',       'Suitable provision available',         1),
  ('peer_learning_network.peers','peer_learning_network',    'Has peers to learn alongside',         1)
on conflict (id) do nothing;

-- Health
insert into public.indicators (id, factor_id, name, sort_order) values
  ('health_self_management.routine','health_self_management','Has health routines',                  1),
  ('health_self_management.helpseeking','health_self_management','Seeks help when needed',           2),
  ('mental_wellbeing.outlook',   'mental_wellbeing',         'Reports positive outlook',             1),
  ('healthcare_access.gp',       'healthcare_access',        'Registered with GP',                   1),
  ('wellbeing_support_network.contacts','wellbeing_support_network','Has people to talk to',         1)
on conflict (id) do nothing;

-- Belonging
insert into public.indicators (id, factor_id, name, sort_order) values
  ('sense_of_belonging.place',   'sense_of_belonging',       'Feels at home in local area',          1),
  ('identity_continuity.practice','identity_continuity',     'Can maintain cultural / religious practice',1),
  ('community_connection.groups','community_connection',     'Member of ≥1 community group',         1),
  ('experience_of_dignity.daily','experience_of_dignity',    'Reports dignified everyday interactions',1)
on conflict (id) do nothing;

-- Social
insert into public.indicators (id, factor_id, name, sort_order) values
  ('civic_engagement.activity',  'civic_engagement',         'Active in ≥1 civic activity',          1),
  ('peer_network_breadth.count', 'peer_network_breadth',     'Member of multiple social networks',   1),
  ('local_inclusion.services',   'local_inclusion',          'Uses local services confidently',      1)
on conflict (id) do nothing;

-- Rights
insert into public.indicators (id, factor_id, name, sort_order) values
  ('rights_literacy.basics',     'rights_literacy',          'Knows core rights (work, housing, healthcare)',1),
  ('legal_support_access.adviser','legal_support_access',    'Has access to qualified adviser',      1),
  ('citizenship_pathway.clarity','citizenship_pathway',      'Clear on next-step requirements',      1),
  ('advocacy_network.support',   'advocacy_network',         'Has named advocates / supporters',     1)
on conflict (id) do nothing;

-- ── RLS ──────────────────────────────────────────────────
-- Framework reference data is readable by all authenticated users.
alter table public.domains          enable row level security;
alter table public.factors          enable row level security;
alter table public.factor_domains   enable row level security;
alter table public.indicators       enable row level security;

drop policy if exists "domains_read"        on public.domains;
create policy "domains_read"        on public.domains        for select using (auth.role() = 'authenticated');
drop policy if exists "factors_read"        on public.factors;
create policy "factors_read"        on public.factors        for select using (auth.role() = 'authenticated');
drop policy if exists "factor_domains_read" on public.factor_domains;
create policy "factor_domains_read" on public.factor_domains for select using (auth.role() = 'authenticated');
drop policy if exists "indicators_read"     on public.indicators;
create policy "indicators_read"     on public.indicators     for select using (auth.role() = 'authenticated');

-- Only ACH staff can modify the framework (e.g. add a new factor).
drop policy if exists "framework_ach_write_factors"   on public.factors;
create policy "framework_ach_write_factors"   on public.factors        for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "framework_ach_write_fd"        on public.factor_domains;
create policy "framework_ach_write_fd"        on public.factor_domains for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "framework_ach_write_indicators" on public.indicators;
create policy "framework_ach_write_indicators" on public.indicators    for all using (public.is_ach_staff()) with check (public.is_ach_staff());
