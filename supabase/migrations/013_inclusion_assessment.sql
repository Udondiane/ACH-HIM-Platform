-- ============================================================
-- 013 · Inclusion Assessment (spec §12)
-- ============================================================
-- 6-dimension instrument that partner organisations can complete to
-- assess their own inclusion climate. Methodologically a PARALLEL
-- framework to the capability framework. Surfaced on the Training
-- Partner dashboard Section 3 (year-over-year) and as a standalone
-- accessible instrument.
--
-- v2: env factors for placed candidates derive from the partner's
-- inclusion assessment (spec §12.2). The mapping is implemented
-- in lib/scoring/inclusion-linkage.ts; the join lives at the
-- application layer not the DB.
-- ============================================================

create table if not exists public.inclusion_dimensions (
  id          text primary key,
  name        text not null,
  description text not null,
  sort_order  integer not null
);

insert into public.inclusion_dimensions (id, name, description, sort_order) values
  ('economic_security',    'Economic Security & Stability', 'Pay, hours, contract security, predictability of income.', 1),
  ('skill_use_growth',     'Skill Use & Growth',            'Use of existing skills and access to growth opportunities.', 2),
  ('workplace_dignity',    'Workplace Dignity & Respect',   'Day-to-day dignity, respect, freedom from discrimination.', 3),
  ('voice_agency',         'Voice & Agency',                'Ability to influence work, raise concerns, be heard.', 4),
  ('social_belonging',     'Social Belonging & Inclusion',  'Belonging in the workplace community.', 5),
  ('wellbeing_confidence', 'Wellbeing & Confidence',        'Wellbeing at work, confidence in role.', 6)
on conflict (id) do nothing;

create table if not exists public.inclusion_assessments (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners(id) on delete cascade,
  assessed_on   date not null default current_date,
  -- year-over-year tracking key — e.g. "2026-Q1"
  period_label  text not null,
  -- aggregate scores 0–5, one per dimension
  s_economic_security    numeric(4,2),
  s_skill_use_growth     numeric(4,2),
  s_workplace_dignity    numeric(4,2),
  s_voice_agency         numeric(4,2),
  s_social_belonging     numeric(4,2),
  s_wellbeing_confidence numeric(4,2),
  -- count of respondents the partner used (e.g. 27 staff surveyed)
  respondent_count       integer,
  -- free-text reflections
  notes         text,
  status        text not null default 'draft' check (status in ('draft','submitted','reviewed')),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (partner_id, period_label)
);

create index if not exists idx_ia_partner on public.inclusion_assessments(partner_id);

alter table public.inclusion_dimensions   enable row level security;
alter table public.inclusion_assessments  enable row level security;

drop policy if exists "incl_dim_read" on public.inclusion_dimensions;
create policy "incl_dim_read" on public.inclusion_dimensions for select using (auth.role() = 'authenticated');

drop policy if exists "ia_ach_all" on public.inclusion_assessments;
create policy "ia_ach_all" on public.inclusion_assessments
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "ia_partner_self" on public.inclusion_assessments;
create policy "ia_partner_self" on public.inclusion_assessments
  for select using (partner_id = public.current_partner_id());

drop policy if exists "ia_partner_write_self" on public.inclusion_assessments;
create policy "ia_partner_write_self" on public.inclusion_assessments
  for insert with check (partner_id = public.current_partner_id() and status = 'draft');

drop policy if exists "ia_partner_update_self" on public.inclusion_assessments;
create policy "ia_partner_update_self" on public.inclusion_assessments
  for update using (
    partner_id = public.current_partner_id() and status = 'draft'
  ) with check (
    partner_id = public.current_partner_id() and status in ('draft','submitted')
  );

drop trigger if exists trg_ia_updated_at on public.inclusion_assessments;
create trigger trg_ia_updated_at before update on public.inclusion_assessments
  for each row execute function public.touch_updated_at();
