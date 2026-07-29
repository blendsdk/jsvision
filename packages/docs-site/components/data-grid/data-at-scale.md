---
title: Data Grid data at scale
description: Choose bounded in-memory or windowed Data Grid sources and communicate loading, total counts, caching, and performance limits honestly.
---

# Data at scale

“Large” is a source-design question, not a styling option. A bounded in-memory collection can be
fast and simple; a much larger collection needs windowed reads, stable keys, loading disclosure,
and a cache policy that never assumes the complete data set is locally available.

## Focused usage

```ts
import { EditableDataGrid } from '@jsvision/datagrid';
import type { GridDataSource } from '@jsvision/datagrid';

const source: GridDataSource<RecordRow> = {
  rowKey: (row) => row.id,
  length: () => 100_000,
  rowAt: (index) => loadedWindows.get(index),
  ensureRange: (start, end) => loadWindow(start, end),
  setSort: (keys) => reload({ sort: keys }),
  setFilter: (filters) => reload({ filters }),
};
const grid = new EditableDataGrid<RecordRow>({
  source,
  columns,
});
```

## Windowed sources

A window source accepts a start and count, then returns only that bounded slice. Scrolling should
request deterministic ranges, expose loading state, and ignore stale completions after reset or
disposal.

<PlayExample id="data-grid/windowed"
  title="100,000-row window"
  blurb="Scroll a deterministic 100,000-row source while proving that only bounded windows are read."
/>

## Large in-memory collections

In-memory mode remains appropriate when the entire collection is intentionally bounded and fits the
application's memory and transformation budget. Measure sort, filter, and repaint together rather
than presenting an isolated synthetic benchmark as a guarantee.

<PlayExample id="data-grid/large-memory"
  title="Large in-memory boundary"
  blurb="Exercise a supported bounded collection and compare its ownership and transformation costs with windowed data."
/>

## Limits and practices

- Never materialize the 100,000-row fixture solely to demonstrate windowing.
- Bound concurrent reads and ignore results from obsolete source generations.
- Report total, loaded, and visible counts separately.
- Document measured environments and avoid universal performance claims.

## Related

- [Theming, accessibility & performance](/components/data-grid/theming-accessibility-performance)
  — preserve interaction quality under load.
- [Data & columns](/components/data-grid/data-and-columns) — choose the source contract.
- [EditableDataGrid API](/api/datagrid/classes/EditableDataGrid) — generated source options.
