-- ============================================================
-- 002 · partners — three-type taxonomy per memo override
-- ============================================================
-- Per memo §4 / brief override: three partner types replace the
-- spec's Placement/Training/Cohort-Contributor classification.
--   capability_investor → buys measured social impact, no hiring
--   workforce_partner   → sponsors + retains hiring rights
--   training_partner    → buys cultural-awareness / inclusive-recruitment
--                          training for their own staff (separate product)
-- ============================================================

do $$ begin
  create type public.partner_type as enum (
    'capability_investor',
    'workforce_partner',
    'training_partner'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.partner_status as enum (
    'prospect', 'active', 'paused', 'closed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.partners (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            public.partner_type not null,
  status          public.partner_status not null default 'prospect',
  sector          text,
  region          text,
  hq_country      text default 'United Kingdom',
  website         text,
  employee_count  integer,
  notes           text,
  -- consent for public listing on the Verified Partner page
  consent_public_listing boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_partners_type on public.partners(type);
create index if not exists idx_partners_status on public.partners(status);

create table if not exists public.partner_contacts (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  name         text not null,
  role         text,
  email        text,
  phone        text,
  is_primary   boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_partner_contacts_partner on public.partner_contacts(partner_id);

-- Backfill the FK from user_roles.partner_id → partners.id
alter table public.user_roles
  drop constraint if exists fk_user_roles_partner;
alter table public.user_roles
  add constraint fk_user_roles_partner
  foreign key (partner_id) references public.partners(id) on delete set null;

-- RLS
alter table public.partners enable row level security;
alter table public.partner_contacts enable row level security;

-- ACH staff: full read/write
drop policy if exists "partners_ach_all" on public.partners;
create policy "partners_ach_all" on public.partners
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "partner_contacts_ach_all" on public.partner_contacts;
create policy "partner_contacts_ach_all" on public.partner_contacts
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

-- Partners: read their own row
drop policy if exists "partners_self_read" on public.partners;
create policy "partners_self_read" on public.partners
  for select using (id = public.current_partner_id());

drop policy if exists "partner_contacts_self_read" on public.partner_contacts;
create policy "partner_contacts_self_read" on public.partner_contacts
  for select using (partner_id = public.current_partner_id());

-- Public: read partners who consent to public listing (for the Verified Partner page)
drop policy if exists "partners_public_listed" on public.partners;
create policy "partners_public_listed" on public.partners
  for select to anon using (consent_public_listing = true and status = 'active');

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_partners_updated_at on public.partners;
create trigger trg_partners_updated_at before update on public.partners
  for each row execute function public.touch_updated_at();
