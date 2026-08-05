-- ============================================================
-- 001 · auth, role enum, user_roles table
-- ============================================================
-- Establishes the three-role model used across the platform:
--   ach_staff  → full operational access (the ACH back office)
--   partner    → scoped to their own partner_id (partner dashboard)
--   candidate  → scoped to their own candidate_id (candidate surface)
--
-- All later migrations reference `user_roles` for RLS gating.
-- ============================================================

-- enum for role
do $$ begin
  create type public.user_role as enum ('ach_staff', 'partner', 'candidate');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.user_roles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         public.user_role not null,
  -- partner / candidate FK columns are added in later migrations once those
  -- tables exist; for now they are nullable text placeholders so this
  -- migration is self-contained.
  partner_id   uuid,
  candidate_id uuid,
  created_at   timestamptz not null default now()
);

create index if not exists idx_user_roles_role on public.user_roles(role);
create index if not exists idx_user_roles_partner   on public.user_roles(partner_id);
create index if not exists idx_user_roles_candidate on public.user_roles(candidate_id);

alter table public.user_roles enable row level security;

-- Read: a user can always read their own role row.
drop policy if exists "self_read_role" on public.user_roles;
create policy "self_read_role" on public.user_roles
  for select using (auth.uid() = user_id);

-- Read: ACH staff can read every role row.
drop policy if exists "ach_staff_read_all_roles" on public.user_roles;
create policy "ach_staff_read_all_roles" on public.user_roles
  for select using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'ach_staff'
    )
  );

-- Write: only service-role / ACH staff path. Service role bypasses RLS.
-- We additionally let ACH staff manage role rows (e.g. promoting a user) via
-- a permissive insert/update/delete policy.
drop policy if exists "ach_staff_write_roles" on public.user_roles;
create policy "ach_staff_write_roles" on public.user_roles
  for all using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'ach_staff'
    )
  ) with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'ach_staff'
    )
  );

-- ------------------------------------------------------------
-- Helper SQL functions used by later migrations' RLS policies
-- ------------------------------------------------------------

create or replace function public.is_ach_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'ach_staff'
  );
$$;

create or replace function public.current_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select partner_id from public.user_roles where user_id = auth.uid();
$$;

create or replace function public.current_candidate_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select candidate_id from public.user_roles where user_id = auth.uid();
$$;

grant execute on function public.is_ach_staff()         to authenticated;
grant execute on function public.current_partner_id()   to authenticated;
grant execute on function public.current_candidate_id() to authenticated;
