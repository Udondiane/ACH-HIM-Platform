/* TOMs crosswalk + exit reasons + intention-to-treat infrastructure.

   1. Exit reasons on candidates so we can distinguish a programme win
      (left because got a job) from a real loss (disengaged)
   2. TOMs codes seeded from the National TOMs 2019 edition
   3. Crosswalk linking each NT code to HIM capability/indicator
   4. Per-cohort claims table so we can compute the monetised £ value
      for a Capability Investor report */

do $$ begin
  create type public.candidate_exit_reason as enum (
    'got_job_with_partner',
    'got_job_elsewhere',
    'education_training',
    'health',
    'disengaged',
    'followable',
    'other'
  );
exception when duplicate_object then null; end $$;

alter table public.candidates
  add column if not exists exit_reason public.candidate_exit_reason,
  add column if not exists exit_date date,
  add column if not exists exit_notes text;

create index if not exists idx_candidates_exit_reason
  on public.candidates(exit_reason) where exit_reason is not null;

/* National TOMs reference table - the master list of NT codes ACH can
   plausibly claim against. Values are 2019 district-council edition;
   ACH staff must verify against the CURRENT live TOMs edition before
   committing to a bid. The verify_required flag drives a UI banner. */
create table if not exists public.toms_codes (
  id                text primary key,                    -- e.g. 'NT1'
  measure           text not null,                       -- short measure title
  description       text,
  unit              text,                                -- 'no. FTE', 'no. weeks', 'hrs x attendees'
  proxy_value_pence integer,                             -- 2019 edition value in pence
  edition           text not null default '2019',
  play              text not null check (play in ('QUANT','QUAL')),
  verify_required   boolean not null default true,
  sort_order        integer not null default 0
);

insert into public.toms_codes (id, measure, description, unit, proxy_value_pence, play, sort_order) values
  ('NT1',   'Local person (FTE) employed on contract >=1yr', 'Direct placement banked at 12mo', 'no. FTE',        2821300, 'QUANT', 1),
  ('NT3',   'FTE taken on, long-term unemployed',            'High-value fit for refugee cohort',  'no. FTE',        1470156, 'QUANT', 2),
  ('NT4',   'FTE taken on, NEET',                            'Use where candidate meets NEET',     'no. FTE',        1243562, 'QUANT', 3),
  ('NT7',   'Hours supporting unemployed into work (24+)',   'Mentoring, mock interviews',         'hrs x attendees',     9428, 'QUANT', 4),
  ('NT8',   'School/college visits, careers talks',          'Low value but real',                 'staff hours',         1443, 'QUANT', 5),
  ('NT9',   'Training opportunity completed (L2/3/4+)',      'Claim at qualification achieved',    'no. weeks',          23487, 'QUANT', 6),
  ('NT12',  'Work placement weeks (unpaid)',                 '',                                   'no. weeks',          14394, 'QUANT', 7),
  ('NT13',  'Work placement weeks (paid at NMW/NLW)',        '',                                   'no. weeks',          14395, 'QUANT', 8),
  ('NT20',  'Contractor staff wellbeing practices',          'About bidder staff, do not misuse',  'hrs x attendees',     9595, 'QUAL',  9),
  ('NT25',  'Initiatives to tackle homelessness',            'Spend-based; nominal £',             'GBP invested',         100, 'QUAL', 10),
  ('NT26',  'Health/wellbeing initiatives in community',     'Report uplift as EVIDENCE',          'GBP invested',         100, 'QUAL', 11),
  ('NT27',  'Networks for older/disabled/vulnerable',        'Nominal; narrative evidence',        'GBP invested',         100, 'QUAL', 12),
  ('NT29',  'Volunteering hours, local community projects',  '',                                   'no. hours',           1443, 'QUANT', 13)
on conflict (id) do nothing;

/* Crosswalk: HIM capability domain -> National TOMs code with
   attribution rule and indicator binding. */
create table if not exists public.toms_crosswalk (
  id              uuid primary key default gen_random_uuid(),
  capability      text not null,                         -- 'employment' | 'housing' | 'education' | ...
  indicator_label text not null,                         -- e.g. 'Legal Right to Work + placement'
  toms_code       text not null references public.toms_codes(id) on delete cascade,
  attribution     text,                                  -- the claim/attribution rule
  sort_order      integer not null default 0
);

create index if not exists idx_toms_crosswalk_cap on public.toms_crosswalk(capability);
create index if not exists idx_toms_crosswalk_code on public.toms_crosswalk(toms_code);

insert into public.toms_crosswalk (capability, indicator_label, toms_code, attribution, sort_order) values
  ('employment', 'Legal Right to Work + placement',           'NT1',  'Claim at ACTUAL placement only - not on capability score',  1),
  ('employment', 'Cohort = long-term unemployed on arrival',  'NT3',  'High-value fit for refugee cohort; claim at placement',     2),
  ('employment', 'Cohort = NEET',                             'NT4',  'Use where candidate meets NEET definition; at placement',   3),
  ('employment', 'Work-Readiness; mentoring; mock interviews','NT7',  'Activity-based - claimable at DELIVERY, banks early',       4),
  ('employment', 'Trial shifts / pre-employment placement',   'NT12', 'NT12 if unpaid; evidence weeks delivered',                  5),
  ('employment', 'Trial shifts / pre-employment placement',   'NT13', 'NT13 if paid at NMW/NLW; evidence weeks delivered',         6),
  ('education',  'Course Recognition; qualifications gained', 'NT9',  'Claim at qualification ACHIEVED / supported to completion', 7),
  ('education',  'Careers talks / school & college visits',   'NT8',  'If ACH delivers these; low value, claim hours',             8),
  ('health',     'Mental Health Awareness; Self-Care; GP reg','NT26', 'Spend-based, nominal £. Report uplift as EVIDENCE',         9),
  ('housing',    'Housing Stability & Security',              'NT25', 'Spend-based; real outcome but TOMs barely monetises',      10),
  ('social',     'Volunteering & Leadership Orientation',     'NT29', 'Low value but genuine; claim hours delivered',             11),
  ('social',     'Civic awareness; community engagement',     'NT27', 'Nominal; narrative evidence',                              12),
  ('belonging',  'Relational Stability; Recognition',         'NT27', 'No clean £ - qualitative case studies',                    13)
on conflict do nothing;

/* Per-cohort TOMs claims. Staff enter quantities; £ value derived from
   toms_codes.proxy_value_pence x quantity. */
create table if not exists public.cohort_toms_claims (
  id              uuid primary key default gen_random_uuid(),
  cohort_id       uuid not null references public.cohorts(id) on delete cascade,
  toms_code       text not null references public.toms_codes(id) on delete restrict,
  quantity        numeric(10,2) not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (cohort_id, toms_code)
);

create index if not exists idx_cohort_toms_cohort on public.cohort_toms_claims(cohort_id);
