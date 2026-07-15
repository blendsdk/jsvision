/**
 * The pure, view-free sort model for `@jsvision/datagrid`: the ordered multi-key data model and the
 * one comparator every sort path (header click, keyboard, imperative API, client re-sort) shares.
 *
 * Like the engine's column helpers this module holds no view state and no signals — callers pass a
 * plain row snapshot, so every function is deterministic and directly unit-testable. A single-column
 * sort is just a one-element key list. Values are compared by their TYPED value (from
 * `GridColumn.value`), never by the formatted display string, so a numeric column orders `9` before
 * `1000` rather than lexically.
 */
import type { GridColumn } from './column.js';

/** A sort direction. */
export type SortDir = 'asc' | 'desc';

/**
 * One directive in an ordered sort: which column, which way. A single-column sort is a one-element
 * list; a multi-column sort lists keys in priority order (first key is primary).
 */
export interface SortKey {
  /** The column to sort by (its `GridColumn.id`). */
  readonly columnId: string;
  /** Sort direction. */
  readonly dir: SortDir;
}

/**
 * The one case-insensitive collator the string branch uses, built lazily and memoized. `sensitivity:
 * 'accent'` makes letter case tie (so `apple` and `Apple` are equal) while keeping accents distinct;
 * `numeric: false` because numeric columns already compare as numbers before reaching here.
 */
let cachedCollator: Intl.Collator | undefined;
function collator(): Intl.Collator {
  return (cachedCollator ??= new Intl.Collator(undefined, { sensitivity: 'accent', numeric: false }));
}

/**
 * The type-aware default order for two non-null values: numbers numerically, `Date`s chronologically,
 * everything else by the case-insensitive collator over `String(value)`. Nulls are handled by the
 * caller ({@link compareOneKey}) before this runs, so neither argument is null/undefined here.
 */
function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return collator().compare(String(a), String(b));
}

/**
 * Compare two values for one sort key. Null/undefined ordering is absolute (independent of `dir`,
 * matching SQL `NULLS FIRST/LAST`): a nil sorts to the top when `col.nulls === 'first'`, otherwise to
 * the bottom (default `'last'`). A custom `col.compare` (or the type-aware default) applies only to two
 * non-null values, and the `dir` sign is applied to its result — so a custom `compare` never sees a nil.
 */
function compareOneKey<T>(va: unknown, vb: unknown, col: GridColumn<T>, dir: SortDir): number {
  const aNil = va === null || va === undefined;
  const bNil = vb === null || vb === undefined;
  if (aNil || bNil) {
    if (aNil && bNil) return 0;
    const nullsFirst = col.nulls === 'first';
    // The nil goes to the top (first) or bottom (last), NOT flipped by dir.
    return aNil ? (nullsFirst ? -1 : 1) : nullsFirst ? 1 : -1;
  }
  const base = col.compare ? col.compare(va, vb) : compareValues(va, vb);
  return dir === 'desc' ? -base : base;
}

/**
 * Ordered multi-key sort. Compares each column's typed value in key order, returning the first
 * non-zero result; equal-on-all-keys rows keep their source order (stable). Never mutates `rows` —
 * always returns a new array. Keys whose `columnId` is absent from `columns` are silently dropped; an
 * empty (or all-unknown) key list returns the rows in source order.
 *
 * @param rows The row snapshot to order (not mutated).
 * @param keys The ordered sort directives (first is primary).
 * @param columns The column model, keyed by `GridColumn.id`, providing each key's `value` accessor and
 *   its optional `compare`/`nulls`.
 * @returns A new array of `rows` in sorted order.
 * @example
 * ```ts
 * import { column, sortRowsMulti } from '@jsvision/datagrid';
 * interface Sale { region: string; qty: number; }
 * const columns = [
 *   column({ id: 'region', title: 'Region', value: (r: Sale) => r.region }),
 *   column({ id: 'qty', title: 'Qty', value: (r: Sale) => r.qty }),
 * ];
 * // qty ascending, then region descending:
 * const ordered = sortRowsMulti(
 *   rows,
 *   [{ columnId: 'qty', dir: 'asc' }, { columnId: 'region', dir: 'desc' }],
 *   new Map(columns.map((c) => [c.id, c])),
 * );
 * ```
 */
export function sortRowsMulti<T>(
  rows: readonly T[],
  keys: readonly SortKey[],
  columns: ReadonlyMap<string, GridColumn<T>>,
): T[] {
  const active = keys.filter((k) => columns.has(k.columnId));
  if (active.length === 0) return [...rows];
  // Array.prototype.sort is stable on Node >= 22, so equal-key rows keep source order; the spread
  // copy keeps `rows` unmutated.
  return [...rows].sort((a, b) => {
    for (const key of active) {
      const col = columns.get(key.columnId)!;
      const r = compareOneKey(col.value(a), col.value(b), col, key.dir);
      if (r !== 0) return r;
    }
    return 0;
  });
}
