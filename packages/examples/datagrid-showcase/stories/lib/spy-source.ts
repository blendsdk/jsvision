/**
 * A bespoke in-memory `GridDataSource` that **implements** the optional push-down seams `fromRows`
 * omits — `setSort`, `setFilter`, and `distinct` — so the Sorting and Filtering push-down demos can show
 * the delegation path without a network. It sorts/filters its backing rows in memory (reusing the
 * datagrid's own pure `sortRowsMulti`/`filterRows`), and records the last model it received in reactive
 * signals so a demo can **echo** "pushed down: <model>". Reading `length()`/`rowAt` reflects the
 * resulting view; because those read a signal, a grid bound to this source repaints when the source
 * re-queries.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { signal } from '@jsvision/ui';
import { sortRowsMulti, filterRows, computeDistinct } from '@jsvision/datagrid';
import type { GridColumn, GridDataSource, SortKey, FilterModel } from '@jsvision/datagrid';

/** A {@link GridDataSource} that records the last pushed-down sort/filter model (both reactive). */
export interface SpySource<T> extends GridDataSource<T> {
  /**
   * Push a sort model down. Required here, unlike the optional base seam — implementing it is the
   * entire reason this source exists, so a caller never has to test for its presence.
   */
  setSort(keys: SortKey[]): void;
  /** Push a filter model down. Required here for the same reason as {@link SpySource.setSort}. */
  setFilter(model: FilterModel): void;
  /** The last sort model pushed down via `setSort` (reactive — read it in an effect to drive an echo). */
  lastSort(): SortKey[];
  /** The last filter model pushed down via `setFilter` (reactive). */
  lastFilter(): FilterModel;
}

/**
 * Build an in-memory spy source over a fixed row set.
 *
 * @param initial The backing rows (copied; never mutated).
 * @param opts `rowKey` (stable row identity) and the typed `columns` (used to evaluate sort/filter).
 * @returns A {@link SpySource} that sorts/filters in memory and records what was pushed down.
 */
export function createSpySource<T>(
  initial: readonly T[],
  opts: { rowKey: (row: T) => string | number; columns: GridColumn<T>[] },
): SpySource<T> {
  const base = [...initial];
  const columnMap = new Map(opts.columns.map((c) => [c.id, c]));
  const sortKeys = signal<SortKey[]>([]);
  const filterModel = signal<FilterModel>(new Map());
  const view = signal<T[]>([...base]);

  // Re-derive the view from the recorded models. Called imperatively from setSort/setFilter (which run
  // outside a tracking scope, whether from a test or the grid's push-down effect), so the reads here
  // never subscribe a caller to these signals; the `view.set` is what a bound grid reacts to.
  function recompute(): void {
    const filtered = filterRows(base, filterModel(), columnMap);
    view.set(sortRowsMulti(filtered, sortKeys(), columnMap));
  }

  return {
    rowKey: opts.rowKey,
    length: () => view().length,
    rowAt: (index) => view()[index],
    setSort: (keys) => {
      sortKeys.set(keys);
      recompute();
    },
    setFilter: (model) => {
      filterModel.set(model);
      recompute();
    },
    distinct: (columnId) => {
      const col = columnMap.get(columnId);
      return Promise.resolve({ values: col !== undefined ? computeDistinct(base, col) : [], truncated: false });
    },
    lastSort: () => sortKeys(),
    lastFilter: () => filterModel(),
  };
}
