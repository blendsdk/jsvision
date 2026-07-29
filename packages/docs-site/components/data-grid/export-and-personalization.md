---
title: Data Grid export and personalization
description: Export safe CSV, TSV, HTML, and JSON and persist user-owned grid variants with reversible dialog semantics.
---

# Export and personalization

Export crosses a trust boundary: typed values become text consumed by spreadsheets, markup
renderers, or other programs. Personalization crosses an ownership boundary: transient column
changes become a named user preference. Make both transformations explicit and reversible.

## Focused usage

```ts
import { createMemoryVariantStore, personalizeGrid } from '@jsvision/datagrid';

const store = createMemoryVariantStore();
const { ok } = await personalizeGrid(grid, { store, host: app });
if (ok) saveUserPreferences(grid.saveVariant('Current'));
```

## Safe export

CSV and TSV require delimiter, quote, newline, and spreadsheet-formula handling. HTML requires
escaping rather than concatenating trusted-looking cell text. JSON should preserve typed values
unless the chosen format contract says otherwise.

<PlayExample id="data-grid/export"
  title="Export trust boundary"
  blurb="Render hostile values through CSV, TSV, HTML, and JSON previews while visible escaping and neutralization stay inspectable."
/>

## Variants and personalization

A variant records user-owned layout, visibility, ordering, sort, and filter choices according to
application policy. The personalization dialog edits a draft: Cancel discards it; OK applies a
validated snapshot.

<PlayExample id="data-grid/variants-personalization"
  title="Variants and personalization"
  blurb="Save, apply, cancel, and accept deterministic grid variants through the public personalization flow."
/>

## Limits and practices

- Treat every exported cell as untrusted text, including values produced by formatters.
- Keep export scope visible: selected, visible, loaded, or all server-side records.
- Version persisted variants and tolerate removed or renamed columns.
- Apply dialog edits only on OK; Cancel must leave the live grid unchanged.

## Related

- [API map](/components/data-grid/api) — find export and personalization helpers.
- [Data at scale](/components/data-grid/data-at-scale) — define what “all rows” means.
- [`personalizeGrid` API](/api/datagrid/functions/personalizeGrid) — generated signature.
