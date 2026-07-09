/**
 * Probe 1 core — schema introspection over `pg_catalog` (more precise than `information_schema` for
 * enums, arrays, and generated columns) plus a proposed type→editor mapping.
 *
 * Produces a `TableMeta` fully describing a table/view: columns (real PG type, nullability, default,
 * generated/identity), primary key, foreign keys, check constraints, enum value sets, and whether the
 * relation is updatable (a plain table vs a read-only view). Reused by the RecordSet probe (which
 * needs the PK + updatability) and the editable-grid probe (which needs the editor kinds).
 */
import { query } from './db.js';

/** The editor a column's type maps to, and how confident we are it is usable. */
export type EditorKind =
  | 'input-text'
  | 'input-int'
  | 'input-decimal'
  | 'checkbox'
  | 'datepicker'
  | 'datetime'
  | 'dropdown-enum'
  | 'dropdown-fk'
  | 'text-raw'
  | 'read-only';

/** How mature the mapping is: trivial (reuse a widget as-is), needs-work, or read-only fallback. */
export type EditorVerdict = 'trivial' | 'needs-work' | 'read-only';

/** One introspected column. */
export interface ColumnMeta {
  readonly name: string;
  /** The formatted PG type, e.g. `integer`, `numeric(12,2)`, `app.customer_tier`, `integer[]`. */
  readonly pgType: string;
  /** The underlying type name from `pg_type` (`int4`, `numeric`, `_int4` for arrays, the enum name). */
  readonly udtName: string;
  /** Broad `pg_type.typcategory` (N=numeric, S=string, B=boolean, D=date/time, E=enum, A=array, …). */
  readonly typeCategory: string;
  readonly notNull: boolean;
  readonly hasDefault: boolean;
  readonly defaultExpr: string | null;
  /** `'s'` = stored generated column (read-only), `''` = not generated. */
  readonly generated: string;
  /** `'a'` = always identity, `'d'` = by default, `''` = not identity. */
  readonly identity: string;
  /** Enum value set when the type is an enum, else null. */
  readonly enumValues: readonly string[] | null;
  /** The proposed editor + its verdict (from {@link proposeEditor}). */
  readonly editor: EditorKind;
  readonly editorVerdict: EditorVerdict;
}

/** A foreign key: which local columns reference which columns of which table. */
export interface ForeignKeyMeta {
  readonly name: string;
  readonly columns: readonly string[];
  readonly refTable: string;
  readonly refColumns: readonly string[];
}

/** A CHECK constraint: its name and the raw expression Postgres reports. */
export interface CheckMeta {
  readonly name: string;
  readonly expr: string;
}

/** Everything the catalog can tell us about one relation. */
export interface TableMeta {
  readonly schema: string;
  readonly name: string;
  /** `r`=table, `v`=view, `m`=matview, `p`=partitioned table. */
  readonly relKind: string;
  /** Whether the relation accepts INSERT/UPDATE/DELETE (a view may be read-only). */
  readonly updatable: boolean;
  readonly columns: readonly ColumnMeta[];
  /** Primary-key column names in key order; empty when the relation has no PK. */
  readonly primaryKey: readonly string[];
  readonly foreignKeys: readonly ForeignKeyMeta[];
  readonly checks: readonly CheckMeta[];
}

/** Map a column to a proposed editor + a maturity verdict, given its type and role. */
export function proposeEditor(
  col: Omit<ColumnMeta, 'editor' | 'editorVerdict'>,
  isFk: boolean,
): { editor: EditorKind; verdict: EditorVerdict } {
  // Generated / always-identity columns are system-computed → read-only regardless of type.
  if (col.generated === 's' || col.identity === 'a') return { editor: 'read-only', verdict: 'read-only' };
  if (col.enumValues) return { editor: 'dropdown-enum', verdict: 'trivial' };
  if (isFk) return { editor: 'dropdown-fk', verdict: 'needs-work' }; // needs a lookup query for labels
  switch (col.udtName) {
    case 'text':
    case 'varchar':
    case 'bpchar':
    case 'name':
      return { editor: 'input-text', verdict: 'trivial' };
    case 'int2':
    case 'int4':
    case 'int8':
      return { editor: 'input-int', verdict: 'trivial' };
    case 'numeric':
    case 'float4':
    case 'float8':
      return { editor: 'input-decimal', verdict: 'trivial' };
    case 'bool':
      return { editor: 'checkbox', verdict: 'trivial' };
    case 'date':
      return { editor: 'datepicker', verdict: 'trivial' };
    case 'timestamp':
    case 'timestamptz':
    case 'time':
    case 'timetz':
      // DatePicker covers the date half; there is no time-of-day widget yet.
      return { editor: 'datetime', verdict: 'needs-work' };
    case 'uuid':
      // Editable as text, but usually system-generated; treat as a guarded text field.
      return { editor: 'input-text', verdict: 'needs-work' };
    case 'jsonb':
    case 'json':
      return { editor: 'text-raw', verdict: 'needs-work' };
    default:
      // Arrays (`_int4` etc.) and any unhandled type: raw-text fallback, needs work.
      if (col.udtName.startsWith('_')) return { editor: 'text-raw', verdict: 'needs-work' };
      return { editor: 'text-raw', verdict: 'read-only' };
  }
}

interface ColRow {
  name: string;
  pg_type: string;
  udt_name: string;
  type_category: string;
  not_null: boolean;
  has_default: boolean;
  default_expr: string | null;
  generated: string;
  identity: string;
  enum_values: string[] | null;
}

/** Introspect one relation into a {@link TableMeta}. `schema`/`name` come from the catalog only. */
export async function introspect(schema: string, name: string): Promise<TableMeta> {
  const relRes = await query<{ oid: number; relkind: string; updatable: boolean }>(
    `SELECT c.oid,
            c.relkind,
            (pg_relation_is_updatable(c.oid, true) & 8) <> 0 AS updatable
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2`,
    [schema, name],
  );
  if (relRes.rows.length === 0) throw new Error(`relation ${schema}.${name} not found`);
  const { oid, relkind, updatable } = relRes.rows[0];

  const colRes = await query<ColRow>(
    `SELECT a.attname                                    AS name,
            format_type(a.atttypid, a.atttypmod)         AS pg_type,
            t.typname                                    AS udt_name,
            t.typcategory                                AS type_category,
            a.attnotnull                                 AS not_null,
            a.atthasdef                                  AS has_default,
            pg_get_expr(d.adbin, d.adrelid)              AS default_expr,
            a.attgenerated                               AS generated,
            a.attidentity                                AS identity,
            CASE WHEN t.typtype = 'e'
                 THEN (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
                         FROM pg_enum e WHERE e.enumtypid = a.atttypid)
                 ELSE NULL END                           AS enum_values
       FROM pg_attribute a
       JOIN pg_type t ON t.oid = a.atttypid
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [oid],
  );

  // Foreign keys — resolve conkey/confkey (attnum arrays) to column names.
  const fkRes = await query<{ name: string; columns: string[]; ref_table: string; ref_columns: string[] }>(
    `SELECT con.conname AS name,
            (SELECT array_agg(att.attname::text ORDER BY k.ord)
               FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
               JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum) AS columns,
            (fn.nspname || '.' || fc.relname) AS ref_table,
            (SELECT array_agg(att.attname::text ORDER BY k.ord)
               FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
               JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = k.attnum) AS ref_columns
       FROM pg_constraint con
       JOIN pg_class fc ON fc.oid = con.confrelid
       JOIN pg_namespace fn ON fn.oid = fc.relnamespace
      WHERE con.conrelid = $1 AND con.contype = 'f'`,
    [oid],
  );

  const checkRes = await query<{ name: string; expr: string }>(
    `SELECT conname AS name, pg_get_constraintdef(oid) AS expr
       FROM pg_constraint WHERE conrelid = $1 AND contype = 'c'`,
    [oid],
  );

  const pkRes = await query<{ columns: string[] }>(
    `SELECT (SELECT array_agg(att.attname::text ORDER BY k.ord)
               FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
               JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum) AS columns
       FROM pg_constraint con WHERE con.conrelid = $1 AND con.contype = 'p'`,
    [oid],
  );

  const fkCols = new Set(fkRes.rows.flatMap((f) => f.columns));
  const columns: ColumnMeta[] = colRes.rows.map((r) => {
    const base = {
      name: r.name,
      pgType: r.pg_type,
      udtName: r.udt_name,
      typeCategory: r.type_category,
      notNull: r.not_null,
      hasDefault: r.has_default,
      defaultExpr: r.default_expr,
      generated: r.generated,
      identity: r.identity,
      enumValues: r.enum_values,
    };
    const { editor, verdict } = proposeEditor(base, fkCols.has(r.name));
    return { ...base, editor, editorVerdict: verdict };
  });

  return {
    schema,
    name,
    relKind: relkind,
    updatable,
    columns,
    primaryKey: pkRes.rows[0]?.columns ?? [],
    foreignKeys: fkRes.rows.map((f) => ({
      name: f.name,
      columns: f.columns,
      refTable: f.ref_table,
      refColumns: f.ref_columns,
    })),
    checks: checkRes.rows.map((c) => ({ name: c.name, expr: c.expr })),
  };
}

/** List every relation (table + view) in a schema, in name order. */
export async function listRelations(schema: string): Promise<{ name: string; relKind: string }[]> {
  const res = await query<{ name: string; relkind: string }>(
    `SELECT c.relname AS name, c.relkind
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind IN ('r', 'v', 'm', 'p')
      ORDER BY c.relkind, c.relname`,
    [schema],
  );
  return res.rows.map((r) => ({ name: r.name, relKind: r.relkind }));
}
