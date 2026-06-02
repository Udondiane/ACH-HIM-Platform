-- ============================================================
-- 030 · assessment factor responses (qualitative + audio)
-- ============================================================
-- Today the candidate's verbal answer to each factor's behavioural
-- prompt is fragmented across per-indicator narrative fields, which
-- destroys the coherence of what was actually said. This migration
-- adds a factor-level capture for the candidate's response so the
-- prompt → answer relationship is preserved as a single record.
--
-- Each row also tracks how the response was captured (typed vs
-- voice-transcribed) and, when applicable, links to an audio
-- attachment in the existing assessment-evidence bucket.
-- ============================================================

create table if not exists public.assessment_factor_responses (
  id                  uuid primary key default gen_random_uuid(),
  assessment_id       uuid not null references public.assessments(id) on delete cascade,
  factor_id           text not null references public.factors(id) on delete cascade,
  response_text       text,
  spoken_language     text,
  audio_attachment_id uuid references public.assessment_attachments(id) on delete set null,
  captured_via        text not null default 'typed'
                        check (captured_via in ('typed', 'voice', 'voice_edited')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (assessment_id, factor_id)
);

create index if not exists idx_afr_assessment on public.assessment_factor_responses(assessment_id);
create index if not exists idx_afr_factor on public.assessment_factor_responses(factor_id);

-- Auto-update updated_at
create or replace function public.touch_assessment_factor_responses()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_afr_updated_at on public.assessment_factor_responses;
create trigger trg_afr_updated_at
  before update on public.assessment_factor_responses
  for each row execute function public.touch_assessment_factor_responses();

-- ── Add audio-recording-consent flag on candidates ──────────────
alter table public.candidates
  add column if not exists consent_audio_recording boolean not null default false,
  add column if not exists consent_audio_recording_date date;

-- ── RLS ─────────────────────────────────────────────────────────
alter table public.assessment_factor_responses enable row level security;

drop policy if exists "afr_ach_all" on public.assessment_factor_responses;
create policy "afr_ach_all"
  on public.assessment_factor_responses
  for all
  using (public.is_ach_staff())
  with check (public.is_ach_staff());

-- Partners can read factor responses for assessments belonging to their cohorts
-- (consistent with existing assessment_responses partner-read policy).
drop policy if exists "afr_partner_read" on public.assessment_factor_responses;
create policy "afr_partner_read"
  on public.assessment_factor_responses
  for select
  using (
    exists (
      select 1
      from public.assessments a
      join public.cohort_candidates cc on cc.candidate_id = a.candidate_id
      join public.cohort_partners    cp on cp.cohort_id  = cc.cohort_id
      where a.id = assessment_factor_responses.assessment_id
        and cp.partner_id = public.current_partner_id()
    )
  );
