---
title: Data Grid validation and lifecycle
description: Separate cell, row, and save validation while presenting loading, ready, empty, filtered-empty, and error states honestly.
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

<PlayExample id="data-grid/validation"
  title="Validation gates"
  blurb="Compare a cell error with successful row and before-save gates, including focused corrective feedback."
/>

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
- Cancel stale asynchronous results when the source changes or the host closes.
- Preserve the last usable data only when the application explicitly supports stale display.
- Reset validation and lifecycle fixtures deterministically in documentation and tests.

## Related

- [Editing & cell editors](/components/data-grid/editing-and-editors) — understand the commit path.
- [Data & columns](/components/data-grid/data-and-columns) — model source state explicitly.
- [EditableDataGrid API](/api/datagrid/classes/EditableDataGrid) — generated validation and
  lifecycle options.
