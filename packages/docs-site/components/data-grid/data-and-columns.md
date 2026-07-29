---
title: Data Grid data and columns
description: Model stable Data Grid rows, source lifecycles, typed values, formatting, parsing, and null behavior before adding interaction.
---

# Data and columns

Rows and columns are the grid's contract with the rest of the application. Choose stable keys,
preserve value types until presentation, and make source lifecycle explicit before adding sorting,
filtering, or editors.

## Focused usage

```ts
import type { GridColumn } from '@jsvision/datagrid';

const amount: GridColumn<Invoice> = {
  id: 'amount',
  title: 'Amount',
  value: (row) => row.amount,
  format: (value) => (value === null ? '—' : currency.format(value)),
};
```

## Data sources

Use an in-memory source for bounded collections, a reactive source when a signal replaces the
collection, and a windowed source when only the visible range should be read. Surface loading and
counts in the UI so users can distinguish “not loaded” from “loaded but empty.”

<PlayExample id="data-grid/data-sources"
  title="Source modes"
  blurb="Switch between deterministic in-memory, reactive, and bounded windowed sources while inspecting row and read counts."
/>

## Typed columns

Keep raw numbers, dates, booleans, and nullable values typed. `format` controls presentation;
editing columns should pair it with a parser that returns the domain type or a clear validation
result. A placeholder such as an em dash is presentation, never a replacement string in the model.

<PlayExample id="data-grid/typed-columns"
  title="Typed column laboratory"
  blurb="Inspect number, percentage, date, boolean, and nullable cells, then exercise formatting and parsing without unrelated features."
/>

## Limits and practices

- Never use a visible row index as identity; it changes under sort and filter.
- Avoid format-then-parse round trips for persistence. Commit the typed value.
- Keep source errors separate from empty results, and reset stale loading indicators.
- For unbounded data, provide a window contract instead of exposing the complete array.

## Related

- [Layout & rendering](/components/data-grid/layout-and-rendering) — turn the column model into
  stable geometry.
- [Data at scale](/components/data-grid/data-at-scale) — choose a bounded source strategy.
- [EditableDataGrid API](/api/datagrid/classes/EditableDataGrid) — generated source and column
  options.
