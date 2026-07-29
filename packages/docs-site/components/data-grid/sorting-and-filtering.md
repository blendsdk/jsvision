---
title: Data Grid sorting and filtering
description: Teach single and multi-sort, quick per-column filters, advanced conditions, value lists, priorities, and result disclosure.
---

# Sorting and filtering

Sorting changes row order; filtering changes row membership. Keep both transformations visible,
deterministic, and based on typed values so the grid never sorts formatted numbers as text or hides
records without explaining why.

## Focused usage

```ts
import { column, EditableDataGrid, fromRows } from '@jsvision/datagrid';
import { signal } from '@jsvision/ui';

interface Row {
  id: number;
  name: string;
  total: number;
}

const rows = signal<Row[]>([{ id: 1, name: 'Ada', total: 1250 }]);
const grid = new EditableDataGrid({
  columns: [
    column<Row, string>({ id: 'name', title: 'Name', value: (row) => row.name }),
    column<Row, number>({ id: 'total', title: 'Total', value: (row) => row.total }),
  ],
  source: fromRows(rows, { rowKey: (row) => row.id }),
  quickFilter: true,
});

grid.sortBy('total', 'desc');
grid.setFilter('name', { kind: 'text', op: 'contains', value: 'Ada' });
```

## Sorting

A single-sort gesture should replace the active key; a multi-sort gesture should preserve ordered
priorities. Comparators receive typed values, while header indicators disclose direction and
priority.

<PlayExample id="data-grid/sorting"
  title="Sorting priorities"
  blurb="Exercise single, multi-column, and value-aware sorting while row keys and priority indicators remain visible."
/>

## Quick filtering

Quick filters are immediate, per-column text constraints. They work best for small expressions and
should keep focus in the active filter while the visible count updates.

<PlayExample id="data-grid/quick-filter"
  title="Quick filter row"
  blurb="Type a column query and watch the matching row keys and N-of-M disclosure update immediately."
/>

## Advanced filtering

Use `FilterPopup` for condition builders and `ValueList` for a finite set of distinct values.
Disclose every active criterion, provide a clear action, and report the visible count against the
unfiltered count.

<PlayExample id="data-grid/advanced-filter"
  title="Advanced filters"
  blurb="Compare a numeric condition with a value-list selection and inspect the resulting criteria and counts."
/>

## Limits and practices

- Sort nulls deliberately and consistently instead of relying on coercion.
- Debounce only expensive remote filtering; local feedback should stay immediate.
- Preserve stable row keys across transformations.
- Announce “0 of N” as filtered-empty, not as an empty data source.

## Related

- [Rows, selection & navigation](/components/data-grid/rows-selection-navigation) — understand how
  transformations interact with cursor and selection.
- [Data & columns](/components/data-grid/data-and-columns) — define typed comparators and values.
- [SortHeader API](/api/datagrid/classes/SortHeader) and
  [QuickFilterRow API](/api/datagrid/classes/QuickFilterRow) — generated signatures.
