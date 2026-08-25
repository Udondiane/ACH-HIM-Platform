#!/usr/bin/env node
/**
 * Applies every SQL migration under ../supabase/migrations/*.sql (the
 * PARENT APP's migrations — single source of truth, no drift) against
 * the Azure Postgres connection in DATABASE_URL, then applies the
 * required azure-post-migrate.sql, then hard-gates on RLS being
 * enabled across every public table.
 *
 * WHY the sanitiser exists:
 * The parent app's migrations reference Supabase-only constructs
 * (`auth.uid()`, `auth.role()`, `is_ach_staff()`, role grants to
 * `anon`/`authenticated`/`service_role`, `storage.objects`). Vanilla
 * Postgres rejects them. sanitise() strips those constructs so the
 * SQL parses.
 *
 * WHY the hard gate exists:
 * sanitise() also strips every `enable row level security` toggle
 * and every policy that references those Supabase predicates. Without
 * recovering that authorisation surface AFTER the migration loop, the
 * Azure database would run with RLS disabled on every table — silently,
 * with no warning at the app layer.
 *
 * The gate:
 *   1. Applies supabase/azure-post-migrate.sql (fail-safe predicate
 *      stubs + `enable row level security` on every table + deny-all
 *      floor policy).
 *   2. Verifies `pg_tables.rowsecurity` = true on every public table.
 *   3. Exits non-zero if any table has RLS off.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npm run db:migrate
 *   DATABASE_URL=postgres://... npm run db:migrate -- --dry-run
 *   DATABASE_URL=postgres://... npm run db:migrate -- --skip-parent-app
 *       (uses the local azure-app/supabase/migrations copy — legacy
 *        path, only for emergency rollback; drifts silently otherwise)
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const argv = new Set(process.argv.slice(2));
const dryRun = argv.has('--dry-run');
const skipParent = argv.has('--skip-parent-app');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// Source of truth: the parent app's supabase/migrations. The local
// azure-app/supabase/migrations copy is a stale mirror kept only for
// emergency rollback; drift between them silently regresses authz
// unless caught.
const parentMigrationsDir = resolve(root, '../supabase/migrations');
const localMigrationsDir  = resolve(root, 'supabase/migrations');
const migrationsDir = skipParent ? localMigrationsDir : parentMigrationsDir;

if (!existsSync(migrationsDir)) {
  console.error(`Migrations directory not found: ${migrationsDir}`);
  process.exit(2);
}

const postMigrate = resolve(root, 'supabase/azure-post-migrate.sql');
if (!existsSync(postMigrate)) {
  console.error(`FATAL: azure-post-migrate.sql is missing at ${postMigrate}.`);
  console.error('That file is required — it recovers the RLS posture stripped by sanitise().');
  console.error('Without it the Azure DB would end up with row-level security disabled on every table.');
  process.exit(2);
}

const conn = process.env.DATABASE_URL;
if (!conn) { console.error('DATABASE_URL is not set'); process.exit(2); }

const pool = new pg.Pool({
  connectionString: conn,
  ssl: conn.includes('azure.com') || conn.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
});

// Ensure a tracking table so re-runs skip already-applied migrations.
await pool.query(`
  create table if not exists _azure_migration_history (
    id serial primary key,
    filename text unique not null,
    applied_at timestamptz not null default now()
  );
`);

const applied = new Set(
  (await pool.query(`select filename from _azure_migration_history`)).rows.map(r => r.filename),
);

const files = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();

/** Strip Supabase-only clauses so vanilla Postgres accepts the SQL. */
function sanitise(body) {
  return body
    .replace(/create\s+policy[^;]*auth\.\w+\(\)[^;]*;/gis, '-- [skipped RLS policy referencing auth.uid()]')
    .replace(/create\s+policy[^;]*is_ach_staff\(\)[^;]*;/gis, '-- [skipped RLS policy referencing is_ach_staff()]')
    .replace(/alter\s+table[^;]*(enable|disable)\s+row\s+level\s+security\s*;/gi, '-- [RLS toggle deferred to azure-post-migrate.sql]')
    .replace(/create\s+or\s+replace\s+function[^$]*\$\$[^$]*auth\.uid\(\)[^$]*\$\$[^;]*;/gis, '-- [skipped function referencing auth.uid()]')
    .replace(/grant[^;]*to\s+(anon|authenticated|service_role)[^;]*;/gi, '-- [skipped Supabase role grant]');
}

// ── 1. Migration loop ─────────────────────────────────────
console.log(`▸ migrations dir: ${migrationsDir}`);
if (skipParent) {
  console.warn('⚠ --skip-parent-app: using local azure-app/supabase/migrations copy. May be stale.');
}

let ok = 0, skipped = 0, failed = 0;
for (const file of files) {
  if (applied.has(file)) { skipped++; continue; }
  const path = resolve(migrationsDir, file);
  const raw = await readFile(path, 'utf8');
  const cleaned = sanitise(raw);
  process.stdout.write(`▸ ${file}${dryRun ? ' (dry-run)' : ''}...`);
  if (dryRun) { process.stdout.write(' would apply\n'); continue; }
  try {
    await pool.query('begin');
    await pool.query(cleaned);
    await pool.query('insert into _azure_migration_history (filename) values ($1)', [file]);
    await pool.query('commit');
    process.stdout.write(' ok\n');
    ok++;
  } catch (e) {
    await pool.query('rollback');
    process.stdout.write(' FAILED\n');
    console.error(`  ${e.message}`);
    failed++;
    if (argv.has('--stop-on-error')) {
      await pool.end();
      process.exit(1);
    }
  }
}

console.log(`\n${ok} applied · ${skipped} already-applied · ${failed} failed`);

// ── 2. Apply azure-post-migrate.sql ───────────────────────
//
// This is not optional. Skipping it leaves the DB with RLS disabled
// on every table. Even in --dry-run we surface what would happen.
console.log('\n▸ applying azure-post-migrate.sql (recovers RLS posture)...');
if (dryRun) {
  console.log('  (dry-run — would apply)');
} else {
  const postSql = await readFile(postMigrate, 'utf8');
  try {
    await pool.query(postSql);
    console.log('  ok');
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    console.error('\n██ FATAL — azure-post-migrate.sql did not apply.');
    console.error('   The Azure database is in an unsafe state and the migration');
    console.error('   is aborting. Do not run the app against this DB.');
    await pool.end();
    process.exit(1);
  }
}

// ── 3. Hard gate — RLS must be enabled on every public table ─
console.log('\n▸ hard gate: verifying RLS is enabled on every public table...');
if (dryRun) {
  console.log('  (dry-run — skipping hard gate)');
} else {
  const gate = await pool.query(`
    select tablename
      from pg_tables
     where schemaname = 'public'
       and rowsecurity = false
       and tablename <> '_azure_migration_history'
     order by tablename
  `);
  if (gate.rows.length > 0) {
    console.error('\n██ FATAL — the following tables have row-level security DISABLED:');
    for (const row of gate.rows) console.error(`   • ${row.tablename}`);
    console.error('\n   This means anyone able to reach the DB can read every row.');
    console.error('   The migration is refusing to complete. Fix by extending');
    console.error('   azure-post-migrate.sql to cover these tables and re-run.');
    await pool.end();
    process.exit(1);
  }
  console.log(`  ok — RLS enabled on all ${(await pool.query("select count(*) c from pg_tables where schemaname='public'")).rows[0].c} public tables`);
}

await pool.end();

if (failed > 0) process.exit(1);
