---
title: Data Grid editing and cell editors
description: Enter, commit, cancel, validate, and persist edits with built-in or custom cell editors and explicit dirty state.
---

# Editing and cell editors

Grid editing is a lifecycle: choose a cell, open an overlay, parse a typed value, validate it,
commit or cancel, then clean up the overlay and restore focus. Treat dirty persistence as a separate
step so an accepted cell edit is not confused with a successful server save.

## Focused usage

```ts
import { signal } from '@jsvision/ui';
import { EditableDataGrid, fromRows } from '@jsvision/datagrid';

const grid = new EditableDataGrid<Product>({
  columns,
  source: fromRows(signal(products), { rowKey: (row) => row.id }),
});
grid.rows; // the focusable EditableGridRows surface composed by the container
```

## Edit lifecycle

Enter begins editing, Enter or an explicit action commits, and Escape cancels. Overlay ownership
must end on every path, including validation failure, row deletion, host close, and reset.

<PlayExample id="data-grid/editing-lifecycle"
  title="Edit lifecycle"
  blurb="Enter, commit, and cancel edits while the lab exposes cell value, focus, and editor-overlay state."
/>

## Built-in editors

Choose an editor that matches the domain type rather than a formatted string: text, number,
boolean, date, enum, and lookup editors each have different parse and navigation behavior.

<PlayExample id="data-grid/editor-types"
  title="Built-in editor gallery"
  blurb="Move through text, number, boolean, date, enum, and lookup columns in one focused editing lab."
/>

## Custom editors

A custom editor should implement the public editing seam, return a typed value, honor commit and
cancel, and dispose all subscriptions or popups when its session ends.

<PlayExample id="data-grid/custom-editor"
  title="Custom rating editor"
  blurb="Edit a rating through a small custom editor and verify its typed commit and cleanup behavior."
/>

## Dirty state and commit

Dirty markers represent local values that differ from the accepted baseline. A persistence layer
may complete asynchronously or veto a change; both outcomes need visible, cell-specific feedback.

<PlayExample id="data-grid/dirty-commit"
  title="Dirty and asynchronous commit"
  blurb="Trigger accepted and vetoed commits while dirty markers and deterministic result feedback remain visible."
/>

## Limits and practices

- Keep cell parsing synchronous and deterministic; perform I/O at the save boundary.
- Never discard a dirty value because a remote commit failed.
- Restore focus after the editor overlay closes.
- Dispose custom editor resources on commit, cancel, reset, and host teardown.

## Related

- [Validation & lifecycle](/components/data-grid/validation-and-lifecycle) — layer cell, row, and
  save gates.
- [Rows, selection & navigation](/components/data-grid/rows-selection-navigation) — establish
  cursor behavior before editing.
- [EditableGridRows API](/api/datagrid/classes/EditableGridRows) — generated editing surface.
