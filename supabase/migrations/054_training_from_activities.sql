-- 054 · Auto-spawn training programmes from project activities
--
-- Context: the app has two overlapping concepts —
--   · PROGRAMME_ACTIVITIES (static, in code): "English training",
--     "Digital skills", "Employability coaching", etc.
--   · training_programmes (DB catalogue): rows created manually
--     via /training/programmes/new, then linked to a project.
--
-- ACH's real flow: they don't maintain a separate library.
-- Ticking "English language training" on project setup IS the moment
-- they decide to deliver that training. So we let the project form
-- own that decision, and the app spawns a training programme record
-- automatically — scoped to the project — for enrolment + data capture.
--
-- This migration just adds the tracking columns needed to make that
-- idempotent. The auto-spawn logic itself lives in server actions.
--
--   source_activity_id       — which PROGRAMME_ACTIVITIES entry
--                              this training was spawned from
--   spawned_from_project_id  — which project spawned it
--
-- A unique constraint on (spawned_from_project_id, source_activity_id)
-- means re-saving a project with the same tick doesn't create dupes.

alter table public.training_programmes
  add column if not exists source_activity_id      text,
  add column if not exists spawned_from_project_id uuid references public.projects(id) on delete set null;

create unique index if not exists uq_training_prog_project_activity
  on public.training_programmes(spawned_from_project_id, source_activity_id)
  where spawned_from_project_id is not null and source_activity_id is not null;

comment on column public.training_programmes.source_activity_id is
  'If auto-spawned from a ticked project activity, this is the activity id (e.g. english_training). NULL for manually-created programmes.';

comment on column public.training_programmes.spawned_from_project_id is
  'If auto-spawned, the project whose activity tick created it. NULL for manually-created programmes.';

-- ── One-time backfill ──
-- For every existing project row in project_activities whose activity is a
-- known training activity, create a training_programmes row + link it.
-- Kept in-migration so the IKEA project immediately gets its training
-- programmes without waiting for someone to re-save the form.
--
-- The activity ids listed here must stay in sync with the isTraining
-- flag in lib/activities/definitions.ts. If you add a new training
-- activity there, add it here too (or leave it — new saves will
-- auto-spawn regardless).
do $$
declare
  training_ids text[] := array[
    'english_training',
    'digital_skills_training',
    'customer_service_training',
    'health_safety_training',
    'cultural_awareness_training',
    'employability_coaching'
  ];
  r record;
  new_programme_id uuid;
  activity_label text;
begin
  for r in
    select pa.project_id, pa.activity, p.project_ref
      from public.project_activities pa
      join public.projects p on p.id = pa.project_id
     where pa.activity = any(training_ids)
       and not exists (
         select 1 from public.training_programmes tp
          where tp.spawned_from_project_id = pa.project_id
            and tp.source_activity_id = pa.activity
       )
  loop
    activity_label := replace(initcap(replace(r.activity, '_', ' ')), 'Iag', 'IAG');

    insert into public.training_programmes (name, category, source_activity_id, spawned_from_project_id, status)
    values (activity_label || ' — ' || r.project_ref, activity_label, r.activity, r.project_id, 'active')
    returning id into new_programme_id;

    insert into public.project_training_programmes (project_id, programme_id)
    values (r.project_id, new_programme_id)
    on conflict (project_id, programme_id) do nothing;
  end loop;
end $$;
