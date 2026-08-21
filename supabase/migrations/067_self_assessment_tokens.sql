-- ============================================================
-- 067 · self-assessment tokens — mobile-friendly closing reflection
-- ============================================================
-- Powers the WhatsApp-shareable beneficiary self-assessment flow. ACH
-- staff generate a token for a (candidate, project, timepoint), share
-- the link via WhatsApp / SMS / email. Beneficiary opens on their
-- phone, answers the closing reflection question (typed or voice),
-- submits. Response lands in assessments.closing_reflection_* for
-- that timepoint.
--
-- No login required to redeem — token is the credential. Tokens are
-- single-use (usable once, then marked). Expiring in 14 days by
-- default so a stale forwarded link stops working.
-- ============================================================

create table if not exists public.self_assessment_tokens (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  timepoint     text not null check (timepoint in ('baseline','mid_3mo','exit_6mo','followup_12mo')),
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  expires_at    timestamptz not null default (now() + interval '14 days'),
  used_at       timestamptz,
  used_ip       text,
  response_length int
);

create index if not exists idx_sat_token on public.self_assessment_tokens(token);
create index if not exists idx_sat_candidate on public.self_assessment_tokens(candidate_id, timepoint);
create index if not exists idx_sat_unused on public.self_assessment_tokens(used_at) where used_at is null;

comment on table public.self_assessment_tokens is
  'Single-use, expiring tokens that let beneficiaries submit a closing reflection via mobile-friendly public route (/self-assess/[token]) without needing a HIM login. Populated by staff; redeemed by beneficiary.';

-- RLS: only ACH staff can read + create. The public route validates
-- the token server-side using the service role, so it doesn't need
-- an RLS carve-out.
alter table public.self_assessment_tokens enable row level security;

drop policy if exists "sat_ach_all" on public.self_assessment_tokens;
create policy "sat_ach_all" on public.self_assessment_tokens
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());
