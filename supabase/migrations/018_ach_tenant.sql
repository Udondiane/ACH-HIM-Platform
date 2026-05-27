alter table public.candidates
  add column if not exists is_ach_tenant boolean not null default false;

create index if not exists idx_candidates_ach_tenant
  on public.candidates(is_ach_tenant)
  where is_ach_tenant = true;
