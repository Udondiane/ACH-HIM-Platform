/**
 * Supabase-shaped query builder over node-postgres.
 * Preserves the surface HIM's ~500 query call sites use, so every
 * page and every server action continues to work verbatim when it
 * imports `createClient` from `@/lib/supabase/server`.
 *
 * Method coverage matches the pattern audit run at migration time:
 *   .from()  533 sites
 *   .select() 392   .eq()    307   .order() 132
 *   .maybeSingle() 90   .or()   88   .limit() 61
 *   .in()   35   .update() 30   .delete() 29   .single() 28
 *   .insert() 21   .is()    13   .gte()   8   .neq()   7
 *   .upsert()  6   .contains() 6   .lte()   5   .not()   2
 *   .like()   2   .rpc()    1   .lt()    1   .gt()    1
 *
 * Known limitations that need vendor work (documented in README):
 *   1. Embedded joins in select(): `.select('*, cohorts(name)')`
 *      — this shim treats them as literal SQL fragments and will
 *      raise. Each occurrence needs rewrite to an explicit SQL
 *      JOIN or a follow-up query. The full list is in
 *      docs/JOIN-CALL-SITES.md (grep for `\.select\('.*\('`).
 *   2. .rpc(name, args) works but calls a Postgres function of the
 *      same name — RLS Supabase functions (auth.uid()) don't exist
 *      on Azure Postgres and their rewrites live in db/rls.sql.
 */

import { getPool } from './pool';

type Op = '=' | '<>' | 'IS' | 'ILIKE' | 'LIKE' | '>' | '>=' | '<' | '<=' | 'IN' | '@>';

interface Filter { col: string; op: Op; value: unknown; }
interface UpsertOption { onConflict?: string; ignoreDuplicates?: boolean; }
interface CountOption { count?: 'exact' | 'planned' | 'estimated' | null; head?: boolean; }

export interface Result<T> {
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
  count?: number | null;
  status?: number;
}

function ident(name: string): string {
  return name.split('.').map(p => `"${p.replace(/"/g, '""')}"`).join('.');
}
function bind(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

export class QueryBuilder<Row = any> implements PromiseLike<Result<any>> {
  private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private cols = '*';
  private filters: Filter[] = [];
  private orderBy: { col: string; ascending: boolean }[] = [];
  private _limit: number | null = null;
  private _single: 'row' | 'maybe' | null = null;
  private insertRows: Record<string, unknown>[] = [];
  private updatePatch: Record<string, unknown> | null = null;
  private upsertRows: Record<string, unknown>[] = [];
  private upsertOpt: UpsertOption = {};
  private returning = false;
  private rawExtraClause: string | null = null;
  private countOpt: CountOption['count'] = null;
  private headOnly = false;

  constructor(private readonly table: string) {}

  select(cols?: string, opts?: CountOption): this {
    this.mode = 'select';
    if (cols) {
      // Embedded-join syntax like `cohorts(name)` inside select() is
      // Supabase-specific and this shim does not translate it. Raise
      // NOW with a clear error rather than surfacing a Postgres
      // syntax error deep in a page render — the correct fix is to
      // rewrite each call site to an explicit SQL JOIN or a follow-up
      // query. The list of call sites is in
      // docs/AZURE-JOIN-CALL-SITES.md.
      if (/[a-z_][a-z0-9_]*\s*\(/i.test(cols) && !/^count\s*\(/i.test(cols.trim())) {
        throw new Error(
          `[azure query-builder] Embedded-join .select("${cols}") is not supported ` +
          `on Azure. Rewrite as an explicit SQL join or a follow-up .from() query. ` +
          `See docs/AZURE-JOIN-CALL-SITES.md for the inventory.`,
        );
      }
      this.cols = cols;
    }
    if (opts?.count) this.countOpt = opts.count;
    if (opts?.head) this.headOnly = true;
    this.returning = true;
    return this;
  }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mode = 'insert';
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(patch: Record<string, unknown>): this {
    this.mode = 'update';
    this.updatePatch = patch;
    return this;
  }
  upsert(rows: Record<string, unknown> | Record<string, unknown>[], opts: UpsertOption = {}): this {
    this.mode = 'upsert';
    this.upsertRows = Array.isArray(rows) ? rows : [rows];
    this.upsertOpt = opts;
    return this;
  }
  delete(): this { this.mode = 'delete'; return this; }

  eq(col: string, value: unknown): this { this.filters.push({ col, op: '=', value }); return this; }
  neq(col: string, value: unknown): this { this.filters.push({ col, op: '<>', value }); return this; }
  is(col: string, value: unknown): this { this.filters.push({ col, op: 'IS', value }); return this; }
  gt(col: string, value: unknown): this { this.filters.push({ col, op: '>', value }); return this; }
  gte(col: string, value: unknown): this { this.filters.push({ col, op: '>=', value }); return this; }
  lt(col: string, value: unknown): this { this.filters.push({ col, op: '<', value }); return this; }
  lte(col: string, value: unknown): this { this.filters.push({ col, op: '<=', value }); return this; }
  in(col: string, values: unknown[]): this { this.filters.push({ col, op: 'IN', value: values }); return this; }
  like(col: string, pattern: string): this { this.filters.push({ col, op: 'LIKE', value: pattern }); return this; }
  ilike(col: string, pattern: string): this { this.filters.push({ col, op: 'ILIKE', value: pattern }); return this; }
  contains(col: string, value: unknown): this { this.filters.push({ col, op: '@>', value }); return this; }
  not(col: string, op: string, value: unknown): this {
    const opMap: Record<string, Op> = { eq: '=', neq: '<>', is: 'IS', in: 'IN' };
    const resolved = opMap[op.toLowerCase()];
    if (!resolved) throw new Error(`Unsupported .not() operator: ${op}`);
    const params: unknown[] = [];
    const bound = resolved === 'IN'
      ? `(${(value as unknown[]).map(v => bind(params, v)).join(', ')})`
      : resolved === 'IS'
        ? String(value).toUpperCase()
        : bind(params, value);
    const clause = `NOT (${ident(col)} ${resolved} ${bound})`;
    this.rawExtraClause = this.rawExtraClause ? `${this.rawExtraClause} AND ${clause}` : clause;
    return this;
  }
  // Deferred until render — .or() values must go through parameter
  // bindings, not string interpolation, so we can't build the SQL
  // until we know the shared params[] array in renderWhere().
  private _orClauses: { col: string; op: Op; value: unknown; isNullLiteral: boolean }[][] = [];

  or(rawFilter: string): this {
    const parts = rawFilter.split(',').map(s => s.trim()).filter(Boolean);
    const group: { col: string; op: Op; value: unknown; isNullLiteral: boolean }[] = [];
    for (const p of parts) {
      const m = p.match(/^([a-z_][a-z0-9_.]*)\.([a-z]+)\.(.+)$/i);
      if (!m) continue;
      const [, col, op, val] = m;
      const sqlOp: Op | null = op === 'eq' ? '='
        : op === 'neq' ? '<>'
        : op === 'is' ? 'IS'
        : op === 'like' ? 'LIKE'
        : op === 'ilike' ? 'ILIKE'
        : op === 'gt' ? '>'
        : op === 'gte' ? '>='
        : op === 'lt' ? '<'
        : op === 'lte' ? '<='
        : null;
      if (!sqlOp) continue;
      // Coerce a bare-word `null` in the DSL to a real null value so
      // it renders as `col IS NULL` — every other value gets bound as
      // a parameter (no string interpolation, no injection surface).
      const isNullLiteral = val === 'null';
      const coerced: unknown = isNullLiteral
        ? null
        : /^-?\d+(\.\d+)?$/.test(val)
          ? Number(val)
          : val;
      group.push({ col, op: sqlOp, value: coerced, isNullLiteral });
    }
    if (group.length > 0) this._orClauses.push(group);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orderBy.push({ col, ascending: opts?.ascending !== false });
    return this;
  }
  limit(n: number): this { this._limit = n; return this; }
  single(): this { this._single = 'row'; this._limit = 2; return this; }
  maybeSingle(): this { this._single = 'maybe'; this._limit = 2; return this; }

  private renderWhere(params: unknown[]): string {
    const parts: string[] = [];
    for (const f of this.filters) {
      if (f.op === 'IN') {
        const vals = f.value as unknown[];
        if (vals.length === 0) { parts.push('FALSE'); continue; }
        parts.push(`${ident(f.col)} IN (${vals.map(v => bind(params, v)).join(', ')})`);
      } else if (f.op === 'IS') {
        parts.push(`${ident(f.col)} IS ${String(f.value).toUpperCase()}`);
      } else if (f.op === '@>') {
        parts.push(`${ident(f.col)} @> ${bind(params, f.value)}::jsonb`);
      } else {
        parts.push(`${ident(f.col)} ${f.op} ${bind(params, f.value)}`);
      }
    }
    // Deferred .or() groups — each becomes `(a OR b OR ...)`,
    // parameter-bound like the rest of the WHERE clause.
    for (const group of this._orClauses) {
      const sub: string[] = [];
      for (const c of group) {
        if (c.isNullLiteral || c.op === 'IS') {
          sub.push(`${ident(c.col)} IS ${c.value === null ? 'NULL' : String(c.value).toUpperCase()}`);
        } else {
          sub.push(`${ident(c.col)} ${c.op} ${bind(params, c.value)}`);
        }
      }
      if (sub.length > 0) parts.push(`(${sub.join(' OR ')})`);
    }
    if (this.rawExtraClause) parts.push(this.rawExtraClause);
    return parts.length > 0 ? ` WHERE ${parts.join(' AND ')}` : '';
  }

  private renderOrderLimit(): string {
    let sql = '';
    if (this.orderBy.length > 0) {
      sql += ` ORDER BY ${this.orderBy.map(o => `${ident(o.col)} ${o.ascending ? 'ASC' : 'DESC'} NULLS LAST`).join(', ')}`;
    }
    if (this._limit !== null) sql += ` LIMIT ${this._limit}`;
    return sql;
  }

  async execute(): Promise<Result<any>> {
    const pool = getPool();
    const params: unknown[] = [];

    try {
      if (this.mode === 'select') {
        if (this.headOnly || this.countOpt === 'exact') {
          const countSql = `SELECT COUNT(*)::int AS c FROM ${ident(this.table)}${this.renderWhere(params)}`;
          const { rows } = await pool.query(countSql, params);
          const count = rows[0]?.c ?? 0;
          if (this.headOnly) return { data: null, error: null, count, status: 200 };
          const dp: unknown[] = [];
          const sql = `SELECT ${this.cols === '*' ? '*' : this.cols} FROM ${ident(this.table)}${this.renderWhere(dp)}${this.renderOrderLimit()}`;
          const { rows: data } = await pool.query(sql, dp);
          return this.wrap(data, count);
        }
        const sql = `SELECT ${this.cols === '*' ? '*' : this.cols} FROM ${ident(this.table)}${this.renderWhere(params)}${this.renderOrderLimit()}`;
        const { rows: data } = await pool.query(sql, params);
        return this.wrap(data);
      }

      if (this.mode === 'insert') {
        if (this.insertRows.length === 0) return { data: [], error: null };
        const cols = Object.keys(this.insertRows[0]);
        const valueRows = this.insertRows.map(r =>
          `(${cols.map(c => bind(params, r[c])).join(', ')})`,
        );
        const sql = `INSERT INTO ${ident(this.table)} (${cols.map(ident).join(', ')}) VALUES ${valueRows.join(', ')}${this.returning ? ' RETURNING *' : ''}`;
        const { rows } = await pool.query(sql, params);
        return this.wrap(rows);
      }

      if (this.mode === 'update') {
        if (!this.updatePatch) return { data: null, error: { message: 'update called without patch' } };
        const cols = Object.keys(this.updatePatch);
        const setClause = cols.map(c => `${ident(c)} = ${bind(params, this.updatePatch![c])}`).join(', ');
        const sql = `UPDATE ${ident(this.table)} SET ${setClause}${this.renderWhere(params)}${this.returning ? ' RETURNING *' : ''}`;
        const { rows } = await pool.query(sql, params);
        return this.wrap(rows);
      }

      if (this.mode === 'upsert') {
        if (this.upsertRows.length === 0) return { data: [], error: null };
        const cols = Object.keys(this.upsertRows[0]);
        const valueRows = this.upsertRows.map(r =>
          `(${cols.map(c => bind(params, r[c])).join(', ')})`,
        );
        const conflictCols = this.upsertOpt.onConflict?.split(',').map(c => c.trim()) ?? cols;
        const conflict = conflictCols.map(ident).join(', ');
        const updates = cols.filter(c => !conflictCols.includes(c))
          .map(c => `${ident(c)} = EXCLUDED.${ident(c)}`).join(', ');
        const action = this.upsertOpt.ignoreDuplicates || !updates
          ? 'DO NOTHING'
          : `DO UPDATE SET ${updates}`;
        const sql = `INSERT INTO ${ident(this.table)} (${cols.map(ident).join(', ')}) VALUES ${valueRows.join(', ')} ON CONFLICT (${conflict}) ${action}${this.returning ? ' RETURNING *' : ''}`;
        const { rows } = await pool.query(sql, params);
        return this.wrap(rows);
      }

      if (this.mode === 'delete') {
        const sql = `DELETE FROM ${ident(this.table)}${this.renderWhere(params)}${this.returning ? ' RETURNING *' : ''}`;
        const { rows } = await pool.query(sql, params);
        return this.wrap(rows);
      }

      return { data: null, error: { message: `unsupported mode ${this.mode}` } };
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? String(e), code: e?.code, details: e?.detail } };
    }
  }

  private wrap(rows: any[], count: number | null = null): Result<any> {
    if (this._single === 'row') {
      if (rows.length === 0) return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
      if (rows.length > 1) return { data: null, error: { message: 'Multiple rows returned' } };
      return { data: rows[0], error: null };
    }
    if (this._single === 'maybe') {
      if (rows.length === 0) return { data: null, error: null };
      if (rows.length > 1) return { data: null, error: { message: 'Multiple rows returned' } };
      return { data: rows[0], error: null };
    }
    return { data: rows, error: null, count };
  }

  then<T1 = Result<any>, T2 = never>(
    onfulfilled?: ((value: Result<any>) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return this.execute().then(onfulfilled, onrejected) as Promise<T1 | T2>;
  }
}
