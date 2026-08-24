-- 059 · Reseed framework to match Refugee_Capabilities_Full.xlsx (72 metrics, 7 domains)
--
-- Strips existing factors + indicators (and any assessment_responses that reference
-- them) and reseeds the framework verbatim from the uploaded capabilities workbook.
-- Score guides on individual factors are dropped since factor IDs change; they can
-- be re-seeded in a follow-up migration once the demo shows the new IDs are stable.
--
-- ⚠️  DESTRUCTIVE — POST-INCIDENT SAFETY GUARD  ⚠️
--
-- This migration destroyed 157 rows of live baseline data when applied
-- against the IKEA pilot on 2026-07-29. Original comment claimed
-- "pre-pilot data only" — that was an assumption, not a check.
--
-- The migration is retained AS-IS in git history so schema evolution
-- is reproducible from scratch. On a fresh empty Supabase this is safe.
-- On any Supabase with existing content, the guard below refuses to
-- run unless the operator has explicitly acknowledged the wipe.
--
-- To run this migration on a database with existing content:
--   1. Trigger the nightly-backup workflow first, download the release
--   2. Run this SQL block to acknowledge:
--        select set_config('him.migration_059_ack', 'i-have-backed-up', false);
--   3. Paste this migration
--
-- Without step 2, the guard raises and rolls back.
-- @approved-destructive — retained for schema reproducibility; guarded

do $$
declare
  n integer;
  ack text;
begin
  select count(*) into n from public.assessment_responses;
  begin
    ack := current_setting('him.migration_059_ack', true);
  exception when others then
    ack := null;
  end;

  if n > 0 and coalesce(ack, '') != 'i-have-backed-up' then
    raise exception E'\n'
      '════════════════════════════════════════════════════════════════\n'
      'REFUSING to reseed framework — % rows of assessment_responses exist.\n'
      'Migration 059 destroyed 157 rows of live IKEA baseline data on 2026-07-29\n'
      'because this check was not in place. Do NOT proceed without a backup.\n'
      '\n'
      'To acknowledge you have taken a backup and want to proceed anyway:\n'
      '  select set_config(''him.migration_059_ack'', ''i-have-backed-up'', false);\n'
      'then re-run this migration.\n'
      '════════════════════════════════════════════════════════════════', n;
  end if;
end $$;

-- ── Wipe existing framework data ──
delete from public.assessment_responses;
delete from public.activity_factors;
delete from public.indicators;
delete from public.factor_domains;
delete from public.factors;

-- ── Ensure the seven domains exist ──
insert into public.domains (id, name, sort_order) values
  ('employment', $bk$Employment$bk$, 1),
  ('housing', $bk$Housing$bk$, 2),
  ('education', $bk$Education & Skills$bk$, 3),
  ('health', $bk$Health & Wellbeing$bk$, 4),
  ('belonging', $bk$Belonging & Identity$bk$, 5),
  ('social', $bk$Social Participation$bk$, 6),
  ('rights', $bk$Rights & Citizenship$bk$, 7)
on conflict (id) do update set name = excluded.name;

-- ── 72 factors (metrics) from the xlsx ──
insert into public.factors (id, name, conversion_factor_type, measurement_question, behavioural_prompt, measurement_method, is_universal) values
  ('emp_p_language_proficiency', $bk$Language Proficiency$bk$, 'personal', $bk$How confident are you in describing your work experience in English during an interview?$bk$, $bk$“Describe a time you used English to manage a work-related task.”$bk$, 'likert_1_5', false),
  ('emp_p_digital_literacy', $bk$Digital Literacy$bk$, 'personal', $bk$How often do you use the internet for job searching or CV editing?$bk$, $bk$“Show us how you would find a job listing online.”$bk$, 'likert_1_5', false),
  ('emp_p_self_efficacy', $bk$Self-efficacy$bk$, 'personal', $bk$I believe I can handle unexpected challenges in a work setting. (Agree/disagree)$bk$, $bk$“Tell me about something difficult you’ve overcome recently.”$bk$, 'likert_1_5', false),
  ('emp_p_career_orientation', $bk$Career Orientation$bk$, 'personal', $bk$Do you have a specific career goal for the next year? (Yes/No + open answer)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('emp_p_work_readiness_confidenc', $bk$Work-Readiness Confidence$bk$, 'personal', $bk$How ready do you feel to attend a UK job interview tomorrow? (1–10 scale)$bk$, $bk$“What would you do if you had an interview next week?”$bk$, 'likert_1_5', false),
  ('emp_s_peer_networks', $bk$Peer Networks$bk$, 'social', $bk$How many people do you know who are working in the UK? (Number)$bk$, $bk$“Has anyone you know helped you find a job or training?”$bk$, 'likert_1_5', false),
  ('emp_s_mentorship_or_role_model', $bk$Mentorship or Role Models$bk$, 'social', $bk$Do you know someone with a similar background who is working successfully in the UK? (Yes/No)$bk$, $bk$“Tell me about a person who inspired your job path.”$bk$, 'likert_1_5', false),
  ('emp_s_trust_in_job_seeking_ins', $bk$Trust in Job-Seeking Institutions$bk$, 'social', $bk$I trust my job support agency to act in my best interest. (Likert scale)$bk$, $bk$“Have you ever felt discouraged by a job service provider?”$bk$, 'likert_1_5', false),
  ('emp_e_legal_right_to_work', $bk$Legal Right to Work$bk$, 'environmental', $bk$$bk$, $bk$$bk$, 'likert_1_5', false),
  ('emp_e_local_job_market_access', $bk$Local Job Market Access$bk$, 'environmental', $bk$Are there job opportunities or job fairs you can physically get to? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('emp_e_credential_recognition', $bk$Credential Recognition$bk$, 'environmental', $bk$Do you feel your previous experience is recognised in the UK? (Likert)$bk$, $bk$“Tell us if you’ve had to repeat any past learning or qualifications.”$bk$, 'likert_1_5', false),
  ('emp_e_workplace_norms_inclusio', $bk$Workplace Norms & Inclusion$bk$, 'environmental', $bk$I feel respected and included at work even if I make mistakes. (Agree/disagree)$bk$, $bk$“Describe how your first days at a new job felt.”$bk$, 'likert_1_5', false),
  ('house_p_knowledge_of_housing_rig', $bk$Knowledge of Housing Rights$bk$, 'personal', $bk$Do you feel confident reading and understanding a UK tenancy agreement?$bk$, $bk$“What would you do if your landlord raised the rent suddenly?”$bk$, 'likert_1_5', false),
  ('house_p_budgeting_and_financial_', $bk$Budgeting and Financial Planning$bk$, 'personal', $bk$Can you estimate how much of your monthly income goes to housing?$bk$, $bk$“Tell us about how you manage your rent and household bills.”$bk$, 'likert_1_5', false),
  ('house_p_confidence_navigating_sy', $bk$Confidence Navigating Systems$bk$, 'personal', $bk$Have you contacted a housing service by yourself in the past 6 months? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('house_s_access_to_housing_advice', $bk$Access to Housing Advice and Advocacy$bk$, 'social', $bk$Do you know where to go if you are facing housing difficulties?$bk$, $bk$“Tell us about a time you received housing advice.”$bk$, 'likert_1_5', false),
  ('house_s_supportive_community_net', $bk$Supportive Community Networks$bk$, 'social', $bk$If you lost your housing tomorrow, would someone help you temporarily? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('house_e_availability_of_affordab', $bk$Availability of Affordable Housing$bk$, 'environmental', $bk$Is there suitable and affordable housing available in your area? (Likert scale)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('house_e_discrimination_or_gateke', $bk$Discrimination or Gatekeeping Barriers$bk$, 'environmental', $bk$Have you ever been refused housing because of your nationality or status? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('house_e_housing_stability_securi', $bk$Housing Stability & Security$bk$, 'environmental', $bk$Do you feel your current home is secure for the next 12 months? (Likert scale)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('house_e_housing_suitability', $bk$Housing Suitability$bk$, 'environmental', $bk$Is your current housing comfortable and appropriate for your household? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('edu_p_language_proficiency', $bk$Language Proficiency$bk$, 'personal', $bk$How confident do you feel understanding lessons taught in English? (Likert)$bk$, $bk$“Describe a time you participated in an English-language class.”$bk$, 'likert_1_5', false),
  ('edu_p_learning_motivation_and_', $bk$Learning Motivation and Self-Discipline$bk$, 'personal', $bk$How motivated are you to complete your current learning programme?$bk$, $bk$“What keeps you going when a course becomes difficult?”$bk$, 'likert_1_5', false),
  ('edu_p_educational_background_b', $bk$Educational Background Bridging$bk$, 'personal', $bk$Have you had your previous education assessed or translated? (Yes/No)$bk$, $bk$“Tell us how your prior education is helping/hindering you now.”$bk$, 'likert_1_5', false),
  ('edu_p_digital_literacy', $bk$Digital Literacy$bk$, 'personal', $bk$Can you log into and complete tasks on an online learning portal? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('edu_s_family_and_caregiving_su', $bk$Family and Caregiving Support$bk$, 'social', $bk$Do your caregiving responsibilities interfere with your learning? (Yes/No)$bk$, $bk$“How does your family support or hinder your studies?”$bk$, 'likert_1_5', false),
  ('edu_s_peer_learning_support', $bk$Peer Learning Support$bk$, 'social', $bk$Do you have someone to help you understand or revise class material? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('edu_s_mentorship_or_tutor_enco', $bk$Mentorship or Tutor Encouragement$bk$, 'social', $bk$Do you feel your teacher understands your learning needs? (Likert)$bk$, $bk$“Describe how your teacher helps you learn.”$bk$, 'likert_1_5', false),
  ('edu_e_accessible_learning_loca', $bk$Accessible Learning Locations & Timings$bk$, 'environmental', $bk$Can you reach your learning centre easily within 45 mins? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('edu_e_course_recognition_and_p', $bk$Course Recognition and Progression Pathways$bk$, 'environmental', $bk$Does your current course lead to a recognised qualification or next step? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('edu_e_affordability_of_learnin', $bk$Affordability of Learning$bk$, 'environmental', $bk$Did cost prevent you from applying for a course in the last year? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('edu_e_supportive_learning_envi', $bk$Supportive Learning Environments$bk$, 'environmental', $bk$Do you feel safe and respected in your class environment? (Likert)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('health_p_physical_health_literacy', $bk$Physical Health Literacy$bk$, 'personal', $bk$Do you know how to register with a GP or make a doctor’s appointment? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('health_p_mental_health_awareness', $bk$Mental Health Awareness$bk$, 'personal', $bk$Have you received any information about mental health or stress support? (Yes/No)$bk$, $bk$“How do you know when you’re feeling mentally unwell?”$bk$, 'likert_1_5', false),
  ('health_p_health_seeking_confidenc', $bk$Health-Seeking Confidence$bk$, 'personal', $bk$How confident are you in describing your health problems to a doctor? (1–10 scale)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('health_p_self_care_capacity', $bk$Self-Care Capacity$bk$, 'personal', $bk$$bk$, $bk$“What helps you feel physically and mentally healthy every week?”$bk$, 'likert_1_5', false),
  ('health_s_trust_in_healthcare_prov', $bk$Trust in Healthcare Providers$bk$, 'social', $bk$Do you feel respected and listened to by your doctor or nurse? (Likert)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('health_s_community_norms_around_w', $bk$Community Norms around Wellbeing$bk$, 'social', $bk$$bk$, $bk$“Do people you know talk openly about stress, emotions or illness?”$bk$, 'likert_1_5', false),
  ('health_s_family_role_expectations', $bk$Family Role Expectations$bk$, 'social', $bk$$bk$, $bk$“Have family expectations made it harder to take care of your health?”$bk$, 'likert_1_5', false),
  ('health_e_accessibility_of_healthc', $bk$Accessibility of Healthcare Services$bk$, 'environmental', $bk$How easy is it to access a GP or dentist when needed? (Easy/Hard/Unsure)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('health_e_language_sensitive_servi', $bk$Language-Sensitive Services$bk$, 'environmental', $bk$$bk$, $bk$“Have you received important health information in your language?”$bk$, 'likert_1_5', false),
  ('health_e_holistic_support_availab', $bk$Holistic Support Availability$bk$, 'environmental', $bk$$bk$, $bk$“Have you been supported for multiple needs at the same time (e.g. housing and health)?”$bk$, 'likert_1_5', false),
  ('health_e_safe_private_non_judgmen', $bk$Safe, Private, Non-Judgmental Spaces$bk$, 'environmental', $bk$Do you feel emotionally safe when discussing personal issues in services? (Likert)$bk$, $bk$“Describe how you feel after a health or counselling appointment.”$bk$, 'likert_1_5', false),
  ('belong_p_self_efficacy_and_confid', $bk$Self-Efficacy and Confidence$bk$, 'personal', $bk$I feel confident speaking my mind even in unfamiliar spaces. (Likert)$bk$, $bk$“Tell me about a time you felt proud of something you did or said.”$bk$, 'likert_1_5', false),
  ('belong_p_cultural_and_personal_id', $bk$Cultural and Personal Identity Continuity$bk$, 'personal', $bk$Do you feel able to express your culture or beliefs openly? (Yes/No)$bk$, $bk$“Describe a moment you felt ‘yourself’ in the UK.”$bk$, 'likert_1_5', false),
  ('belong_p_psychological_safety', $bk$Psychological Safety$bk$, 'personal', $bk$Do you worry about being judged for how you speak, look, or act? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('belong_s_social_recognition_and_r', $bk$Social Recognition and Respect$bk$, 'social', $bk$Do you feel others see you as a person of worth? (Likert)$bk$, $bk$“Has someone ever shown you appreciation that mattered deeply?”$bk$, 'likert_1_5', false),
  ('belong_s_peer_and_role_model_repr', $bk$Peer and Role Model Representation$bk$, 'social', $bk$Can you name someone you relate to who has done well in the UK? (Yes/No)$bk$, $bk$“How do their stories influence your thinking about your future?”$bk$, 'likert_1_5', false),
  ('belong_s_relational_stability_fri', $bk$Relational Stability (Friendships, Supportive Ties)$bk$, 'social', $bk$How often do you spend time with someone you trust?$bk$, $bk$“Describe a friendship that helps you feel at home here.”$bk$, 'likert_1_5', false),
  ('belong_e_inclusive_community_spac', $bk$Inclusive Community Spaces$bk$, 'environmental', $bk$Do you feel welcome in community events or spaces like libraries or parks? (Likert)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('belong_e_positive_representation_', $bk$Positive Representation in Services and Media$bk$, 'environmental', $bk$Have you seen positive images or stories of people like you in UK media or services? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('belong_e_celebration_of_cultural_', $bk$Celebration of Cultural Diversity$bk$, 'environmental', $bk$$bk$, $bk$“Have you joined or led any cultural celebrations here?”$bk$, 'likert_1_5', false),
  ('belong_e_housing_stability_and_sa', $bk$Housing Stability and Safety$bk$, 'environmental', $bk$Have you moved more than once in the past year? (Yes/No)$bk$, $bk$“How does your housing situation affect your sense of home?”$bk$, 'likert_1_5', false),
  ('social_p_confidence_in_participat', $bk$Confidence in Participation$bk$, 'personal', $bk$I feel confident contributing to group discussions or decisions. (Likert)$bk$, $bk$“Describe a time you felt your opinion influenced a group or event.”$bk$, 'likert_1_5', false),
  ('social_p_civic_knowledge_and_awar', $bk$Civic Knowledge and Awareness$bk$, 'personal', $bk$Do you feel you understand how to get involved in local decisions or activities? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('social_p_volunteering_and_leaders', $bk$Volunteering and Leadership Orientation$bk$, 'personal', $bk$Have you volunteered or helped organise a community event in the last year? (Yes/No)$bk$, $bk$“Tell me about a time you led or supported a group activity.”$bk$, 'likert_1_5', false),
  ('social_s_access_to_social_network', $bk$Access to Social Networks$bk$, 'social', $bk$Do you know someone who helps you connect with social events or groups? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('social_s_sense_of_being_welcomed_', $bk$Sense of Being Welcomed and Included$bk$, 'social', $bk$I feel that people in my area want me to take part in activities with them. (Likert)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('social_s_mutual_exchange_and_soli', $bk$Mutual Exchange and Solidarity$bk$, 'social', $bk$$bk$, $bk$“Have you been part of a project or group where people worked together equally?”$bk$, 'likert_1_5', false),
  ('social_e_availability_of_particip', $bk$Availability of Participatory Platforms$bk$, 'environmental', $bk$Do you have opportunities in your local area to join community meetings or projects? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('social_e_supportive_institutional', $bk$Supportive Institutional Structures$bk$, 'environmental', $bk$Are community events in your area inclusive of different backgrounds and languages? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('social_e_recognition_of_informal_', $bk$Recognition of Informal Participation$bk$, 'environmental', $bk$$bk$, $bk$“Describe something informal you've done that helped your community.”$bk$, 'likert_1_5', false),
  ('social_e_physical_and_logistical_', $bk$Physical and Logistical Accessibility$bk$, 'environmental', $bk$Do practical issues like transport or language stop you from joining events? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('rights_p_legal_literacy_and_aware', $bk$Legal Literacy and Awareness$bk$, 'personal', $bk$I know where to go if I need legal advice on my immigration status. (Likert)$bk$, $bk$“Tell me about a time you had to understand your legal rights in the UK.”$bk$, 'likert_1_5', false),
  ('rights_p_confidence_navigating_sy', $bk$Confidence Navigating Systems$bk$, 'personal', $bk$I feel confident completing official forms or speaking with government staff. (Likert)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('rights_p_civic_empowerment', $bk$Civic Empowerment$bk$, 'personal', $bk$$bk$, $bk$“What does it mean to you to be part of UK society?”$bk$, 'likert_1_5', false),
  ('rights_s_trust_in_institutions', $bk$Trust in Institutions$bk$, 'social', $bk$I trust the local council or service providers to help if I need them. (Likert)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('rights_s_social_mediation_and_adv', $bk$Social Mediation and Advocacy Support$bk$, 'social', $bk$Do you know someone who can help you if you need to deal with official processes? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('rights_s_civic_role_models_and_pe', $bk$Civic Role Models and Peers$bk$, 'social', $bk$$bk$, $bk$“Do you know someone whose path to citizenship or stability inspired you?”$bk$, 'likert_1_5', false),
  ('rights_e_accessible_and_responsiv', $bk$Accessible and Responsive Legal Services$bk$, 'environmental', $bk$Do you know where to find legal or rights-based help in your local area? (Yes/No)$bk$, $bk$$bk$, 'likert_1_5', false),
  ('rights_e_stable_legal_and_bureauc', $bk$Stable Legal and Bureaucratic Environment$bk$, 'environmental', $bk$$bk$, $bk$“Have you ever been confused or set back by unclear rules or sudden changes?”$bk$, 'likert_1_5', false),
  ('rights_e_opportunities_for_politi', $bk$Opportunities for Political Participation$bk$, 'environmental', $bk$Have you had the opportunity to participate in political or civic activities? (Yes/No)$bk$, $bk$“Have you shared your opinion in a public setting in the UK?”$bk$, 'likert_1_5', false)
;

-- ── factor_domains links ──
insert into public.factor_domains (factor_id, domain_id) values
  ('emp_p_language_proficiency', 'employment'),
  ('emp_p_digital_literacy', 'employment'),
  ('emp_p_self_efficacy', 'employment'),
  ('emp_p_career_orientation', 'employment'),
  ('emp_p_work_readiness_confidenc', 'employment'),
  ('emp_s_peer_networks', 'employment'),
  ('emp_s_mentorship_or_role_model', 'employment'),
  ('emp_s_trust_in_job_seeking_ins', 'employment'),
  ('emp_e_legal_right_to_work', 'employment'),
  ('emp_e_local_job_market_access', 'employment'),
  ('emp_e_credential_recognition', 'employment'),
  ('emp_e_workplace_norms_inclusio', 'employment'),
  ('house_p_knowledge_of_housing_rig', 'housing'),
  ('house_p_budgeting_and_financial_', 'housing'),
  ('house_p_confidence_navigating_sy', 'housing'),
  ('house_s_access_to_housing_advice', 'housing'),
  ('house_s_supportive_community_net', 'housing'),
  ('house_e_availability_of_affordab', 'housing'),
  ('house_e_discrimination_or_gateke', 'housing'),
  ('house_e_housing_stability_securi', 'housing'),
  ('house_e_housing_suitability', 'housing'),
  ('edu_p_language_proficiency', 'education'),
  ('edu_p_learning_motivation_and_', 'education'),
  ('edu_p_educational_background_b', 'education'),
  ('edu_p_digital_literacy', 'education'),
  ('edu_s_family_and_caregiving_su', 'education'),
  ('edu_s_peer_learning_support', 'education'),
  ('edu_s_mentorship_or_tutor_enco', 'education'),
  ('edu_e_accessible_learning_loca', 'education'),
  ('edu_e_course_recognition_and_p', 'education'),
  ('edu_e_affordability_of_learnin', 'education'),
  ('edu_e_supportive_learning_envi', 'education'),
  ('health_p_physical_health_literacy', 'health'),
  ('health_p_mental_health_awareness', 'health'),
  ('health_p_health_seeking_confidenc', 'health'),
  ('health_p_self_care_capacity', 'health'),
  ('health_s_trust_in_healthcare_prov', 'health'),
  ('health_s_community_norms_around_w', 'health'),
  ('health_s_family_role_expectations', 'health'),
  ('health_e_accessibility_of_healthc', 'health'),
  ('health_e_language_sensitive_servi', 'health'),
  ('health_e_holistic_support_availab', 'health'),
  ('health_e_safe_private_non_judgmen', 'health'),
  ('belong_p_self_efficacy_and_confid', 'belonging'),
  ('belong_p_cultural_and_personal_id', 'belonging'),
  ('belong_p_psychological_safety', 'belonging'),
  ('belong_s_social_recognition_and_r', 'belonging'),
  ('belong_s_peer_and_role_model_repr', 'belonging'),
  ('belong_s_relational_stability_fri', 'belonging'),
  ('belong_e_inclusive_community_spac', 'belonging'),
  ('belong_e_positive_representation_', 'belonging'),
  ('belong_e_celebration_of_cultural_', 'belonging'),
  ('belong_e_housing_stability_and_sa', 'belonging'),
  ('social_p_confidence_in_participat', 'social'),
  ('social_p_civic_knowledge_and_awar', 'social'),
  ('social_p_volunteering_and_leaders', 'social'),
  ('social_s_access_to_social_network', 'social'),
  ('social_s_sense_of_being_welcomed_', 'social'),
  ('social_s_mutual_exchange_and_soli', 'social'),
  ('social_e_availability_of_particip', 'social'),
  ('social_e_supportive_institutional', 'social'),
  ('social_e_recognition_of_informal_', 'social'),
  ('social_e_physical_and_logistical_', 'social'),
  ('rights_p_legal_literacy_and_aware', 'rights'),
  ('rights_p_confidence_navigating_sy', 'rights'),
  ('rights_p_civic_empowerment', 'rights'),
  ('rights_s_trust_in_institutions', 'rights'),
  ('rights_s_social_mediation_and_adv', 'rights'),
  ('rights_s_civic_role_models_and_pe', 'rights'),
  ('rights_e_accessible_and_responsiv', 'rights'),
  ('rights_e_stable_legal_and_bureauc', 'rights'),
  ('rights_e_opportunities_for_politi', 'rights')
;

-- ── Indicators (observable bullets) ──
insert into public.indicators (id, factor_id, name, sort_order) values
  ('emp_p_language_proficiency.b0', 'emp_p_language_proficiency', $bk$Able to describe past job experience in English$bk$, 1),
  ('emp_p_language_proficiency.b1', 'emp_p_language_proficiency', $bk$Comfortable using work-related vocabulary$bk$, 2),
  ('emp_p_language_proficiency.b2', 'emp_p_language_proficiency', $bk$Can write/read basic emails or forms$bk$, 3),
  ('emp_p_digital_literacy.b0', 'emp_p_digital_literacy', $bk$Able to search and apply for jobs online$bk$, 1),
  ('emp_p_digital_literacy.b1', 'emp_p_digital_literacy', $bk$Comfortable using video interview platforms$bk$, 2),
  ('emp_p_digital_literacy.b2', 'emp_p_digital_literacy', $bk$Understands basic computer tasks (typing, editing CV)$bk$, 3),
  ('emp_p_self_efficacy.b0', 'emp_p_self_efficacy', $bk$Believes in their ability to succeed in a UK job$bk$, 1),
  ('emp_p_self_efficacy.b1', 'emp_p_self_efficacy', $bk$Willing to try unfamiliar tasks or environments$bk$, 2),
  ('emp_p_self_efficacy.b2', 'emp_p_self_efficacy', $bk$Sees challenges as manageable, not defeating$bk$, 3),
  ('emp_p_career_orientation.b0', 'emp_p_career_orientation', $bk$Has identified at least one job goal$bk$, 1),
  ('emp_p_career_orientation.b1', 'emp_p_career_orientation', $bk$Knows basic UK work norms and expectations$bk$, 2),
  ('emp_p_career_orientation.b2', 'emp_p_career_orientation', $bk$Understands long-term career pathways$bk$, 3),
  ('emp_p_work_readiness_confidenc.b0', 'emp_p_work_readiness_confidenc', $bk$Feels prepared for job interview$bk$, 1),
  ('emp_p_work_readiness_confidenc.b1', 'emp_p_work_readiness_confidenc', $bk$Has a suitable outfit, CV, and transport plan$bk$, 2),
  ('emp_s_peer_networks.b0', 'emp_s_peer_networks', $bk$Knows others working in the UK job market$bk$, 1),
  ('emp_s_peer_networks.b1', 'emp_s_peer_networks', $bk$Receives encouragement or referrals from peers$bk$, 2),
  ('emp_s_mentorship_or_role_model.b0', 'emp_s_mentorship_or_role_model', $bk$Has seen someone "like me" succeed$bk$, 1),
  ('emp_s_mentorship_or_role_model.b1', 'emp_s_mentorship_or_role_model', $bk$Receives targeted advice from more experienced peers$bk$, 2),
  ('emp_s_trust_in_job_seeking_ins.b0', 'emp_s_trust_in_job_seeking_ins', $bk$Trusts training providers or job coaches$bk$, 1),
  ('emp_s_trust_in_job_seeking_ins.b1', 'emp_s_trust_in_job_seeking_ins', $bk$Feels safe asking for help with job applications$bk$, 2),
  ('emp_e_legal_right_to_work.b0', 'emp_e_legal_right_to_work', $bk$Has settled/pre-settled/refugee status enabling work$bk$, 1),
  ('emp_e_legal_right_to_work.b1', 'emp_e_legal_right_to_work', $bk$Understands documentation requirements$bk$, 2),
  ('emp_e_local_job_market_access.b0', 'emp_e_local_job_market_access', $bk$Can access jobs within transport range$bk$, 1),
  ('emp_e_local_job_market_access.b1', 'emp_e_local_job_market_access', $bk$Local employers offer entry-level roles$bk$, 2),
  ('emp_e_credential_recognition.b0', 'emp_e_credential_recognition', $bk$UK employers accept/acknowledge prior skills$bk$, 1),
  ('emp_e_credential_recognition.b1', 'emp_e_credential_recognition', $bk$Refugee knows whether retraining is needed$bk$, 2),
  ('emp_e_workplace_norms_inclusio.b0', 'emp_e_workplace_norms_inclusio', $bk$Workplaces welcome language learners$bk$, 1),
  ('emp_e_workplace_norms_inclusio.b1', 'emp_e_workplace_norms_inclusio', $bk$Onboarding allows for cultural difference$bk$, 2),
  ('house_p_knowledge_of_housing_rig.b0', 'house_p_knowledge_of_housing_rig', $bk$Understands tenancy agreements and obligations$bk$, 1),
  ('house_p_knowledge_of_housing_rig.b1', 'house_p_knowledge_of_housing_rig', $bk$Knows what to do if they face eviction or landlord harassment$bk$, 2),
  ('house_p_budgeting_and_financial_.b0', 'house_p_budgeting_and_financial_', $bk$Knows how to allocate money for rent and bills$bk$, 1),
  ('house_p_budgeting_and_financial_.b1', 'house_p_budgeting_and_financial_', $bk$Prioritizes housing expenses in spending decisions$bk$, 2),
  ('house_p_confidence_navigating_sy.b0', 'house_p_confidence_navigating_sy', $bk$Willing and able to contact local council, housing providers$bk$, 1),
  ('house_p_confidence_navigating_sy.b1', 'house_p_confidence_navigating_sy', $bk$Can complete forms or contact helplines when needed$bk$, 2),
  ('house_s_access_to_housing_advice.b0', 'house_s_access_to_housing_advice', $bk$Knows where to go when experiencing housing problems$bk$, 1),
  ('house_s_access_to_housing_advice.b1', 'house_s_access_to_housing_advice', $bk$Has access to case workers, legal support, or advocates$bk$, 2),
  ('house_s_supportive_community_net.b0', 'house_s_supportive_community_net', $bk$Receives emotional or practical help during housing crises$bk$, 1),
  ('house_s_supportive_community_net.b1', 'house_s_supportive_community_net', $bk$Can temporarily stay with friends or community in emergencies$bk$, 2),
  ('house_e_availability_of_affordab.b0', 'house_e_availability_of_affordab', $bk$Local housing stock includes options within Housing Benefit thresholds$bk$, 1),
  ('house_e_availability_of_affordab.b1', 'house_e_availability_of_affordab', $bk$Availability of temporary and supported housing options$bk$, 2),
  ('house_e_discrimination_or_gateke.b0', 'house_e_discrimination_or_gateke', $bk$Not excluded from tenancies due to refugee or migration status$bk$, 1),
  ('house_e_discrimination_or_gateke.b1', 'house_e_discrimination_or_gateke', $bk$Landlords/agents treat refugee tenants equally$bk$, 2),
  ('house_e_housing_stability_securi.b0', 'house_e_housing_stability_securi', $bk$Length and renewability of current tenancy$bk$, 1),
  ('house_e_housing_stability_securi.b1', 'house_e_housing_stability_securi', $bk$Protections from eviction or exploitative contracts$bk$, 2),
  ('house_e_housing_suitability.b0', 'house_e_housing_suitability', $bk$House meets standards for size, heating, sanitation$bk$, 1),
  ('house_e_housing_suitability.b1', 'house_e_housing_suitability', $bk$Safe for family members, including children or elderly$bk$, 2),
  ('edu_p_language_proficiency.b0', 'edu_p_language_proficiency', $bk$Can follow lessons in English$bk$, 1),
  ('edu_p_language_proficiency.b1', 'edu_p_language_proficiency', $bk$Comfortable asking questions in class$bk$, 2),
  ('edu_p_language_proficiency.b2', 'edu_p_language_proficiency', $bk$Able to complete coursework in English$bk$, 3),
  ('edu_p_learning_motivation_and_.b0', 'edu_p_learning_motivation_and_', $bk$Values continued learning and skill development$bk$, 1),
  ('edu_p_learning_motivation_and_.b1', 'edu_p_learning_motivation_and_', $bk$Attends regularly and completes assignments$bk$, 2),
  ('edu_p_educational_background_b.b0', 'edu_p_educational_background_b', $bk$Understands differences between UK system and previous experience$bk$, 1),
  ('edu_p_educational_background_b.b1', 'edu_p_educational_background_b', $bk$Has translated, assessed or contextualised foreign qualifications$bk$, 2),
  ('edu_p_digital_literacy.b0', 'edu_p_digital_literacy', $bk$Can navigate online learning platforms$bk$, 1),
  ('edu_p_digital_literacy.b1', 'edu_p_digital_literacy', $bk$Comfortable using email, attachments, and research tools$bk$, 2),
  ('edu_s_family_and_caregiving_su.b0', 'edu_s_family_and_caregiving_su', $bk$Family members encourage learning$bk$, 1),
  ('edu_s_family_and_caregiving_su.b1', 'edu_s_family_and_caregiving_su', $bk$Care responsibilities do not obstruct participation$bk$, 2),
  ('edu_s_peer_learning_support.b0', 'edu_s_peer_learning_support', $bk$Has peers to revise or practice with$bk$, 1),
  ('edu_s_peer_learning_support.b1', 'edu_s_peer_learning_support', $bk$Receives help with tasks or assignments from classmates$bk$, 2),
  ('edu_s_mentorship_or_tutor_enco.b0', 'edu_s_mentorship_or_tutor_enco', $bk$Tutor takes time to explain and adapt$bk$, 1),
  ('edu_s_mentorship_or_tutor_enco.b1', 'edu_s_mentorship_or_tutor_enco', $bk$Tutor offers encouragement and recognition$bk$, 2),
  ('edu_e_accessible_learning_loca.b0', 'edu_e_accessible_learning_loca', $bk$Education centres are reachable by public transport$bk$, 1),
  ('edu_e_accessible_learning_loca.b1', 'edu_e_accessible_learning_loca', $bk$Class timings are suited for part-time workers or parents$bk$, 2),
  ('edu_e_course_recognition_and_p.b0', 'edu_e_course_recognition_and_p', $bk$Courses lead to recognised qualifications$bk$, 1),
  ('edu_e_course_recognition_and_p.b1', 'edu_e_course_recognition_and_p', $bk$Clear progression options (e.g. ESOL → vocational → job)$bk$, 2),
  ('edu_e_affordability_of_learnin.b0', 'edu_e_affordability_of_learnin', $bk$Courses are free or subsidised$bk$, 1),
  ('edu_e_affordability_of_learnin.b1', 'edu_e_affordability_of_learnin', $bk$No hidden costs (e.g. materials, uniforms)$bk$, 2),
  ('edu_e_supportive_learning_envi.b0', 'edu_e_supportive_learning_envi', $bk$Learner feels respected and included$bk$, 1),
  ('edu_e_supportive_learning_envi.b1', 'edu_e_supportive_learning_envi', $bk$Misunderstandings due to language/culture are addressed gently$bk$, 2),
  ('health_p_physical_health_literacy.b0', 'health_p_physical_health_literacy', $bk$Understands when to seek medical help$bk$, 1),
  ('health_p_physical_health_literacy.b1', 'health_p_physical_health_literacy', $bk$Knows how to book a GP/dentist/clinic appointment$bk$, 2),
  ('health_p_mental_health_awareness.b0', 'health_p_mental_health_awareness', $bk$Recognises signs of stress, depression, or trauma$bk$, 1),
  ('health_p_mental_health_awareness.b1', 'health_p_mental_health_awareness', $bk$Is aware of available support options$bk$, 2),
  ('health_p_health_seeking_confidenc.b0', 'health_p_health_seeking_confidenc', $bk$Feels confident approaching professionals for health support$bk$, 1),
  ('health_p_health_seeking_confidenc.b1', 'health_p_health_seeking_confidenc', $bk$Can express symptoms in English or via interpreter$bk$, 2),
  ('health_p_self_care_capacity.b0', 'health_p_self_care_capacity', $bk$Has daily routines for rest, nutrition, and exercise$bk$, 1),
  ('health_p_self_care_capacity.b1', 'health_p_self_care_capacity', $bk$Manages chronic conditions if applicable$bk$, 2),
  ('health_s_trust_in_healthcare_prov.b0', 'health_s_trust_in_healthcare_prov', $bk$Believes NHS or clinics act in one’s best interest$bk$, 1),
  ('health_s_trust_in_healthcare_prov.b1', 'health_s_trust_in_healthcare_prov', $bk$Has not had discriminatory experiences$bk$, 2),
  ('health_s_community_norms_around_w.b0', 'health_s_community_norms_around_w', $bk$Mental health openly discussed among peers$bk$, 1),
  ('health_s_community_norms_around_w.b1', 'health_s_community_norms_around_w', $bk$Encouraged to access preventive care$bk$, 2),
  ('health_s_family_role_expectations.b0', 'health_s_family_role_expectations', $bk$Family does not shame mental or sexual health issues$bk$, 1),
  ('health_s_family_role_expectations.b1', 'health_s_family_role_expectations', $bk$Health needs do not clash with family demands$bk$, 2),
  ('health_e_accessibility_of_healthc.b0', 'health_e_accessibility_of_healthc', $bk$Can get to local GP/clinic/dentist$bk$, 1),
  ('health_e_accessibility_of_healthc.b1', 'health_e_accessibility_of_healthc', $bk$Short wait time, appointment booking understood$bk$, 2),
  ('health_e_language_sensitive_servi.b0', 'health_e_language_sensitive_servi', $bk$Interpreters available at health appointments$bk$, 1),
  ('health_e_language_sensitive_servi.b1', 'health_e_language_sensitive_servi', $bk$Medical information provided in accessible formats$bk$, 2),
  ('health_e_holistic_support_availab.b0', 'health_e_holistic_support_availab', $bk$Signposted to food banks, housing, therapy where needed$bk$, 1),
  ('health_e_holistic_support_availab.b1', 'health_e_holistic_support_availab', $bk$Receives integrated responses to complex needs$bk$, 2),
  ('health_e_safe_private_non_judgmen.b0', 'health_e_safe_private_non_judgmen', $bk$Consultations are confidential and trauma-informed$bk$, 1),
  ('health_e_safe_private_non_judgmen.b1', 'health_e_safe_private_non_judgmen', $bk$Can speak without fear or shame$bk$, 2),
  ('belong_p_self_efficacy_and_confid.b0', 'belong_p_self_efficacy_and_confid', $bk$Believes one's actions can make a difference$bk$, 1),
  ('belong_p_self_efficacy_and_confid.b1', 'belong_p_self_efficacy_and_confid', $bk$Feels proud of identity and capable of expression$bk$, 2),
  ('belong_p_cultural_and_personal_id.b0', 'belong_p_cultural_and_personal_id', $bk$Can express religion, culture, or ethnicity without fear$bk$, 1),
  ('belong_p_cultural_and_personal_id.b1', 'belong_p_cultural_and_personal_id', $bk$Maintains meaningful personal history$bk$, 2),
  ('belong_p_psychological_safety.b0', 'belong_p_psychological_safety', $bk$Feels safe from judgment or ridicule$bk$, 1),
  ('belong_p_psychological_safety.b1', 'belong_p_psychological_safety', $bk$Can speak or dress as desired without fear$bk$, 2),
  ('belong_s_social_recognition_and_r.b0', 'belong_s_social_recognition_and_r', $bk$Feels seen and valued by others$bk$, 1),
  ('belong_s_social_recognition_and_r.b1', 'belong_s_social_recognition_and_r', $bk$Role in community is acknowledged$bk$, 2),
  ('belong_s_peer_and_role_model_repr.b0', 'belong_s_peer_and_role_model_repr', $bk$Sees others from similar background succeed$bk$, 1),
  ('belong_s_peer_and_role_model_repr.b1', 'belong_s_peer_and_role_model_repr', $bk$Feels hope from relatable examples$bk$, 2),
  ('belong_s_relational_stability_fri.b0', 'belong_s_relational_stability_fri', $bk$Feels emotionally connected to others$bk$, 1),
  ('belong_s_relational_stability_fri.b1', 'belong_s_relational_stability_fri', $bk$Has reliable relationships$bk$, 2),
  ('belong_e_inclusive_community_spac.b0', 'belong_e_inclusive_community_spac', $bk$Safe and welcoming public spaces exist$bk$, 1),
  ('belong_e_inclusive_community_spac.b1', 'belong_e_inclusive_community_spac', $bk$Cultural mixing or openness encouraged$bk$, 2),
  ('belong_e_positive_representation_.b0', 'belong_e_positive_representation_', $bk$Refugees represented respectfully in public discourse$bk$, 1),
  ('belong_e_positive_representation_.b1', 'belong_e_positive_representation_', $bk$Services avoid stereotypes or stigma$bk$, 2),
  ('belong_e_celebration_of_cultural_.b0', 'belong_e_celebration_of_cultural_', $bk$Local festivals, food, and dress are celebrated inclusively$bk$, 1),
  ('belong_e_celebration_of_cultural_.b1', 'belong_e_celebration_of_cultural_', $bk$Refugee or ethnic groups participate in shaping cultural events$bk$, 2),
  ('belong_e_housing_stability_and_sa.b0', 'belong_e_housing_stability_and_sa', $bk$Can stay long-term in clean, stable accommodation$bk$, 1),
  ('belong_e_housing_stability_and_sa.b1', 'belong_e_housing_stability_and_sa', $bk$Not constantly ‘starting over’$bk$, 2),
  ('social_p_confidence_in_participat.b0', 'social_p_confidence_in_participat', $bk$Feels comfortable expressing views publicly$bk$, 1),
  ('social_p_confidence_in_participat.b1', 'social_p_confidence_in_participat', $bk$Feels their voice matters in community matters$bk$, 2),
  ('social_p_civic_knowledge_and_awar.b0', 'social_p_civic_knowledge_and_awar', $bk$Understands how local government or community initiatives work$bk$, 1),
  ('social_p_civic_knowledge_and_awar.b1', 'social_p_civic_knowledge_and_awar', $bk$Knows how to join or form a group$bk$, 2),
  ('social_p_volunteering_and_leaders.b0', 'social_p_volunteering_and_leaders', $bk$Has desire to contribute time or ideas$bk$, 1),
  ('social_p_volunteering_and_leaders.b1', 'social_p_volunteering_and_leaders', $bk$Takes initiative in social settings$bk$, 2),
  ('social_s_access_to_social_network.b0', 'social_s_access_to_social_network', $bk$Has invitations or awareness of events/groups$bk$, 1),
  ('social_s_access_to_social_network.b1', 'social_s_access_to_social_network', $bk$Knows someone who can bring them into community spaces$bk$, 2),
  ('social_s_sense_of_being_welcomed_.b0', 'social_s_sense_of_being_welcomed_', $bk$Not made to feel like an outsider$bk$, 1),
  ('social_s_sense_of_being_welcomed_.b1', 'social_s_sense_of_being_welcomed_', $bk$Encouraged to contribute by others$bk$, 2),
  ('social_s_mutual_exchange_and_soli.b0', 'social_s_mutual_exchange_and_soli', $bk$Feels others value their contributions$bk$, 1),
  ('social_s_mutual_exchange_and_soli.b1', 'social_s_mutual_exchange_and_soli', $bk$Experiences shared efforts or collective pride$bk$, 2),
  ('social_e_availability_of_particip.b0', 'social_e_availability_of_particip', $bk$Local community meetings, boards, or forums exist$bk$, 1),
  ('social_e_availability_of_particip.b1', 'social_e_availability_of_particip', $bk$Volunteering, arts, and youth programmes are offered$bk$, 2),
  ('social_e_supportive_institutional.b0', 'social_e_supportive_institutional', $bk$Community centres, schools, and charities actively include refugee voices$bk$, 1),
  ('social_e_supportive_institutional.b1', 'social_e_supportive_institutional', $bk$Facilitators are trained to handle language and trauma sensitivity$bk$, 2),
  ('social_e_recognition_of_informal_.b0', 'social_e_recognition_of_informal_', $bk$Helping neighbours, informal group chats, or cultural mediation seen as valid forms of participation$bk$, 1),
  ('social_e_physical_and_logistical_.b0', 'social_e_physical_and_logistical_', $bk$Can get to events safely and affordably$bk$, 1),
  ('social_e_physical_and_logistical_.b1', 'social_e_physical_and_logistical_', $bk$Childcare and translation are available if needed$bk$, 2),
  ('rights_p_legal_literacy_and_aware.b0', 'rights_p_legal_literacy_and_aware', $bk$Understands basic legal rights (e.g., work, housing, health, family)$bk$, 1),
  ('rights_p_legal_literacy_and_aware.b1', 'rights_p_legal_literacy_and_aware', $bk$Aware of routes to settlement or citizenship$bk$, 2),
  ('rights_p_confidence_navigating_sy.b0', 'rights_p_confidence_navigating_sy', $bk$Not intimidated by forms, officials, or processes$bk$, 1),
  ('rights_p_confidence_navigating_sy.b1', 'rights_p_confidence_navigating_sy', $bk$Feels able to assert one’s rights without fear$bk$, 2),
  ('rights_p_civic_empowerment.b0', 'rights_p_civic_empowerment', $bk$Understands role as a participant in society$bk$, 1),
  ('rights_p_civic_empowerment.b1', 'rights_p_civic_empowerment', $bk$Sees oneself as a right-bearing individual$bk$, 2),
  ('rights_s_trust_in_institutions.b0', 'rights_s_trust_in_institutions', $bk$Believes public services will treat them fairly$bk$, 1),
  ('rights_s_trust_in_institutions.b1', 'rights_s_trust_in_institutions', $bk$Past experiences did not undermine this trust$bk$, 2),
  ('rights_s_social_mediation_and_adv.b0', 'rights_s_social_mediation_and_adv', $bk$Has access to a trusted advocate or case worker$bk$, 1),
  ('rights_s_social_mediation_and_adv.b1', 'rights_s_social_mediation_and_adv', $bk$Can receive support when asserting rights$bk$, 2),
  ('rights_s_civic_role_models_and_pe.b0', 'rights_s_civic_role_models_and_pe', $bk$Knows others who have successfully navigated systems$bk$, 1),
  ('rights_s_civic_role_models_and_pe.b1', 'rights_s_civic_role_models_and_pe', $bk$Inspired to pursue similar routes (e.g., naturalisation)$bk$, 2),
  ('rights_e_accessible_and_responsiv.b0', 'rights_e_accessible_and_responsiv', $bk$Immigration, housing, family support services exist and are reachable$bk$, 1),
  ('rights_e_accessible_and_responsiv.b1', 'rights_e_accessible_and_responsiv', $bk$Language support is available$bk$, 2),
  ('rights_e_stable_legal_and_bureauc.b0', 'rights_e_stable_legal_and_bureauc', $bk$Policies don’t shift unpredictably$bk$, 1),
  ('rights_e_stable_legal_and_bureauc.b1', 'rights_e_stable_legal_and_bureauc', $bk$Application processes are clearly explained$bk$, 2),
  ('rights_e_opportunities_for_politi.b0', 'rights_e_opportunities_for_politi', $bk$Invited to share feedback in consultations, forums$bk$, 1),
  ('rights_e_opportunities_for_politi.b1', 'rights_e_opportunities_for_politi', $bk$Can join petitions, campaigns, or community boards$bk$, 2)
;

-- total indicators seeded: 148