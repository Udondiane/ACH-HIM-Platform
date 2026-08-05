-- ============================================================
-- 012 · Verified Partner network (spec §15)
-- ============================================================
-- Tiers: none → verified → verified_plus
-- Auto-progression based on milestone payment history.
-- ============================================================

do $$ begin
  create type public.partner_tier as enum (
    'none', 'verified', 'verified_plus'
  );
exception when duplicate_object then null; end $$;

-- Current tier state — one row per partner.
create table if not exists public.partner_tier_status (
  partner_id        uuid primary key references public.partners(id) on delete cascade,
  current_tier      public.partner_tier not null default 'none',
  qualified_at      timestamptz,
  -- Discount on subsequent cohort engagement fees (spec §15.2). Stored as fraction.
  engagement_fee_discount numeric(4,3) not null default 0,
  priority_intake_access boolean not null default false,
  badge_consent     boolean not null default false,    -- consent to use Verified badge
  public_listing_consent boolean not null default false, -- spec §15.2
  updated_at        timestamptz not null default now()
);

-- Tier history — append-only.
create table if not exists public.partner_tier_history (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  tier         public.partner_tier not null,
  effective_at timestamptz not null default now(),
  reason       text,
  created_by   uuid references auth.users(id)
);

create index if not exists idx_tier_history_partner on public.partner_tier_history(partner_id);

-- Tier qualification rule (spec §15.1):
--   verified       = all milestones in first 12 months paid in good standing
--   verified_plus  = continued multi-year engagement (2+ years all-paid)
create or replace function public.recompute_partner_tier(p_partner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_first_placement_at date;
  v_months_since_first integer;
  v_overdue_or_forfeited integer;
  v_new_tier public.partner_tier;
begin
  -- find earliest placement
  select min(start_date) into v_first_placement_at
  from public.placements where partner_id = p_partner and status <> 'offered';

  if v_first_placement_at is null then
    insert into public.partner_tier_status(partner_id, current_tier) values (p_partner, 'none')
      on conflict (partner_id) do update set current_tier = 'none', updated_at = now();
    return;
  end if;

  v_months_since_first := extract(year from age(now(), v_first_placement_at)) * 12
                        + extract(month from age(now(), v_first_placement_at));

  -- any milestone that's overdue ≥ 30 days or forfeited disqualifies
  select count(*) into v_overdue_or_forfeited
  from public.placement_milestones m
  join public.placements p on p.id = m.placement_id
  where p.partner_id = p_partner
    and (
      m.state = 'forfeited'
      or (m.state = 'pending' and m.due_on < current_date - interval '30 days')
    );

  if v_overdue_or_forfeited > 0 then
    v_new_tier := 'none';
  elsif v_months_since_first >= 24 then
    v_new_tier := 'verified_plus';
  elsif v_months_since_first >= 12 then
    v_new_tier := 'verified';
  else
    v_new_tier := 'none';
  end if;

  -- write tier status
  insert into public.partner_tier_status (partner_id, current_tier, qualified_at)
  values (p_partner, v_new_tier, case when v_new_tier <> 'none' then now() else null end)
  on conflict (partner_id) do update
    set current_tier = excluded.current_tier,
        qualified_at = case when excluded.current_tier <> 'none'
                            and partner_tier_status.current_tier <> excluded.current_tier
                            then now() else partner_tier_status.qualified_at end,
        engagement_fee_discount = case
          when excluded.current_tier = 'verified_plus' then 0.15
          when excluded.current_tier = 'verified'      then 0.075
          else 0 end,
        priority_intake_access  = (excluded.current_tier <> 'none'),
        updated_at = now();

  -- append history row only on change
  if not exists (
    select 1 from public.partner_tier_history
    where partner_id = p_partner
      and tier = v_new_tier
      and effective_at = (select max(effective_at) from public.partner_tier_history where partner_id = p_partner)
  ) then
    insert into public.partner_tier_history (partner_id, tier, reason)
    values (p_partner, v_new_tier, 'auto-recompute');
  end if;
end $$;

-- RLS
alter table public.partner_tier_status  enable row level security;
alter table public.partner_tier_history enable row level security;

drop policy if exists "tier_ach_all" on public.partner_tier_status;
create policy "tier_ach_all" on public.partner_tier_status
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "tier_partner_self" on public.partner_tier_status;
create policy "tier_partner_self" on public.partner_tier_status
  for select using (partner_id = public.current_partner_id());

-- Public can read tier rows for partners on the public listing
drop policy if exists "tier_public_listing" on public.partner_tier_status;
create policy "tier_public_listing" on public.partner_tier_status
  for select to anon using (
    public_listing_consent = true
    and current_tier in ('verified','verified_plus')
    and exists (
      select 1 from public.partners p
      where p.id = partner_id and p.consent_public_listing = true and p.status = 'active'
    )
  );

drop policy if exists "tier_hist_ach_all" on public.partner_tier_history;
create policy "tier_hist_ach_all" on public.partner_tier_history
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "tier_hist_partner" on public.partner_tier_history;
create policy "tier_hist_partner" on public.partner_tier_history
  for select using (partner_id = public.current_partner_id());
