-- ============================================================
-- Migration 043 — Training subsystem
-- ============================================================
-- Adds the schema for the training team's operational tool inside HIM.
-- Extends (does not replace) the existing candidate_training summary
-- table with:
--
--   • training_programmes            — reusable programme definitions
--   • training_sessions              — individual class instances
--   • training_attendance            — per-learner per-session
--   • training_enrolments            — candidate ↔ programme lifecycle
--   • training_certificates          — issued certificates + audit
--   • training_learning_outcome_map  — LO ↔ HIM factor bridge
--   • training_session_notes         — quick learner notes per session
--
-- Design principles:
--   1. Every training programme lives once; instances (sessions) are
--      cheap to schedule.
--   2. Attendance is per-session, per-learner — captured on a phone
--      by the tutor in class.
--   3. Learning outcomes bridge to HIM factors, so completing a
--      programme becomes evidence for factor scoring.
--   4. Nothing here deletes or migrates existing candidate_training
--      rows — those stay as the historical summary; a new column
--      links them optionally to the new programme.
-- ============================================================

-- =============================================================
-- Training programmes (reusable across cohorts and time)
-- =============================================================
create table if not exists public.training_programmes (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  code                  text unique,
  description           text,
  category              text,
  duration_hours        integer,
  total_sessions        integer,
  certificate_template  text,
  status                text not null default 'active'
    check (status in ('active','archived','draft')),
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_training_programmes_status on public.training_programmes(status);

-- =============================================================
-- Individual class sessions (instances of a programme)
-- =============================================================
create table if not exists public.training_sessions (
  id                uuid primary key default gen_random_uuid(),
  programme_id      uuid not null references public.training_programmes(id) on delete cascade,
  cohort_id         uuid references public.cohorts(id) on delete set null,
  session_number    integer,
  session_title     text,
  scheduled_date    date not null,
  scheduled_start   time,
  scheduled_end     time,
  room              text,
  tutor_id          uuid references auth.users(id),
  tutor_name        text,
  status            text not null default 'scheduled'
    check (status in ('scheduled','delivered','cancelled')),
  session_notes     text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_training_sessions_programme on public.training_sessions(programme_id);
create index if not exists idx_training_sessions_cohort    on public.training_sessions(cohort_id);
create index if not exists idx_training_sessions_date      on public.training_sessions(scheduled_date);
create index if not exists idx_training_sessions_tutor     on public.training_sessions(tutor_id);

-- =============================================================
-- Enrolments (candidate ↔ programme lifecycle)
-- =============================================================
create table if not exists public.training_enrolments (
  id                uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references public.candidates(id) on delete cascade,
  programme_id      uuid not null references public.training_programmes(id) on delete cascade,
  cohort_id         uuid references public.cohorts(id) on delete set null,
  status            text not null default 'enrolled'
    check (status in ('enrolled','completed','withdrawn','waiting_list','deferred')),
  enrolled_date     date not null default current_date,
  completed_date    date,
  withdrawn_date    date,
  withdrawal_reason text,
  waiting_list_priority integer,
  notes             text,
  recorded_by       uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(candidate_id, programme_id)
);

create index if not exists idx_training_enrolments_candidate on public.training_enrolments(candidate_id);
create index if not exists idx_training_enrolments_programme on public.training_enrolments(programme_id);
create index if not exists idx_training_enrolments_status    on public.training_enrolments(status);

-- =============================================================
-- Attendance (per-learner per-session, tap-and-go)
-- =============================================================
create table if not exists public.training_attendance (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.training_sessions(id) on delete cascade,
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  status         text not null default 'present'
    check (status in ('present','absent','late','excused','not_marked')),
  arrival_time   time,
  notes          text,
  marked_by      uuid references auth.users(id),
  marked_at      timestamptz not null default now(),
  unique(session_id, candidate_id)
);

create index if not exists idx_training_attendance_session   on public.training_attendance(session_id);
create index if not exists idx_training_attendance_candidate on public.training_attendance(candidate_id);
create index if not exists idx_training_attendance_status    on public.training_attendance(status);

-- =============================================================
-- Session notes (quick learner notes, separate from attendance)
-- =============================================================
create table if not exists public.training_session_notes (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.training_sessions(id) on delete cascade,
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  note_kind      text not null default 'observation'
    check (note_kind in ('observation','concern','achievement','follow_up')),
  note_text      text not null,
  recorded_by    uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists idx_training_session_notes_session   on public.training_session_notes(session_id);
create index if not exists idx_training_session_notes_candidate on public.training_session_notes(candidate_id);

-- =============================================================
-- Certificates (issued, audited, downloadable)
-- =============================================================
create table if not exists public.training_certificates (
  id                    uuid primary key default gen_random_uuid(),
  candidate_id          uuid not null references public.candidates(id) on delete cascade,
  programme_id          uuid not null references public.training_programmes(id) on delete cascade,
  enrolment_id          uuid references public.training_enrolments(id) on delete set null,
  certificate_number    text unique not null,
  issued_date           date not null default current_date,
  issued_by             uuid references auth.users(id),
  attendance_pct        numeric(5,2),
  certificate_file_url  text,
  revoked_at            timestamptz,
  revoked_reason        text,
  created_at            timestamptz not null default now()
);

create index if not exists idx_training_certificates_candidate on public.training_certificates(candidate_id);
create index if not exists idx_training_certificates_programme on public.training_certificates(programme_id);

-- =============================================================
-- Learning-outcome ↔ HIM factor bridge (the intellectual glue)
-- =============================================================
create table if not exists public.training_learning_outcomes (
  id                    uuid primary key default gen_random_uuid(),
  programme_id          uuid not null references public.training_programmes(id) on delete cascade,
  outcome_code          text,
  outcome_text          text not null,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now()
);

create index if not exists idx_training_learning_outcomes_programme on public.training_learning_outcomes(programme_id);

create table if not exists public.training_learning_outcome_map (
  id                    uuid primary key default gen_random_uuid(),
  learning_outcome_id   uuid not null references public.training_learning_outcomes(id) on delete cascade,
  factor_id             text not null references public.factors(id) on delete cascade,
  evidence_weight       numeric(3,2) not null default 1.0
    check (evidence_weight >= 0.0 and evidence_weight <= 1.0),
  created_at            timestamptz not null default now(),
  unique(learning_outcome_id, factor_id)
);

create index if not exists idx_lo_map_outcome on public.training_learning_outcome_map(learning_outcome_id);
create index if not exists idx_lo_map_factor  on public.training_learning_outcome_map(factor_id);

-- =============================================================
-- Bridge existing candidate_training to the new programme concept
-- =============================================================
alter table public.candidate_training
  add column if not exists programme_id  uuid references public.training_programmes(id) on delete set null,
  add column if not exists enrolment_id  uuid references public.training_enrolments(id) on delete set null;

create index if not exists idx_candidate_training_programme on public.candidate_training(programme_id);

-- =============================================================
-- RLS — permissive for now (matches the wider platform pattern
-- while AUTH_DISABLED is on; RLS becomes real once SSO lands)
-- =============================================================
do $$
declare tbl text;
begin
  for tbl in
    select unnest(array[
      'training_programmes',
      'training_sessions',
      'training_enrolments',
      'training_attendance',
      'training_session_notes',
      'training_certificates',
      'training_learning_outcomes',
      'training_learning_outcome_map'
    ])
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists "%s_all" on public.%I', tbl, tbl);
    execute format('create policy "%s_all" on public.%I for all to authenticated using (true) with check (true)', tbl, tbl);
  end loop;
end $$;

commit;
