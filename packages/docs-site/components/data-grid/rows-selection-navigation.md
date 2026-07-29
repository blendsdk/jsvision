---
title: Data Grid rows, selection, and navigation
description: Design stable row mutations, checkbox and range selection, cursor movement, and predictable keyboard traversal.
---

# Rows, selection and navigation

Selection and cursor are different state. The cursor identifies the active cell for navigation;
selection identifies records for an operation. Stable row keys let both survive sorting, filtering,
insertion, duplication, and deletion.

## Focused usage

```ts
import { signal } from '@jsvision/ui';
import { EditableDataGrid, fromRows } from '@jsvision/datagrid';

const grid = new EditableDataGrid<Order>({
  columns,
  source: fromRows(signal(rows), { rowKey: (row) => row.id }),
  selectionMode: 'multi',
});
```

## Selection and navigation

Offer checkbox or gutter affordances when selection is actionable. Arrow keys move the cursor,
Space toggles the focused row where appropriate, and Tab traverses editable cells without trapping
the user at either edge.

<PlayExample id="data-grid/selection-navigation"
  title="Selection and keyboard map"
  blurb="Compare cursor and multi-selection state, use the gutter, and traverse cells with arrows and Tab."
/>

## Row mutations

Insert and duplicate with fresh keys, then choose a predictable successor when deleting the focused
row. Never let a visual row index become a persistent identifier.

<PlayExample id="data-grid/row-mutations"
  title="Stable row mutations"
  blurb="Insert, duplicate, and delete records while visible stable keys prove that identity survives each mutation."
/>

## Limits and practices

- Keep selection when rows reorder, but remove keys that no longer exist.
- Make bulk actions state how many records they affect.
- Confirm destructive operations according to application policy, not inside the cell renderer.
- Return focus to the nearest surviving row after deletion.

## Related

- [Editing & cell editors](/components/data-grid/editing-and-editors) — add edit traversal.
- [Sorting & filtering](/components/data-grid/sorting-and-filtering) — transform visible rows
  without losing identity.
- [EditableDataGrid API](/api/datagrid/classes/EditableDataGrid) — generated navigation and
  selection options.
