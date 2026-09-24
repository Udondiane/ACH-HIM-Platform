-- ============================================================
-- 069 · Reseed project weights per finalised scoring logic
-- ============================================================
-- Applies the two-step derivation finalised on 2026-09-24 (schema.ts):
--
--   Step 1 · project type from classification questionnaire total
--            (methodology doc §5.2). Fallback to coreCount-based
--            inference when the questionnaire is not filled.
--
--   Step 2 · weight ratio from Delphi Round 1 (July 2026) defaults:
--            depth   → d2_1 unless 3 Core + 0 Optional (→ d3_1)
--            breadth → b2_1 unless 0 Core + 3+ Optional (→ b3_1)
--            hybrid  → d1_1 with hybrid_option='A' (equal weights)
--
-- OVERRIDE-LOCK GUARD: this migration is idempotent and SKIPS any
-- project whose weight_ratio has been explicitly overridden away
-- from the previously-derived value. The presumption: if an operator
-- manually changed the ratio, respect that intent and do not undo it.
--
-- Overrides are detected by comparing the current weight_ratio to
-- the ratio the OLD lookup-table derivation would have produced from
-- the same capability counts. Projects where the current ratio
-- matches the old derivation are candidates for recompute; any
-- mismatch is treated as a manual override and preserved.
--
-- Every recompute writes to audit_log with before/after values so
-- ACH can review what changed.
-- ============================================================

do $$
declare
  proj                    record;
  core_count              integer;
  optional_count          integer;
  q_total                 integer;
  old_derived_ratio       text;
  new_type                text;
  new_ratio               text;
  new_hybrid_option       text;
  q1v                     integer;
  q2v                     integer;
  q3v                     integer;
  q4v                     integer;
  is_manual_override      boolean;
  changes_count           integer := 0;
  preserved_count         integer := 0;
begin
  for proj in
    select id, type, weight_ratio, hybrid_option,
           classification_q1, classification_q2, classification_q3, classification_q4,
           classification_total
      from public.projects
  loop
    -- Count core / optional capabilities for this project
    select
      coalesce(count(*) filter (where role = 'core'), 0),
      coalesce(count(*) filter (where role = 'optional'), 0)
      into core_count, optional_count
      from public.project_capabilities
      where project_id = proj.id;

    -- Compute classification_total from stored A/B/C answers.
    -- Map: A=2, C=1, B=0. Requires all four questions answered.
    q1v := case proj.classification_q1 when 'A' then 2 when 'C' then 1 when 'B' then 0 else null end;
    q2v := case proj.classification_q2 when 'A' then 2 when 'C' then 1 when 'B' then 0 else null end;
    q3v := case proj.classification_q3 when 'A' then 2 when 'C' then 1 when 'B' then 0 else null end;
    q4v := case proj.classification_q4 when 'A' then 2 when 'C' then 1 when 'B' then 0 else null end;
    q_total := case
      when q1v is not null and q2v is not null and q3v is not null and q4v is not null
        then q1v + q2v + q3v + q4v
      else null
    end;

    -- Step 1: derive new type
    if q_total is not null then
      new_type := case
        when q_total >= 6 then 'depth'
        when q_total >= 3 then 'hybrid'
        else 'breadth'
      end;
    else
      new_type := case when core_count = 0 then 'breadth' else 'depth' end;
    end if;

    -- Step 2: derive new weight_ratio + hybrid_option
    if new_type = 'hybrid' then
      new_ratio := 'd1_1';
      new_hybrid_option := 'A';
    elsif new_type = 'depth' then
      new_ratio := case when core_count = 3 and optional_count = 0 then 'd3_1' else 'd2_1' end;
      new_hybrid_option := null;
    else
      new_ratio := case when core_count = 0 and optional_count >= 3 then 'b3_1' else 'b2_1' end;
      new_hybrid_option := null;
    end if;

    -- Manual-override detection: compute what the OLD lookup-table would
    -- have produced from the same counts. If the current ratio matches
    -- that, no override was made — safe to recompute. If not, preserve.
    old_derived_ratio := case
      when core_count = 0 and optional_count = 0 then 'd3_1'
      when core_count = 0 then case when optional_count >= 3 then 'b3_1' else 'b2_1' end
      when core_count = 1 then case
        when optional_count = 0 then 'd5_1'
        when optional_count <= 2 then 'd3_1'
        else 'd2_1'
      end
      when core_count = 2 then case
        when optional_count = 0 then 'd4_1'
        when optional_count <= 2 then 'd3_1'
        else 'd2_1'
      end
      when core_count = 3 then case
        when optional_count = 0 then 'd3_1'
        when optional_count = 1 then 'd2_1'
        else 'd1_1'
      end
      else 'd3_1'
    end;
    is_manual_override := proj.weight_ratio <> old_derived_ratio;

    if is_manual_override then
      preserved_count := preserved_count + 1;
      continue;
    end if;

    -- Only apply if something actually changes
    if proj.type = new_type
       and proj.weight_ratio = new_ratio
       and coalesce(proj.hybrid_option, '') = coalesce(new_hybrid_option, '')
       and (q_total is null or proj.classification_total is not distinct from q_total) then
      continue;
    end if;

    -- Audit the change
    insert into public.audit_log (table_name, row_id, action, before_data, after_data)
    values (
      'projects', proj.id, 'update',
      jsonb_build_object(
        'type', proj.type,
        'weight_ratio', proj.weight_ratio,
        'hybrid_option', proj.hybrid_option,
        'classification_total', proj.classification_total
      ),
      jsonb_build_object(
        'type', new_type,
        'weight_ratio', new_ratio,
        'hybrid_option', new_hybrid_option,
        'classification_total', q_total,
        'source', 'migration_069_reseed'
      )
    );

    -- Apply the recompute
    update public.projects
       set type = new_type,
           weight_ratio = new_ratio,
           hybrid_option = new_hybrid_option,
           classification_total = coalesce(q_total, classification_total),
           updated_at = now()
     where id = proj.id;

    changes_count := changes_count + 1;
  end loop;

  raise notice
    'migration 069 · reseeded % project(s); preserved % project(s) with manual overrides',
    changes_count, preserved_count;
end $$;
