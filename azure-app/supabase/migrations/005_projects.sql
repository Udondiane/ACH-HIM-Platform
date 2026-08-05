-- ============================================================
-- 005 · projects (project-level HIM unit)
-- ============================================================
-- Per spec §2.1: a project is a discrete intervention. HIM scoring
-- operates at this unit. Each project has:
--   - a type (depth / hybrid / breadth) → drives α/β weights
--   - selected Core and Optional capabilities (spec §8.1)
-- ============================================================

do $$ begin
  create type public.project_type as enum (
    'depth', 'hybrid', 'breadth'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.weight_ratio as enum (
    -- depth-favoured (spec §3.3)
    'd1_1', 'd2_1', 'd3_1', 'd4_1', 'd5_1',
    -- breadth-favoured (spec §3.4)
    'b2_1', 'b3_1', 'b4_1'
    -- (d1_1 == b1_1 → equal; we keep one canonical form)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.hybrid_option as enum (
    'A',  -- fixed equal weights (v1 default)
    'B'   -- interpolated weights (v2)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.capability_role as enum (
    'core', 'optional'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  project_ref     text unique not null,         -- e.g. "PRJ-2026-B2E-001"
  name            text not null,
  description     text,
  cohort_id       uuid references public.cohorts(id) on delete set null,
  -- classification
  type            public.project_type not null,
  weight_ratio    public.weight_ratio not null default 'd3_1',  -- α=0.75, β=0.25 default
  hybrid_option   public.hybrid_option default 'A',
  -- v2: stability blending parameter; defaults to 0 in v1
  stability_blend numeric(3,2) not null default 0.00 check (stability_blend between 0 and 1),
  -- v2: optional-score scheme
  optional_scheme text not null default 'simple_average'
    check (optional_scheme in ('simple_average', 'coverage_weighted')),
  -- classification questionnaire result (v2)
  classification_q1 text check (classification_q1 in ('A','B','C')),
  classification_q2 text check (classification_q2 in ('A','B','C')),
  classification_q3 text check (classification_q3 in ('A','B','C')),
  classification_q4 text check (classification_q4 in ('A','B','C')),
  classification_total integer check (classification_total between 0 and 8),
  -- lifecycle
  start_date      date,
  end_date        date,
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_projects_cohort on public.projects(cohort_id);
create index if not exists idx_projects_type on public.projects(type);

-- Which capabilities (domains) the project marks as Core / Optional.
-- A domain not present in this table is excluded from scoring entirely
-- per spec §8.1.
create table if not exists public.project_capabilities (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  domain        text not null,                  -- references domains.id (see migration 006)
  role          public.capability_role not null,
  -- Within a selected capability, the evaluator further selects which specific
  -- factors to assess (spec §8.1). Stored as a string[] of factor ids; empty
  -- array = use all factors for that domain.
  selected_factors text[] not null default '{}',
  created_at    timestamptz not null default now(),
  unique (project_id, domain)
);

create index if not exists idx_pc_project on public.project_capabilities(project_id);

-- RLS
alter table public.projects enable row level security;
alter table public.project_capabilities enable row level security;

drop policy if exists "projects_ach_all" on public.projects;
create policy "projects_ach_all" on public.projects
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "pc_ach_all" on public.project_capabilities;
create policy "pc_ach_all" on public.project_capabilities
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at before update on public.projects
  for each row execute function public.touch_updated_at();
