-- ============================================================
-- 050 · Bid support packs
-- ============================================================
-- A bid support pack is what ACH takes into a funding conversation.
-- It assembles:
--   1. Bid metadata (funder, deadline, ask amount, focus domains)
--   2. Impact evidence pulled from HIM (aggregate + selected cohorts)
--   3. Financial impact mapping (chosen framework applied to outcomes)
--   4. Featured beneficiary voices with consent
--   5. Methodology stamp
--
-- Frameworks seed three options:
--   · hact_wellbeing_2019  — sector standard for housing / wellbeing bids
--   · tom2019              — public sector / commissioners
--   · ach_bespoke          — placeholder for ACH's own attribution model
--
-- Per-domain proxy values are STARTING POINTS. ACH's methodology lead
-- should review and refine before using in a real bid.
-- ============================================================

do $$ begin
  create type public.bid_status as enum ('draft', 'submitted', 'won', 'lost', 'withdrawn');
exception when duplicate_object then null; end $$;

create table if not exists public.bids (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  funder_name            text,
  ask_amount_gbp         numeric(10,2),
  deadline               date,
  submitted_at           date,
  outcome_notes          text,
  status                 public.bid_status not null default 'draft',
  -- Which HIM domains this bid emphasises. Free-form JSON array of domain keys.
  focus_domains          jsonb not null default '[]'::jsonb,
  -- Which financial framework to use for £-value calculations.
  framework_key          text,
  -- Which projects/cohorts feed the impact evidence.
  scoped_project_ids     jsonb not null default '[]'::jsonb,
  scoped_cohort_ids      jsonb not null default '[]'::jsonb,
  -- Which featured quotes to include (id references featured_quotes.id).
  featured_quote_ids     jsonb not null default '[]'::jsonb,
  -- Free-form editorial content.
  executive_summary      text,
  methodology_note       text,
  what_we_will_do        text,
  what_change_looks_like text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references auth.users(id)
);

create index if not exists idx_bids_status   on public.bids(status);
create index if not exists idx_bids_deadline on public.bids(deadline);

-- Reference table: framework definitions
create table if not exists public.bid_financial_frameworks (
  key           text primary key,
  label         text not null,
  description   text,
  source_ref    text,
  created_at    timestamptz not null default now()
);

-- Per-framework, per-HIM-domain £ proxy values (in pence for precision)
create table if not exists public.bid_framework_domain_proxies (
  framework_key   text not null references public.bid_financial_frameworks(key) on delete cascade,
  domain_id       text not null,
  proxy_value_pence integer not null,
  unit            text,
  guidance        text,
  primary key (framework_key, domain_id)
);

-- ── Seed the three starter frameworks ──
insert into public.bid_financial_frameworks (key, label, description, source_ref) values
  ('hact_wellbeing_2019',
   'HACT UK Social Value Bank (Wellbeing)',
   'Wellbeing valuation proxies developed by HACT. Sector standard for housing associations and wellbeing-focused bids.',
   'HACT Social Value Bank 2019 (indicative — refresh from HACT.net for live values)'),
  ('tom2019',
   'National TOMs 2019',
   'Themes, Outcomes, Measures framework used by UK public sector procurement. Values from Social Value UK / Loop.',
   'National TOMs 2019 (values from cohort_toms_claims for actual bids)'),
  ('ach_bespoke',
   'ACH bespoke attribution',
   'Placeholder for ACH’s own attribution model — configurable per bid.',
   'To be refined by ACH methodology lead')
on conflict (key) do nothing;

-- HACT starter proxies (INDICATIVE — methodology lead to refresh)
insert into public.bid_framework_domain_proxies (framework_key, domain_id, proxy_value_pence, unit, guidance) values
  ('hact_wellbeing_2019', 'employment',  1350900,  'per person moved into employment',       'Full-time work with benefit take-up removed (HACT indicative).'),
  ('hact_wellbeing_2019', 'housing',      812000,  'per person housed / retained tenancy',   'Wellbeing uplift from secure accommodation.'),
  ('hact_wellbeing_2019', 'education',    300000,  'per person completing further learning', 'Skills / qualification recognised.'),
  ('hact_wellbeing_2019', 'health',       200000,  'per person with improved wellbeing',     'Reduction in psychological distress.'),
  ('hact_wellbeing_2019', 'belonging',    185000,  'per person less isolated',               'Sense of belonging and identity.'),
  ('hact_wellbeing_2019', 'social',       150000,  'per person more socially engaged',       'Regular social contact.'),
  ('hact_wellbeing_2019', 'rights',       250000,  'per person with improved rights knowledge','Legal / civic capability uplift.')
on conflict do nothing;

-- TOMs starter proxies (rough placeholders — real values live in cohort_toms_claims)
insert into public.bid_framework_domain_proxies (framework_key, domain_id, proxy_value_pence, unit, guidance) values
  ('tom2019', 'employment',   1650000, 'per FTE employment for local resident', 'NT1 proxy — check TOMs 2019 for the code that fits.'),
  ('tom2019', 'education',      45000, 'per person completing qualification',    'NT8 proxy.'),
  ('tom2019', 'social',        180000, 'per volunteer hour supported',           'NT9 proxy.'),
  ('tom2019', 'health',        150000, 'per person with mental health improvement','NT7 proxy.'),
  ('tom2019', 'belonging',     120000, 'per person in local community activity',  'NT12 proxy.')
on conflict do nothing;

-- ── RLS ──
alter table public.bids                          enable row level security;
alter table public.bid_financial_frameworks      enable row level security;
alter table public.bid_framework_domain_proxies  enable row level security;

drop policy if exists "bid_ach_all" on public.bids;
create policy "bid_ach_all" on public.bids
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "bff_all_read" on public.bid_financial_frameworks;
create policy "bff_all_read" on public.bid_financial_frameworks  for select using (true);
drop policy if exists "bff_ach_write" on public.bid_financial_frameworks;
create policy "bff_ach_write" on public.bid_financial_frameworks for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "bfp_all_read" on public.bid_framework_domain_proxies;
create policy "bfp_all_read" on public.bid_framework_domain_proxies  for select using (true);
drop policy if exists "bfp_ach_write" on public.bid_framework_domain_proxies;
create policy "bfp_ach_write" on public.bid_framework_domain_proxies for all using (public.is_ach_staff()) with check (public.is_ach_staff());

-- ── Triggers ──
drop trigger if exists trg_bids_updated_at on public.bids;
create trigger trg_bids_updated_at before update on public.bids
  for each row execute function public.touch_updated_at();
