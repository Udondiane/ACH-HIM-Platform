/**
 * The Azure-native Supabase-shaped client. Every call site in HIM
 * (`import { createClient } from '@/lib/supabase/server'`) receives
 * one of these — same surface, different guts:
 *   .from(table).select/eq/order/…      → node-postgres against Azure Postgres
 *   .auth.getUser()                     → NextAuth v5 + Entra ID
 *   .storage.from(bucket).upload/…      → Azure Blob Storage
 *   .rpc(name, args)                    → Postgres function call
 */

import { QueryBuilder } from './query-builder';
import { storage } from './storage';
import { authApi } from './auth';
import { getPool } from './pool';

export interface AzureClient {
  from<Row = any>(table: string): QueryBuilder<Row>;
  auth: typeof authApi;
  storage: typeof storage;
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }>;
}

export function createAzureClient(): AzureClient {
  return {
    from<Row = any>(table: string): QueryBuilder<Row> {
      return new QueryBuilder<Row>(table);
    },
    auth: authApi,
    storage,
    async rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<{ data: T | null; error: { message: string } | null }> {
      try {
        // Postgres named-argument syntax: fn(arg_name := $N).
        // Positional bindings would silently misbind when the caller's
        // Object.keys order does not match the function's declared
        // parameter order. Named args are order-independent.
        const cols = Object.keys(args);
        const bindings = cols.map((k, i) => `"${k.replace(/"/g, '""')}" := $${i + 1}`);
        const sql = `SELECT * FROM ${fn.split('.').map(p => `"${p.replace(/"/g, '""')}"`).join('.')}(${bindings.join(', ')})`;
        const { rows } = await getPool().query(sql, cols.map(k => args[k]));
        return { data: rows as T, error: null };
      } catch (e: any) {
        return { data: null, error: { message: e?.message ?? String(e) } };
      }
    },
  };
}
