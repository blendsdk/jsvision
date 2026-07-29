---
title: Data Grid footer, aggregation, and detail
description: Present honest totals, sticky footer widgets, partial-data disclosure, and master-detail relationships.
---

# Footer, aggregation and detail

Footers summarize the current data scope; detail views explain one focused master row. Both depend
on explicit scope and stable identity. A total computed from a loaded window must never masquerade
as a total for the complete remote collection.

## Focused usage

```ts
import { EditableDataGrid } from '@jsvision/datagrid';
import type { GridFooter } from '@jsvision/datagrid';

const footer: GridFooter = {
  sticky: true,
  aggregates: { amount: { fn: 'sum', label: 'Total' } },
};
const grid = new EditableDataGrid({ columns, source, footer });
```

## Aggregates and footer bands

Use footer widgets for counts, sums, averages, or application-owned summaries. Keep the band sticky
when it remains useful during vertical navigation, and label whether values describe selected,
visible, loaded, or total records.

<PlayExample id="data-grid/aggregates"
  title="Honest aggregates"
  blurb="Compare visible and selected totals, sticky footer state, and partial-data disclosure."
/>

## Master and detail

Bind detail content to the focused master's stable key. When filtering or deletion removes that
master, clear or deliberately move the detail view rather than showing stale information.

<PlayExample id="data-grid/master-detail"
  title="Master-detail binding"
  blurb="Move the grid cursor and observe a detail pane track the focused row's stable key."
/>

## Limits and practices

- Label aggregate scope beside the value.
- Compute over typed values, not formatted cell text.
- Keep detail rendering cancellable if it loads asynchronously.
- Do not let the detail pane steal arrow-key navigation from the grid unless focus moves there.

## Related

- [Data at scale](/components/data-grid/data-at-scale) — understand partial and total scopes.
- [Rows, selection & navigation](/components/data-grid/rows-selection-navigation) — define the
  focused master.
- [FooterBand API](/api/datagrid/classes/FooterBand) — generated footer surface.
