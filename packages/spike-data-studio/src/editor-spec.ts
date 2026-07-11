/**
 * Design sketch (Probe 4 follow-up) — the `EditorSpec` model that turns an introspected column into a
 * concrete cell editor. Three pieces:
 *   1. `EditorSpec` — the declarative per-column descriptor the grid/form reads.
 *   2. `resolveEditors(meta, overrides)` — derives specs from `TableMeta` (Probe 1) + per-column
 *      overrides (the channel for what the catalog cannot infer: FK label columns, CHECK-based enums).
 *   3. `createCellEditor(spec, field, host)` — mounts the right `@jsvision/ui` widget bound to the
 *      RecordSet's string `field()` buffer through a typed adapter (the honest cost of typed controls).
 *
 * This compiles against the real widget API; it is a design artefact, not a wired feature.
 */
import {
  Input,
  CheckGroup,
  DatePicker,
  ComboBox,
  filter,
  signal,
  effect,
  untrack,
  toISO,
  parseISO,
} from '@jsvision/ui';
import type { Signal, Validator, View, ColumnWidth, ColumnAlign, CalendarDate } from '@jsvision/ui';
import type { ColumnMeta, ForeignKeyMeta, TableMeta } from './introspect.js';

/** The concrete editor a cell uses (widget-level, one step below the PG type). */
export type EditorKind =
  'text' | 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'enum' | 'lookup' | 'json' | 'array' | 'readonly';

/** How NULL is treated on a nullable column (distinct from an empty string). */
export interface NullPolicy {
  readonly nullable: boolean;
  /** How NULL renders in a non-editing cell (default `''`). */
  readonly display?: string;
}

/** An enum editor's value set (from `pg_enum`, or supplied via an override for a CHECK-based enum). */
export interface EnumConfig {
  readonly values: readonly string[];
}

/**
 * A foreign-key lookup editor's configuration. `refTable`/`keyColumn` come from the FK metadata;
 * `labelColumns` is what the catalog CANNOT infer (which column to show the user) — supply it per FK.
 */
export interface LookupConfig {
  readonly refTable: string;
  readonly keyColumn: string;
  readonly labelColumns: readonly string[];
  readonly orderBy?: readonly string[];
  readonly limit?: number;
}

/** The declarative per-column editor descriptor. */
export interface EditorSpec {
  readonly column: string;
  readonly title: string;
  readonly kind: EditorKind;
  readonly readOnly: boolean;
  readonly null: NullPolicy;
  /** Live keystroke filter + on-commit validation (drives `Input.valid()` / the `Dialog.valid()` gate). */
  readonly validator?: Validator;
  /** Cell text when NOT editing (default `String(value)`). */
  readonly format?: (value: unknown) => string;
  readonly width?: ColumnWidth;
  readonly align?: ColumnAlign;
  readonly enum?: EnumConfig;
  readonly lookup?: LookupConfig;
}

/** A per-column override merged over the auto-derived spec — the escape hatch for catalog gaps. */
export type EditorOverride = Partial<Omit<EditorSpec, 'column'>>;

/** One row of an FK lookup dropdown: the stored key + the human label. */
export interface LookupItem {
  readonly key: string;
  readonly label: string;
}

/** The host a cell editor needs at mount time (async lookup loads, etc.). */
export interface CellEditorHost {
  /** Load the FK lookup rows (server-side, parameterized) — `SELECT key, label FROM refTable …`. */
  loadLookup(cfg: LookupConfig): Promise<LookupItem[]>;
}

// --- derivation -------------------------------------------------------------

/** Map an introspected column to its editor kind (mirrors Probe 1's `proposeEditor`, widget-level). */
function deriveKind(col: ColumnMeta, isFk: boolean): EditorKind {
  if (col.generated === 's' || col.identity === 'a') return 'readonly';
  if (isFk) return 'lookup';
  if (col.enumValues) return 'enum';
  switch (col.udtName) {
    case 'text':
    case 'varchar':
    case 'bpchar':
    case 'name':
    case 'uuid':
      return 'text';
    case 'int2':
    case 'int4':
    case 'int8':
      return 'integer';
    case 'numeric':
    case 'float4':
    case 'float8':
      return 'decimal';
    case 'bool':
      return 'boolean';
    case 'date':
      return 'date';
    case 'timestamp':
    case 'timestamptz':
      return 'datetime';
    case 'jsonb':
    case 'json':
      return 'json';
    default:
      return col.udtName.startsWith('_') ? 'array' : 'text';
  }
}

/** A paging-safe default width per kind (never `auto` — an `auto` column forces a full scan; Probe 3b). */
function widthFor(kind: EditorKind): ColumnWidth {
  switch (kind) {
    case 'integer':
      return 8;
    case 'decimal':
      return 12;
    case 'boolean':
      return 5;
    case 'date':
      return 12;
    case 'datetime':
      return 20;
    default:
      return 18;
  }
}

/** A sensible default keystroke filter per kind (bounds come from CHECK parsing or an override later). */
function defaultValidator(kind: EditorKind): Validator | undefined {
  if (kind === 'integer') return filter('0-9-');
  if (kind === 'decimal') return filter('0-9.-');
  return undefined;
}

/**
 * Derive an {@link EditorSpec} per column from `TableMeta`, then apply per-column overrides. Read-only
 * relations (a view) and generated/identity columns come back `readOnly`. FK columns become `lookup`
 * with `labelColumns` left empty for the caller to supply.
 *
 * @example
 * const meta = await introspect('app', 'order');
 * const editors = resolveEditors(meta, {
 *   customer_id: { title: 'Customer', kind: 'lookup',
 *     lookup: { refTable: 'app.customer', keyColumn: 'id', labelColumns: ['name'] } },
 *   status: { kind: 'enum', enum: { values: ['open', 'paid', 'shipped', 'cancelled'] } }, // CHECK-enum
 *   total: { align: 'right', width: 12 },
 * });
 */
export function resolveEditors(meta: TableMeta, overrides: Record<string, EditorOverride> = {}): EditorSpec[] {
  const fkByCol = new Map<string, ForeignKeyMeta>();
  for (const fk of meta.foreignKeys) for (const c of fk.columns) fkByCol.set(c, fk);

  return meta.columns.map((col): EditorSpec => {
    const fk = fkByCol.get(col.name);
    const kind = deriveKind(col, fk !== undefined);
    const base: EditorSpec = {
      column: col.name,
      title: col.name,
      kind,
      readOnly: !meta.updatable || kind === 'readonly',
      null: { nullable: !col.notNull },
      validator: defaultValidator(kind),
      width: widthFor(kind),
      align: kind === 'integer' || kind === 'decimal' ? 'right' : 'left',
      enum: col.enumValues ? { values: col.enumValues } : undefined,
      lookup: fk ? { refTable: fk.refTable, keyColumn: fk.refColumns[0], labelColumns: [] } : undefined,
    };
    const ov = overrides[col.name];
    return ov ? { ...base, ...ov, null: { ...base.null, ...ov.null } } : base;
  });
}

// --- typed adapters (the honest cost of binding typed controls to a string buffer) -----------------

/** `Signal<boolean[]>` for a CheckGroup ⟷ a `'true'/'false'` string field (owned by the editor scope). */
function boolBridge(field: Signal<string>): Signal<boolean[]> {
  const b = signal<boolean[]>([field() === 'true']);
  effect(() => {
    const v = field() === 'true';
    untrack(() => b()[0] !== v && b.set([v]));
  });
  effect(() => {
    const v = b()[0] ? 'true' : 'false';
    untrack(() => field() !== v && field.set(v));
  });
  return b;
}

/** `Signal<CalendarDate|null>` for a DatePicker ⟷ an ISO `'YYYY-MM-DD'` string field. */
function dateBridge(field: Signal<string>): Signal<CalendarDate | null> {
  const d = signal<CalendarDate | null>(parseISO(field()));
  effect(() => {
    const parsed = parseISO(field());
    untrack(() => d.set(parsed));
  });
  effect(() => {
    const iso = d() ? toISO(d()!) : '';
    untrack(() => field() !== iso && field.set(iso));
  });
  return d;
}

/** `Signal<string|null>` for a select-only ComboBox ⟷ the string field (`''` ⟷ `null`). */
function stringOrNullBridge(field: Signal<string>): Signal<string | null> {
  const s = signal<string | null>(field() === '' ? null : field());
  effect(() => {
    const v = field() === '' ? null : field();
    untrack(() => s.set(v));
  });
  effect(() => {
    const v = s() ?? '';
    untrack(() => field() !== v && field.set(v));
  });
  return s;
}

/** `Signal<LookupItem|null>` for an FK ComboBox ⟷ the string field holding the FK key. */
function lookupBridge(field: Signal<string>, items: Signal<LookupItem[]>): Signal<LookupItem | null> {
  const sel = signal<LookupItem | null>(null);
  effect(() => {
    const key = field();
    const match = items().find((it) => it.key === key) ?? null;
    untrack(() => sel.set(match));
  });
  effect(() => {
    const key = sel()?.key ?? '';
    untrack(() => field() !== key && field.set(key));
  });
  return sel;
}

/**
 * Mount the concrete editor for a cell: the right widget bound to the RecordSet's string `field()`
 * buffer via a typed adapter. Call it INSIDE the editor overlay's reactive root (like
 * `openAnchoredPopup`) so the adapter effects are owned and disposed on close.
 *
 * `readonly`/`datetime` return `null` (no in-cell editor: read-only shows text; datetime wants a
 * composite date+time editor that does not ship yet).
 */
export function createCellEditor(spec: EditorSpec, field: Signal<string>, host: CellEditorHost): View | null {
  switch (spec.kind) {
    case 'text':
    case 'integer':
    case 'decimal':
    case 'json':
    case 'array':
      // json/array edit the raw text for now; a structured editor is deferred.
      return new Input({ value: field, validator: spec.validator });
    case 'boolean':
      return new CheckGroup({ labels: [spec.title], value: boolBridge(field) });
    case 'date':
      return new DatePicker({ value: dateBridge(field) });
    case 'enum': {
      const items = signal<string[]>([...(spec.enum?.values ?? [])]);
      return new ComboBox<string>({ items, getText: (s) => s, value: stringOrNullBridge(field), editable: false });
    }
    case 'lookup': {
      const items = signal<LookupItem[]>([]);
      if (spec.lookup) void host.loadLookup(spec.lookup).then((rows) => items.set(rows));
      return new ComboBox<LookupItem>({
        items,
        getText: (it) => it.label,
        value: lookupBridge(field, items),
        editable: false,
      });
    }
    case 'datetime':
    case 'readonly':
    default:
      return null;
  }
}
