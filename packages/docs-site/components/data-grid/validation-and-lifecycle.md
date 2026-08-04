---
title: Data Grid validation and lifecycle
description: Validate Data Grid cells and rows, recover trapped row edits with Escape, persist atomic rollback, and present lifecycle states honestly.
---

# Validation and lifecycle

Validation answers whether a proposed value or record is acceptable; lifecycle answers whether the
grid can present data at all. Keeping those axes separate produces precise errors and avoids using
an empty grid as a catch-all for loading or failure.

## Focused usage

```ts
import type { GridColumn } from '@jsvision/datagrid';

const quantity: GridColumn<Line> = {
  id: 'quantity',
  title: 'Quantity',
  value: (row) => row.quantity,
  validate: (value) => (value >= 0 ? undefined : 'Quantity cannot be negative'),
};
```

## Validation gates

Cell validation handles type and local constraints. Row validation checks relationships across
fields. Before-save validation checks application policy immediately before persistence. Report
which gate rejected the operation and retain the user's value for correction.

| Gate              | Runs when                                     | Use it for                                           |
| ----------------- | --------------------------------------------- | ---------------------------------------------------- |
| Column `validate` | A parsed editor value is about to commit      | Type and single-field rules                          |
| `beforeSave`      | After the optimistic write, before `onCommit` | Application policy and authorization hints           |
| `validateRow`     | An edited row is about to lose the cursor     | Cross-field rules that need several committed values |

Client validation improves correction flow; it is not an authorization boundary. Repeat policy and
data-integrity checks in the authoritative persistence layer.

## Recover a trapped row

A cross-field rule cannot reject every temporarily invalid cell commit: changing an interval often
requires editing Start and End separately. `validateRow` therefore lets each valid cell commit, then
blocks row-leave when the combined record is invalid. The committed cells form one bounded row-edit
session that Escape can restore to its earliest values.

<PlayExample id="data-grid/validation"
  title="Trap, restore, and retry a row"
  blurb="Set Start to 9, press Tab then Down to trap the row, and press Escape to restore it. Arm Alt+V first to see a persistence veto retain the edits for another Escape retry."
/>

The laboratory starts maximized so the grid, actions, status text, and complete keyboard guidance
remain visible together. Restore and maximize the dialog to check the same workflow at compact and
wide sizes. Its text status distinguishes restored and vetoed outcomes without relying on color.

### Which Escape owns the key?

| Focus state                                      | Escape behavior                                    |
| ------------------------------------------------ | -------------------------------------------------- |
| A cell editor is open                            | Cancels that editor's uncommitted text             |
| The grid body owns a trapped, edited row         | Starts the atomic row-revert transaction           |
| The row is untouched, valid, or already released | Falls through; no row rollback starts              |
| A row revert is pending                          | Is consumed with other grid input until settlement |

Correcting the row and leaving successfully releases the session. Sorting or filtering may keep the
same key-and-row-object session alive, but replacing, deleting, refreshing, or losing ownership of
that row invalidates it. A late asynchronous result cannot attach to a replacement row.

## Persist an atomic row revert

Use `onRevertRow` when accepted cell commits also reach host persistence:

```ts
import type { OnRevertRow } from '@jsvision/datagrid';

const persistRevert: OnRevertRow<Line> = async ({ rowKey, row, cells }) => {
  return saveOriginalCells(rowKey, row, cells);
};
```

The callback receives the row after all captured baselines have been applied, plus an immutable
`cells` array in first-commit order. Each cell describes its column, original `value`, and committed
`previous` value. Freeze or copy any additional application state before awaiting; the supplied
payload itself is already frozen.

Returning `false`, throwing, or rejecting compensates the in-memory row back to its committed values,
keeps the trap retryable, and shows a bounded failure message. While the callback is pending, editing,
navigation, filters, selection, resize, and other grid mutations remain inert. Dispose or row
replacement invalidates the presentation; settlement still belongs only to the captured transaction.

Without `onRevertRow`, local rollback is available only when the grid has no `beforeSave` or `onCommit`
persistence hook. A persisted grid deliberately refuses rollback without the atomic row seam, avoiding
a UI value that disagrees with storage.

## Lifecycle states

Loading, ready, source-empty, filtered-empty, and error require different messages and actions. A
retry belongs to error; clearing criteria belongs to filtered-empty; adding the first record belongs
to source-empty.

<PlayExample id="data-grid/lifecycle-states"
  title="Lifecycle state gallery"
  blurb="Cycle through loading, ready, empty, filtered-empty, and error presentations without replacing the host grid."
/>

## Limits and practices

- Keep invalid cells navigable and readable; do not hide them behind a generic toast.
- Tell users that body Escape restores committed row edits, while editor Escape cancels only the open editor.
- Persist every reverted cell as one row transaction; per-cell rollback can leave storage partially restored.
- Keep veto and failure feedback textual as well as colored so retry state remains visible in monochrome.
- Cancel stale asynchronous results when the source changes or the host closes.
- Preserve the last usable data only when the application explicitly supports stale display.
- Reset validation and lifecycle fixtures deterministically in documentation and tests.

## Related

- [Editing & cell editors](/components/data-grid/editing-and-editors) — understand the commit path.
- [Data & columns](/components/data-grid/data-and-columns) — model source state explicitly.
- [EditableDataGrid API](/api/datagrid/classes/EditableDataGrid) — generated validation, lifecycle,
  and `onRevertRow` option signatures.
- [OnRevertRow API](/api/datagrid/type-aliases/OnRevertRow) — atomic persistence callback.
- [RowRevert API](/api/datagrid/interfaces/RowRevert) and
  [RowRevertCell API](/api/datagrid/interfaces/RowRevertCell) — immutable callback payloads.
- [GridAction API](/api/datagrid/type-aliases/GridAction) — includes the remappable `revertRow` action.
