/**
 * A `DataSource` decouples the `RecordSet` from *where* rows come from — a live pg table, or an
 * in-memory array (for a reactivity proof with no server round-trips). The RecordSet only ever calls
 * this interface, so paging strategy and transport are swappable behind it.
 */
import { introspect } from './introspect.js';
import type { TableMeta } from './introspect.js';
import {
  deleteByKey,
  insertReturning,
  selectPage,
  updateOptimistic,
} from './crud.js';

/** A row plus its `xmin` version token (for optimistic concurrency). */
export type MetaRow = Record<string, unknown> & { xmin: string };

/** The transport the RecordSet drives. All value channels are parameterized inside the impls. */
export interface DataSource {
  readonly meta: TableMeta;
  readonly editableColumns: string[];
  totalCount(): Promise<number>;
  fetchWindow(offset: number, limit: number): Promise<MetaRow[]>;
  update(
    key: Record<string, unknown>,
    values: Record<string, unknown>,
    xmin: string,
  ): Promise<{ ok: true; row: MetaRow } | { ok: false }>;
  insert(values: Record<string, unknown>): Promise<MetaRow>;
  delete(key: Record<string, unknown>): Promise<number>;
  /** Extract the primary-key map from a row (empty object when the relation has no PK → read-only). */
  keyOf(row: Record<string, unknown>): Record<string, unknown>;
}

/** Columns a user may edit: not generated, not always-identity, not a plain read-only view column. */
function editableColumns(meta: TableMeta): string[] {
  if (!meta.updatable) return [];
  return meta.columns.filter((c) => c.editor !== 'read-only').map((c) => c.name);
}

/** A live PostgreSQL table/view data source built on the Probe 1 introspection + Probe 2 CRUD. */
export async function pgSource(schema: string, table: string): Promise<DataSource> {
  const meta = await introspect(schema, table);
  const pk = meta.primaryKey;
  return {
    meta,
    editableColumns: editableColumns(meta),
    async totalCount() {
      const { query } = await import('./db.js');
      const r = await query<{ n: string }>(`SELECT count(*)::text AS n FROM "${schema}"."${table}"`);
      return Number(r.rows[0].n);
    },
    async fetchWindow(offset, limit) {
      const order = pk.length ? pk : meta.columns.slice(0, 1).map((c) => c.name);
      const page = await selectPage<Record<string, unknown>>(schema, table, order, limit, offset);
      return page.rows as MetaRow[];
    },
    update(key, values, xmin) {
      return updateOptimistic<MetaRow>(schema, table, key, values, xmin);
    },
    insert(values) {
      return insertReturning<MetaRow>(schema, table, values);
    },
    delete(key) {
      return deleteByKey(schema, table, key);
    },
    keyOf(row) {
      const key: Record<string, unknown> = {};
      for (const c of pk) key[c] = row[c];
      return key;
    },
  };
}
