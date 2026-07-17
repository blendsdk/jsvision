/**
 * The data source seam the grid body binds to, plus its in-memory realization.
 *
 * `GridDataSource<T>` is the single read shape the grid understands — satisfied by both an in-memory
 * array and a windowed/server source — so the body is agnostic to where rows come from. `fromRows`
 * is the in-memory source over a reactive `Signal<T[]>`. Every source carries a required `rowKey` for
 * stable row identity.
 */
import type { Signal } from '@jsvision/ui';
import type { SortKey } from './sort.js';
import type { FilterModel, DistinctResult } from './filter.js';
import type { Key } from './selection.js';

/**
 * The read/mutate seam the grid body binds to. In-memory and windowed/server sources implement this
 * same shape, so the body is source-agnostic. Only `rowKey`/`length`/`rowAt` are exercised in the
 * read-only foundation; the optional push-down and windowing members are declared for later releases.
 *
 * `rowAt` returns `undefined` for an out-of-range or not-yet-loaded index (a windowed source may not
 * have the row yet); an in-memory source always has every in-range row.
 */
export interface GridDataSource<T> {
  /** Stable identity for a row (required). */
  rowKey: (row: T) => string | number;
  /** Total row count (best-known for a windowed source). */
  length(): number;
  /** The row at a display-ordered index, or `undefined` when out of range / not yet loaded. */
  rowAt(index: number): T | undefined;
  /**
   * Insert a row at a **source-array** index (append when `at` is omitted). Optional — a source that
   * omits it is read-only, so the grid can never add through it. The row must already carry its own
   * `rowKey` (the caller owns key generation). A windowed/server source uses this callback to persist.
   */
  insert?(row: T, at?: number): void | Promise<void>;
  /**
   * Remove rows by key. Optional — a source that omits it is read-only, so the grid can never delete
   * through it. Keys not present are ignored. A windowed/server source uses this callback to persist.
   */
  remove?(keys: readonly Key[]): void | Promise<void>;
  /** Prefetch a window of rows (windowed sources; a later release). */
  ensureRange?(start: number, end: number): void | Promise<void>;
  /** Push sort down to the source; omit for client-side sorting (a later release). */
  setSort?(keys: SortKey[]): void;
  /** Push filtering down to the source; omit for client-side filtering (a later release). */
  setFilter?(model: FilterModel): void;
  /**
   * Distinct formatted labels for a column, for value-list filtering (a later release). Returns the
   * labels plus an optional `truncated` flag so a bounded/windowed source can disclose a capped list
   * instead of silently under-reporting.
   */
  distinct?(columnId: string): Promise<DistinctResult>;
  /**
   * Whether every row is loaded in memory. Omit it (or return `true`) for an eager in-memory source, so a
   * footer aggregate renders a clean grand total. A windowed/server source that has loaded only part of
   * the dataset returns `false`, and the footer labels its aggregates `"(loaded)"` — a total over the
   * loaded set is never passed off as a whole-dataset grand total.
   */
  complete?(): boolean;
}

/**
 * Build an in-memory data source over a reactive rows signal. `length`/`rowAt` read the signal, so a
 * container that reads them inside a reactive scope re-runs when `rows` changes. `rowKey` is required.
 *
 * It also implements the `insert`/`remove` mutation seam: each splices a **new** array into the signal
 * (never mutating in place), so every reader re-derives and the grid repaints. The caller owns key
 * generation — `insert` takes a row that already carries its `rowKey`.
 *
 * @param rows A signal holding the display-ordered rows.
 * @param opts Row identity — `rowKey` maps a row to a stable string/number key (required).
 * @returns A `GridDataSource` backed by the signal, with the mutation seam wired.
 * @example
 * ```ts
 * import { signal } from '@jsvision/ui';
 * import { fromRows } from '@jsvision/datagrid';
 * const rows = signal([{ id: 1, name: 'Ada' }, { id: 2, name: 'Bo' }]);
 * const source = fromRows(rows, { rowKey: (r) => r.id });
 * source.length();            // 2
 * source.rowAt(0);            // { id: 1, name: 'Ada' }
 * source.insert!({ id: 3, name: 'Cy' }); // appended → rows() has 3 entries
 * source.remove!([1]);        // drops id 1 → rows() is [{ id: 2 }, { id: 3 }]
 * ```
 */
export function fromRows<T>(rows: Signal<T[]>, opts: { rowKey: (row: T) => string | number }): GridDataSource<T> {
  return {
    rowKey: opts.rowKey,
    length: () => rows().length,
    rowAt: (index) => rows()[index],
    insert(row, at) {
      const next = rows().slice();
      next.splice(at ?? next.length, 0, row);
      rows.set(next);
    },
    remove(keys) {
      const drop = new Set(keys);
      rows.set(rows().filter((r) => !drop.has(opts.rowKey(r))));
    },
  };
}

/**
 * Build a reactive, **write-through** {@link GridDataSource} — the twin of {@link fromRows} for rows that
 * are a *function* of other state (e.g. a master grid's focused record).
 *
 * `read` supplies the current rows; it is evaluated inside the grid's reactive derivation, so the grid
 * re-derives whenever a signal `read` touches changes. `insert`/`remove` delegate to caller writers that
 * mutate the **owning** collection, so a structural edit on this source persists there. Omit a writer to
 * make the source read-only for that operation — the grid's `insertRow`/`deleteRows` then no-op
 * gracefully (cell edits still work via the in-place `version` path). `complete` feeds the footer honesty
 * label (omit ⇒ complete).
 *
 * The caller contract: `read` must return **stable references** into the owned model (not fresh objects
 * each call) for cell edits to persist, and should stay cheap — the grid calls it once per row per
 * re-derivation, so a filtering `read` over a large set is O(n²) per derivation.
 *
 * @param read Returns the current rows (evaluated in the grid's reactive scope).
 * @param opts `rowKey` (required identity), optional `insert`/`remove` write-through writers, and an
 *   optional `complete` completeness predicate.
 * @returns A reactive write-through `GridDataSource`.
 * @example
 * ```ts
 * import { signal } from '@jsvision/ui';
 * import { fromReactiveRows } from '@jsvision/datagrid';
 * interface Line { id: number; orderId: number }
 * const lines = signal<Line[]>([{ id: 1, orderId: 7 }]);
 * const focusedOrderId = 7;
 * const source = fromReactiveRows(() => lines().filter((l) => l.orderId === focusedOrderId), {
 *   rowKey: (l) => l.id,
 *   insert: (row, at) => { const n = lines().slice(); n.splice(at ?? n.length, 0, row); lines.set(n); },
 *   remove: (keys) => { const drop = new Set(keys); lines.set(lines().filter((l) => !drop.has(l.id))); },
 * });
 * ```
 */
export function fromReactiveRows<T>(
  read: () => readonly T[],
  opts: {
    rowKey: (row: T) => string | number;
    insert?: (row: T, at?: number) => void;
    remove?: (keys: readonly Key[]) => void;
    complete?: () => boolean;
  },
): GridDataSource<T> {
  const source: GridDataSource<T> = {
    rowKey: opts.rowKey,
    length: () => read().length,
    rowAt: (index) => read()[index],
  };
  // Present the mutation/completeness members only when supplied — an absent `insert`/`remove` is what
  // makes `EditableDataGrid.insertRow`/`deleteRows` no-op (the read-only-source contract).
  if (opts.insert) source.insert = opts.insert;
  if (opts.remove) source.remove = opts.remove;
  if (opts.complete) source.complete = opts.complete;
  return source;
}
