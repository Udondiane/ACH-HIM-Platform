-- 052 · Cohort auto-status
--
-- Problem: cohort.status was manually set on the create form (defaulting to
-- 'planned') and never touched again. In practice this meant every cohort
-- carried the wrong badge — the IKEA cohort still read 'planned' a month
-- after its start date, because nothing in the app moved it.
--
-- Fix: derive status from the underlying facts.
--
--   cancelled     manual sentinel (Cancel button)                — never overwritten
--   planned       no candidates linked yet                       — default
--   recruiting    candidates linked, start_date in the future    — or start_date null
--   in_progress   start_date has passed, cohort still open       — end_date null OR in future
--   completed     end_date has passed  OR
--                 every linked candidate is placed / progressed / withdrawn
--
-- Recomputation runs whenever:
--   · the cohort itself is inserted/updated (dates or status change)
--   · a candidate joins/leaves via cohort_candidates
--   · a candidate's own status changes (affects completed rule)
--
-- 'planned' and any other computed value on cohorts.status can be freely
-- overwritten by the trigger. 'cancelled' is treated as a sticky manual
-- choice and never touched.

-- ── Core function: recompute one cohort's status ──
create or replace function public.recompute_cohort_status(cohort_id_in uuid)
returns void language plpgsql as $$
declare
  r_start      date;
  r_end        date;
  r_status     public.cohort_status;
  linked_count int;
  active_count int;
  new_status   public.cohort_status;
  today        date := current_date;
begin
  select start_date, end_date, status
    into r_start, r_end, r_status
  from public.cohorts
  where id = cohort_id_in;

  if not found then
    return;
  end if;

  -- Manual sentinel: never overwrite a cancelled cohort.
  if r_status = 'cancelled' then
    return;
  end if;

  select count(*) into linked_count
  from public.cohort_candidates cc
  where cc.cohort_id = cohort_id_in;

  select count(*) into active_count
  from public.cohort_candidates cc
  join public.candidates c on c.id = cc.candidate_id
  where cc.cohort_id = cohort_id_in
    and c.status not in ('placed', 'progressed', 'withdrawn');

  if linked_count = 0 then
    new_status := 'planned';
  elsif r_end is not null and today > r_end then
    new_status := 'completed';
  elsif linked_count > 0 and active_count = 0 then
    -- Every candidate has reached a terminal state — the cohort is done
    -- even if the calendar end_date hasn't been passed yet.
    new_status := 'completed';
  elsif r_start is null or today < r_start then
    new_status := 'recruiting';
  else
    new_status := 'in_progress';
  end if;

  if new_status <> r_status then
    update public.cohorts
       set status = new_status
     where id = cohort_id_in;
  end if;
end $$;

-- ── Trigger 1: cohorts row changes ──
-- Handles the create case + any manual edit of start/end dates.
-- IMPORTANT: use an AFTER trigger so the row exists when we recompute,
-- and guard against loops by checking whether status was the only thing
-- that actually changed via the recomputation itself (a no-op update is
-- cheap and the recursive call will find no delta).
create or replace function public.trg_cohorts_recompute_status()
returns trigger language plpgsql as $$
begin
  perform public.recompute_cohort_status(NEW.id);
  return NEW;
end $$;

drop trigger if exists trg_cohort_auto_status on public.cohorts;
create trigger trg_cohort_auto_status
  after insert or update of start_date, end_date, status on public.cohorts
  for each row execute function public.trg_cohorts_recompute_status();

-- ── Trigger 2: cohort_candidates changes ──
-- Adding the first candidate flips planned → recruiting; removing the
-- last one flips it back.
create or replace function public.trg_cohort_cands_recompute_status()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    perform public.recompute_cohort_status(OLD.cohort_id);
    return OLD;
  else
    perform public.recompute_cohort_status(NEW.cohort_id);
    return NEW;
  end if;
end $$;

drop trigger if exists trg_cohort_cands_auto_status on public.cohort_candidates;
create trigger trg_cohort_cands_auto_status
  after insert or delete on public.cohort_candidates
  for each row execute function public.trg_cohort_cands_recompute_status();

-- ── Trigger 3: candidate status changes ──
-- When a candidate is placed / progressed / withdrawn, every cohort
-- they're in may now be 'completed'. Recompute each.
create or replace function public.trg_candidates_recompute_cohort_status()
returns trigger language plpgsql as $$
declare
  cohort_row record;
begin
  if NEW.status is distinct from OLD.status then
    for cohort_row in
      select cohort_id from public.cohort_candidates where candidate_id = NEW.id
    loop
      perform public.recompute_cohort_status(cohort_row.cohort_id);
    end loop;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_candidates_cohort_auto_status on public.candidates;
create trigger trg_candidates_cohort_auto_status
  after update of status on public.candidates
  for each row execute function public.trg_candidates_recompute_cohort_status();

-- ── One-time backfill ──
-- Fix every existing cohort (this is the line that flips IKEA to
-- in_progress).
do $$
declare
  cohort_row record;
begin
  for cohort_row in select id from public.cohorts loop
    perform public.recompute_cohort_status(cohort_row.id);
  end loop;
end $$;
