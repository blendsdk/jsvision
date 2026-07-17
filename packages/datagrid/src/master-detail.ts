/**
 * The `masterDetail` link helper — wires a detail {@link EditableDataGrid} to a master grid's **focused**
 * record via reactivity, and owns the teardown of that wiring.
 *
 * The detail is built once, inside a fresh reactive scope, and handed a `focused` accessor over the
 * master's `focusedRow()`. A detail typically backs its source with {@link fromReactiveRows} closing over
 * that accessor, so moving the master cursor re-derives the detail's rows — and, because the source is
 * write-through, cell edits and insert/delete on the detail persist into the master's owned collection.
 * The returned `dispose()` tears the scope down; it is also registered on the ambient reactive owner (if
 * any), so the detail is freed with the surrounding scope even if `dispose()` is never called by hand.
 */
import { createRoot, getOwner, onCleanup, runWithOwner } from '@jsvision/ui';
import type { EditableDataGrid } from './grid.js';

/**
 * Link a detail grid to `master`'s focused record.
 *
 * @param master The master grid whose focused record drives the detail.
 * @param buildDetail Receives a reactive `focused` accessor (over `master.focusedRow()`) and returns the
 *   detail grid — typically backed by `fromReactiveRows(() => …focused()…)`.
 * @returns The `detail` grid and a `dispose()` that tears down its reactive scope (idempotent; also
 *   fired automatically when the surrounding scope disposes).
 * @example
 * ```ts
 * import { column, fromRows, fromReactiveRows, EditableDataGrid, masterDetail } from '@jsvision/datagrid';
 * import { signal } from '@jsvision/ui';
 * interface Order { id: number }
 * interface Line { id: number; orderId: number }
 * const lines = signal<Line[]>([]);
 * const master = new EditableDataGrid<Order>({ columns, source });
 * const { detail, dispose } = masterDetail(master, (focused) =>
 *   new EditableDataGrid<Line>({
 *     columns: lineColumns,
 *     source: fromReactiveRows(() => lines().filter((l) => l.orderId === focused()?.id), {
 *       rowKey: (l) => l.id,
 *     }),
 *   }),
 * );
 * // ...later:
 * dispose(); // tear down the detail's reactive link
 * ```
 */
export function masterDetail<M, D>(
  master: EditableDataGrid<M>,
  buildDetail: (focused: () => M | undefined) => EditableDataGrid<D>,
): { detail: EditableDataGrid<D>; dispose: () => void } {
  // Capture the caller's scope BEFORE createRoot opens a new one — createRoot makes its fresh scope the
  // active owner during the callback, so we must grab the ambient owner here to register auto-disposal on it.
  const ambient = getOwner();
  return createRoot((dispose) => {
    const detail = buildDetail(() => master.focusedRow());
    // Free the detail's scope when the surrounding scope disposes too (not only on an explicit dispose()).
    if (ambient !== null) runWithOwner(ambient, () => onCleanup(dispose));
    return { detail, dispose };
  });
}
