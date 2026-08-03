#!/usr/bin/env node
/**
 * Runs db/schema.sql (and optionally db/rls.sql, db/framework-seed.sql) against
 * the Azure Postgres connection in DATABASE_URL.
 *
 * Usage:
 *   node scripts/migrate.mjs             # schema only
 *   node scripts/migrate.mjs --with-rls  # + RLS policies (once Entra rollout complete)
 *   node scripts/migrate.mjs --seed      # + framework seed
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const argv = new Set(process.argv.slice(2));
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const conn = process.env.DATABASE_URL;
if (!conn) { console.error('DATABASE_URL is not set'); process.exit(2); }

const pool = new pg.Pool({
  connectionString: conn,
  ssl: conn.includes('azure.com') ? { rejectUnauthorized: false } : undefined,
});

const files = ['db/schema.sql'];
if (argv.has('--with-rls')) files.push('db/rls.sql');
if (argv.has('--seed'))     files.push('db/framework-seed.sql');

for (const rel of files) {
  const path = resolve(root, rel);
  console.log(`▸ applying ${rel}`);
  const body = await readFile(path, 'utf8');
  try {
    await pool.query(body);
    console.log(`  ok`);
  } catch (e) {
    console.error(`  failed: ${e.message}`);
    process.exit(1);
  }
}

console.log('all done.');
await pool.end();
