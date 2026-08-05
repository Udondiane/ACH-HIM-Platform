#!/usr/bin/env node
/**
 * Applies every SQL migration under supabase/migrations/*.sql (copied
 * verbatim from the parent app) against the Azure Postgres connection
 * in DATABASE_URL.
 *
 * Filters out lines that reference Supabase-only constructs
 * (`auth.uid()`, `auth.jwt()`, `storage.objects`, `is_ach_staff()`)
 * so the script survives on standard Postgres. Those pieces belong
 * to the RLS rewrite tracked in AZURE-HANDOVER.md.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npm run db:migrate
 *   DATABASE_URL=postgres://... npm run db:migrate -- --dry-run
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const argv = new Set(process.argv.slice(2));
const dryRun = argv.has('--dry-run');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const migrationsDir = resolve(root, 'supabase/migrations');

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
  // Drop entire RLS-policy blocks that reference auth functions
  return body
    // Remove `create policy ... using ( ... auth.uid() ... );` (multi-line)
    .replace(/create\s+policy[^;]*auth\.\w+\(\)[^;]*;/gis, '-- [skipped RLS policy referencing auth.uid()]')
    .replace(/create\s+policy[^;]*is_ach_staff\(\)[^;]*;/gis, '-- [skipped RLS policy referencing is_ach_staff()]')
    .replace(/alter\s+table[^;]*(enable|disable)\s+row\s+level\s+security\s*;/gi, '-- [RLS toggle deferred to azure-post-migrate.sql]')
    // Skip create-function definitions that reference auth.uid()
    .replace(/create\s+or\s+replace\s+function[^$]*\$\$[^$]*auth\.uid\(\)[^$]*\$\$[^;]*;/gis, '-- [skipped function referencing auth.uid()]')
    // Skip grants to Supabase roles
    .replace(/grant[^;]*to\s+(anon|authenticated|service_role)[^;]*;/gi, '-- [skipped Supabase role grant]');
}

let ok = 0, skipped = 0;
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
    process.stdout.write(` FAILED\n`);
    console.error(`  ${e.message}`);
    if (argv.has('--stop-on-error')) process.exit(1);
  }
}

console.log(`\n${ok} applied · ${skipped} already-applied · ${files.length - ok - skipped} failed`);
await pool.end();
