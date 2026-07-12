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
import type { Column, ColumnWidth, ColumnAlign } from '@jsvision/ui';

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
  /** Parses edited text back to the typed value (editable columns only). */
  readonly parse?: (text: string) => V;
  /** Sizing rule (default `'auto'` when adapted): fixed cells, `${n}fr`, or `'auto'`. */
  readonly width?: ColumnWidth;
  /** Text alignment within the column width. */
  readonly align?: ColumnAlign;
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
