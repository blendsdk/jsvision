/**
 * The data source seam the grid body binds to, plus its in-memory realization.
 *
 * `GridDataSource<T>` is the single read shape the grid understands — satisfied by both an in-memory
 * array and a windowed/server source — so the body is agnostic to where rows come from. `fromRows`
 * is the in-memory source over a reactive `Signal<T[]>`. Every source carries a required `rowKey` for
 * stable row identity.
 */
import type { Signal } from '@jsvision/ui';

/**
 * A single sort directive. The full sorting model is defined by a later release; this is a
 * forward-declared placeholder so the source contract stays stable.
 */
export interface SortKey {
  /** The column to sort by. */
  readonly columnId: string;
  /** Sort direction. */
  readonly dir: 'asc' | 'desc';
}

/**
 * A filter model applied to the grid's rows. The full filtering model is defined by a later release;
 * this is a forward-declared placeholder so the source contract stays stable.
 */
export interface FilterModel<T> {
  /** Per-column filter conditions (shape defined by the filtering subsystem). */
  readonly conditions?: readonly unknown[];
  /** Phantom marker tying the model to the row type; carries no runtime data. */
  readonly rowType?: (row: T) => void;
}

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
  /** Prefetch a window of rows (windowed sources; a later release). */
  ensureRange?(start: number, end: number): void | Promise<void>;
  /** Push sort down to the source; omit for client-side sorting (a later release). */
  setSort?(keys: SortKey[]): void;
  /** Push filtering down to the source; omit for client-side filtering (a later release). */
  setFilter?(model: FilterModel<T>): void;
  /** Distinct values for a column, for value-list filtering (a later release). */
  distinct?(columnId: string): Promise<string[]>;
}

/**
 * Build an in-memory data source over a reactive rows signal. `length`/`rowAt` read the signal, so a
 * container that reads them inside a reactive scope re-runs when `rows` changes. `rowKey` is required.
 *
 * @param rows A signal holding the display-ordered rows.
 * @param opts Row identity — `rowKey` maps a row to a stable string/number key (required).
 * @returns A `GridDataSource` backed by the signal.
 * @example
 * ```ts
 * import { signal } from '@jsvision/ui';
 * import { fromRows } from '@jsvision/datagrid';
 * const rows = signal([{ id: 1, name: 'Ada' }, { id: 2, name: 'Bo' }]);
 * const source = fromRows(rows, { rowKey: (r) => r.id });
 * source.length();  // 2
 * source.rowAt(0);  // { id: 1, name: 'Ada' }
 * ```
 */
export function fromRows<T>(rows: Signal<T[]>, opts: { rowKey: (row: T) => string | number }): GridDataSource<T> {
  return {
    rowKey: opts.rowKey,
    length: () => rows().length,
    rowAt: (index) => rows()[index],
  };
}
