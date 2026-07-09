/**
 * Probe 2 core — parameterized CRUD keyed on a primary key, an `xmin`-based optimistic-concurrency
 * update, and a structured PG-error mapper. Every data value is bound ($1, $2, …); only catalog-sourced
 * identifiers are interpolated (via `qIdent`).
 *
 * The key insight for a generic editor: a row's identity is its primary-key column set. UPDATE/DELETE
 * build a `WHERE` from that key. A composite PK is just a multi-column key; a table with NO PK has no
 * safe row identity (see the no-PK note in the Probe 2 runner).
 */
import type { PoolClient } from 'pg';
import { pool, qIdent } from './db.js';

/** A structured, user-presentable database error (mapped from a raw pg error). */
export interface DbError {
  /** Coarse class used to route the message to a field or a dialog. */
  kind: 'check' | 'not-null' | 'foreign-key' | 'unique' | 'bad-input' | 'read-only' | 'other';
  /** The SQLSTATE code, for logging/debugging. */
  code: string;
  /** The offending column, when the driver reports one (NOT NULL / bad input). */
  column?: string;
  /** The violated constraint name, when reported (CHECK / FK / UNIQUE). */
  constraint?: string;
  /** A message safe to show a user (no SQL, no PII beyond what they typed). */
  message: string;
}

interface RawPgError {
  code?: string;
  column?: string;
  constraint?: string;
  detail?: string;
  message?: string;
  table?: string;
}

/** Map a raw pg error to a {@link DbError}. Returns null for a non-pg error (rethrow those). */
export function mapPgError(err: unknown): DbError | null {
  const e = err as RawPgError;
  if (!e || typeof e.code !== 'string') return null;
  switch (e.code) {
    case '23514': // check_violation
      return {
        kind: 'check',
        code: e.code,
        constraint: e.constraint,
        message: `Value violates rule "${e.constraint ?? 'check'}".`,
      };
    case '23502': // not_null_violation
      return {
        kind: 'not-null',
        code: e.code,
        column: e.column,
        message: `"${e.column ?? 'field'}" is required.`,
      };
    case '23503': // foreign_key_violation
      return {
        kind: 'foreign-key',
        code: e.code,
        constraint: e.constraint,
        message: `Referenced record does not exist (${e.constraint ?? 'foreign key'}).`,
      };
    case '23505': // unique_violation
      return {
        kind: 'unique',
        code: e.code,
        constraint: e.constraint,
        message: `A record with this value already exists (${e.constraint ?? 'unique'}).`,
      };
    case '22P02': // invalid_text_representation
    case '22007': // invalid_datetime_format
    case '22003': // numeric_value_out_of_range
      return { kind: 'bad-input', code: e.code, message: `Invalid value: ${e.message ?? 'bad input'}.` };
    default:
      return { kind: 'other', code: e.code, message: e.message ?? 'Database error.' };
  }
}

/** Qualify a schema.table for SQL. */
function relRef(schema: string, table: string): string {
  return `${qIdent(schema)}.${qIdent(table)}`;
}

/** A page of rows plus the `xmin` version token per row (for optimistic updates). */
export interface Page<Row> {
  rows: (Row & { xmin: string })[];
}

/** Parameterized offset page. `orderBy` columns are catalog-sourced identifiers (safe to quote). */
export async function selectPage<Row>(
  schema: string,
  table: string,
  orderBy: readonly string[],
  limit: number,
  offset: number,
  client: PoolClient | typeof pool = pool,
): Promise<Page<Row>> {
  const order = orderBy.map(qIdent).join(', ');
  const sql = `SELECT *, xmin::text AS xmin FROM ${relRef(schema, table)}${
    order ? ` ORDER BY ${order}` : ''
  } LIMIT $1 OFFSET $2`;
  const res = await client.query(sql, [limit, offset]);
  return { rows: res.rows as (Row & { xmin: string })[] };
}

/** Keyset (seek) page: rows strictly after `afterId` in `keyCol` order — O(1) regardless of depth. */
export async function selectKeyset<Row>(
  schema: string,
  table: string,
  keyCol: string,
  afterId: number | null,
  limit: number,
  client: PoolClient | typeof pool = pool,
): Promise<Page<Row>> {
  const kc = qIdent(keyCol);
  const sql =
    afterId === null
      ? `SELECT *, xmin::text AS xmin FROM ${relRef(schema, table)} ORDER BY ${kc} LIMIT $1`
      : `SELECT *, xmin::text AS xmin FROM ${relRef(schema, table)} WHERE ${kc} > $1 ORDER BY ${kc} LIMIT $2`;
  const params = afterId === null ? [limit] : [afterId, limit];
  const res = await client.query(sql, params);
  return { rows: res.rows as (Row & { xmin: string })[] };
}

/** INSERT … RETURNING *. `values` keys are catalog columns; values are bound. */
export async function insertReturning<Row>(
  schema: string,
  table: string,
  values: Record<string, unknown>,
  client: PoolClient | typeof pool = pool,
): Promise<Row> {
  const cols = Object.keys(values);
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const sql = `INSERT INTO ${relRef(schema, table)} (${cols.map(qIdent).join(', ')})
               VALUES (${placeholders.join(', ')}) RETURNING *, xmin::text AS xmin`;
  const res = await client.query(sql, Object.values(values));
  return res.rows[0] as Row;
}

/** Build a `WHERE` from a primary-key map and its bind params, starting at placeholder `$startAt`. */
function whereFromKey(key: Record<string, unknown>, startAt: number): { sql: string; params: unknown[] } {
  const cols = Object.keys(key);
  const clauses = cols.map((c, i) => `${qIdent(c)} = $${startAt + i}`);
  return { sql: clauses.join(' AND '), params: Object.values(key) };
}

/** UPDATE … WHERE <pk>. Returns the updated row (RETURNING), or null if the key matched nothing. */
export async function updateByKey<Row>(
  schema: string,
  table: string,
  key: Record<string, unknown>,
  values: Record<string, unknown>,
  client: PoolClient | typeof pool = pool,
): Promise<Row | null> {
  const setCols = Object.keys(values);
  const setSql = setCols.map((c, i) => `${qIdent(c)} = $${i + 1}`).join(', ');
  const where = whereFromKey(key, setCols.length + 1);
  const sql = `UPDATE ${relRef(schema, table)} SET ${setSql} WHERE ${where.sql} RETURNING *, xmin::text AS xmin`;
  const res = await client.query(sql, [...Object.values(values), ...where.params]);
  return (res.rows[0] as Row) ?? null;
}

/**
 * Optimistic UPDATE guarded by `xmin`: only writes when the row's version still matches `expectedXmin`.
 * Returns `{ ok: true, row }` on success or `{ ok: false }` when a concurrent commit changed the row
 * (0 rows updated) — the caller then re-reads and asks the user to reconcile.
 */
export async function updateOptimistic<Row>(
  schema: string,
  table: string,
  key: Record<string, unknown>,
  values: Record<string, unknown>,
  expectedXmin: string,
  client: PoolClient | typeof pool = pool,
): Promise<{ ok: true; row: Row } | { ok: false }> {
  const setCols = Object.keys(values);
  const setSql = setCols.map((c, i) => `${qIdent(c)} = $${i + 1}`).join(', ');
  const where = whereFromKey(key, setCols.length + 1);
  const xminIdx = setCols.length + Object.keys(key).length + 1;
  const sql = `UPDATE ${relRef(schema, table)} SET ${setSql}
               WHERE ${where.sql} AND xmin = $${xminIdx}::text::xid
               RETURNING *, xmin::text AS xmin`;
  const res = await client.query(sql, [...Object.values(values), ...where.params, expectedXmin]);
  if (res.rows.length === 0) return { ok: false };
  return { ok: true, row: res.rows[0] as Row };
}

/** DELETE … WHERE <pk>. Returns the number of rows deleted (0 = key matched nothing). */
export async function deleteByKey(
  schema: string,
  table: string,
  key: Record<string, unknown>,
  client: PoolClient | typeof pool = pool,
): Promise<number> {
  const where = whereFromKey(key, 1);
  const sql = `DELETE FROM ${relRef(schema, table)} WHERE ${where.sql}`;
  const res = await client.query(sql, where.params);
  return res.rowCount ?? 0;
}
