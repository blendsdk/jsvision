/**
 * Cell-to-cell `Tab` traversal for the editable grid — the pure cursor math plus the application-level
 * wiring that turns `Tab`/`Shift+Tab` into grid navigation.
 *
 * The framework swallows an unbound `Tab` for focus traversal before any view sees it, so cell traversal
 * cannot be a body key: it is delivered as a loop **command**. An app opts in by merging {@link gridKeymap}
 * into its event loop (so `Tab` becomes the `grid.nextCell`/`grid.prevCell` command) and calling
 * {@link installGridNavigation} to register the command handlers. This needs no change to the core or the
 * widget framework — the app consciously owns global `Tab` policy, and the handler still falls back to the
 * loop's own focus traversal when no grid is focused (or a focused grid is at its edge).
 */
import { createKeymap } from '@jsvision/ui';
import type { EventLoop, View } from '@jsvision/ui';

/** Where the cursor lands next, or `'exit'` at the grid edge. Pure — carries no view. */
export type CellMove = { readonly col: number; readonly row: number } | 'exit';

/**
 * The cell one step forward (left-to-right, top-to-bottom) from `(col, row)` in a `cols × rows` grid, or
 * `'exit'` past the last cell of the last row (and for an empty grid). Past the last column it wraps to
 * the first column of the next row. Pure — the grid maps the result onto its cursor signals.
 *
 * @param col The current column index.
 * @param row The current row index.
 * @param cols The visible column count.
 * @param rows The display row count.
 * @returns The next cell, or `'exit'` at the grid's end.
 * @example
 * ```ts
 * import { nextCellIndex } from '@jsvision/datagrid';
 * nextCellIndex(0, 0, 3, 3); // { col: 1, row: 0 }
 * nextCellIndex(2, 0, 3, 3); // { col: 0, row: 1 } — wraps
 * nextCellIndex(2, 2, 3, 3); // 'exit'
 * ```
 */
export function nextCellIndex(col: number, row: number, cols: number, rows: number): CellMove {
  if (cols <= 0 || rows <= 0) return 'exit';
  if (col + 1 < cols) return { col: col + 1, row };
  if (row + 1 < rows) return { col: 0, row: row + 1 };
  return 'exit';
}

/**
 * The cell one step backward from `(col, row)` — the mirror of {@link nextCellIndex}. Before the first
 * column it wraps to the last column of the previous row; at `(0, 0)` (and for an empty grid) it returns
 * `'exit'`.
 *
 * @param col The current column index.
 * @param row The current row index.
 * @param cols The visible column count.
 * @param rows The display row count.
 * @returns The previous cell, or `'exit'` at the grid's start.
 * @example
 * ```ts
 * import { prevCellIndex } from '@jsvision/datagrid';
 * prevCellIndex(2, 1, 3, 3); // { col: 1, row: 1 }
 * prevCellIndex(0, 1, 3, 3); // { col: 2, row: 0 } — wraps
 * prevCellIndex(0, 0, 3, 3); // 'exit'
 * ```
 */
export function prevCellIndex(col: number, row: number, cols: number, rows: number): CellMove {
  if (cols <= 0 || rows <= 0) return 'exit';
  if (col - 1 >= 0) return { col: col - 1, row };
  if (row - 1 >= 0) return { col: cols - 1, row: row - 1 };
  return 'exit';
}

/** The command names the grid-navigation keymap and handlers agree on. */
const NEXT_CELL = 'grid.nextCell';
const PREV_CELL = 'grid.prevCell';

/**
 * The loop-keymap fragment binding `Tab`/`Shift+Tab` to the grid-navigation commands. Merge it into
 * `createEventLoop({ keymap })` so `Tab` reaches the grid as a command (the framework otherwise swallows
 * an unbound `Tab` for focus traversal). Binding `Tab` here means the app owns global `Tab` policy — the
 * {@link installGridNavigation} handler restores focus traversal when no grid is focused.
 *
 * @example
 * ```ts
 * import { createEventLoop } from '@jsvision/ui';
 * import { gridKeymap, installGridNavigation } from '@jsvision/datagrid';
 * const loop = createEventLoop({ width: 80, height: 24 }, { caps, keymap: gridKeymap });
 * const uninstall = installGridNavigation(loop, grid); // Tab → next cell; Shift+Tab → prev cell
 * ```
 */
export const gridKeymap = createKeymap({ tab: NEXT_CELL, 'shift+tab': PREV_CELL });

/**
 * The grid capabilities {@link installGridNavigation} drives. Deliberately structural and row-type-free
 * (the four members carry no row type), so an `EditableDataGrid` of any row type satisfies it and grids of
 * different row types — e.g. a master and its detail — can be passed together.
 */
export interface NavGrid {
  /** Whether this grid's body currently holds focus. */
  isBodyFocused(): boolean;
  /** Whether an in-cell editor is open on this grid (focus is then on the editor, not the body). */
  isEditing(): boolean;
  /** Advance the cursor by one cell (commit-then-advance while editing); `'exit'` at the grid edge. */
  nextCell(): Promise<'moved' | 'exit'>;
  /** Retreat the cursor by one cell; `'exit'` at the grid start. */
  prevCell(): Promise<'moved' | 'exit'>;
  /** The focusable body view (re-focused after a `'moved'` result). */
  readonly rows: View;
}

/**
 * Register the `Tab`/`Shift+Tab` command handlers for one or more grids and return an uninstaller.
 *
 * On the command, the focused grid (the first whose body holds focus) advances by one cell. At the grid's
 * edge (`'exit'`) focus moves to the next/previous widget via the loop's own traversal, preserving global
 * `Tab`; when no passed grid is focused, the command also falls back to that traversal. On a `'moved'`
 * result the body is re-focused explicitly — a `Tab`-commit may have closed the editor overlay and left
 * no focused leaf on the grid, and the loop does not auto-recover — so the grid never goes dead. A single
 * pair of handlers inspects every passed grid, so two grids (e.g. master-detail) never both advance.
 *
 * @param loop The event loop the grid's app is mounted in.
 * @param grids One grid, or a list of grids sharing the same loop.
 * @returns A function that unregisters both handlers (idempotent).
 * @example
 * ```ts
 * import { createEventLoop } from '@jsvision/ui';
 * import { gridKeymap, installGridNavigation } from '@jsvision/datagrid';
 * const loop = createEventLoop({ width: 80, height: 24 }, { caps, keymap: gridKeymap });
 * loop.focusView(grid.rows);
 * const uninstall = installGridNavigation(loop, grid);
 * // …later: uninstall();
 * ```
 */
export function installGridNavigation(loop: EventLoop, grids: NavGrid | readonly NavGrid[]): () => void {
  const list: readonly NavGrid[] = Array.isArray(grids) ? grids : [grids];

  const run = async (forward: boolean): Promise<void> => {
    // A grid is the active Tab target when its body is focused OR it is editing — while an editor is open
    // the focus is on the editor overlay, not the body, but Tab must still commit that grid and advance.
    const focused = list.find((g) => g.isBodyFocused() || g.isEditing());
    if (focused === undefined) {
      // No grid owns focus → preserve the framework's global Tab traversal.
      if (forward) loop.focusNext();
      else loop.focusPrev();
      return;
    }
    const result = forward ? await focused.nextCell() : await focused.prevCell();
    if (result === 'exit') {
      if (forward) loop.focusNext();
      else loop.focusPrev();
    } else {
      // 'moved' → re-focus the body. A Tab-commit may have disposed the editor overlay, leaving no focused
      // leaf on the grid; the loop won't auto-recover, so restore it explicitly. Idempotent when no editor
      // was open (the body already holds focus), so it is safe on every 'moved'.
      loop.focusView(focused.rows);
    }
  };

  const offNext = loop.onCommand(NEXT_CELL, () => void run(true));
  const offPrev = loop.onCommand(PREV_CELL, () => void run(false));
  return () => {
    offNext();
    offPrev();
  };
}
