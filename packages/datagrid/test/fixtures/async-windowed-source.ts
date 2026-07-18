/**
 * An async paged windowed `GridDataSource` double — the counterpart to the eager `windowed-source.ts`.
 *
 * Unlike the eager double, this one only holds the pages that have been fetched: `rowAt` returns
 * `undefined` for a not-yet-loaded index (and kicks off the page fetch), and a landed page bumps a
 * reactive `revision` signal so the grid re-derives and repaints. It is the runnable proof that the
 * windowed read path works end-to-end, the showcase demo source, and — via its `rowAt` access counter —
 * the **scan tripwire**: a test asserts the counter stays ≈ O(visible window), never ≈ `length()`,
 * proving nothing full-scanned the dataset.
 *
 * Determinism: `fetchPage` is the caller's async loader. In tests it resolves synchronously
 * (`Promise.resolve(page)`) and the test awaits `settle()` (or pumps a microtask), so no wall-clock
 * timing is involved. Pages are **retained** (no eviction), which keeps returned row references stable
 * and mutable — an in-place cell edit persists — and sidesteps any dirty-page/edit-loss race.
 */
import { signal } from '@jsvision/ui';
import type { GridDataSource } from '../../src/data-source.js';
import type { Key } from '../../src/selection.js';
import type { SortKey } from '../../src/sort.js';
import type { FilterModel, DistinctResult } from '../../src/filter.js';

/** Construction options for {@link asyncWindowedSource}. */
export interface AsyncWindowedOptions<T> {
  /** The grand total row count (`source.length()`). */
  readonly total: number;
  /** Rows per page — `rowAt(i)` maps to page `Math.floor(i / pageSize)`. */
  readonly pageSize: number;
  /** The caller's async page loader — resolves the rows for a 0-based page index. */
  readonly fetchPage: (page: number) => Promise<T[]>;
  /** Stable identity for a row. */
  readonly rowKey: (row: T) => Key;
  /** Optional distinct-label provider for value-list filtering (defaults to an empty, non-truncated list). */
  readonly distinct?: (columnId: string) => Promise<DistinctResult>;
}

/** The recorded push-down / prefetch calls, so a test can assert push-down fired and no client scan ran. */
export interface AsyncWindowedSpies {
  readonly setSort: SortKey[][];
  readonly setFilter: FilterModel[];
  readonly distinct: string[];
  readonly ensureRange: Array<[number, number]>;
}

/** The async paged source plus the test affordances tests drive it through. */
export type AsyncWindowedSource<T> = GridDataSource<T> & {
  /** Prefetch the pages covering `[start, end)`; the Promise settles when they land. Always present here. */
  ensureRange(start: number, end: number): Promise<void>;
  /** The reactive revision read (a landed page bumps it). Declared here so the fixture is self-contained. */
  revision(): number;
  /** Resolve once every in-flight page fetch has landed (loops so a cascade settles fully). */
  settle(): Promise<void>;
  /** The recorded push-down / prefetch calls. */
  readonly spies: AsyncWindowedSpies;
  /** How many times `rowAt` has been called — the scan tripwire (reset with {@link resetCounts}). */
  rowAtCount(): number;
  /** Zero the `rowAt` access counter so a test measures only the accesses it is about to trigger. */
  resetCounts(): void;
  /** The number of rows currently resident in loaded pages (feeds `complete()`). */
  loadedRowCount(): number;
  /** Simulate a server re-report of the (filtered) total — drives the filtered-total limitation test. */
  setTotal(next: number): void;
};

/**
 * Build an async paged windowed source over a caller-supplied page loader.
 *
 * @param opts The grand total, page size, async `fetchPage` loader, `rowKey`, and optional `distinct`.
 * @returns A {@link GridDataSource} that yields `undefined` for unloaded rows (kicking a fetch) and
 *   bumps a reactive `revision` on each landed page, plus the test affordances in {@link AsyncWindowedSource}.
 */
export function asyncWindowedSource<T>(opts: AsyncWindowedOptions<T>): AsyncWindowedSource<T> {
  const { pageSize, fetchPage, rowKey } = opts;
  let total = opts.total;
  const pages = new Map<number, T[]>();
  const inFlight = new Map<number, Promise<void>>();
  // The reactive repaint seam: a landed page bumps this, and the grid's display derivation reads it
  // (a tracked signal read), so the newly-loaded rows repaint. Not the fetch-settle channel.
  const revision = signal(0);
  let accesses = 0;
  const spies: AsyncWindowedSpies = { setSort: [], setFilter: [], distinct: [], ensureRange: [] };

  /** Fetch a page once — an in-flight or already-loaded page is never re-fetched (idempotent). */
  function ensurePage(page: number): Promise<void> {
    if (pages.has(page)) return Promise.resolve();
    const existing = inFlight.get(page);
    if (existing !== undefined) return existing;
    const p = fetchPage(page).then((rows) => {
      pages.set(page, rows);
      inFlight.delete(page);
      revision.set(revision() + 1); // a landed page → repaint
    });
    inFlight.set(page, p);
    return p;
  }

  const source: AsyncWindowedSource<T> = {
    rowKey,
    length: () => total,
    rowAt(index) {
      accesses += 1;
      if (index < 0 || index >= total) return undefined;
      const page = Math.floor(index / pageSize);
      const rows = pages.get(page);
      if (rows === undefined) {
        void ensurePage(page); // miss → kick the fetch, return a hole for now
        return undefined;
      }
      return rows[index - page * pageSize];
    },
    ensureRange(start, end) {
      spies.ensureRange.push([start, end]);
      const firstPage = Math.floor(start / pageSize);
      // `end` is half-open, so the last covered row is `end - 1`; clamp so an empty range touches nothing.
      const lastPage = Math.floor(Math.max(start, end - 1) / pageSize);
      const wanted: Promise<void>[] = [];
      for (let page = firstPage; page <= lastPage; page += 1) wanted.push(ensurePage(page));
      return Promise.all(wanted).then(() => undefined);
    },
    revision: () => revision(),
    setSort(keys) {
      spies.setSort.push(keys);
    },
    setFilter(model) {
      spies.setFilter.push(model);
    },
    distinct(columnId) {
      spies.distinct.push(columnId);
      return opts.distinct ? opts.distinct(columnId) : Promise.resolve({ values: [], truncated: false });
    },
    complete: () => source.loadedRowCount() === total,
    async settle() {
      while (inFlight.size > 0) await Promise.all([...inFlight.values()]);
    },
    spies,
    rowAtCount: () => accesses,
    resetCounts() {
      accesses = 0;
    },
    loadedRowCount() {
      let count = 0;
      for (const rows of pages.values()) count += rows.length;
      return Math.min(count, total);
    },
    setTotal(next) {
      total = next;
    },
  };
  return source;
}
