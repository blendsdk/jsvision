# 03-03: Tab Traversal (`navigation.ts` + the commit-advance seam)

> **Parent**: [Index](00-index.md) · **AR**: AR-2, AR-5, AR-6, AR-7, AR-8, AR-12
> **New file**: `packages/datagrid/src/navigation.ts` · **Modified**: `grid.ts`, `editing.ts`

`Tab`/`Shift-Tab` cell traversal. Because `route()` swallows an unbound `Tab` before any view (02 §3),
`Tab` must be a loop-keymap chord → command → the grid's `nextCell`/`prevCell`. The app opts in; the
grid ships the pieces. No core/ui change (AR-2).

## Pure cursor math (spec-testable)

```ts
/** Where the cursor lands next, or 'exit' at the grid edge (AR-5/AR-6). Pure — no view. */
export type CellMove = { readonly col: number; readonly row: number } | 'exit';

export function nextCellIndex(col: number, row: number, cols: number, rows: number): CellMove;
export function prevCellIndex(col: number, row: number, cols: number, rows: number): CellMove;
```

- `nextCellIndex`: `col+1`; if `col+1 === cols` → wrap to `{ col: 0, row: row+1 }`; if that row `=== rows`
  → `'exit'`. `prevCellIndex` mirrors it (`col−1`; wrap to `{ col: cols−1, row: row−1 }`; at `(0,0)` →
  `'exit'`). Empty grid (`cols===0 || rows===0`) → `'exit'`. (AR-5, AR-6)

## The grid methods

`EditableDataGrid` gains public `nextCell()`/`prevCell(): Promise<'moved' | 'exit'>`:

```ts
async nextCell(): Promise<'moved' | 'exit'> {
  // Commit an open edit first (AR-7); a vetoed commit keeps the editor open and does not advance.
  if (this.rows.isEditing()) { const ok = await this.rows.commitEdit(); if (!ok) return 'moved'; }
  const move = nextCellIndex(this.focusedCol(), this.focused(), this.totalVisibleCols(), this.displayLen());
  if (move === 'exit') return 'exit';
  this.focused.set(move.row); this.focusedCol.set(move.col);   // container owns the cursor signals
  return 'moved';
}
```

`totalVisibleCols()`/`displayLen()` are thin reads over the existing column model + display. The container
already owns `focused`/`focusedCol` (`grid.ts:245/246`), so this is a thin delegator — the pure math lives
in `navigation.ts`, keeping grid.ts `< 1300` (AR-8).

**Return semantics (document precisely — the return drives the focus handoff, not "did the cursor
move"):** a vetoed commit returns `'moved'` **even though the cursor stayed put** (the editor is still
open on the same cell). This is deliberate — `'moved'` means "the grid handled Tab; do **not** hand focus
to the next widget," so `installGridNavigation` only exits on `'exit'`. The JSDoc `@example` on
`nextCell`/`prevCell` MUST call this out so a programmatic caller does not read `'moved'` as "the cursor
advanced."

## The `commitEdit` seam (`editing.ts`)

`EditController` gains `commitEdit(): Promise<boolean>` — commits the open editor if any (reusing the
existing private `commit()` await-close path), resolving `true` on commit, `false` on veto or when idle.
`Enter` keeps its own path (`onEditorKey`→`commit`→`advanceRow`, by row); `Tab` uses `commitEdit()` then
advances by cell. Extract the shared body from the existing `commit()` so there is no duplicate logic.
(AR-7)

**Focus restoration — the command path has no event envelope (grounded gap, PF-003).** The existing
`commit()` refocuses the body via `ev2.focusView?.(host.body)` (`editing.ts:310`) using the Enter event's
envelope. But `Tab` is swallowed at the router (`dispatch.ts:124`) and delivered as a **loop command**, so
the `installGridNavigation` handler runs **envelope-free** — `commitEdit()` therefore cannot refocus the
body the way Enter does, and the loop does **not** auto-recover (when the editor overlay is disposed,
`healFocus` heals *into* the now-empty, `visible:false` overlay — a no-op — leaving no focused leaf on the
grid). So `commitEdit()` closes the editor and returns the boolean **without** touching focus, and the
**caller restores it**: the `installGridNavigation` handler calls `loop.focusView(grid.rows)` after a
`'moved'` result (see below). Without this the grid goes dead after a Tab-commit-advance.

## `gridKeymap` + `installGridNavigation` (the app opt-in)

```ts
/** The loop-keymap fragment binding Tab/Shift-Tab to grid-navigation commands. Merge into createEventLoop. */
export const gridKeymap = createKeymap({ 'tab': 'grid.nextCell', 'shift+tab': 'grid.prevCell' });

/**
 * Register the Tab/Shift-Tab command handlers for one or more grids (AR-12). On the command, the focused
 * grid advances by cell; if none is focused, or the focused grid is at its edge ('exit'), focus moves to
 * the next/previous widget (loop.focusNext/Prev), preserving global Tab (AR-6). Returns an uninstaller.
 */
export function installGridNavigation(loop: EventLoop, grids: EditableDataGrid<any> | EditableDataGrid<any>[]): () => void;
```

Behavior of the `grid.nextCell` handler:
1. Find the focused grid among `grids` (a grid whose `rows.state.focused` is true — expose a small public
   `isBodyFocused()` on the grid so the helper needs no protected access).
2. Focused grid found → `await grid.nextCell()`:
   - `'exit'` → `loop.focusNext()` (leave the grid to the next widget).
   - `'moved'` → `loop.focusView(grid.rows)` — **re-focus the body** (PF-003). A Tab-commit may have
     closed the editor overlay and left no focused leaf on the grid; the loop won't auto-recover, so the
     handler restores focus explicitly. This is idempotent when no edit was open (the body already holds
     focus), so it is safe to call on every `'moved'`.
3. No focused grid → `loop.focusNext()` (global Tab preserved). `grid.prevCell` mirrors with `focusPrev`
   (and `loop.focusView(grid.rows)` on its own `'moved'`).

**Multi-grid correctness (AR-12):** a single handler pair inspects all passed grids and acts once, so
two grids (e.g. master-detail) never both fire `focusNext`.

**Global-Tab implication (surfaced):** binding `tab` in the loop keymap means `Tab` no longer does the
framework's default focus-traversal *by itself* anywhere in the app — the handler's `focusNext` fallback
restores it. This is why the app opts in consciously (AR-2).

## Reference, don't restate

- The `route()` swallow + the readonly loop keymap are documented in [02 §3](02-current-state.md).
- `createKeymap` is core's primitive (re-exported from ui/datagrid); `gridKeymap` is just a fragment.

## Verification hooks

Spec: ST-14…ST-19b ([07 §C](07-testing-strategy.md)) — wrap, exit, commit-then-advance, the keymap
fragment, the helper's focus/fallback/multi-grid behavior, and the post-commit focus restoration (ST-19b,
PF-003). JSDoc `@example` on `nextCell`/`prevCell`, `nextCellIndex`/`prevCellIndex`, `gridKeymap`,
`installGridNavigation` (barrel-exported).
