# Backup, restore, and destructive-migration safeguards

Written after the 2026-07-29 data-loss incident (migration 059
destroyed 157 rows of live baseline data). This document describes
the three layers that now stand between the platform and a repeat
event.

---

## Layer 1 — Nightly automated backup

**Where:** `.github/workflows/nightly-backup.yml`

**What it does:** every night at **02:30 UTC** (03:30 BST), GitHub
Actions runs `pg_dump` against the production Supabase database and
publishes a compressed data-only dump as a GitHub Release asset. The
dump covers the 14 impact-measurement tables (assessments, responses,
candidates, consent, interviews, outcomes, quotes, cohorts,
placements, and their linking tables).

Retention is **30 days rolling** — five times the Supabase Pro PITR
window, and doesn't require a paid Supabase tier.

**One-time setup required.** In the GitHub repo:

1. Settings → Secrets and variables → Actions → New repository secret
2. Name: `SUPABASE_DB_URL`
3. Value: `postgresql://postgres:YOUR_DB_PASSWORD@db.qugpvhasqtbhmqrmjbgy.supabase.co:5432/postgres`
   (the password is set at Supabase Dashboard → Settings → Database → Connection string)
4. Save

To manually trigger a backup right now (e.g. before running a big
migration), go to the Actions tab → "Nightly Supabase backup" → Run
workflow.

---

## Layer 2 — Restoring from a backup

### From a GitHub Release asset

```bash
# 1. Find the release
gh release list --limit 30 | grep '^backup-'

# 2. Download the backup you want
gh release download backup-20260830-0230 -p '*.sql.gz'

# 3. Decompress
gunzip him-backup-20260830-0230.sql.gz

# 4. Restore into a shadow project first, NEVER directly into prod.
#    Create a new Supabase project, run all migrations, then:
psql "postgresql://postgres:SHADOW_PASSWORD@db.SHADOW_REF.supabase.co:5432/postgres" \
     < him-backup-20260830-0230.sql

# 5. Verify the rows exist in the shadow project
psql "postgresql://postgres:SHADOW_PASSWORD@db.SHADOW_REF.supabase.co:5432/postgres" \
     -c "SELECT count(*) FROM assessment_responses;"

# 6. If verification passes, and you want to bring specific rows back
#    into prod, use \copy from the shadow to CSV then \copy into prod.
#    Never truncate-and-restore into prod — you may destroy rows
#    written since the backup.
```

### Restore a single table from an ad-hoc dump

For pre-migration snapshots taken via the pre-migration guard
(Layer 3), the file is a plain `.sql` in Supabase Storage. Same
procedure: download, decompress, restore into a shadow project,
verify, then \copy selective rows into prod.

---

## Layer 3 — Migration safety CI gate

**Where:** `.github/workflows/migration-safety.yml`

**What it does:** every PR that adds a `.sql` file under
`supabase/migrations/` is scanned. If the file contains any of the
following patterns, the CI check fails and the PR cannot be merged:

- `DELETE FROM ... ;` without a `WHERE` clause
- `TRUNCATE TABLE ...`
- `DROP TABLE ...`
- `ALTER TABLE ... DROP COLUMN ...`

This is the exact pattern that let migration 059 destroy 157 rows on
2026-07-29 — the CI gate now catches it at PR time before the SQL
ever touches production.

### Approved-destructive escape hatch

Some migrations genuinely need to delete data (e.g. wiping a test
dataset before handover). To allow one, add this comment somewhere
in the migration file:

```sql
-- @approved-destructive
```

Best practice when you do:

1. Take a manual backup first (Actions → Nightly Supabase backup →
   Run workflow). Wait for it to finish.
2. Write the destructive SQL guarded by a `DO $$ ... IF ... THEN
   RAISE EXCEPTION ... END IF; END $$` block that refuses to run
   if content exists.
3. Include the ticket / GitHub issue reference in the comment so
   the reason is discoverable later.

Example of a safe destructive pattern:

```sql
-- @approved-destructive — ticket ACH-123, wiping dev fixtures
do $$
declare n integer;
begin
  select count(*) into n from public.assessment_responses
    where assessment_id in (
      select id from public.assessments where assessor_id is null
    );
  if n > 200 then
    raise exception 'Refusing to delete % rows — expected ≤ 200 dev fixtures', n;
  end if;
  delete from public.assessment_responses
    where assessment_id in (
      select id from public.assessments where assessor_id is null
    );
end $$;
```

---

## Quarterly restore drill (required)

At the start of each quarter (Jan, Apr, Jul, Oct):

1. Open the latest backup release
2. Follow the restore procedure into a fresh Supabase shadow project
3. Verify: `SELECT count(*) FROM assessment_responses;` matches the
   count from prod on the backup date
4. Delete the shadow project
5. Log the drill in the operations calendar (date + outcome)

The purpose of the drill is not the backup itself — it's to confirm
that a real recovery is achievable without hitting an unknown
blocker (expired DB password, changed schema, etc.).

---

## What is NOT backed up (and why)

- **Reference data** (`factors`, `indicators`, `domains`,
  `activity_factors`) — these come from migration files and can be
  recovered by re-running the reseed migration.
- **Audit tables** (`candidate_change_log` etc.) — self-recovering
  from future writes; historical loss is bearable.
- **Storage bucket audio files** (`assessment-evidence`) — a
  separate storage-side backup job is needed. See TODO in this
  file.
- **User accounts** (`auth.users`) — Supabase Auth manages its own
  schema; ICT admin can re-invite users if lost.

---

## What if the nightly backup itself fails?

Failed workflow runs send an email to the GitHub repo admin. If a
run fails:

1. Check the run's log — usually a bad `SUPABASE_DB_URL` (password
   rotated?) or a temporary network blip.
2. Fix the underlying cause.
3. Manually re-run: Actions tab → "Nightly Supabase backup" → Run
   workflow.
4. Verify the release was created.

Two consecutive failures = a real problem. Escalate to Enobong /
current dev partner immediately.
