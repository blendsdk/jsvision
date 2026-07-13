# Requirements & Scope — Editing Engine

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-02](../../requirements/RD-02-editing-engine.md)
> **Implements**: datagrid/RD-02

## Scope

This plan implements **RD-02 only** — the interactive editing engine over the RD-01 read-only foundation.
It is additive: no RD-01 contract changes shape (only `GridColumn` **gains** an optional `set`), and no new
`@jsvision/ui` symbol is promoted (the engine the subclass needs is already public from RD-01).

### In scope (RD-02 Must-Have)

1. **`EditableGridRows<T>`** — a subclass of the public `@jsvision/ui` `GridRows<T>` that adds a column cursor
   (`focusedCol`), reassigns the base `←`/`→`/`Home`/`End` bindings, overpaints the focused cell, and drives
   the editor lifecycle. (03-02)
2. **Two-axis cell cursor** — `focusedCol` + the inherited row `focused`, **owned by the `EditableDataGrid`
   container** and injected as shared signals (AR #4). The focused cell is overpainted in `gridCursor`. (03-02, 03-03)
3. **Cursor navigation** — `←`/`→` move the column; `↑`/`↓` move the row (inherited); `Tab`/`Shift-Tab` move the
   cell with row wrap; `Home`/`End` jump to the first/last column; `Ctrl+Home`/`Ctrl+End` to the first/last cell
   of the grid; `PgUp`/`PgDn` page rows (inherited). All clamp to range (AR #8). (03-02)
4. **Begin-edit triggers** — `F2` and `Enter` on an **editable** cell open the editor (caret at end); a printable
   character opens the editor and **replaces** the content (req AR-19). (03-02)
5. **In-cell editor overlay** — the editor `View` mounts at the focused cell's rect via the RD-01
   `mountCellOverlay`; focus routes to it (`getFocused() === editor`); it is disposed on commit/cancel. (03-02)
6. **Per-cell immediate commit** — on `Enter`/`Tab` while editing, `parse(field())` is written to the record via
   `column.set` (immediate), then `onCommit({rowKey, columnId, value, previous, row})` runs; `false`/reject reverts
   to `previous` and keeps the editor open, `true` closes it and shows the new value (req AR-02/AR-16). (03-02)
7. **Enter precedence** — not editing → begin edit (no-op on a read-only cell); editing → commit + auto-advance to
   the same column of the next row (req AR-18). (03-02)
8. **Cancel** — `Esc` while editing reverts to `previous` and closes the editor **without** calling `onCommit`. (03-02)
9. **Auto-advance** — `Tab` commits (if editing) then moves to the next cell (row wrap); `Enter` commits then moves
   to the next row, same column (AR #8). (03-02)
10. **Dirty tracking** — a per-cell pending-commit flag keyed by `rowKey`+`columnId`; a `•` marker in `gridDirty`
    paints on the cell; `isDirty(rowKey, columnId)` + row/grid rollups (AR #6). (03-03)
11. **Read-only columns** — a column that is not editable (missing `parse` or `set`) rejects begin-edit; the cursor
    still lands on it for navigation (AR #1/#2). (03-01, 03-02)

### Additive public/core surface (this plan)

| Surface | Symbol | Where | Ref |
| --- | --- | --- | --- |
| datagrid column model | `GridColumn.set?: (row, value: V) => void` | `packages/datagrid/src/column.ts` | AR #1 |
| datagrid editor seam | `createCellEditor(column, field, host): View \| null` + default text `Input` | `packages/datagrid/src/cell-editor.ts` | AR #2 |
| datagrid container | `EditableDataGridOptions.onCommit?`, `EditableDataGrid.isDirty(...)`, `EditableGridRows` | `packages/datagrid/src/{grid,editable-grid-rows}.ts` | AR #1/#4/#6 |
| core theme | `gridCursor`, `gridDirty` roles | `packages/core/src/engine/color/theme.ts` | AR #3 |

### Out of scope (later RDs — RD-02 provides the seam only)

- **Typed editor widgets & value help (F4 lookup)** — RD-03. RD-02 ships the text `Input` default + the
  `createCellEditor` seam RD-03 extends.
- **Per-cell / per-row validation + the BeforeSave veto** — RD-12. RD-02 exposes the `onCommit` seam RD-12 plugs
  into; a rejected validation surfaces here as a `false` commit.
- **Frozen left/center/right panels + sticky panels** — RD-07. RD-02 makes the **container** own the shared
  signals so the split composes with no cursor retrofit (AR #4).
- **Row selection gestures / checkbox column** — RD-08. The cursor coexists with (does not implement) selection.
- **Mouse / double-click begin-edit routing** — RD-10. RD-02 is keyboard-driven; all begin-edit paths are
  event-driven off the keyboard envelope (AR #13).
- **Row-editor dialog (form view)** — RD-02 Should-Have, deferred to Phase B (req AR-27).
- **Undo/redo** — deferred (req AR-30).

## Plan-local decisions (delta over the RD text)

These are the plan-authoring resolutions from the [Ambiguity Register](00-ambiguity-register.md) that go beyond
what RD-02's prose fixes; every implementation detail traces to one:

- **Editability = `parse` && `set`** (AR #1). The RD says "a column with no editor rejects begin-edit"; in RD-02
  terms "has an editor" = "has a complete text↔record round-trip" = both `parse` and `set`.
- **Repaint via a container `version` signal** (AR #5) — an in-place `column.set` needs a reactive nudge; the
  `Surface.version` pattern, no `GridDataSource` change.
- **Dirty = pending commit** in a reactive `Set` (AR #6), not a "value ever changed" flag.
- **Commit keys captured by the editor-host `Group`** via the focus-chain bubble (AR #7) — the grid body is
  unfocused while editing.
- **Grid-corner navigation clamps** (AR #8); Tab/Shift-Tab wrap between rows but not around the grid.
- **`committing` locks the cell**; other cells stay navigable; per-cell commits serialize (AR #9).
- **No stored `loop` ref** — focus routing uses the `DispatchEvent.focusView` seam (AR #13).

## Success criteria

RD-02 is complete when every RD-02 AC-1…AC-10 is realized by a green ST-1…ST-17
([07-testing-strategy](07-testing-strategy.md)), `yarn verify` is green across `@jsvision/datagrid` **and**
`@jsvision/core` (the new roles), the editable kitchen-sink story passes the headless smoke test, and no ui/core
regression is introduced (`DataGrid` + the existing theme suites stay green).

**Verify** (per AR #10): `yarn verify` for phase/done gates; scoped
`yarn workspace @jsvision/datagrid <build|typecheck|test|check:docs>` +
`yarn workspace @jsvision/core test check:docs` for the inner loop.
