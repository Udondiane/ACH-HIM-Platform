# Migration squash · approach for Azure cutover

**Status:** Not yet executed. This document is the plan.
**Trigger:** Executed during the Azure migration cutover window, not before.
**Owner:** Whoever runs the cutover.

---

## Why we haven't squashed the historical migrations already

`supabase/migrations/` currently holds 44 numbered SQL files representing the schema's evolution across the 24-month KTP. Each was written to apply against a database that already had the previous migrations run.

Squashing them into a single "initial schema" file today would risk drift between the hand-written squash and the actual current state of the production database. Any manual tweak applied through the Supabase SQL editor (bug fix, index tune, seed correction) that never made it back into a migration file would be missing from the squash and silently lost.

**The safe path is to squash from the live database, not from the migration history.** That's what this document lays out.

## When squashing is safe

At the moment we spin up a fresh Azure Database for PostgreSQL instance. The new database has no history. All it needs is a single artefact that puts it into the exact same state the current production database is in.

`pg_dump --schema-only` produces exactly that artefact from the live database.

## Procedure at cutover

1. Freeze writes on the current production database (put Supabase into a read-only role or take a maintenance window)
2. Run `pg_dump --schema-only --no-owner --no-privileges --file=001_initial_schema.sql <SUPABASE_CONNECTION_STRING>`
3. Manually strip any Supabase-specific artefacts from the resulting file that Azure Postgres doesn't understand — most commonly:
   - `auth` schema references (replace with the `staff` table, which by that stage exists in a preceding migration under this workstream)
   - `storage` schema references (Blob Storage handles this separately)
   - Any Supabase-managed extensions we don't use on Azure
4. Copy the cleaned `001_initial_schema.sql` into `supabase/migrations/` in a new subfolder `azure/`
5. Move the 44 historical migrations to `supabase/migrations/archive/` — they stay in git history but are no longer on the apply path
6. Apply `001_initial_schema.sql` against the fresh Azure Postgres
7. Run the data-only dump (`pg_dump --data-only`) against Supabase and restore against Azure Postgres
8. Row-count verification: for each table, `SELECT count(*)` from both sides must match
9. Continue Azure migration with any post-migration schema changes as new numbered files starting at 002

## What the 44 historical migrations become

They stay in the git repo forever under `supabase/migrations/archive/`. They are useful for:

- Anyone wanting to understand how a specific column or policy came to be (`git blame` the archive)
- Auditors wanting to see the evolution of the data model
- Academic write-ups of the KTP describing methodology iteration

They are NOT useful for:

- Provisioning a new database (use `001_initial_schema.sql` instead)
- Onboarding a new engineer to the current schema (they read the squash, not the history)

## What we do NOT do

- We do NOT hand-write a consolidated schema by reading the 44 migrations manually. That is drift-prone and error-prone.
- We do NOT squash the migrations while HIM is still on Supabase. Any post-squash write to the DB would land in a schema whose migration file no longer accurately describes it.
- We do NOT delete the 44 historical migrations. They are the schema's audit trail.

## Rollback

If the Azure database has an integrity problem post-cutover, roll back by pointing DNS at the frozen Supabase deployment. The Supabase instance and its 44-migration history remain intact for 30 days after cutover. No data has been destroyed by the squash.
