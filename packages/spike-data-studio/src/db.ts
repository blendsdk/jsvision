/**
 * Shared Postgres access for the spike. ONE rule: every value goes through a parameterized query
 * ($1, $2, …) — no string interpolation of data into SQL, ever. Identifiers (table/column names)
 * that must be interpolated (introspection can't parameterize them) are quoted via `qIdent` and only
 * ever come from the catalog, never from user free-text.
 *
 * Connection config is read from DATABASE_URL only. Credentials are never hardcoded and never logged.
 */
import { Pool } from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Example:\n' +
      "  export DATABASE_URL='postgres://postgres:spike@localhost:5433/postgres'",
  );
}

/** The shared pool. `end()` it at the tail of a probe script so the process can exit. */
export const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

/** Parameterized query. `params` are bound, never interpolated. */
export async function query<R extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<R>> {
  return pool.query<R>(sql, params as unknown[]);
}

/** Run `fn` inside a transaction: BEGIN, then COMMIT on success or ROLLBACK on throw. */
export async function withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Quote a SQL identifier (double-quote, escape embedded quotes). ONLY for identifiers sourced from
 * the catalog during introspection — never a channel for user data (that is always parameterized).
 */
export function qIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

/** Redact a connection string for safe logging (drops the password). */
export function safeUrl(url: string): string {
  return url.replace(/:\/\/([^:@/]+):[^@]*@/, '://$1:***@');
}
