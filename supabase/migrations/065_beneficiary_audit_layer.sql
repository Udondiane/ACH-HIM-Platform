-- ============================================================
-- 065 · beneficiary audit layer
-- ============================================================
-- Fills the three audit gaps identified in the ICT walkthrough:
--   (a) field-level change log on candidates — who changed what when
--   (b) status transition timeline — timestamped applicant → in_programme
--       → placed → progressed | withdrawn history
--   (c) read-access log — who viewed which candidate record
--
-- (a) and (b) are automatic via Postgres triggers on the candidates
-- table — no application code changes required, every UPDATE anywhere
-- in the codebase is captured. (c) is a table plus a helper function
-- that server actions call from lib/audit/access-log.ts; existing
-- reads should be instrumented as we visit each server-side query.
-- ============================================================

-- ── (a) Field-level change log ─────────────────────────────────

create table if not exists public.candidate_change_log (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  changed_at    timestamptz not null default now(),
  changed_by    uuid references auth.users(id),
  field_name    text not null,
  old_value     text,
  new_value     text,
  change_source text default 'app'  -- 'app' | 'import' | 'admin_sql' | future
);

create index if not exists idx_ccl_candidate on public.candidate_change_log(candidate_id, changed_at desc);
create index if not exists idx_ccl_field on public.candidate_change_log(field_name, changed_at desc);

comment on table public.candidate_change_log is
  'One row per candidate field that changed on any UPDATE. Populated automatically by trg_candidates_change_log — no application code needed. Read via /candidates/[id] history panel.';

-- Trigger function: diff OLD vs NEW on candidates, insert one row per
-- changed column. Skips volatile bookkeeping fields (updated_at) so
-- the log stays readable. Captures the acting user from
-- auth.uid() where available.
create or replace function public.trg_candidates_change_log()
returns trigger language plpgsql as $$
declare
  acting uuid := auth.uid();
  col_name text;
  old_v text;
  new_v text;
  skip_cols text[] := array['updated_at', 'created_at', 'application_source_data'];
begin
  -- Iterate over every column in the candidates table.
  for col_name in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'candidates'
      and column_name <> all(skip_cols)
  loop
    execute format('select ($1).%I::text, ($2).%I::text', col_name, col_name)
      into old_v, new_v
      using OLD, NEW;
    if old_v is distinct from new_v then
      insert into public.candidate_change_log (candidate_id, changed_by, field_name, old_value, new_value)
      values (NEW.id, acting, col_name, old_v, new_v);
    end if;
  end loop;
  return NEW;
end$$;

drop trigger if exists trg_candidates_change_log on public.candidates;
create trigger trg_candidates_change_log
  after update on public.candidates
  for each row execute function public.trg_candidates_change_log();

-- ── (b) Status transition timeline ─────────────────────────────

create table if not exists public.candidate_status_transitions (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  from_status   public.candidate_status,
  to_status     public.candidate_status not null,
  changed_at    timestamptz not null default now(),
  changed_by    uuid references auth.users(id),
  reason        text
);

create index if not exists idx_cst_candidate on public.candidate_status_transitions(candidate_id, changed_at desc);

comment on table public.candidate_status_transitions is
  'Append-only log of every status change on candidates. Populated by trg_candidates_status_transition on any candidates.status UPDATE. Enables "time from enrolment to placement" and cohort-level lifecycle dashboards.';

create or replace function public.trg_candidates_status_transition()
returns trigger language plpgsql as $$
begin
  if OLD.status is distinct from NEW.status then
    insert into public.candidate_status_transitions (candidate_id, from_status, to_status, changed_by)
    values (NEW.id, OLD.status, NEW.status, auth.uid());
  end if;
  return NEW;
end$$;

drop trigger if exists trg_candidates_status_transition on public.candidates;
create trigger trg_candidates_status_transition
  after update of status on public.candidates
  for each row execute function public.trg_candidates_status_transition();

-- Seed a synthetic row for every existing candidate so the timeline
-- doesn't look empty at first render. from_status = null, to_status
-- = their current status, changed_at = their created_at.
insert into public.candidate_status_transitions (candidate_id, from_status, to_status, changed_at)
select id, null, status, created_at
from public.candidates
where not exists (
  select 1 from public.candidate_status_transitions t where t.candidate_id = candidates.id
);

-- ── (c) Read-access log ────────────────────────────────────────

create table if not exists public.candidate_access_log (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  accessed_at    timestamptz not null default now(),
  accessed_by    uuid references auth.users(id),
  access_type    text not null default 'view',  -- 'view' | 'export' | 'report_generated'
  route          text,                          -- e.g. '/candidates/[id]'
  request_id     text                           -- optional correlation id
);

create index if not exists idx_cal_candidate on public.candidate_access_log(candidate_id, accessed_at desc);
create index if not exists idx_cal_actor on public.candidate_access_log(accessed_by, accessed_at desc);

comment on table public.candidate_access_log is
  'Row-level access log for beneficiary records. Not auto-populated — server-side reads must call logCandidateAccess() from lib/audit/access-log.ts. Underpins GDPR data-subject-access-request responses ("show me every access of my record").';

-- ── Enable RLS on all three ────────────────────────────────────
-- Reads restricted to ACH staff (same policy as other beneficiary-
-- adjacent tables). Inserts happen server-side via the triggers or
-- via the log helper.

alter table public.candidate_change_log         enable row level security;
alter table public.candidate_status_transitions enable row level security;
alter table public.candidate_access_log         enable row level security;

drop policy if exists "ccl_ach_read" on public.candidate_change_log;
create policy "ccl_ach_read" on public.candidate_change_log
  for select using (public.is_ach_staff());

drop policy if exists "cst_ach_read" on public.candidate_status_transitions;
create policy "cst_ach_read" on public.candidate_status_transitions
  for select using (public.is_ach_staff());

drop policy if exists "cal_ach_read" on public.candidate_access_log;
create policy "cal_ach_read" on public.candidate_access_log
  for select using (public.is_ach_staff());
