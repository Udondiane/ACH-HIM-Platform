-- ============================================================
-- 061 · ACH team-role model
-- ============================================================
-- Adds an application-level role field (`team_role`) to `user_roles`
-- that distinguishes ACH staff by their functional role in the
-- organisation. RLS continues to be gated by the top-level `role`
-- enum (ach_staff / partner / candidate); `team_role` controls which
-- UI surfaces the user sees and which server actions they can invoke.
--
-- The eight roles reflect ACH's actual organisational structure:
--   1. employability_coach  · own caseload write, programme-wide read
--   2. trainer              · all training programmes across ACH
--   3. support_worker       · own caseload write, programme-wide read
--   4. programme_lead       · full programme oversight + partner mgmt
--   5. bid_business_dev     · impact library, pricing (read), bids
--   6. board                · read-only dashboards, no PII drill-through
--   7. finance_contracts    · pricing, dev fund, TOMs, revenue context
--   8. ict_admin            · user management, audit log, backups
--
-- Backward-compatibility rule: a NULL `team_role` on an ach_staff row
-- is treated by the application layer as full-access. Existing pilot
-- users therefore see no change until an ICT admin assigns them a
-- team role via /admin/users.
-- ============================================================

do $$ begin
  create type public.ach_team_role as enum (
    'employability_coach',
    'trainer',
    'support_worker',
    'programme_lead',
    'bid_business_dev',
    'board',
    'finance_contracts',
    'ict_admin'
  );
exception when duplicate_object then null; end $$;

alter table public.user_roles
  add column if not exists team_role public.ach_team_role;

create index if not exists idx_user_roles_team_role
  on public.user_roles(team_role);

-- Helper: does the current user hold this team role?
create or replace function public.has_team_role(check_role public.ach_team_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id   = auth.uid()
      and role      = 'ach_staff'
      and team_role = check_role
  );
$$;

-- Helper: is the current user an ICT admin?
create or replace function public.is_ict_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_team_role('ict_admin');
$$;

grant execute on function public.has_team_role(public.ach_team_role) to authenticated;
grant execute on function public.is_ict_admin()                       to authenticated;

-- ------------------------------------------------------------
-- RLS · only ICT admins can write to user_roles (in addition to
-- the existing ach_staff_write_roles policy, which we retain as a
-- backstop for the pilot period until every user has a team_role).
--
-- We do NOT drop the pre-existing policy — that would break the
-- pilot's synthetic-user flow. Instead this policy sits alongside
-- and, in practice, the application layer routes all writes through
-- the ICT admin surface.
-- ------------------------------------------------------------

drop policy if exists "ict_admin_write_roles" on public.user_roles;
create policy "ict_admin_write_roles" on public.user_roles
  for all using (public.is_ict_admin())
  with check (public.is_ict_admin());
