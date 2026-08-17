-- Migration 060 · Recreate universal_factor_responses view with SECURITY INVOKER
--
-- The view originally landed via migration 007 without an explicit
-- security clause, which Supabase then flags as SECURITY DEFINER by
-- default. SECURITY DEFINER means the view runs with the creator's
-- permissions rather than the querying user's — bypassing RLS.
--
-- SECURITY INVOKER makes the view respect the current user's RLS
-- policies, which is what we want for a view over sensitive
-- assessment data.

create or replace view public.universal_factor_responses
with (security_invoker = on) as
  select
    ar.id              as response_id,
    a.candidate_id,
    a.project_id,
    a.timepoint,
    ar.indicator_id,
    i.factor_id,
    f.is_universal,
    fd.domain_id,
    ar.numeric_value,
    ar.narrative
  from public.assessment_responses ar
  join public.indicators i      on i.id = ar.indicator_id
  join public.factors    f      on f.id = i.factor_id
  join public.factor_domains fd on fd.factor_id = f.id
  join public.assessments a     on a.id = ar.assessment_id
  where f.is_universal = true;
