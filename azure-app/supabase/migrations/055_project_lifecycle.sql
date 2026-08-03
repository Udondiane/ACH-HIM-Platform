-- 055 · Project lifecycle · baseline window, data providers, completion narrative
--
-- Codifies four lifecycle constructs that were previously implicit:
--
--   1. baseline_window_days — how many days after project start baseline
--      assessments remain available. Default 3 (hard lockout after that).
--   2. project_data_providers — corporate-partner contacts who supply
--      performance data (retention, promotion) when required. Filled in
--      during project setup when the funding model is hybrid or commercial
--      and standard-data-collection was agreed with the partner.
--   3. end_narrative_* — three qualitative fields captured when the
--      project is marked completed. Feed the outcomes report's narrative
--      alongside the quantitative HIM data.
--   4. Project 'completed' is stored in the existing text status column.
--      No enum constraint change needed — status is unchecked text.

-- baseline_window_days already exists (migration 034). Tighten the
-- default from 14 → 3 as agreed with ACH; backfill existing projects
-- so the demo reflects the new rule.
alter table public.projects
  alter column baseline_window_days set default 3;
update public.projects set baseline_window_days = 3 where baseline_window_days = 14;

alter table public.projects
  add column if not exists partner_provides_standard_data boolean not null default false,
  add column if not exists end_narrative_what_worked text,
  add column if not exists end_narrative_challenges text,
  add column if not exists end_narrative_unexpected text,
  add column if not exists completed_at timestamptz;

comment on column public.projects.baseline_window_days is
  'Days after project start_date during which baseline assessments remain available. Hard lockout enforced in UI after this window closes.';

comment on column public.projects.partner_provides_standard_data is
  'True when the corporate partner has agreed during negotiations to supply performance data on placed candidates. Triggers the data-provider capture on the project form.';

-- Data providers table — one row per contact who supplies partner-side data.
create table if not exists public.project_data_providers (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  email        text not null,
  contact_name text,
  role         text,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_project_data_providers_project on public.project_data_providers(project_id);

create unique index if not exists uq_project_data_providers_project_email
  on public.project_data_providers(project_id, lower(email));

comment on table public.project_data_providers is
  'Corporate-partner contacts who supply performance data (retention, promotion, etc.) when required — captured on project setup when partner_provides_standard_data = true.';
