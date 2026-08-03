-- ============================================================
-- 048 · Standardised partner question sets by project type
-- ============================================================
-- Partners receive different questions depending on the shape of the
-- programme being reported on. Workforce cohorts ask about role and
-- retention. Wellbeing cohorts ask about stability. Housing cohorts
-- ask about tenancy sustainment. The tokenised partner report already
-- exists — this migration adds the CONFIGURATION LAYER so different
-- programmes can present different question sets without hard-coding.
--
-- Two tables:
--   partner_question_sets  — a named set of prompts (workforce, wellbeing, housing, etc.)
--   partner_question_items — the actual prompts inside a set
--
-- Projects link to a set via projects.partner_question_set_key
-- (added below, nullable — defaults to the workforce set if absent).
-- ============================================================

create table if not exists public.partner_question_sets (
  key           text primary key,
  label         text not null,
  description   text,
  created_at    timestamptz not null default now()
);

create table if not exists public.partner_question_items (
  id            uuid primary key default gen_random_uuid(),
  set_key       text not null references public.partner_question_sets(key) on delete cascade,
  timepoint     text not null check (timepoint in ('exit_3mo', 'retention_6mo', 'retention_12mo')),
  ordering      integer not null default 100,
  prompt        text not null,
  response_type text not null default 'narrative'
    check (response_type in ('narrative', 'yes_no', 'likert_1_5', 'text_short')),
  guidance      text,
  is_required   boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_pqi_set on public.partner_question_items(set_key);
create index if not exists idx_pqi_tp  on public.partner_question_items(timepoint);

-- Add project → set link (nullable, defaults to workforce if unset)
alter table public.projects
  add column if not exists partner_question_set_key text
    references public.partner_question_sets(key) on delete set null;

-- ── Seed three sets ──

insert into public.partner_question_sets (key, label, description) values
  ('workforce',
   'Workforce partner',
   'For programmes with employer partners providing placements. Growth, retention, progression.'),
  ('wellbeing',
   'Wellbeing partner',
   'For programmes measuring wellbeing outcomes. Stability, engagement, distress signals.'),
  ('housing',
   'Housing partner',
   'For programmes measuring housing outcomes. Tenancy sustainment, arrears, safeguarding.')
on conflict (key) do nothing;

-- ── WORKFORCE items ──
insert into public.partner_question_items (set_key, timepoint, ordering, prompt, response_type, guidance, is_required) values
  ('workforce', 'exit_3mo',      10,  'How is the candidate performing in their role so far?',                                  'narrative',   'A short paragraph is fine. Note specific examples of growth or gaps.', true),
  ('workforce', 'exit_3mo',      20,  'Have you made a formal offer, or does the placement end at 3 months?',                    'text_short',  'Formal offer / Placement ends / Other — please specify.', true),
  ('workforce', 'exit_3mo',      30,  'What is one thing the candidate has learned that surprised you?',                         'narrative',   'Optional — but a great quote for reporting.', false),

  ('workforce', 'retention_6mo', 10,  'Is the candidate still in the same role?',                                                'yes_no',      null, true),
  ('workforce', 'retention_6mo', 20,  'If yes, how are they progressing?',                                                       'narrative',   'Optional narrative on progression.', false),
  ('workforce', 'retention_6mo', 30,  'If no, do you know what they moved on to?',                                               'narrative',   'Any information helps us track onward outcomes.', false),

  ('workforce', 'retention_12mo', 10, 'Is the candidate still employed with your organisation?',                                 'yes_no',      null, true),
  ('workforce', 'retention_12mo', 20, 'Have they progressed (promotion, new responsibilities, pay grade change)?',              'narrative',   'This becomes the 12-month impact report progression narrative.', false),
  ('workforce', 'retention_12mo', 30, 'Would you take another candidate from this programme?',                                   'yes_no',      null, true)
on conflict do nothing;

-- ── WELLBEING items ──
insert into public.partner_question_items (set_key, timepoint, ordering, prompt, response_type, guidance, is_required) values
  ('wellbeing', 'exit_3mo',      10, 'How would you rate the candidate’s current stability?',                                    'likert_1_5', '1 = very unstable, 5 = very stable.', true),
  ('wellbeing', 'exit_3mo',      20, 'What has changed since baseline?',                                                         'narrative',  null, true),
  ('wellbeing', 'exit_3mo',      30, 'Any concerns you would flag for the case worker?',                                         'narrative',  'Anything urgent — housing, safeguarding, mental health.', false),

  ('wellbeing', 'retention_6mo', 10, 'Is the candidate still engaged with the support service?',                                 'yes_no',     null, true),
  ('wellbeing', 'retention_6mo', 20, 'How is their wellbeing now vs 6 months ago?',                                              'narrative',  null, true),

  ('wellbeing', 'retention_12mo', 10, 'Has the candidate maintained the wellbeing gains from the programme?',                    'yes_no',     null, true),
  ('wellbeing', 'retention_12mo', 20, 'What has that meant for their life a year on?',                                           'narrative',  'This becomes the 12-month impact narrative.', false)
on conflict do nothing;

-- ── HOUSING items ──
insert into public.partner_question_items (set_key, timepoint, ordering, prompt, response_type, guidance, is_required) values
  ('housing', 'exit_3mo',      10, 'Is the tenant currently in the same accommodation as at programme entry?',                  'yes_no',      null, true),
  ('housing', 'exit_3mo',      20, 'Are they in rent arrears?',                                                                  'yes_no',      null, true),
  ('housing', 'exit_3mo',      30, 'Have there been any safeguarding concerns?',                                                 'narrative',   'Anything you would want the case worker to know.', false),

  ('housing', 'retention_6mo', 10, 'Is the tenant still in secure accommodation?',                                               'yes_no',      null, true),
  ('housing', 'retention_6mo', 20, 'Any rent arrears now?',                                                                      'yes_no',      null, true),
  ('housing', 'retention_6mo', 30, 'Have they engaged with any onward services (benefits, health, employment)?',                'narrative',   'Onward engagement is a key impact indicator.', false),

  ('housing', 'retention_12mo', 10, 'Is the tenancy still sustained?',                                                           'yes_no',      null, true),
  ('housing', 'retention_12mo', 20, 'How has this tenancy contributed to the tenant’s wider situation?',                         'narrative',   'This becomes the 12-month impact narrative.', false)
on conflict do nothing;

-- ── RLS ──
alter table public.partner_question_sets  enable row level security;
alter table public.partner_question_items enable row level security;

drop policy if exists "pqs_all_read"   on public.partner_question_sets;
create policy "pqs_all_read"   on public.partner_question_sets  for select using (true);
drop policy if exists "pqs_ach_write"  on public.partner_question_sets;
create policy "pqs_ach_write"  on public.partner_question_sets  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "pqi_all_read"   on public.partner_question_items;
create policy "pqi_all_read"   on public.partner_question_items for select using (true);
drop policy if exists "pqi_ach_write"  on public.partner_question_items;
create policy "pqi_ach_write"  on public.partner_question_items for all using (public.is_ach_staff()) with check (public.is_ach_staff());
