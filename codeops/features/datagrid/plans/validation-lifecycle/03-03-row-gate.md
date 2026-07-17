# Per-Row Gate & Row-Leave Trap

> **Document**: 03-03-row-gate.md
> **Parent**: [Index](00-index.md)

## Overview

The cross-field gate: an optional `validateRow` that runs when the cursor **leaves a row that was
edited**, blocks the leave on failure, refocuses the reported field, and surfaces the message. Owns
`validateRow` (AR-16), the dirty-gated trap (AR-5), and the row-leave interception across the four
leave paths (AR-15).

## Architecture

### Current

Commit is strictly per-cell. Nothing observes "the cursor is leaving row X". Row navigation delegates
to the base helpers via `runAction` (`editable-grid-rows.ts:401`); `Enter` advances via
`host.advanceRow()` (`editing.ts:332`); `Tab` wraps/advances via the container's `advanceCell`
(`grid.ts:1192`); a click sets the row cursor in the body mouse-down branch.

### Proposed

A `RowGate` controller (in `validation.ts`), owned by the container, with a single decision method
`tryLeave(): boolean`. Every row-leave path consults it first. When it blocks, the move is cancelled,
the cursor column is set to the offending field, and the message is surfaced.

## Implementation Details

### `validateRow` option (AR-16)

```ts
readonly validateRow?: (row: T) => { ok: boolean; message?: string; field?: string };
// field = the columnId to refocus on failure; message = the surfaced text.
```

### The `RowGate` controller (`validation.ts`, AR-5/AR-15)

```ts
export interface RowGateDeps<T> {
  validateRow?: (row: T) => { ok: boolean; message?: string; field?: string };
  focusedRow(): T | undefined;              // grid.ts:1119 delegator
  focusedKey(): string | number | undefined;// grid.ts:1130 delegator
  isRowDirty(rowKey: string | number): boolean; // dirty prefix scan (grid.ts:597 logic)
  columnIndex(columnId: string): number;    // typedColumns.findIndex(c => c.id === id)
  focusColumn(index: number): void;         // set the shared column cursor + focus the cell
  firstDirtyColumn(rowKey: string | number): number | undefined;
  note(message: string | null): void;       // push/clear the active band message (error registry)
}

export function createRowGate<T>(deps: RowGateDeps<T>): { tryLeave(): boolean };
```

`tryLeave()`:

1. If `validateRow` is undefined → `return true` (no gate).
2. `row = focusedRow()`; if undefined → `return true` (empty grid).
3. If **not** `isRowDirty(focusedKey())` → `return true` (AR-5: untouched rows leave freely — even a
   pre-existing-invalid seed row).
4. `res = validateRow(row)`; if `res.ok` → `note(null)` (clear any stale message) and `return true`.
5. Blocked: `focusColumn(res.field ? columnIndex(res.field) : firstDirtyColumn(key) ?? currentCol)`,
   `note(res.message ?? 'This row is invalid')`, `return false`.

`note` uses the error registry's shared active-message channel ([03-02](03-02-error-surfacing.md)) — a
transient row/veto message with no `cellKey`; it clears on the next successful leave or correction.

### The four leave paths (AR-15)

Each site calls `rowGate.tryLeave()` and cancels its move on `false`:

| # | Path | Site | Wiring |
| - | ---- | ---- | ------ |
| 1 | Keyboard row nav (rowDown/Up/PageUp/Down/Home/End that change the row) | `runAction` (`editable-grid-rows.ts:401`) | The body gets a `rowLeaveGate?: () => boolean` config hook; before a **row-changing** action, if `!rowLeaveGate()` consume the event and skip the base move. Column-only actions (nextCol/prevCol) never gate. |
| 2 | `Enter`-advance after a cell commit | the body's `advanceRow()` (`editable-grid-rows.ts:592`, bound to `EditHost.advanceRow` at `:274`; called from `editing.ts:332`) | **`advanceRow` is a body method, not a container one** — the container has no `advanceRow`. So the body's `advanceRow` consults the same `rowLeaveGate` body-dep as Path 1 before it moves: on block it does not advance (the just-committed cell stays; the field refocuses). |
| 3 | `Tab` row-edge wrap / exit | `advanceCell` (`grid.ts:1192`, the container's Tab method) | `advanceCell` (container-owned, so it calls `rowGate.tryLeave()` directly) gates before a move that changes the row (a within-row cell hop does not gate); on block, stay. |
| 4 | Click on a different row | body mouse-down branch (`editable-grid-rows.ts:370`) | A plain click's row-cursor move is owned by the **base** class (`super.onEvent` → `focusTo`; the override's mouse-down at `:370` runs first and a plain click is otherwise cursor-only, `:338-346`). So the override must compute the target row from the click and, when it differs from the current row, call `rowLeaveGate()` **before** `super.onEvent`; on block, consume the event and refocus the offending field. |

Only a row **change** gates — within-row column movement (arrows across cells, Tab within a row) never
consults the gate. "Changes the row" is decided by comparing the target row index/key to the current
one at the call site (the nav helpers already compute the target).

### Refocus semantics

`focusColumn(index)` sets the shared column-cursor signal and focuses the offending cell (not
begin-edit — the user chooses to re-edit). If `field` is an unknown/hidden column id, fall back to the
first dirty column, then the current column (never throw).

## Integration Points

- `grid.ts` constructs the `RowGate` with delegators it already exposes (`focusedRow`/`focusedKey`
  `:1119/:1130`; the dirty prefix scan `:597`) plus a `focusColumn` that reuses the existing
  column-cursor setter; it wires `rowLeaveGate: () => rowGate.tryLeave()` into `_bodyDeps` — which the
  **body** consults for the three body-owned leave paths (Path 1 `runAction`, Path 2 the body's
  `advanceRow`, Path 4 the mouse-down branch) — and calls `rowGate.tryLeave()` directly in its own
  `advanceCell` implementation (Path 3, the container-owned `Tab` method). The container has no
  `advanceRow`; the Enter-path gate lands in `editable-grid-rows.ts`, not `grid.ts`.
- No new reactive state — the gate reads live state on demand (the controller convention, AR-10).

## Error Handling

| Case | Handling | AR |
| ---- | -------- | -- |
| `validateRow` undefined | No gating anywhere | AR-16 |
| Row untouched (not dirty) | Leaves freely, even if `validateRow` would fail | AR-5 |
| `field` names an unknown/hidden column | Fall back to first-dirty then current column; never throw | AR-15 |
| Row valid again after a correction | `note(null)`; the next leave succeeds | AR-15 |
| `validateRow` throws | Treat as a blocking `{ ok: false }` with a generic message (defensive; never crash the loop) | AR-15 |

## Testing Requirements

- Spec: an edited row failing `validateRow` cannot leave via arrow / `Enter` / `Tab` / click; the
  cursor lands on `field`; the message shows. An **untouched** invalid row leaves freely. A corrected
  row leaves and the message clears (ST-11…ST-15, [07](07-testing-strategy.md)).
- Impl: within-row column moves never gate; `field` fallback chain; `validateRow` throw handled;
  multi-panel (frozen) row-leave gates once; `note` clears on success.
