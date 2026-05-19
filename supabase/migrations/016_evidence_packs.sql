-- ============================================================
-- 016 · Evidence Pack, Career Progression Reports, Engagement Reports
-- ============================================================
-- Spec §18: Funding & Bid Evidence Pack — 14 sections, Word + PDF.
-- Spec §15.3: Career Progression Reports for milestone-paying partners.
-- Spec §16.2: Engagement Reports for sub-milestone exits.
-- ============================================================

-- ── EVIDENCE PACKS ────────────────────────────────────────
do $$ begin
  create type public.pack_status as enum (
    'draft', 'finalised', 'exported_word', 'exported_pdf', 'archived'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.evidence_packs (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  funder          text,
  funding_window  text,
  description     text,
  status          public.pack_status not null default 'draft',
  -- customisation knobs (spec §18.3)
  emphasis_sections text[] not null default '{}',     -- section keys to lead with
  featured_partners uuid[] not null default '{}',     -- partners to feature
  anonymisation_level text not null default 'standard'
    check (anonymisation_level in ('low','standard','high')),
  -- AI-assisted drafting cache (V2, spec §18.4)
  ai_provider     text default 'gemini-1.5-flash',
  -- methodology stamp (spec §11.3 — every report stamps its methodology version)
  methodology_version text not null default 'v1.0',
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 14 sections per spec §18.2
create table if not exists public.evidence_pack_sections (
  id            uuid primary key default gen_random_uuid(),
  pack_id       uuid not null references public.evidence_packs(id) on delete cascade,
  section_key   text not null check (section_key in (
    'organisational_overview',
    'programme_overview',
    'current_scale_reach',
    'outcomes_evidence',
    'partner_case_studies',
    'candidate_stories',
    'methodology_academic_grounding',
    'distinctiveness_innovation',
    'theory_of_change',
    'financial_operational',
    'funder_citation_blocks',
    'evidence_references',
    'visual_material',
    'ach_attestation'
  )),
  sort_order    integer not null default 0,
  content       text,                       -- editable rich text
  ai_draft      text,                       -- separate AI draft, never auto-merged
  ai_drafted_at timestamptz,
  ai_drafted_by text,                       -- model name + version
  ai_prompt_hash text,                      -- for the 24h cache
  included      boolean not null default true,
  unique (pack_id, section_key)
);

create index if not exists idx_eps_pack on public.evidence_pack_sections(pack_id);

-- 24h cache for AI drafting requests (spec brief: rate limit + cache to stay within free tier)
create table if not exists public.ai_draft_cache (
  prompt_hash text primary key,
  response    text not null,
  model       text not null,
  cached_at   timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists idx_aic_expires on public.ai_draft_cache(expires_at);

-- Per-user rate limit ledger (10 drafts/user/hour per brief)
create table if not exists public.ai_draft_calls (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  called_at   timestamptz not null default now(),
  cache_hit   boolean not null default false
);

create index if not exists idx_aidc_user_time on public.ai_draft_calls(user_id, called_at desc);

-- ── CAREER PROGRESSION REPORTS (spec §15.3) ────────────────
create table if not exists public.career_progression_reports (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners(id) on delete cascade,
  period_label  text not null,                  -- e.g. "2026 annual"
  generated_at  timestamptz not null default now(),
  -- snapshot fields (computed at generation time, then preserved)
  total_milestone_payments numeric(12,2) not null default 0,
  total_dev_fund_contribution numeric(12,2) not null default 0,
  match_funding_amplification numeric(12,2) not null default 0,
  candidates_contributed_to integer not null default 0,
  training_enrolments_funded integer not null default 0,
  transitions integer not null default 0,
  earnings_uplift_attributed numeric(12,2) not null default 0,
  retention_in_progressed_roles integer not null default 0,
  methodology_version text not null default 'v1.0',
  unique (partner_id, period_label)
);

create index if not exists idx_cpr_partner on public.career_progression_reports(partner_id);

-- ── ENGAGEMENT REPORTS (spec §16.2) ───────────────────────
-- Produced for sub-milestone exits regardless of underlying reason.
create table if not exists public.engagement_reports (
  id            uuid primary key default gen_random_uuid(),
  placement_id  uuid not null references public.placements(id) on delete cascade,
  partner_id    uuid not null references public.partners(id) on delete cascade,
  generated_at  timestamptz not null default now(),
  engagement_summary text,
  placement_outcomes_factual text,
  candidate_development_trajectory text,
  partial_sv_attribution numeric(12,2) not null default 0,
  learnings text,
  methodology_version text not null default 'v1.0',
  unique (placement_id)
);

create index if not exists idx_er_partner on public.engagement_reports(partner_id);

-- RLS
alter table public.evidence_packs            enable row level security;
alter table public.evidence_pack_sections    enable row level security;
alter table public.ai_draft_cache            enable row level security;
alter table public.ai_draft_calls            enable row level security;
alter table public.career_progression_reports enable row level security;
alter table public.engagement_reports        enable row level security;

drop policy if exists "ep_ach_all"  on public.evidence_packs;
create policy "ep_ach_all"  on public.evidence_packs            for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "eps_ach_all" on public.evidence_pack_sections;
create policy "eps_ach_all" on public.evidence_pack_sections    for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "aic_ach_all" on public.ai_draft_cache;
create policy "aic_ach_all" on public.ai_draft_cache            for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "aidc_self"   on public.ai_draft_calls;
create policy "aidc_self"   on public.ai_draft_calls            for select using (user_id = auth.uid());
drop policy if exists "aidc_ach_all" on public.ai_draft_calls;
create policy "aidc_ach_all" on public.ai_draft_calls           for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "cpr_ach_all"  on public.career_progression_reports;
create policy "cpr_ach_all"  on public.career_progression_reports for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "cpr_partner_self" on public.career_progression_reports;
create policy "cpr_partner_self" on public.career_progression_reports
  for select using (partner_id = public.current_partner_id());

drop policy if exists "er_ach_all"   on public.engagement_reports;
create policy "er_ach_all"   on public.engagement_reports        for all using (public.is_ach_staff()) with check (public.is_ach_staff());
drop policy if exists "er_partner_self" on public.engagement_reports;
create policy "er_partner_self" on public.engagement_reports
  for select using (partner_id = public.current_partner_id());

drop trigger if exists trg_ep_updated_at on public.evidence_packs;
create trigger trg_ep_updated_at before update on public.evidence_packs
  for each row execute function public.touch_updated_at();
