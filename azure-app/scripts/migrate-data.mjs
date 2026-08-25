#!/usr/bin/env node
/**
 * One-time data migration: Supabase Postgres → Azure Database for
 * PostgreSQL Flexible Server.
 *
 * Two-stage flow:
 *   1. Dump Supabase using pg_dump (data only — schema is provisioned
 *      by scripts/migrate.mjs which runs the app's own migrations).
 *   2. Restore the dump into Azure Postgres.
 *
 * This delegates to Postgres tooling for correctness: pg_dump handles
 * type coercion, JSON columns, arrays, foreign key ordering, and
 * enums cleanly. Custom app-level export scripts get all of that
 * wrong sooner or later.
 *
 * Prereqs (vendor day-one):
 *   - pg_dump + psql on PATH (>= 15, matching Azure PG major version)
 *   - SUPABASE_DB_URL   e.g. postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres
 *   - AZURE_DB_URL      e.g. postgresql://achhim@ach-him-pg.postgres.database.azure.com:5432/postgres?sslmode=require
 *
 * Usage:
 *   node scripts/migrate-data.mjs --step=schema     # apply schema (parent app's migrations)
 *   node scripts/migrate-data.mjs --step=dump       # pg_dump Supabase (data only)
 *   node scripts/migrate-data.mjs --step=restore    # pg_restore into Azure (RLS bypassed via session_replication_role=replica)
 *   node scripts/migrate-data.mjs --step=finalize   # apply azure-finalize.sql (deny-all restrictive policies)
 *   node scripts/migrate-data.mjs --step=verify     # row-count parity across every public table
 *   node scripts/migrate-data.mjs --step=all        # schema → dump → restore → finalize → verify
 *
 * The steps are individually resumable — if `restore` fails on one
 * table you can fix it and re-run just `restore` without re-dumping.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DUMP_DIR = join(__dirname, '..', '.migration-artifacts');
const DATA_DUMP = join(DUMP_DIR, 'supabase-data.dump');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const step = args.step ?? 'all';

function require(name, value) {
  if (!value) {
    console.error(`✗ Missing env var ${name}`);
    process.exit(1);
  }
  return value;
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function ensureDumpDir() {
  if (!existsSync(DUMP_DIR)) mkdirSync(DUMP_DIR, { recursive: true });
}

function which(bin) {
  const r = spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// The Supabase-specific schemas we DON'T want to migrate — they're
// managed by Supabase itself. Azure Postgres won't have `auth.*` and
// doesn't need it (we use Entra + a shim, not Supabase Auth).
const EXCLUDE_SCHEMAS = ['auth', 'storage', 'graphql', 'realtime', 'supabase_migrations', 'vault', 'extensions', 'net', 'pgsodium', 'pgsodium_masks'];

function pgDumpArgs(url) {
  const args = ['--dbname=' + url, '--data-only', '--format=custom', '--no-owner', '--no-acl', '--no-comments', '--verbose'];
  for (const s of EXCLUDE_SCHEMAS) args.push(`--exclude-schema=${s}`);
  return args;
}

function pgRestoreArgs(url) {
  return [
    '--dbname=' + url,
    '--data-only',
    '--no-owner',
    '--no-acl',
    '--single-transaction',
    '--disable-triggers',   // FK-safe insert; re-enabled after commit
    '--verbose',
    DATA_DUMP,
  ];
}

// On Azure managed Postgres you are not superuser, so pg_restore's
// --disable-triggers cannot fully bypass FK triggers and RLS. Setting
// session_replication_role=replica in a wrapper script achieves the
// same effect: FK trigger checks skipped, RLS effectively bypassed
// for BYPASSRLS-eligible users. Set this via a PGOPTIONS env var so
// pg_restore's session picks it up.
function pgRestoreEnv() {
  return {
    ...process.env,
    // -c "set session_replication_role = 'replica'" applied on connect
    PGOPTIONS: `${process.env.PGOPTIONS ?? ''} -c session_replication_role=replica`.trim(),
  };
}

function stepDump() {
  const src = require('SUPABASE_DB_URL', process.env.SUPABASE_DB_URL);
  if (!which('pg_dump')) {
    console.error('✗ pg_dump not on PATH. Install postgresql-client matching your Azure PG version.');
    process.exit(1);
  }
  ensureDumpDir();
  log('Dumping Supabase data → ' + DATA_DUMP);
  const r = spawnSync('pg_dump', pgDumpArgs(src), { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  const size = statSync(DATA_DUMP).size;
  log(`Dump complete (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

function stepSchema() {
  // Runs the app's own migrations against Azure Postgres. This creates
  // the schema before we restore data into it.
  log('Applying app migrations to Azure Postgres...');
  const r = spawnSync('node', [join(__dirname, 'migrate.mjs')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: require('AZURE_DB_URL', process.env.AZURE_DB_URL),
    },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  log('Schema ready.');
}

function stepRestore() {
  const dst = require('AZURE_DB_URL', process.env.AZURE_DB_URL);
  if (!existsSync(DATA_DUMP)) {
    console.error('✗ No dump found — run --step=dump first.');
    process.exit(1);
  }
  if (!which('pg_restore')) {
    console.error('✗ pg_restore not on PATH.');
    process.exit(1);
  }
  log('Restoring dump → Azure Postgres (session_replication_role=replica)');
  const r = spawnSync('pg_restore', pgRestoreArgs(dst), {
    stdio: 'inherit',
    env: pgRestoreEnv(),
  });
  if (r.status !== 0) {
    console.error('✗ pg_restore returned non-zero. Common causes: RLS still active (session_replication_role=replica requires BYPASSRLS or superuser role — check your AZURE_DB_URL user), schema drift (rerun --step=schema), duplicate rows (target must be empty), FK ordering.');
    process.exit(r.status ?? 1);
  }
  log('Restore complete.');
}

function stepFinalize() {
  // Apply azure-finalize.sql — adds the last-resort deny-all
  // restrictive policy on every public table. Must run AFTER
  // stepRestore has loaded data, otherwise pg_restore is blocked.
  const dst = require('AZURE_DB_URL', process.env.AZURE_DB_URL);
  const finalizePath = join(__dirname, '..', 'supabase', 'azure-finalize.sql');
  if (!existsSync(finalizePath)) {
    console.error(`✗ azure-finalize.sql not found at ${finalizePath}`);
    process.exit(1);
  }
  log('Applying azure-finalize.sql (deny-all restrictive policy on every public table)');
  const r = spawnSync('psql', [dst, '-v', 'ON_ERROR_STOP=1', '-f', finalizePath], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('✗ Finalize failed. The DB is in a partially-restored state; do not point the app at it yet.');
    process.exit(r.status ?? 1);
  }
  log('Finalize complete.');
}

function stepVerify() {
  const src = require('SUPABASE_DB_URL', process.env.SUPABASE_DB_URL);
  const dst = require('AZURE_DB_URL', process.env.AZURE_DB_URL);

  // Enumerate every public table on Supabase — no hardcoded list, no
  // silently-uncounted tables. If a table shows up here that Azure
  // doesn't have, verify reports it as a mismatch (count -1).
  const tables = enumerateTables(src);
  log(`Row-count parity check across ${tables.length} public tables:`);
  let mismatches = 0;
  for (const t of tables) {
    const s = countRows(src, t);
    const d = countRows(dst, t);
    const ok = s === d;
    if (!ok) mismatches++;
    console.log(`  ${ok ? '✓' : '✗'} ${t.padEnd(38)} supabase=${s.toString().padStart(7)}  azure=${d.toString().padStart(7)}`);
  }
  if (mismatches > 0) {
    console.error(`\n✗ ${mismatches} table(s) mismatched. Investigate before cutover.`);
    process.exit(1);
  }
  log('All tables match. Proceed to cutover when ready.');
}

function enumerateTables(url) {
  try {
    const r = execFileSync('psql', [url, '-tAc',
      "select tablename from pg_tables where schemaname='public' " +
      "and tablename not like '\\_%' escape '\\' order by tablename",
    ], { encoding: 'utf8' });
    return r.split('\n').map(s => s.trim()).filter(Boolean);
  } catch (e) {
    console.error(`✗ Could not enumerate tables on source: ${e.message ?? e}`);
    process.exit(1);
  }
}

function countRows(url, table) {
  try {
    const r = execFileSync('psql', [url, '-tAc', `select count(*) from public.${table}`], { encoding: 'utf8' });
    return parseInt(r.trim(), 10) || 0;
  } catch {
    return -1;   // table missing — verify() flags as mismatch
  }
}

const STEPS = { dump: stepDump, schema: stepSchema, restore: stepRestore, finalize: stepFinalize, verify: stepVerify };

if (step === 'all') {
  stepSchema();
  stepDump();
  stepRestore();
  stepFinalize();
  stepVerify();
} else if (STEPS[step]) {
  STEPS[step]();
} else {
  console.error(`✗ Unknown --step=${step}. Valid: dump | schema | restore | finalize | verify | all`);
  process.exit(1);
}
