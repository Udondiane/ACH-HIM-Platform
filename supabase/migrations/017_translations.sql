-- ============================================================
-- 017 · Translations admin (per user direction on tiering)
-- ============================================================
-- Stores per-string translations so ACH staff can view, edit, mark
-- reviewed, filter by language/status, and export/import JSON.
-- Strings live as canonical message_key + locale rows. JSON files
-- in /messages/ are seeded from this table by an export job and
-- are read by next-intl at runtime via the build process.
--
-- Tiering policy:
--   Tier A (en):        reviewed = true (source of truth)
--   Tier B (ar/fr/es/uk): reviewed = false, machine-translated
--   Tier C (others):    reviewed = false, content = null (English fallback)
-- ============================================================

create table if not exists public.translations (
  id            uuid primary key default gen_random_uuid(),
  message_key   text not null,                  -- e.g. 'nav.dashboard'
  locale        text not null,                  -- ISO code, must match lib/i18n/config.ts
  content       text,                           -- null = "needs translation", English fallback
  reviewed      boolean not null default false,
  needs_native_review boolean not null default false, -- Tier C marker
  source_method text not null default 'manual'
    check (source_method in ('manual', 'machine_deepl', 'machine_google', 'machine_gemini')),
  -- editorial trail
  last_edited_by uuid references auth.users(id),
  last_edited_at timestamptz not null default now(),
  reviewer_notes text,
  created_at    timestamptz not null default now(),
  unique (message_key, locale)
);

create index if not exists idx_tr_locale on public.translations(locale);
create index if not exists idx_tr_reviewed on public.translations(reviewed);
create index if not exists idx_tr_needs_review on public.translations(needs_native_review);

-- Exportable JSON snapshots (history, so we can roll back a bad import)
create table if not exists public.translation_snapshots (
  id            uuid primary key default gen_random_uuid(),
  locale        text not null,
  taken_at      timestamptz not null default now(),
  taken_by      uuid references auth.users(id),
  json_payload  jsonb not null,
  notes         text
);

create index if not exists idx_tsnap_locale on public.translation_snapshots(locale, taken_at desc);

-- RLS
alter table public.translations          enable row level security;
alter table public.translation_snapshots enable row level security;

drop policy if exists "tr_ach_all" on public.translations;
create policy "tr_ach_all" on public.translations
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());

drop policy if exists "tr_read" on public.translations;
create policy "tr_read" on public.translations
  for select using (auth.role() = 'authenticated');

drop policy if exists "tsnap_ach_all" on public.translation_snapshots;
create policy "tsnap_ach_all" on public.translation_snapshots
  for all using (public.is_ach_staff()) with check (public.is_ach_staff());
