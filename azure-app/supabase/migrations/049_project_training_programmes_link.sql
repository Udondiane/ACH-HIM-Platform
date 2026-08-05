-- ============================================================
-- 049 · Project ↔ Training Programme link
-- ============================================================
-- Employability projects (Bridge to Employment IKEA Pilot etc.) bundle
-- multiple training programmes as their delivery activities: Customer
-- Service, Health & Safety, Cultural Awareness, ESOL, Digital Skills.
-- Each of those is a reusable training programme run many times.
--
-- The old model tied projects to a generic activity taxonomy (via
-- project_activities). This link table lets a project point at the
-- ACTUAL training programmes it delivers, so:
--
--   · The project detail page can list specific trainings by name
--   · The training programme detail can show which projects use it
--   · The effectiveness view can filter to "this programme, as
--     delivered on this project" — separating standalone impact from
--     project-embedded impact
--   · Reports can aggregate factor uplift across activities AND
--     linked training programmes (assessment integration is deferred;
--     the schema is here so the data starts accumulating)
-- ============================================================

create table if not exists public.project_training_programmes (
  project_id     uuid not null references public.projects(id)          on delete cascade,
  programme_id   uuid not null references public.training_programmes(id) on delete cascade,
  linked_at      timestamptz not null default now(),
  linked_by      uuid references auth.users(id),
  notes          text,
  primary key (project_id, programme_id)
);

create index if not exists idx_ptp_project    on public.project_training_programmes(project_id);
create index if not exists idx_ptp_programme  on public.project_training_programmes(programme_id);

comment on table public.project_training_programmes is
  'Many-to-many link between projects and the specific reusable training programmes they deliver. Separate from project_activities, which references generic activity types.';

alter table public.project_training_programmes enable row level security;

drop policy if exists "ptp_ach_all" on public.project_training_programmes;
create policy "ptp_ach_all" on public.project_training_programmes
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());
