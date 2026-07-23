/**
 * A demo async **windowed** `GridDataSource` for the Data-at-scale cluster. It serves rows one page at
 * a time from a backing array: `rowAt` returns `undefined` for a not-yet-loaded page (kicking a
 * microtask "fetch"), and a landed page bumps a reactive `revision` so the grid repaints the newly
 * loaded rows. It implements the required `setSort`/`setFilter` push-down (re-querying the backing set
 * with the datagrid's own pure `sortRowsMulti`/`filterRows`), so a header click re-orders server-side —
 * exactly the shape a real server/windowed source has, with no network.
 *
 * Only `revision` is reactive — the ordered view and the loaded pages are plain state, repainted through
 * `revision` alone, so the source never forms a read-write reactive cycle with the grid.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { signal } from '@jsvision/ui';
import { sortRowsMulti, filterRows } from '@jsvision/datagrid';
import type { GridColumn, GridDataSource, SortKey, FilterModel } from '@jsvision/datagrid';

/** A windowed demo source plus the loaded-row read-out a demo echoes. */
export interface WindowedDemoSource<T> extends GridDataSource<T> {
  /** How many rows are currently resident in loaded pages (reactive — reads `revision` to repaint). */
  loadedRowCount(): number;
}

/**
 * Build a windowed demo source over a backing array.
 *
 * @param backing The full row set (copied; the source pages over it lazily).
 * @param opts `rowKey`, the typed `columns` (for push-down sort/filter), and an optional `pageSize`.
 * @returns A windowed {@link GridDataSource} with lazy page loading + `revision` repaint + push-down.
 */
export function createWindowedSource<T>(
  backing: readonly T[],
  opts: { rowKey: (row: T) => string | number; columns: GridColumn<T>[]; pageSize?: number },
): WindowedDemoSource<T> {
  const pageSize = opts.pageSize ?? 100;
  const columnMap = new Map(opts.columns.map((c) => [c.id, c]));
  const base = [...backing];
  const revision = signal(0); // the ONLY reactive seam — a landed page / a re-query bumps it
  let current: T[] = [...base]; // the current sorted/filtered order the pages slice from (plain state)
  let curSort: SortKey[] = [];
  let curFilter: FilterModel = new Map();
  const pages = new Map<number, T[]>();
  const inFlight = new Set<number>();

  /** Re-derive the ordered/filtered view (server-side push-down), drop loaded pages, and repaint. */
  function requery(): void {
    current = sortRowsMulti(filterRows(base, curFilter, columnMap), curSort, columnMap);
    pages.clear();
    revision.update((n) => n + 1);
  }

  /** Fetch a page once (a microtask simulates the async round-trip); a landed page bumps `revision`. */
  function loadPage(page: number): void {
    if (pages.has(page) || inFlight.has(page)) return;
    inFlight.add(page);
    queueMicrotask(() => {
      const start = page * pageSize;
      pages.set(page, current.slice(start, start + pageSize));
      inFlight.delete(page);
      revision.update((n) => n + 1);
    });
  }

  return {
    rowKey: opts.rowKey,
    length: () => current.length,
    rowAt(index) {
      const page = Math.floor(index / pageSize);
      const rows = pages.get(page);
      if (rows === undefined) {
        loadPage(page);
        return undefined;
      }
      return rows[index - page * pageSize];
    },
    ensureRange(start, end) {
      const last = Math.floor(Math.max(start, end - 1) / pageSize);
      for (let page = Math.floor(start / pageSize); page <= last; page += 1) loadPage(page);
    },
    setSort(keys) {
      curSort = keys;
      requery();
    },
    setFilter(model) {
      curFilter = model;
      requery();
    },
    revision: () => revision(),
    complete: () => {
      let count = 0;
      for (const rows of pages.values()) count += rows.length;
      return count === current.length;
    },
    loadedRowCount() {
      revision(); // subscribe so a read-out repaints as pages land
      let count = 0;
      for (const rows of pages.values()) count += rows.length;
      return count;
    },
  };
}
