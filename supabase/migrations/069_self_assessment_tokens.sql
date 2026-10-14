-- ============================================================
-- 069 · Self-assessment tokens
-- ============================================================
-- Tokenised, single-use (per generation) links a candidate opens on
-- their own device to complete a follow-up HIM self-assessment at
-- 3mo / 6mo / 12mo timepoints. Shareable via WhatsApp, SMS, email.
--
-- Design:
--   - One row per generated link
--   - Shareable URL: /self-assess/<token>
--   - 14-day default expiry
--   - Marks completed_at when the candidate submits
--   - Can be revoked by ACH staff
-- ============================================================

create table if not exists public.self_assessment_tokens (
  id             uuid primary key default gen_random_uuid(),
  token          text unique not null,
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  project_id     uuid not null references public.projects(id)   on delete cascade,
  timepoint      public.assessment_timepoint not null,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '14 days'),
  opened_at      timestamptz,
  completed_at   timestamptz,
  revoked_at     timestamptz,
  revoked_reason text
);

create index if not exists idx_sat_candidate   on public.self_assessment_tokens(candidate_id);
create index if not exists idx_sat_token       on public.self_assessment_tokens(token);
create index if not exists idx_sat_expires_at  on public.self_assessment_tokens(expires_at);

alter table public.self_assessment_tokens enable row level security;

drop policy if exists "sat_ach_all" on public.self_assessment_tokens;
create policy "sat_ach_all" on public.self_assessment_tokens
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

-- Note: the public /self-assess/<token> page accesses this table via
-- the service-role client (bypasses RLS). This is appropriate because
-- the token itself is the authentication credential — only someone
-- with the exact token string can read the matching row.
