alter table public.cohorts
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_cohorts_project on public.cohorts(project_id);

update public.cohorts c
   set project_id = p.id
  from public.projects p
 where p.cohort_id = c.id
   and c.project_id is null;

drop index if exists public.idx_projects_cohort;

alter table public.projects
  drop column if exists cohort_id;
