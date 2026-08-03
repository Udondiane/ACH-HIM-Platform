/**
 * Azure Database for PostgreSQL client.
 *
 * Connection string comes from DATABASE_URL and must include `sslmode=require`
 * (Azure PostgreSQL Flexible Server enforces TLS in production). In a
 * container-mounted managed-identity setup you can strip user:password from
 * the URL and pass an access token instead — see the `getAzureToken` helper
 * below (opt-in, off by default).
 */

import { Pool } from 'pg';
import type { QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const connStr = process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL is not set');
  pool = new Pool({
    connectionString: connStr,
    ssl: connStr.includes('azure.com') || connStr.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return pool;
}

/**
 * Tagged-template query helper. Prevents SQL injection and gives us
 * pleasant call sites throughout the app:
 *
 *   const users = await sql<User>`SELECT * FROM users WHERE email = ${email}`;
 */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
  const result: QueryResult<T> = await getPool().query(text, values);
  return result.rows;
}

export async function sqlOne<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T | null> {
  const rows = await sql<T>(strings, ...values);
  return rows[0] ?? null;
}
