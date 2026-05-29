/* Programme-stage tracking + ongoing support log + counterfactual
   data point. Five additions in one migration for the user's gap list:

   1. candidate_training - per-candidate training delivery record
      (the 1-week training before placement). Attendance, completion,
      certificate.
   2. candidate_support - log of ongoing support given to ANY candidate
      including those not hired. Caseworker contact, action, follow-up.
   3. not_selected_for_programme exit reason - so we can analyse the
      capability trajectory of applicants ACH did not put on the
      programme (counterfactual basis).
   4. at_risk boolean cached on candidates - simple rule-based flag the
      caseworker dashboards can highlight.
   5. cohort_narrative_synthesis table - persistent home for AI-
      generated cohort theme summaries so they can be reviewed and
      attached to evidence packs. */

create table if not exists public.candidate_training (
  id                 uuid primary key default gen_random_uuid(),
  candidate_id       uuid not null references public.candidates(id) on delete cascade,
  cohort_id          uuid references public.cohorts(id) on delete set null,
  training_name      text not null,
  trainer            text,
  scheduled_start    date,
  scheduled_end      date,
  attended_sessions  integer,
  total_sessions     integer,
  completion_status  text not null default 'not_started'
    check (completion_status in ('not_started','in_progress','completed','withdrew')),
  completion_date    date,
  certificate_url    text,
  notes              text,
  recorded_by        uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_training_candidate on public.candidate_training(candidate_id);
create index if not exists idx_training_cohort on public.candidate_training(cohort_id);

do $$ begin
  create type public.support_kind as enum (
    'iag_session',
    'casework_call',
    'in_person_visit',
    'referral',
    'document_help',
    'mental_health_check',
    'follow_up',
    'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.candidate_support (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references public.candidates(id) on delete cascade,
  kind            public.support_kind not null,
  provided_on     date not null default current_date,
  duration_mins   integer,
  caseworker      text,
  summary         text,
  next_action     text,
  next_action_by  date,
  recorded_by     uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_support_candidate on public.candidate_support(candidate_id);
create index if not exists idx_support_provided_on on public.candidate_support(provided_on);
create index if not exists idx_support_next_action on public.candidate_support(next_action_by)
  where next_action_by is not null;

alter type public.candidate_exit_reason add value if not exists 'not_selected_for_programme';

alter table public.candidates
  add column if not exists at_risk boolean not null default false,
  add column if not exists at_risk_reason text;

create table if not exists public.cohort_narrative_synthesis (
  id              uuid primary key default gen_random_uuid(),
  cohort_id       uuid not null references public.cohorts(id) on delete cascade,
  themes          jsonb,
  sentiment_summary text,
  generated_at    timestamptz not null default now(),
  generated_by    uuid references auth.users(id),
  source_count    integer,
  model           text default 'azure-openai',
  methodology_version text default 'v1.0'
);

create index if not exists idx_synthesis_cohort on public.cohort_narrative_synthesis(cohort_id);

alter table public.candidate_training enable row level security;
alter table public.candidate_support  enable row level security;
alter table public.cohort_narrative_synthesis enable row level security;

drop policy if exists "training_ach_all" on public.candidate_training;
create policy "training_ach_all" on public.candidate_training
  for all using (
    (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  ) with check (
    (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  );

drop policy if exists "support_ach_all" on public.candidate_support;
create policy "support_ach_all" on public.candidate_support
  for all using (
    (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  ) with check (
    (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  );

drop policy if exists "synthesis_ach_all" on public.cohort_narrative_synthesis;
create policy "synthesis_ach_all" on public.cohort_narrative_synthesis
  for all using (
    (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  ) with check (
    (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  );
