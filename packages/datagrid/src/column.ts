/**
 * The typed column model for `@jsvision/datagrid` and the adapter that bridges it to the
 * `@jsvision/ui` grid engine.
 *
 * A `GridColumn<T, V>` carries a **typed** value: `value(row)` is the sort/filter key, `format(value)`
 * is the display string, and `parse(text)` is the edit round-trip. The engine, by contrast, renders
 * and sorts a plain string accessor. `toEngineColumn` bridges the two — the display string comes from
 * `format(value)` (or `String(value)`), and the sort comparator is synthesized from the typed value —
 * so a numeric or date column orders by its value, never by the formatted text.
 */
import type { Column, ColumnWidth, ColumnAlign, ThemeRoleName, Style } from '@jsvision/ui';
import type { CellEditorSpec } from './cell-editor.js';
import type { ParseFailed } from './format.js';
import type { CellRenderer } from './cell-draw.js';
import type { FilterType } from './filter.js';

/**
 * Value-driven cell colour. Returns either a theme role name (resolved against the active theme) or an
 * explicit {@link Style}. Composited under the fixed cell precedence
 * (cursor > dirty > selected-row > cellStyle > zebra > normal), so a higher-precedence state wins.
 */
export type CellStyle<T, V> = (value: V, row: T) => ThemeRoleName | Style;

/**
 * One typed column of a data grid: a stable `id`, a header `title`, a typed `value` accessor (the
 * sort/filter key), and optional display `format`, edit `parse`, sizing `width`, and `align`. When
 * `format` is omitted the cell shows `String(value)`; a read-only column may define `format` without
 * `parse`. Author columns with {@link column} so `V` is inferred from `value` and `format`/`parse`
 * are type-checked against it.
 */
export interface GridColumn<T, V = unknown> {
  /** Stable column identifier (used by sort/filter/layout state). */
  readonly id: string;
  /** Header cell text. */
  readonly title: string;
  /** Extracts this column's typed value from a row — the sort/filter key. */
  readonly value: (row: T) => V;
  /** Formats the value for display (default: `String(value)`). */
  readonly format?: (value: V, row: T) => string;
  /**
   * Parses edited text back to the typed value (editable columns only). May return the `PARSE_FAILED`
   * sentinel for an unparseable string (as the invertible `fmt.*` formatters do); the commit path
   * rejects that — the record is left unchanged and the editor stays open.
   */
  readonly parse?: (text: string) => V | ParseFailed;
  /**
   * Writes the parsed value back into the record (editable columns only). Pairs with `parse`: a
   * column is editable exactly when it has both, so an edit round-trips text → value → record.
   */
  readonly set?: (row: T, value: V) => void;
  /** Sizing rule (default `'auto'` when adapted): fixed cells, `${n}fr`, or `'auto'`. */
  readonly width?: ColumnWidth;
  /**
   * Minimum width in cells. A resize clamps to this floor and an `'auto'`/`fr` column never
   * apportions below it. Defaults to a small built-in floor when omitted.
   */
  readonly minWidth?: number;
  /**
   * Maximum width in cells. Caps apportionment and bounds auto-fit (auto-fit falls back to a
   * generous built-in default when omitted). An interactive resize is not capped unless this is set.
   */
  readonly maxWidth?: number;
  /** Text alignment within the column width. */
  readonly align?: ColumnAlign;
  /**
   * The cell editor to mount: a literal {@link CellEditorSpec}, or a per-row function that returns one.
   * Absent on an editable column (one with `parse` + `set`) mounts a plain text input; a read-only
   * column ignores it. Use it to pick a typed widget — e.g. `{ kind: 'boolean' }` or
   * `{ kind: 'lookup', items }` — or `{ kind: 'readonly' }` to make an otherwise-editable column read-only.
   */
  readonly editor?: CellEditorSpec | ((row: T) => CellEditorSpec);
  /**
   * Custom cell painter — the escape hatch for glyph indicators, badges, and traffic lights. Draws into
   * a cell-local, cell-clipped context (origin at the cell's top-left) and is draw-error isolated: a
   * throw degrades only its own cell. When set, it replaces the default formatted text for the cell.
   */
  readonly render?: CellRenderer<T, V>;
  /**
   * Value-driven cell colour, composited under the fixed precedence
   * (cursor > dirty > selected-row > cellStyle > zebra > normal): it paints only when no higher state
   * (the cursor cell, a pending commit, or the selected/focused row) owns the cell.
   */
  readonly cellStyle?: CellStyle<T, V>;
  /**
   * Custom order for this column's values, overriding the type-aware default (numbers, dates, then a
   * case-insensitive collator). Receives only non-null values — null/undefined ordering is governed by
   * `nulls`. Returns `<0` / `0` / `>0` like `Array.prototype.sort`'s comparator.
   */
  readonly compare?: (a: V, b: V) => number;
  /** Where null/undefined values sort, independent of direction (default `'last'`). */
  readonly nulls?: 'first' | 'last';
  /**
   * The operator family the column's filter popup presents (`'text'` / `'number'` / `'date'`). When
   * omitted it is inferred at runtime from a sampled non-null value (a number → `'number'`, a `Date`
   * or `CalendarDate` → `'date'`, otherwise `'text'`); set it to override a sparse or ambiguous
   * column whose sample would misclassify.
   */
  readonly filterType?: FilterType;
  /**
   * Whether this column participates in filtering (default `true`). A `false` column shows **no**
   * header funnel and its funnel cell is not hit-testable, its quick-filter input is omitted, and the
   * `Alt+Down` open-filter shortcut is a no-op while one of its cells is focused — use it for
   * action/icon columns, or any column that should never be filtered. Column geometry is unaffected:
   * the funnel reserve and the quick-filter slot are simply not taken.
   *
   * @example
   * ```ts
   * import { column } from '@jsvision/datagrid';
   * interface Row { name: string; }
   * // An action column that never shows a funnel and has no quick-filter input:
   * const actions = column({ id: 'actions', title: '', value: (_r: Row) => '', filterable: false });
   * ```
   */
  readonly filterable?: boolean;
  /**
   * Show the filter funnel `▽` on this column's header **at all times** (default `false`). By default a
   * column's funnel appears only while it has an active filter (emphasized) and the header is otherwise
   * clean; set this to advertise the filter affordance permanently — the glyph is drawn muted when
   * unfiltered and emphasized when a filter is active. Independent of the keyboard opener: `Alt+Down`
   * opens the condition popup on any filterable column regardless of this flag. Ignored when
   * `filterable` is `false` (a non-filterable column never shows a funnel). Reserving the funnel cell
   * clips a title that would otherwise fill the full column width by one cell.
   *
   * @example
   * ```ts
   * import { column } from '@jsvision/datagrid';
   * interface Row { region: string; }
   * // A column that always advertises its filter funnel, even before any filter is applied:
   * const region = column({ id: 'region', title: 'Region', value: (r: Row) => r.region, showFunnel: true });
   * ```
   */
  readonly showFunnel?: boolean;
}

/**
 * Author a typed column. Infers the value type `V` from `value`, so `format`/`parse` are type-checked
 * against it, then returns the column in the uniform storage shape so differently-typed columns
 * collect into one `GridColumn<T>[]`.
 *
 * Authoring is per column, not per array: a per-array helper would collapse every element to
 * `unknown`, leaving a typed `format`/`parse` uncheckable.
 *
 * @param col The column definition (`id`, `title`, `value`, and optional `format`/`parse`/`width`/`align`).
 * @returns The same column, typed for collection into a `GridColumn<T>[]`.
 * @example
 * ```ts
 * import { column } from '@jsvision/datagrid';
 * interface Person { name: string; balance: number; }
 * const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
 * const columns = [
 *   column({ id: 'name', title: 'Name', value: (r: Person) => r.name }),
 *   column({
 *     id: 'balance',
 *     title: 'Balance',
 *     value: (r: Person) => r.balance, // v is inferred as number
 *     format: (v) => eur.format(v),
 *     align: 'right',
 *   }),
 * ];
 * ```
 */
export function column<T, V>(col: GridColumn<T, V>): GridColumn<T> {
  // The value type is erased on return so heterogeneously-typed columns share one array type. This is
  // sound: a consumer of `GridColumn<T>` only reads `value(row)` (as `unknown`) and, for display, the
  // string from `format`/`String(value)` — it never feeds a value back into the erased `format`.
  return col as GridColumn<T>;
}

/**
 * Whether a column can be edited: it round-trips text through both `parse` (text → value) and `set`
 * (value → record). A column missing either is read-only — the cursor still lands on it for
 * navigation, but begin-edit is a no-op.
 *
 * @param col The column to test.
 * @returns `true` when the column defines both `parse` and `set`.
 * @example
 * ```ts
 * import { column, isEditable } from '@jsvision/datagrid';
 * interface Person { name: string; }
 * const name = column({
 *   id: 'name', title: 'Name', value: (r: Person) => r.name,
 *   parse: (t) => t, set: (r, v) => { r.name = v; },
 * });
 * const label = column({ id: 'label', title: 'Label', value: (r: Person) => r.name }); // no parse/set
 * isEditable(name);  // true
 * isEditable(label); // false
 * ```
 */
export function isEditable<T>(col: GridColumn<T>): boolean {
  return typeof col.parse === 'function' && typeof col.set === 'function';
}

/**
 * Adapt a typed {@link GridColumn} to the `@jsvision/ui` engine's string-accessor `Column`. The
 * accessor is `format(value, row)` when a formatter is set, else `String(value)`; the comparator is
 * value-aware (numbers/dates order naturally, not by their display text). Internal — the container
 * adapts columns before constructing the engine renderers.
 *
 * @param c The typed column.
 * @returns The engine column (string accessor + synthesized value comparator).
 */
export function toEngineColumn<T, V>(c: GridColumn<T, V>): Column<T> {
  return {
    title: c.title,
    accessor: (row) => {
      const v = c.value(row);
      return c.format ? c.format(v, row) : String(v);
    },
    width: c.width ?? 'auto',
    minWidth: c.minWidth,
    maxWidth: c.maxWidth,
    align: c.align,
    compare: (a, b) => defaultCompare(c.value(a), c.value(b)),
  };
}

/**
 * Value-aware default comparator used by the engine adapter: numbers compare numerically, `Date`s
 * chronologically, strings by locale; `null`/`undefined` sort last; anything else falls back to a
 * locale compare of `String(value)`. Internal.
 *
 * @param a First value.
 * @param b Second value.
 * @returns Negative if `a < b`, positive if `a > b`, zero if equal (ascending order).
 */
export function defaultCompare(a: unknown, b: unknown): number {
  const aNil = a === null || a === undefined;
  const bNil = b === null || b === undefined;
  if (aNil || bNil) return aNil === bNil ? 0 : aNil ? 1 : -1; // nullish sorts last
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  return String(a).localeCompare(String(b));
}
