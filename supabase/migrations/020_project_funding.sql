do $$ begin
  create type public.project_funding_model as enum ('funded', 'hybrid', 'commercial');
exception when duplicate_object then null; end $$;

alter table public.projects
  add column if not exists funding_model public.project_funding_model,
  add column if not exists funder_name text,
  add column if not exists capability_questionnaire jsonb;

create index if not exists idx_projects_funding_model
  on public.projects(funding_model);
