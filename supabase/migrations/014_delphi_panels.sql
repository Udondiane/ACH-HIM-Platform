-- ============================================================
-- 014 · Delphi panels (V2 — spec §5)
-- ============================================================
-- 8–12 expert panel. Two rounds. Consensus:
--   ≥70% agreement on a single option, OR
--   interquartile range within one scale point.
-- ============================================================

do $$ begin
  create type public.delphi_role as enum (
    'practitioner', 'academic', 'funder', 'beneficiary_advocate'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.delphi_state as enum (
    'open_round_1', 'aggregating', 'open_round_2', 'consensus_reached',
    'no_consensus', 'closed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.delphi_panels (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  research_question text not null,
  -- options the panel chooses among. Use the weight_ratio enum from migration 005
  -- so the Delphi result feeds directly into project weighting.
  options         text[] not null,
  state           public.delphi_state not null default 'open_round_1',
  -- aggregated results captured at consensus
  consensus_option  text,
  consensus_method  text check (consensus_method in ('agreement_70','iqr_one_scale')),
  consensus_reached_at timestamptz,
  -- audit
  facilitator_id  uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.delphi_experts (
  id          uuid primary key default gen_random_uuid(),
  panel_id    uuid not null references public.delphi_panels(id) on delete cascade,
  name        text not null,
  email       text,
  role        public.delphi_role not null,
  notes       text,
  joined_at   timestamptz not null default now(),
  unique (panel_id, email)
);

create index if not exists idx_dexp_panel on public.delphi_experts(panel_id);

create table if not exists public.delphi_rounds (
  id          uuid primary key default gen_random_uuid(),
  panel_id    uuid not null references public.delphi_panels(id) on delete cascade,
  round_number integer not null check (round_number in (1,2)),
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz,
  -- snapshot of aggregated responses from prior round (shown anonymised in r2)
  aggregate_summary jsonb,
  unique (panel_id, round_number)
);

create table if not exists public.delphi_responses (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references public.delphi_rounds(id) on delete cascade,
  expert_id   uuid not null references public.delphi_experts(id) on delete cascade,
  selected_option text not null,
  rationale       text,
  submitted_at    timestamptz not null default now(),
  unique (round_id, expert_id)
);

create index if not exists idx_dresp_round on public.delphi_responses(round_id);

-- RLS — Delphi panels are ACH-staff-managed; experts read only the panels
-- they're invited to via separate panel-token auth. For the v1 build we
-- restrict to ACH staff and rely on the UI to send invitation emails with
-- one-time tokens (built in session 7).
alter table public.delphi_panels    enable row level security;
alter table public.delphi_experts   enable row level security;
alter table public.delphi_rounds    enable row level security;
alter table public.delphi_responses enable row level security;

drop policy if exists "dp_ach_all"    on public.delphi_panels;
create policy "dp_ach_all"    on public.delphi_panels    for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "de_ach_all"    on public.delphi_experts;
create policy "de_ach_all"    on public.delphi_experts   for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "dr_ach_all"    on public.delphi_rounds;
create policy "dr_ach_all"    on public.delphi_rounds    for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "dresp_ach_all" on public.delphi_responses;
create policy "dresp_ach_all" on public.delphi_responses for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop trigger if exists trg_dp_updated_at on public.delphi_panels;
create trigger trg_dp_updated_at before update on public.delphi_panels
  for each row execute function public.touch_updated_at();
