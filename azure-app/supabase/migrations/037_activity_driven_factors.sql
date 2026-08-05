-- ============================================================
-- 037 · Programme activity-driven factor selection
-- ============================================================
-- Programme Managers tick which activities their programme delivers.
-- The platform then derives which HIM factors to measure from those
-- activities — no manual factor selection needed.
--
-- Two tables:
--   activity_factors    — methodology mapping (which factors each
--                         activity activates). Curated; rarely changes.
--   project_activities  — per-project record of which activities are
--                         ticked.
--
-- Activity identifiers live as text values rather than an enum so we
-- can evolve the list without destructive migrations. The canonical
-- set is defined in lib/activities/definitions.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_factors (
  activity   text NOT NULL,
  factor_id  text NOT NULL REFERENCES public.factors(id) ON DELETE CASCADE,
  PRIMARY KEY (activity, factor_id)
);

CREATE TABLE IF NOT EXISTS public.project_activities (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity   text NOT NULL,
  PRIMARY KEY (project_id, activity)
);

CREATE INDEX IF NOT EXISTS idx_project_activities_project ON public.project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_factors_activity ON public.activity_factors(activity);

-- Methodology mapping. One row per (activity, factor) edge.
-- Adjust this set as ACH's methodology authors refine the model.
INSERT INTO public.activity_factors (activity, factor_id) VALUES
  -- English language training
  ('english_training',           'emp_p_lang'),
  ('english_training',           'edu_p_lang'),

  -- Digital skills training
  ('digital_skills_training',    'emp_p_dig'),
  ('digital_skills_training',    'edu_p_dig'),

  -- Employability coaching / interview prep
  ('employability_coaching',     'emp_p_ready'),
  ('employability_coaching',     'emp_p_self'),

  -- Career goal-setting / IAG
  ('career_goal_setting',        'emp_p_orient'),
  ('career_goal_setting',        'edu_p_back'),

  -- Direct job placement with corporate partners
  ('direct_job_placement',       'emp_p_ready'),
  ('direct_job_placement',       'emp_e_norm'),

  -- In-work support / retention check-ins
  ('in_work_support',            'emp_s_peer'),
  ('in_work_support',            'emp_e_norm'),

  -- Mentorship / peer connection
  ('mentorship_peer_connection', 'emp_s_mentor'),
  ('mentorship_peer_connection', 'emp_s_peer'),
  ('mentorship_peer_connection', 'belong_s_peer'),

  -- Wraparound / wellbeing support
  ('wraparound_support',         'belong_p_safe'),
  ('wraparound_support',         'belong_p_self'),
  ('wraparound_support',         'belong_s_rel'),
  ('wraparound_support',         'health_p_mental'),
  ('wraparound_support',         'health_p_self'),

  -- Housing support
  ('housing_support',            'house_p_rights'),
  ('housing_support',            'house_p_budget'),
  ('housing_support',            'house_p_conf'),
  ('housing_support',            'house_e_stab'),

  -- Legal advice / rights education
  ('legal_advice',               'rights_p_lit'),
  ('legal_advice',               'rights_p_conf'),
  ('legal_advice',               'rights_s_med'),

  -- Community / civic participation
  ('community_participation',    'soc_p_civic'),
  ('community_participation',    'soc_p_conf'),
  ('community_participation',    'soc_s_net'),
  ('community_participation',    'soc_s_wel'),

  -- Employer engagement (changing recruitment practices)
  ('employer_engagement',        'emp_e_norm'),
  ('employer_engagement',        'emp_e_cred')
ON CONFLICT (activity, factor_id) DO NOTHING;
