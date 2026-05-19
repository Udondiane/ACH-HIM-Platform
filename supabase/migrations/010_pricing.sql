-- ============================================================
-- 010 · Dynamic Pricing Tool (memo §3–5 supersedes spec §13.4)
-- ============================================================
-- Memo model:
--   Sponsorship floor:        £2,170 per candidate (£1,670 cost + £500 margin)
--   Placement fees by band:   Volume £750 / Standard £1,500 / Premium £2,500
--   Retention by band:        Volume 225+300 / Standard 250+325 / Premium 300+375
--   Retention formula:        £290 + (0.30 × replacement_cost × retention_uplift)
--   Volume discount:          5–9 hires 10% / 10+ 20% (placement fee only)
--   Sponsorship & retention:  never discounted
--   Direct hirer:             £1,000 social value + placement + retention
--
-- Cost-recovery floor: delivery cost + minimum operational margin (10%)
-- Sustainability floor: delivery cost + 30% margin
-- Traffic-light:
--   red    = below cost-recovery
--   amber  = between cost-recovery and sustainability
--   green  = at or above sustainability
-- ============================================================

do $$ begin
  create type public.quote_status as enum (
    'draft', 'sent', 'accepted', 'declined', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.quote_track as enum (
    'capability_investor',     -- sponsorship-only
    'workforce_partner',       -- sponsorship + hiring rights
    'training_partner',        -- standalone training product
    'direct_hirer'             -- non-sponsor hires from cohort
  );
exception when duplicate_object then null; end $$;

create table if not exists public.pricing_quotes (
  id             uuid primary key default gen_random_uuid(),
  quote_ref      text unique not null,           -- e.g. "QT-2026-042"
  partner_id     uuid references public.partners(id) on delete set null,
  cohort_id      uuid references public.cohorts(id) on delete set null,
  track          public.quote_track not null,
  -- candidate count under the sponsorship floor
  candidate_count integer not null default 0 check (candidate_count >= 0),
  -- expected hire mix by band (Workforce Partner only)
  expected_hires_volume   integer not null default 0,
  expected_hires_standard integer not null default 0,
  expected_hires_premium  integer not null default 0,
  -- expected retention conversion (defaults: 6mo 0.70, 12mo 0.55 of hires)
  retention_6mo_rate  numeric(4,3) not null default 0.70,
  retention_12mo_rate numeric(4,3) not null default 0.55,
  -- Tender Support Pack add-on (per memo §7)
  tender_pack_fee numeric(10,2) not null default 0,
  -- internal cost intelligence (ACH staff only)
  delivery_cost_internal numeric(10,2),
  cost_recovery_floor    numeric(10,2),
  sustainability_floor   numeric(10,2),
  -- computed quote total
  suggested_price numeric(12,2),
  margin_amount   numeric(12,2),
  margin_pct      numeric(5,2),
  traffic_light   text check (traffic_light in ('green','amber','red')),
  -- lifecycle
  status         public.quote_status not null default 'draft',
  valid_until    date,
  sent_at        timestamptz,
  accepted_at    timestamptz,
  notes          text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_quotes_partner on public.pricing_quotes(partner_id);
create index if not exists idx_quotes_status on public.pricing_quotes(status);

-- Line items: itemised breakdown the partner sees (sponsorship, placement, retention, tender pack)
create table if not exists public.pricing_quote_lines (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.pricing_quotes(id) on delete cascade,
  sort_order  integer not null default 0,
  kind        text not null check (kind in (
    'sponsorship','placement','retention_6mo','retention_12mo','tender_pack','direct_hire_sv','discount','other'
  )),
  band        public.salary_band,
  quantity    integer not null default 1,
  unit_amount numeric(10,2) not null,
  line_total  numeric(12,2) not null,
  label       text,
  notes       text
);

create index if not exists idx_ql_quote on public.pricing_quote_lines(quote_id);

-- Pricing parameters (memo §3–5) — held as one editable row.
-- ACH staff can update if pricing logic changes; full history kept via audit.
create table if not exists public.pricing_parameters (
  id                          smallint primary key default 1,
  -- floors per memo §3
  cost_per_candidate          numeric(10,2) not null default 1670,
  sustainability_margin       numeric(10,2) not null default  500,
  sponsorship_price           numeric(10,2) not null default 2170,
  -- placement fees by band (memo §5)
  placement_volume            numeric(10,2) not null default  750,
  placement_standard          numeric(10,2) not null default 1500,
  placement_premium           numeric(10,2) not null default 2500,
  -- retention by band (memo §5)
  retention_6mo_volume        numeric(10,2) not null default  225,
  retention_12mo_volume       numeric(10,2) not null default  300,
  retention_6mo_standard      numeric(10,2) not null default  250,
  retention_12mo_standard     numeric(10,2) not null default  325,
  retention_6mo_premium       numeric(10,2) not null default  300,
  retention_12mo_premium      numeric(10,2) not null default  375,
  -- volume discount thresholds (placement only)
  volume_discount_threshold_1 integer not null default 5,
  volume_discount_rate_1      numeric(4,3) not null default 0.10,
  volume_discount_threshold_2 integer not null default 10,
  volume_discount_rate_2      numeric(4,3) not null default 0.20,
  -- direct hirer
  direct_hirer_sv_fee         numeric(10,2) not null default 1000,
  -- Tender Support Pack (memo §7)
  tender_pack_min             numeric(10,2) not null default 250,
  tender_pack_max             numeric(10,2) not null default 500,
  -- cost-floor margins
  cost_recovery_margin_pct    numeric(4,3) not null default 0.10,
  sustainability_margin_pct   numeric(4,3) not null default 0.30,
  updated_at                  timestamptz not null default now(),
  -- enforce single row
  constraint pricing_singleton check (id = 1)
);

-- Seed defaults
insert into public.pricing_parameters (id) values (1) on conflict (id) do nothing;

-- RLS
alter table public.pricing_quotes      enable row level security;
alter table public.pricing_quote_lines enable row level security;
alter table public.pricing_parameters  enable row level security;

drop policy if exists "quotes_ach_all" on public.pricing_quotes;
create policy "quotes_ach_all" on public.pricing_quotes
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "ql_ach_all" on public.pricing_quote_lines;
create policy "ql_ach_all" on public.pricing_quote_lines
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

-- Partner can read quotes addressed to them (but not the internal cost columns —
-- enforced at view layer / select column restriction in lib/supabase queries).
drop policy if exists "quotes_partner_read" on public.pricing_quotes;
create policy "quotes_partner_read" on public.pricing_quotes
  for select using (partner_id = public.current_partner_id());

drop policy if exists "ql_partner_read" on public.pricing_quote_lines;
create policy "ql_partner_read" on public.pricing_quote_lines
  for select using (
    exists (
      select 1 from public.pricing_quotes q
      where q.id = quote_id and q.partner_id = public.current_partner_id()
    )
  );

drop policy if exists "params_read" on public.pricing_parameters;
create policy "params_read" on public.pricing_parameters
  for select using (auth.role() = 'authenticated');
drop policy if exists "params_ach_write" on public.pricing_parameters;
create policy "params_ach_write" on public.pricing_parameters
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop trigger if exists trg_quotes_updated_at on public.pricing_quotes;
create trigger trg_quotes_updated_at before update on public.pricing_quotes
  for each row execute function public.touch_updated_at();
