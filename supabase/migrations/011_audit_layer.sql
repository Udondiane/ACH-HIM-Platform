-- ============================================================
-- 011 · audit layer (Training Partner verification)
-- ============================================================
-- Spec §10.2: practice change entries, policy/handbook updates, and
-- internal initiatives may optionally be verified through ACH audit.
-- Verification outcome: confirmed / partially confirmed / not substantiated.
-- Free-text narrative quotes are NOT subject to verification.
-- Spec §10.4: audit independence — described as "ACH-audited", not
-- "independently audited."
-- ============================================================

do $$ begin
  create type public.audit_entry_kind as enum (
    'practice_change',
    'policy_update',
    'internal_initiative',
    'narrative_quote'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum (
    'self_reported',
    'confirmed',
    'partially_confirmed',
    'not_substantiated',
    'pending'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.audit_entries (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners(id) on delete cascade,
  kind          public.audit_entry_kind not null,
  title         text not null,
  description   text not null,
  evidence_url  text,
  reported_on   date not null default current_date,
  verification  public.verification_status not null default 'self_reported',
  audit_notes   text,
  audited_by    uuid references auth.users(id),
  audited_on    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_audit_partner on public.audit_entries(partner_id);
create index if not exists idx_audit_kind on public.audit_entries(kind);
create index if not exists idx_audit_verification on public.audit_entries(verification);

-- Free-text narrative quotes are explicitly NOT subject to verification per
-- spec §10.2. A check constraint enforces this in storage.
alter table public.audit_entries
  drop constraint if exists narrative_no_audit;
alter table public.audit_entries
  add constraint narrative_no_audit
  check (
    kind <> 'narrative_quote' or verification = 'self_reported'
  );

-- RLS
alter table public.audit_entries enable row level security;

drop policy if exists "audit_ach_all" on public.audit_entries;
create policy "audit_ach_all" on public.audit_entries
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

-- Partner can read and create their own entries (audit decisions remain ACH-only)
drop policy if exists "audit_partner_read" on public.audit_entries;
create policy "audit_partner_read" on public.audit_entries
  for select using (partner_id = public.current_partner_id());

drop policy if exists "audit_partner_insert" on public.audit_entries;
create policy "audit_partner_insert" on public.audit_entries
  for insert with check (
    partner_id = public.current_partner_id()
    and verification = 'self_reported'    -- partners cannot set verification status
  );

drop trigger if exists trg_audit_updated_at on public.audit_entries;
create trigger trg_audit_updated_at before update on public.audit_entries
  for each row execute function public.touch_updated_at();
