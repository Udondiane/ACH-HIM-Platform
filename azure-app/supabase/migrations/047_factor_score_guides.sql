-- ============================================================
-- 047 · Explicit 1–5 score anchors on factors
-- ============================================================
-- observable_bullets tell an assessor WHAT TO LISTEN FOR.
-- score_guides tell an assessor WHAT SCORE TO ASSIGN for what they hear.
-- Each guide is a jsonb object keyed by "1" through "5" with a short
-- description. Rendered inline on the assessment runner so the assessor
-- has consistent anchors across candidates and across assessors.
--
-- This migration seeds guides for eight demo-relevant factors
-- (Employment × 4, Education × 4). The remaining factors can be
-- back-filled by ACH's methodology lead — the primitive is here.
-- ============================================================

alter table public.factors
  add column if not exists score_guides jsonb;

comment on column public.factors.score_guides is
  'Optional 1–5 scoring anchors per factor. jsonb object with keys "1".."5" and short descriptions. Rendered on the assessment runner.';

-- ── EMPLOYMENT ────────────────────────────────────────────────

update public.factors set score_guides = $g${
  "1": "Cannot describe past work experience in English. Relies on translation for any work conversation.",
  "2": "Can describe past work experience in simple sentences with prompting. Needs help with vocabulary.",
  "3": "Can describe past work experience clearly. Comfortable with everyday work vocabulary.",
  "4": "Can hold a work conversation confidently. Handles common interview questions.",
  "5": "Fluent in work contexts. Could describe complex tasks in English."
}$g$::jsonb where id = 'emp_p_lang';

update public.factors set score_guides = $g${
  "1": "Does not use the internet for job search. Needs step-by-step help to open a browser.",
  "2": "Can search a job site with support. Cannot yet upload a CV or apply online.",
  "3": "Independently searches, filters, and applies for jobs online. Can upload a CV.",
  "4": "Uses multiple platforms (Indeed, LinkedIn). Confident with video interview tools.",
  "5": "Advanced — manages professional online presence, optimises CVs for ATS, mentors peers."
}$g$::jsonb where id = 'emp_p_dig';

update public.factors set score_guides = $g${
  "1": "Believes UK work is out of reach. Afraid of new tasks or challenges.",
  "2": "Willing to try but doubts own capability. Needs frequent encouragement.",
  "3": "Believes they can handle typical UK work tasks. Willing to attempt unfamiliar work.",
  "4": "Confident in own capability. Sees challenges as manageable.",
  "5": "Strong self-belief. Actively seeks challenges. Supports others' confidence."
}$g$::jsonb where id = 'emp_p_self';

update public.factors set score_guides = $g${
  "1": "No specific career goal. Cannot describe what kind of work they want.",
  "2": "Vague sector interest. No clear pathway or steps identified.",
  "3": "Named a specific role or sector. Understands the immediate next step.",
  "4": "Named a role plus 2-3 year pathway. Understands UK progression norms in that sector.",
  "5": "Clear career plan with milestones. Actively pursuing progression opportunities."
}$g$::jsonb where id = 'emp_p_orient';

-- ── EDUCATION ─────────────────────────────────────────────────

update public.factors set score_guides = $g${
  "1": "Cannot follow lessons taught in English. Relies fully on translation.",
  "2": "Follows lessons with heavy support (extra time, simplified language, peer help).",
  "3": "Follows lessons independently. Asks questions when unclear.",
  "4": "Fully engaged in lessons. Can debate, contribute, and complete assignments in English.",
  "5": "Could teach the material in English. Supports other learners with language."
}$g$::jsonb where id = 'edu_p_lang';

update public.factors set score_guides = $g${
  "1": "Attends inconsistently. Disengaged from learning. Frequently misses assignments.",
  "2": "Attends most sessions but disengaged. Completes minimum required work.",
  "3": "Attends regularly, engaged, completes assignments on time.",
  "4": "Actively engaged. Seeks extra material. Supports classroom learning environment.",
  "5": "Highly motivated learner. Sets own learning goals. Progresses beyond course requirements."
}$g$::jsonb where id = 'edu_p_mot';

update public.factors set score_guides = $g${
  "1": "Prior learning (whether formal qualifications or experiential) has not been assessed or mapped to UK equivalents. No clarity on the path forward.",
  "2": "Aware of what needs to happen — translation of qualifications, or documentation of experience through an APEL (Accreditation of Prior Experiential Learning) route — but has not started.",
  "3": "Prior learning documented. Either qualifications translated and assessed, OR experiential learning captured in a UK-readable format (CV, portfolio, references). UK equivalent understood.",
  "4": "Recognition achieved OR bridging plan in place. Knows which UK courses, functional skills, or qualifications are needed to close any remaining gap for their goal.",
  "5": "Fully bridged into UK employment or further education. Prior education gaps are no longer a barrier — through recognition, top-up learning, or a demonstrated skills route."
}$g$::jsonb where id = 'edu_p_back';

update public.factors set score_guides = $g${
  "1": "Cannot log into an online learning portal. No prior experience with digital tools.",
  "2": "Can log in with support. Struggles with basic navigation.",
  "3": "Independently navigates online learning platforms. Can submit assignments online.",
  "4": "Confident with email, research, and productivity tools. Handles technical issues.",
  "5": "Advanced digital learner. Uses collaboration tools, research databases, video learning."
}$g$::jsonb where id = 'edu_p_dig';
