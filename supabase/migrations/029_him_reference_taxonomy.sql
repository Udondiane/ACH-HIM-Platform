-- ============================================================
-- 029 · HIM verbatim reference taxonomy
-- ============================================================
-- Replaces the 32-factor abstracted framework (migration 006)
-- with the ~72-factor reference taxonomy verbatim from the HIM
-- master design (himeval reference set, May 2026).
--
-- Adds the `behavioural_prompt` column on `factors` carrying the
-- interview prompt verbatim. Indicators are recreated from each
-- factor's observable-criteria bullets verbatim.
--
-- WARNING: destructive of existing assessment responses keyed to
-- the previous indicator IDs. Run only in pilot-prep phase, before
-- any production cohort begins assessment under HIM v1.0.
--
-- The previous design used universal-factor deduplication
-- (digital_literacy, self_efficacy, english_fluency propagated
-- across multiple domains). The reference taxonomy duplicates
-- conceptually-related factors per domain (e.g. Language Proficiency
-- exists as emp_p_lang AND edu_p_lang) — this migration follows the
-- reference faithfully, so is_universal is false throughout.
-- ============================================================

begin;

-- Add behavioural_prompt column ----------------------------------
alter table public.factors
  add column if not exists behavioural_prompt text;

-- Add observable_bullets column for free-form access (indicators table
-- still holds the structured rows; this is a convenience copy).
alter table public.factors
  add column if not exists observable_bullets jsonb;

-- Wipe existing framework data ------------------------------------
-- assessment_responses has FK on indicators(id) with ON DELETE RESTRICT,
-- so clear it first. Pre-pilot phase: no production responses yet.
delete from public.assessment_responses;
delete from public.indicators;
delete from public.factor_domains;
delete from public.factors;

-- ============================================================
-- EMPLOYMENT
-- ============================================================
insert into public.factors (id, name, conversion_factor_type, measurement_question, behavioural_prompt, measurement_method, is_universal, observable_bullets) values
  ('emp_p_lang',    'Language Proficiency',              'personal',      $bk$How confident are you in describing your work experience in English?$bk$,                  $bk$Describe a time you used English to manage a work-related task.$bk$,        'likert_1_5', false, $bk$["Able to describe past job experience in English","Comfortable using work-related vocabulary","Can write/read basic emails or forms"]$bk$::jsonb),
  ('emp_p_dig',     'Digital Literacy',                  'personal',      $bk$How often do you use the internet for job searching or CV editing?$bk$,                     $bk$Show us how you would find a job listing online.$bk$,                        'likert_1_5', false, $bk$["Able to search and apply for jobs online","Comfortable using video interview platforms","Understands basic computer tasks"]$bk$::jsonb),
  ('emp_p_self',    'Self-efficacy',                     'personal',      $bk$I believe I can handle unexpected challenges in a work setting. (Agree/disagree)$bk$,        $bk$Tell me about something difficult you've overcome recently.$bk$,             'likert_1_5', false, $bk$["Believes in ability to succeed in a UK job","Willing to try unfamiliar tasks","Sees challenges as manageable"]$bk$::jsonb),
  ('emp_p_orient',  'Career Orientation',                'personal',      $bk$Do you have a specific career goal for the next year?$bk$,                                  null,                                                                             'likert_1_5', false, $bk$["Has identified at least one job goal","Knows basic UK work norms","Understands long-term career pathways"]$bk$::jsonb),
  ('emp_p_ready',   'Work-Readiness Confidence',         'personal',      $bk$How ready do you feel to attend a UK job interview tomorrow? (1-10)$bk$,                    $bk$What would you do if you had an interview next week?$bk$,                    'likert_1_5', false, $bk$["Feels prepared for job interview","Has suitable outfit, CV, and transport plan"]$bk$::jsonb),
  ('emp_s_peer',    'Peer Networks',                     'social',        $bk$How many people do you know who are working in the UK?$bk$,                                 $bk$Has anyone you know helped you find a job or training?$bk$,                  'likert_1_5', false, $bk$["Knows others working in the UK job market","Receives encouragement or referrals from peers"]$bk$::jsonb),
  ('emp_s_mentor',  'Mentorship or Role Models',         'social',        $bk$Do you know someone with a similar background who is working successfully in the UK?$bk$,   $bk$Tell me about a person who inspired your job path.$bk$,                      'likert_1_5', false, $bk$["Has seen someone \"like me\" succeed","Receives targeted advice from experienced peers"]$bk$::jsonb),
  ('emp_s_trust',   'Trust in Job-Seeking Institutions', 'social',        $bk$I trust my job support agency to act in my best interest.$bk$,                              $bk$Have you ever felt discouraged by a job service provider?$bk$,               'likert_1_5', false, $bk$["Trusts training providers or job coaches","Feels safe asking for help with job applications"]$bk$::jsonb),
  ('emp_e_legal',   'Legal Right to Work',               'environmental', $bk$Verified legal status + knowledge test or checklist$bk$,                                    null,                                                                             'yes_no',     false, $bk$["Has settled/pre-settled/refugee status enabling work","Understands documentation requirements"]$bk$::jsonb),
  ('emp_e_local',   'Local Job Market Access',           'environmental', $bk$Are there job opportunities or job fairs you can physically get to?$bk$,                    null,                                                                             'likert_1_5', false, $bk$["Can access jobs within transport range","Local employers offer entry-level roles"]$bk$::jsonb),
  ('emp_e_cred',    'Credential Recognition',            'environmental', $bk$Do you feel your previous experience is recognised in the UK?$bk$,                          $bk$Tell us if you've had to repeat any past learning or qualifications.$bk$,    'likert_1_5', false, $bk$["UK employers accept/acknowledge prior skills","Refugee knows whether retraining is needed"]$bk$::jsonb),
  ('emp_e_norm',    'Workplace Norms & Inclusion',       'environmental', $bk$I feel respected and included at work even if I make mistakes.$bk$,                         $bk$Describe how your first days at a new job felt.$bk$,                         'likert_1_5', false, $bk$["Workplaces welcome language learners","Onboarding allows for cultural difference"]$bk$::jsonb);

insert into public.factor_domains (factor_id, domain_id) values
  ('emp_p_lang','employment'),('emp_p_dig','employment'),('emp_p_self','employment'),
  ('emp_p_orient','employment'),('emp_p_ready','employment'),
  ('emp_s_peer','employment'),('emp_s_mentor','employment'),('emp_s_trust','employment'),
  ('emp_e_legal','employment'),('emp_e_local','employment'),('emp_e_cred','employment'),('emp_e_norm','employment');

-- ============================================================
-- HOUSING
-- ============================================================
insert into public.factors (id, name, conversion_factor_type, measurement_question, behavioural_prompt, measurement_method, is_universal, observable_bullets) values
  ('house_p_rights',  'Knowledge of Housing Rights',          'personal',      $bk$Do you feel confident reading and understanding a UK tenancy agreement?$bk$, $bk$What would you do if your landlord raised the rent suddenly?$bk$, 'likert_1_5', false, $bk$["Understands tenancy agreements","Knows what to do if facing eviction"]$bk$::jsonb),
  ('house_p_budget',  'Budgeting and Financial Planning',     'personal',      $bk$Can you estimate how much of your monthly income goes to housing?$bk$,        $bk$Tell us about how you manage your rent and household bills.$bk$,  'likert_1_5', false, $bk$["Knows how to allocate money for rent","Prioritizes housing expenses"]$bk$::jsonb),
  ('house_p_conf',    'Confidence Navigating Systems',        'personal',      $bk$Have you contacted a housing service by yourself in the past 6 months?$bk$,  null,                                                                  'likert_1_5', false, $bk$["Willing to contact local council","Can complete forms/contact helplines"]$bk$::jsonb),
  ('house_s_access',  'Access to Housing Advice',             'social',        $bk$Do you know where to go if you are facing housing difficulties?$bk$,         $bk$Tell us about a time you received housing advice.$bk$,            'likert_1_5', false, $bk$["Knows where to go when experiencing problems","Has access to case workers/advocates"]$bk$::jsonb),
  ('house_s_network', 'Supportive Community Networks',        'social',        $bk$If you lost your housing tomorrow, would someone help you temporarily?$bk$,  null,                                                                  'likert_1_5', false, $bk$["Receives emotional/practical help during crises","Can stay with friends/community in emergencies"]$bk$::jsonb),
  ('house_e_avail',   'Availability of Affordable Housing',   'environmental', $bk$Is there suitable and affordable housing available in your area?$bk$,        null,                                                                  'likert_1_5', false, $bk$["Local stock includes options within Benefit thresholds","Availability of temporary/supported options"]$bk$::jsonb),
  ('house_e_discrim', 'Discrimination or Gatekeeping Barriers','environmental',$bk$Have you ever been refused housing because of your nationality or status?$bk$,null,                                                                 'likert_1_5', false, $bk$["Not excluded due to refugee status","Landlords treat refugee tenants equally"]$bk$::jsonb),
  ('house_e_stab',    'Housing Stability & Security',         'environmental', $bk$Do you feel your current home is secure for the next 12 months?$bk$,         null,                                                                  'likert_1_5', false, $bk$["Length and renewability of current tenancy","Protections from eviction"]$bk$::jsonb),
  ('house_e_suit',    'Housing Suitability',                  'environmental', $bk$Is your current housing comfortable and appropriate for your household?$bk$, null,                                                                  'likert_1_5', false, $bk$["Meets standards for size, heating, sanitation","Safe for family members"]$bk$::jsonb);

insert into public.factor_domains (factor_id, domain_id) values
  ('house_p_rights','housing'),('house_p_budget','housing'),('house_p_conf','housing'),
  ('house_s_access','housing'),('house_s_network','housing'),
  ('house_e_avail','housing'),('house_e_discrim','housing'),('house_e_stab','housing'),('house_e_suit','housing');

-- ============================================================
-- EDUCATION & SKILLS
-- ============================================================
insert into public.factors (id, name, conversion_factor_type, measurement_question, behavioural_prompt, measurement_method, is_universal, observable_bullets) values
  ('edu_p_lang',  'Language Proficiency',          'personal',      $bk$How confident do you feel understanding lessons taught in English?$bk$,      $bk$Describe a time you participated in an English-language class.$bk$, 'likert_1_5', false, $bk$["Can follow lessons in English","Comfortable asking questions","Able to complete coursework"]$bk$::jsonb),
  ('edu_p_mot',   'Learning Motivation',           'personal',      $bk$How motivated are you to complete your current learning programme?$bk$,      $bk$What keeps you going when a course becomes difficult?$bk$,           'likert_1_5', false, $bk$["Values continued learning","Attends regularly and completes assignments"]$bk$::jsonb),
  ('edu_p_back',  'Educational Background Bridging','personal',     $bk$Have you had your previous education assessed or translated?$bk$,            $bk$Tell us how your prior education is helping/hindering you now.$bk$,  'likert_1_5', false, $bk$["Understands differences between UK system and previous","Has translated/assessed qualifications"]$bk$::jsonb),
  ('edu_p_dig',   'Digital Literacy',              'personal',      $bk$Can you log into and complete tasks on an online learning portal?$bk$,       null,                                                                    'likert_1_5', false, $bk$["Can navigate online learning platforms","Comfortable using email/research tools"]$bk$::jsonb),
  ('edu_s_family','Family and Caregiving Support', 'social',        $bk$Do your caregiving responsibilities interfere with your learning?$bk$,       $bk$How does your family support or hinder your studies?$bk$,            'likert_1_5', false, $bk$["Family members encourage learning","Care responsibilities do not obstruct participation"]$bk$::jsonb),
  ('edu_s_peer',  'Peer Learning Support',         'social',        $bk$Do you have someone to help you understand or revise class material?$bk$,    null,                                                                    'likert_1_5', false, $bk$["Has peers to revise with","Receives help from classmates"]$bk$::jsonb),
  ('edu_s_tutor', 'Mentorship or Tutor Encouragement','social',     $bk$Do you feel your teacher understands your learning needs?$bk$,               $bk$Describe how your teacher helps you learn.$bk$,                      'likert_1_5', false, $bk$["Tutor takes time to explain and adapt","Tutor offers encouragement"]$bk$::jsonb),
  ('edu_e_loc',   'Accessible Learning Locations', 'environmental', $bk$Can you reach your learning centre easily within 45 mins?$bk$,               null,                                                                    'likert_1_5', false, $bk$["Reachable by public transport","Timings suited for part-time workers/parents"]$bk$::jsonb),
  ('edu_e_prog',  'Course Recognition',            'environmental', $bk$Does your current course lead to a recognised qualification?$bk$,            null,                                                                    'likert_1_5', false, $bk$["Courses lead to recognised qualifications","Clear progression options (ESOL -> vocational)"]$bk$::jsonb),
  ('edu_e_cost',  'Affordability of Learning',     'environmental', $bk$Did cost prevent you from applying for a course in the last year?$bk$,       null,                                                                    'likert_1_5', false, $bk$["Courses are free or subsidised","No hidden costs"]$bk$::jsonb),
  ('edu_e_env',   'Supportive Learning Environments','environmental',$bk$Do you feel safe and respected in your class environment?$bk$,              null,                                                                    'likert_1_5', false, $bk$["Learner feels respected and included","Misunderstandings addressed gently"]$bk$::jsonb);

insert into public.factor_domains (factor_id, domain_id) values
  ('edu_p_lang','education'),('edu_p_mot','education'),('edu_p_back','education'),('edu_p_dig','education'),
  ('edu_s_family','education'),('edu_s_peer','education'),('edu_s_tutor','education'),
  ('edu_e_loc','education'),('edu_e_prog','education'),('edu_e_cost','education'),('edu_e_env','education');

-- ============================================================
-- HEALTH & WELLBEING
-- ============================================================
insert into public.factors (id, name, conversion_factor_type, measurement_question, behavioural_prompt, measurement_method, is_universal, observable_bullets) values
  ('health_p_phys',    'Physical Health Literacy',     'personal',      $bk$Do you know how to register with a GP?$bk$,                                              null,                                                                  'likert_1_5', false, $bk$["Understands when to seek help","Knows how to book GP/dentist appointment"]$bk$::jsonb),
  ('health_p_mental',  'Mental Health Awareness',      'personal',      $bk$Have you received any information about mental health?$bk$,                              $bk$How do you know when you're feeling mentally unwell?$bk$,           'likert_1_5', false, $bk$["Recognises signs of stress/trauma","Aware of available support"]$bk$::jsonb),
  ('health_p_seek',    'Health-Seeking Confidence',    'personal',      $bk$How confident are you in describing your health problems to a doctor? (1-10)$bk$,        null,                                                                  'likert_1_5', false, $bk$["Feels confident approaching professionals","Can express symptoms"]$bk$::jsonb),
  ('health_p_self',    'Self-Care Capacity',           'personal',      $bk$Prompt: "What helps you feel physically and mentally healthy every week?"$bk$,            null,                                                                  'likert_1_5', false, $bk$["Has daily routines for rest/nutrition","Manages chronic conditions"]$bk$::jsonb),
  ('health_s_trust',   'Trust in Healthcare Providers','social',        $bk$Do you feel respected and listened to by your doctor?$bk$,                               null,                                                                  'likert_1_5', false, $bk$["Believes NHS acts in best interest","No discriminatory experiences"]$bk$::jsonb),
  ('health_s_norm',    'Community Norms',              'social',        $bk$Do people you know talk openly about stress?$bk$,                                         null,                                                                  'likert_1_5', false, $bk$["Mental health openly discussed","Encouraged to access preventive care"]$bk$::jsonb),
  ('health_s_fam',     'Family Role Expectations',     'social',        $bk$Have family expectations made it harder to take care of your health?$bk$,                null,                                                                  'likert_1_5', false, $bk$["Family does not shame health issues","Needs do not clash with demands"]$bk$::jsonb),
  ('health_s_access',  'Accessibility of Services',    'social',        $bk$How easy is it to access a GP or dentist?$bk$,                                            null,                                                                  'likert_1_5', false, $bk$["Can get to local services","Short wait time, booking understood"]$bk$::jsonb),
  ('health_e_lang',    'Language-Sensitive Services',  'environmental', $bk$Have you received important health information in your language?$bk$,                    null,                                                                  'likert_1_5', false, $bk$["Interpreters available","Information provided in accessible formats"]$bk$::jsonb),
  ('health_e_holistic','Holistic Support Availability','environmental', $bk$Have you been supported for multiple needs at the same time?$bk$,                        null,                                                                  'likert_1_5', false, $bk$["Signposted to food banks/housing where needed","Integrated responses"]$bk$::jsonb),
  ('health_e_safe',    'Safe, Private Spaces',         'environmental', $bk$Do you feel emotionally safe when discussing personal issues?$bk$,                       null,                                                                  'likert_1_5', false, $bk$["Consultations are confidential","Can speak without fear or shame"]$bk$::jsonb);

insert into public.factor_domains (factor_id, domain_id) values
  ('health_p_phys','health'),('health_p_mental','health'),('health_p_seek','health'),('health_p_self','health'),
  ('health_s_trust','health'),('health_s_norm','health'),('health_s_fam','health'),('health_s_access','health'),
  ('health_e_lang','health'),('health_e_holistic','health'),('health_e_safe','health');

-- ============================================================
-- BELONGING & IDENTITY
-- ============================================================
insert into public.factors (id, name, conversion_factor_type, measurement_question, behavioural_prompt, measurement_method, is_universal, observable_bullets) values
  ('belong_p_self',  'Self-Efficacy and Confidence',         'personal',      $bk$I feel confident speaking my mind even in unfamiliar spaces.$bk$,            $bk$Tell me about a time you felt proud of something you did.$bk$,    'likert_1_5', false, $bk$["Believes actions make a difference","Feels proud of identity"]$bk$::jsonb),
  ('belong_p_ident', 'Cultural and Personal Identity',       'personal',      $bk$Do you feel able to express your culture or beliefs openly?$bk$,             $bk$Describe a moment you felt 'yourself' in the UK.$bk$,             'likert_1_5', false, $bk$["Can express religion/culture without fear","Maintains meaningful personal history"]$bk$::jsonb),
  ('belong_p_safe',  'Psychological Safety',                 'personal',      $bk$Do you worry about being judged for how you speak, look, or act?$bk$,        null,                                                                  'likert_1_5', false, $bk$["Feels safe from judgment","Can speak or dress as desired"]$bk$::jsonb),
  ('belong_s_recog', 'Social Recognition',                   'social',        $bk$Do you feel others see you as a person of worth?$bk$,                        $bk$Has someone ever shown you appreciation that mattered deeply?$bk$,  'likert_1_5', false, $bk$["Feels seen and valued","Role in community acknowledged"]$bk$::jsonb),
  ('belong_s_peer',  'Peer and Role Models',                 'social',        $bk$Can you name someone you relate to who has done well in the UK?$bk$,         null,                                                                  'likert_1_5', false, $bk$["Sees others from similar background succeed","Feels hope from examples"]$bk$::jsonb),
  ('belong_s_rel',   'Relational Stability',                 'social',        $bk$How often do you spend time with someone you trust?$bk$,                     $bk$Describe a friendship that helps you feel at home here.$bk$,        'likert_1_5', false, $bk$["Feels emotionally connected","Has reliable relationships"]$bk$::jsonb),
  ('belong_e_incl',  'Inclusive Community Spaces',           'environmental', $bk$Do you feel welcome in community events like libraries?$bk$,                 null,                                                                  'likert_1_5', false, $bk$["Safe and welcoming public spaces exist","Cultural mixing encouraged"]$bk$::jsonb),
  ('belong_e_rep',   'Positive Representation',              'environmental', $bk$Have you seen positive images of people like you in UK media?$bk$,           null,                                                                  'likert_1_5', false, $bk$["Refugees represented respectfully","Services avoid stereotypes"]$bk$::jsonb),
  ('belong_e_cel',   'Celebration of Diversity',             'environmental', $bk$Have you joined or led any cultural celebrations here?$bk$,                  null,                                                                  'likert_1_5', false, $bk$["Local festivals celebrated inclusively","Groups participate in shaping events"]$bk$::jsonb),
  ('belong_e_house', 'Housing Stability and Safety',         'environmental', $bk$Have you moved more than once in the past year?$bk$,                         $bk$How does your housing situation affect your sense of home?$bk$,     'likert_1_5', false, $bk$["Can stay long-term in clean, stable accommodation","Not constantly 'starting over'"]$bk$::jsonb);

insert into public.factor_domains (factor_id, domain_id) values
  ('belong_p_self','belonging'),('belong_p_ident','belonging'),('belong_p_safe','belonging'),
  ('belong_s_recog','belonging'),('belong_s_peer','belonging'),('belong_s_rel','belonging'),
  ('belong_e_incl','belonging'),('belong_e_rep','belonging'),('belong_e_cel','belonging'),('belong_e_house','belonging');

-- ============================================================
-- SOCIAL PARTICIPATION
-- ============================================================
insert into public.factors (id, name, conversion_factor_type, measurement_question, behavioural_prompt, measurement_method, is_universal, observable_bullets) values
  ('soc_p_conf',   'Confidence in Participation',         'personal',      $bk$I feel confident contributing to group discussions.$bk$,                      $bk$Describe a time you felt your opinion influenced a group.$bk$, 'likert_1_5', false, $bk$["Feels comfortable expressing views","Feels voice matters"]$bk$::jsonb),
  ('soc_p_civic',  'Civic Knowledge',                     'personal',      $bk$Do you understand how to get involved in local decisions?$bk$,                null,                                                              'likert_1_5', false, $bk$["Understands local initiatives","Knows how to join groups"]$bk$::jsonb),
  ('soc_p_vol',    'Volunteering Orientation',            'personal',      $bk$Have you volunteered in the last year?$bk$,                                   null,                                                              'likert_1_5', false, $bk$["Has desire to contribute time","Takes initiative"]$bk$::jsonb),
  ('soc_s_net',    'Access to Social Networks',           'social',        $bk$Do you know someone who helps you connect with social events?$bk$,            null,                                                              'likert_1_5', false, $bk$["Has invitations/awareness of events","Knows someone who can bring them"]$bk$::jsonb),
  ('soc_s_wel',    'Sense of Being Welcomed',             'social',        $bk$I feel that people in my area want me to take part.$bk$,                      null,                                                              'likert_1_5', false, $bk$["Not made to feel like an outsider","Encouraged to contribute"]$bk$::jsonb),
  ('soc_s_mut',    'Mutual Exchange',                     'social',        $bk$Have you been part of a project where people worked together equally?$bk$,    null,                                                              'likert_1_5', false, $bk$["Feels others value contributions","Experiences shared efforts"]$bk$::jsonb),
  ('soc_e_plat',   'Availability of Platforms',           'environmental', $bk$Do you have opportunities to join community meetings?$bk$,                    null,                                                              'likert_1_5', false, $bk$["Local meetings/forums exist","Volunteering/arts programs offered"]$bk$::jsonb),
  ('soc_e_struct', 'Supportive Structures',               'environmental', $bk$Are community events inclusive of different backgrounds?$bk$,                 null,                                                              'likert_1_5', false, $bk$["Events include refugee voices","Facilitators trained in sensitivity"]$bk$::jsonb),
  ('soc_e_recog',  'Recognition of Informal Participation','environmental',$bk$Describe something informal you've done that helped your community.$bk$,      null,                                                              'narrative',  false, $bk$["Helping neighbours/informal chats seen as valid"]$bk$::jsonb),
  ('soc_e_access', 'Physical Accessibility',              'environmental', $bk$Do practical issues like transport stop you from joining?$bk$,                null,                                                              'likert_1_5', false, $bk$["Can get to events safely","Childcare/translation available"]$bk$::jsonb);

insert into public.factor_domains (factor_id, domain_id) values
  ('soc_p_conf','social'),('soc_p_civic','social'),('soc_p_vol','social'),
  ('soc_s_net','social'),('soc_s_wel','social'),('soc_s_mut','social'),
  ('soc_e_plat','social'),('soc_e_struct','social'),('soc_e_recog','social'),('soc_e_access','social');

-- ============================================================
-- RIGHTS & CITIZENSHIP
-- ============================================================
insert into public.factors (id, name, conversion_factor_type, measurement_question, behavioural_prompt, measurement_method, is_universal, observable_bullets) values
  ('rights_p_lit',    'Legal Literacy',                       'personal',      $bk$I know where to go if I need legal advice on my immigration status.$bk$,         null,                                                                  'likert_1_5', false, $bk$["Understands basic legal rights","Aware of routes to settlement"]$bk$::jsonb),
  ('rights_p_conf',   'Confidence Navigating Systems',        'personal',      $bk$I feel confident completing official forms.$bk$,                                 null,                                                                  'likert_1_5', false, $bk$["Not intimidated by forms","Feels able to assert rights"]$bk$::jsonb),
  ('rights_p_emp',    'Civic Empowerment',                    'personal',      $bk$What does it mean to you to be part of UK society?$bk$,                          null,                                                                  'narrative',  false, $bk$["Understands role as participant","Sees oneself as right-bearing"]$bk$::jsonb),
  ('rights_s_trust',  'Trust in Institutions',                'social',        $bk$I trust the local council to help if I need them.$bk$,                           null,                                                                  'likert_1_5', false, $bk$["Believes public services will treat them fairly","Past experiences did not undermine trust"]$bk$::jsonb),
  ('rights_s_med',    'Social Mediation',                     'social',        $bk$Do you know someone who can help you deal with official processes?$bk$,         null,                                                                  'likert_1_5', false, $bk$["Has access to trusted advocate","Can receive support when asserting rights"]$bk$::jsonb),
  ('rights_s_role',   'Civic Role Models',                    'social',        $bk$Do you know someone whose path to citizenship inspired you?$bk$,                 null,                                                                  'likert_1_5', false, $bk$["Knows others who navigated systems","Inspired to pursue similar routes"]$bk$::jsonb),
  ('rights_e_acc',    'Accessible Legal Services',            'environmental', $bk$Do you know where to find legal help in your local area?$bk$,                   null,                                                                  'likert_1_5', false, $bk$["Services exist and reachable","Language support available"]$bk$::jsonb),
  ('rights_e_stable', 'Stable Legal Environment',             'environmental', $bk$Have you been confused by unclear rules?$bk$,                                    null,                                                                  'likert_1_5', false, $bk$["Policies don't shift unpredictably","Application processes clear"]$bk$::jsonb),
  ('rights_e_opp',    'Opportunities for Participation',      'environmental', $bk$Have you had the opportunity to participate in political activities?$bk$,        null,                                                                  'likert_1_5', false, $bk$["Invited to share feedback","Can join petitions/campaigns"]$bk$::jsonb);

insert into public.factor_domains (factor_id, domain_id) values
  ('rights_p_lit','rights'),('rights_p_conf','rights'),('rights_p_emp','rights'),
  ('rights_s_trust','rights'),('rights_s_med','rights'),('rights_s_role','rights'),
  ('rights_e_acc','rights'),('rights_e_stable','rights'),('rights_e_opp','rights');

-- ============================================================
-- INDICATORS — built verbatim from each factor's bullets
-- ============================================================
-- One indicator per bullet, ID format `{factor_id}.b{n}`, name = bullet text.
-- Generated programmatically from the observable_bullets jsonb column.
insert into public.indicators (id, factor_id, name, sort_order)
select
  f.id || '.b' || (ord - 1)            as id,
  f.id                                  as factor_id,
  bullet::text                          as name,
  (ord - 1)::integer                    as sort_order
from public.factors f
cross join lateral jsonb_array_elements_text(coalesce(f.observable_bullets, '[]'::jsonb)) with ordinality as t(bullet, ord);

-- Strip the leading/trailing quotes that jsonb_array_elements_text leaves
-- (since the source is jsonb strings, the text cast keeps them clean —
-- this is a no-op for clean inputs but defensive).
update public.indicators
set name = trim(both '"' from name)
where name like '"%"';

commit;

-- ============================================================
-- Post-migration verification (informational)
-- ============================================================
-- Expected counts:
--   domains:       7
--   factors:      72
--   factor_domains:72
--   indicators: ~180
do $$
declare
  v_factors integer;
  v_indicators integer;
  v_factor_domains integer;
begin
  select count(*) into v_factors from public.factors;
  select count(*) into v_indicators from public.indicators;
  select count(*) into v_factor_domains from public.factor_domains;
  raise notice 'HIM verbatim taxonomy installed: % factors, % factor_domains, % indicators',
    v_factors, v_factor_domains, v_indicators;
end$$;
