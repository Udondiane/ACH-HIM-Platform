-- ============================================================
-- 008 · placements, milestones, milestone review
-- ============================================================
-- Spec §16: milestone payments are visible commitment, not retention tax.
-- 6mo and 12mo milestones. Sub-milestone exits trigger Engagement Reports.
-- Milestone Review Process handles "exit within 30 days prior to milestone
-- due to materially adverse working conditions" cases.
-- ============================================================

do $$ begin
  create type public.placement_status as enum (
    'offered', 'started', 'active', 'completed_12mo',
    'left_pre_6mo', 'left_6_to_12mo', 'left_post_12mo'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.milestone_kind as enum (
    'placement',     -- on-hire (memo: placement fee)
    'retention_6mo',
    'retention_12mo'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.milestone_state as enum (
    'pending', 'paid', 'waived', 'partial', 'under_review', 'forfeited'
  );
exception when duplicate_object then null; end $$;

-- Salary bands per memo §5 (Volume / Standard / Premium)
do $$ begin
  create type public.salary_band as enum (
    'volume',    -- £20–23k
    'standard',  -- £23–28k
    'premium'    -- £28k+
  );
exception when duplicate_object then null; end $$;

-- ── PLACEMENTS ────────────────────────────────────────────
create table if not exists public.placements (
  id                uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references public.candidates(id) on delete restrict,
  partner_id        uuid not null references public.partners(id)   on delete restrict,
  cohort_id         uuid references public.cohorts(id) on delete set null,
  role_title        text not null,
  salary_band       public.salary_band not null,
  salary_actual     numeric(10,2),
  start_date        date not null,
  end_date          date,
  end_reason        text,
  status            public.placement_status not null default 'offered',
  -- whether the placing employer is the candidate's sponsoring partner
  sponsored_placement boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_placements_candidate on public.placements(candidate_id);
create index if not exists idx_placements_partner   on public.placements(partner_id);
create index if not exists idx_placements_status    on public.placements(status);

-- ── MILESTONES ────────────────────────────────────────────
create table if not exists public.placement_milestones (
  id            uuid primary key default gen_random_uuid(),
  placement_id  uuid not null references public.placements(id) on delete cascade,
  kind          public.milestone_kind not null,
  -- Memo §5 amounts by band — denormalised here for historical accuracy.
  amount        numeric(10,2) not null,
  -- when the milestone is/was due
  due_on        date not null,
  paid_on       date,
  state         public.milestone_state not null default 'pending',
  invoice_ref   text,
  notes         text,
  -- Match-funding amplification (spec §14.5): pooled funds applied to
  -- this milestone's Development Fund contribution.
  match_funding_applied numeric(10,2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (placement_id, kind)
);

create index if not exists idx_milestone_placement on public.placement_milestones(placement_id);
create index if not exists idx_milestone_state on public.placement_milestones(state);

-- ── MILESTONE REVIEW PROCESS ──────────────────────────────
-- Spec §16.3: triggered when candidate exits within 30 days prior to a
-- milestone date and ACH has grounds to conclude adverse working conditions.
do $$ begin
  create type public.review_outcome as enum (
    'pending', 'pay_full', 'pay_partial', 'waive'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.milestone_reviews (
  id              uuid primary key default gen_random_uuid(),
  milestone_id    uuid not null references public.placement_milestones(id) on delete cascade,
  opened_at       timestamptz not null default now(),
  opened_by       uuid references auth.users(id),
  grounds         text not null,
  findings        text,
  outcome         public.review_outcome not null default 'pending',
  outcome_amount  numeric(10,2),
  closed_at       timestamptz,
  closed_by       uuid references auth.users(id),
  unique (milestone_id)
);

create index if not exists idx_mr_milestone on public.milestone_reviews(milestone_id);
create index if not exists idx_mr_outcome on public.milestone_reviews(outcome);

-- RLS
alter table public.placements enable row level security;
alter table public.placement_milestones enable row level security;
alter table public.milestone_reviews enable row level security;

drop policy if exists "placements_ach_all" on public.placements;
create policy "placements_ach_all" on public.placements
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "milestones_ach_all" on public.placement_milestones;
create policy "milestones_ach_all" on public.placement_milestones
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "mr_ach_all" on public.milestone_reviews;
create policy "mr_ach_all" on public.milestone_reviews
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

-- Partner reads their own placements + milestones
drop policy if exists "placements_partner_self" on public.placements;
create policy "placements_partner_self" on public.placements
  for select using (partner_id = public.current_partner_id());

drop policy if exists "milestones_partner_self" on public.placement_milestones;
create policy "milestones_partner_self" on public.placement_milestones
  for select using (
    exists (
      select 1 from public.placements p
      where p.id = placement_id and p.partner_id = public.current_partner_id()
    )
  );

-- Candidate reads their own placements + milestones
drop policy if exists "placements_candidate_self" on public.placements;
create policy "placements_candidate_self" on public.placements
  for select using (candidate_id = public.current_candidate_id());

drop policy if exists "milestones_candidate_self" on public.placement_milestones;
create policy "milestones_candidate_self" on public.placement_milestones
  for select using (
    exists (
      select 1 from public.placements p
      where p.id = placement_id and p.candidate_id = public.current_candidate_id()
    )
  );

drop trigger if exists trg_placements_updated_at on public.placements;
create trigger trg_placements_updated_at before update on public.placements
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_milestones_updated_at on public.placement_milestones;
create trigger trg_milestones_updated_at before update on public.placement_milestones
  for each row execute function public.touch_updated_at();
