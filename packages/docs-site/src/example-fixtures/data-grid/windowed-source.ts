import { signal } from '@jsvision/ui';
import type { GridDataSource } from '@jsvision/datagrid';
import type { DataGridLabRow } from './data.js';

/** Total size exposed by the procedural documentation source. */
export const WINDOWED_TOTAL_ROWS = 100_000;

/** Read-only evidence returned by the guarded procedural row fixture. */
export interface GuardedWindowedRows {
  /** Generate one bounded slice. */
  readonly readWindow: (start: number, count: number) => readonly DataGridLabRow[];
  /** Number of bounded slice reads made so far. */
  readonly readCount: () => number;
  /** Always false: this fixture deliberately has no full-array operation. */
  readonly fullArrayRead: () => boolean;
}

/** Generate one deterministic row without allocating the complete collection. */
function rowAt(index: number): DataGridLabRow {
  const regions: readonly DataGridLabRow['region'][] = ['North', 'South', 'East', 'West'];
  return {
    id: `record-${index + 1}`,
    name: `Customer ${String(index + 1).padStart(6, '0')}`,
    region: regions[index % regions.length],
    amount: (index * 37) % 10_000,
    active: index % 3 !== 0,
  };
}

/**
 * Create a guarded 100,000-row fixture that only supports bounded slices.
 *
 * @returns A fixture with explicit read evidence and no full-array property.
 */
export function createGuardedWindowedRows(): GuardedWindowedRows {
  let reads = 0;
  return Object.freeze({
    readWindow(start: number, count: number): readonly DataGridLabRow[] {
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || start < 0 || count < 0 || count > 200) {
        throw new RangeError('window reads require a non-negative start and a count no greater than 200');
      }
      reads += 1;
      const end = Math.min(WINDOWED_TOTAL_ROWS, start + count);
      return Array.from({ length: Math.max(0, end - start) }, (_, offset) => rowAt(start + offset));
    },
    readCount: () => reads,
    fullArrayRead: () => false,
  });
}

/** Windowed source plus bounded-work evidence shown by the live labs. */
export interface WindowedDataGridLabSource extends GridDataSource<DataGridLabRow> {
  /** Number of bounded page reads issued so far. */
  readonly readCount: () => number;
  /** Number of generated rows currently held in the page cache. */
  readonly loadedRowCount: () => number;
  /** Always false because the source has no full-array path. */
  readonly fullArrayRead: () => boolean;
}

/**
 * Adapt the guarded fixture to the public `GridDataSource` seam.
 *
 * Pages are generated on demand and cached; resetting sort/filter is deliberately outside this
 * focused fixture because the scale labs teach bounded reads rather than remote query semantics.
 */
export function createWindowedDataGridLabSource(pageSize = 40): WindowedDataGridLabSource {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200) {
    throw new RangeError('pageSize must be an integer from 1 through 200');
  }
  const fixture = createGuardedWindowedRows();
  const revision = signal(0);
  const pages = new Map<number, readonly DataGridLabRow[]>();

  const loadPage = (page: number): void => {
    if (pages.has(page)) return;
    pages.set(page, fixture.readWindow(page * pageSize, pageSize));
    revision.update((value) => value + 1);
  };

  return {
    rowKey: (row) => row.id,
    length: () => WINDOWED_TOTAL_ROWS,
    rowAt(index) {
      if (!Number.isSafeInteger(index) || index < 0 || index >= WINDOWED_TOTAL_ROWS) return undefined;
      const page = Math.floor(index / pageSize);
      loadPage(page);
      return pages.get(page)?.[index - page * pageSize];
    },
    ensureRange(start, end) {
      if (!Number.isFinite(start) || !Number.isFinite(end)) throw new RangeError('window bounds must be finite');
      const boundedStart = Math.max(0, Math.floor(start));
      const boundedEnd = Math.min(WINDOWED_TOTAL_ROWS, Math.max(boundedStart, Math.ceil(end)));
      if (boundedEnd - boundedStart > 600) throw new RangeError('a lab request may cover at most 600 rows');
      for (
        let page = Math.floor(boundedStart / pageSize);
        page <= Math.floor(Math.max(boundedStart, boundedEnd - 1) / pageSize);
        page += 1
      ) {
        loadPage(page);
      }
    },
    setSort() {
      // A real remote source would include the sort model in its next request. This procedural lab
      // invalidates its bounded cache so the next visible window is re-read through the same seam.
      pages.clear();
      revision.update((value) => value + 1);
    },
    setFilter() {
      // Filtering is intentionally not simulated client-side over partial data. Cache invalidation
      // models a new remote query without ever materializing the complete procedural collection.
      pages.clear();
      revision.update((value) => value + 1);
    },
    revision: () => revision(),
    complete: () => false,
    readCount: fixture.readCount,
    loadedRowCount: () => [...pages.values()].reduce((total, rows) => total + rows.length, 0),
    fullArrayRead: fixture.fullArrayRead,
  };
}
