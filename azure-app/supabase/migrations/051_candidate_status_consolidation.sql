-- ============================================================
-- 051 · Candidate status consolidation
-- ============================================================
-- Reduces candidates.status from 7 values to 5:
--
--   applicant → in_programme → placed → progressed
--        ↓
--   withdrawn (fallback at any stage)
--
-- Removed:
--   · 'enrolled'  — was a ghost state, never explicitly written
--   · 'completed' — redundant; workforce candidates are 'placed',
--                    non-workforce stay 'in_programme' until end
--
-- Also drops candidates.journey_stage entirely — it was a parallel
-- 10-value enum written by different actions (interviews, training)
-- that drifted from candidates.status. Now there is one source of
-- truth for candidate state.
--
-- Triggers from migration 046 are recreated to reference only the
-- new set of valid states.
-- ============================================================

-- ── 1. Backfill values that will be removed ──
-- 'enrolled' → 'applicant' (nobody was ever explicitly enrolled)
update public.candidates set status = 'applicant' where status = 'enrolled';

-- 'completed' → 'placed' if they have a placement, else 'in_programme'
update public.candidates set status = 'placed'
 where status = 'completed'
   and exists (select 1 from public.placements p where p.candidate_id = candidates.id);

update public.candidates set status = 'in_programme'
 where status = 'completed';

-- ── 2. Recreate the enum with only 5 values ──
-- Postgres cannot drop enum values; we create a new type and swap.
create type public.candidate_status_v2 as enum (
  'applicant', 'in_programme', 'placed', 'progressed', 'withdrawn'
);

alter table public.candidates
  alter column status drop default;

alter table public.candidates
  alter column status type public.candidate_status_v2
  using status::text::public.candidate_status_v2;

alter table public.candidates
  alter column status set default 'applicant';

alter table public.candidates
  alter column status set not null;

drop type public.candidate_status;
alter type public.candidate_status_v2 rename to candidate_status;

-- ── 3. Drop journey_stage column (single source of truth) ──
alter table public.candidates drop column if exists journey_stage;

-- The enum type itself may still exist. Drop it if nothing else uses it.
do $$ begin
  drop type public.candidate_journey_stage;
exception when others then null; end $$;

-- ── 4. Recreate auto-status trigger functions using only valid states ──

create or replace function public.auto_set_placed_on_placement()
returns trigger language plpgsql as $$
begin
  update public.candidates
     set status = 'placed'
   where id = NEW.candidate_id
     and status in ('applicant', 'in_programme');
  return NEW;
end $$;

create or replace function public.auto_set_progressed_on_12mo_retention()
returns trigger language plpgsql as $$
declare
  v_candidate_id uuid;
begin
  if NEW.timepoint = 'retention_12mo' and NEW.still_employed = true then
    select candidate_id into v_candidate_id
      from public.placements
     where id = NEW.placement_id;

    if v_candidate_id is not null then
      update public.candidates
         set status = 'progressed'
       where id = v_candidate_id
         and status = 'placed';
    end if;
  end if;
  return NEW;
end $$;

create or replace function public.auto_set_in_programme_on_baseline()
returns trigger language plpgsql as $$
begin
  if NEW.timepoint = 'baseline' and NEW.status in ('completed', 'reviewed') then
    update public.candidates
       set status = 'in_programme'
     where id = NEW.candidate_id
       and status = 'applicant';
  end if;
  return NEW;
end $$;

-- (auto_flag_regression_on_12mo_retention and
--  auto_create_followup_dispatches_on_placement are unchanged — they
--  don't reference the removed status values.)
