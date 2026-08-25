-- ============================================================
-- azure-pre-migrate.sql · REQUIRED before the migration loop
-- ============================================================
-- The parent app's migrations declare 43 foreign-key columns as
-- `references auth.users(id)` — a Supabase-shaped identity model.
-- On vanilla Azure Postgres the `auth` schema does not exist and
-- neither does `auth.users`, so the FIRST migration that carries
-- such a reference (003_candidates.sql) would fail with
-- `schema "auth" does not exist`.
--
-- This file stands up a minimal compatibility surface so those FK
-- references attach cleanly. It does NOT replicate Supabase Auth's
-- behaviour — the real identity source on Azure is Entra ID, and
-- the Entra post-sign-in hook (lib/partner-access/post-signin.ts)
-- populates auth.users with (id = Entra oid).
--
-- Idempotent. migrate.mjs applies this BEFORE the migration loop.
-- ============================================================

create schema if not exists auth;

-- Minimum identity row. Matches the shape the parent app's FK columns
-- expect: a uuid primary key. Everything else we track lives in
-- public.user_roles or public.partner_users.
create table if not exists auth.users (
  id            uuid primary key,
  email         text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_auth_users_email
  on auth.users (lower(email));

comment on schema auth is
  'Supabase-Auth compatibility surface. Populated by the Entra post-sign-in hook. Do not treat as the source of truth for identity — Entra ID is.';

comment on table auth.users is
  'Compatibility table so `references auth.users(id)` FK columns in parent-app migrations attach cleanly on Azure. Rows are inserted by the Entra sign-in flow with id = Entra object id.';

-- ── auth.uid() / auth.role() / auth.jwt() compatibility shims ──
--
-- The parent app's SECURITY DEFINER helper functions (and stripped
-- policies, once rewritten) reference auth.uid(). Provide a stub
-- that returns the current session-variable identity if the app has
-- set one, else null. The Azure app is expected to
--   set local "request.user.id" = 'the-entra-oid';
-- at the top of each request (see lib/azure/pool.ts request-scoped
-- helper) so this resolves during the request.

create or replace function auth.uid()
returns uuid
language plpgsql
stable
security definer
set search_path = auth, pg_temp
as $$
declare
  claimed text;
begin
  begin
    claimed := current_setting('request.user.id', true);
  exception when others then
    claimed := null;
  end;
  if claimed is null or claimed = '' then
    return null;
  end if;
  begin
    return claimed::uuid;
  exception when others then
    return null;
  end;
end $$;

create or replace function auth.role()
returns text
language plpgsql
stable
security definer
set search_path = auth, pg_temp
as $$
begin
  return coalesce(current_setting('request.user.role', true), 'anon');
exception when others then
  return 'anon';
end $$;

comment on function auth.uid() is
  'Compatibility shim for Supabase auth.uid(). Reads request.user.id session variable set by the app at request start. Returns null if not set — policies using it deny access, which is the fail-safe default.';

comment on function auth.role() is
  'Compatibility shim for Supabase auth.role(). Reads request.user.role session variable. Defaults to anon if not set.';
