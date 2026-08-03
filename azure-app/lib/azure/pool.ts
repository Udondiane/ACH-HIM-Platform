import { Pool } from 'pg';

/**
 * Single Postgres connection pool for the entire runtime. Uses
 * DATABASE_URL — an Azure Database for PostgreSQL Flexible Server
 * connection string in production; local Postgres in dev.
 * SSL is required for Azure.
 */

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error(
      '[azure-db] DATABASE_URL is not set. Configure it in Azure App Configuration.',
    );
  }
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
