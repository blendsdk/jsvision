---
title: Data Grid layout and rendering
description: Size, reorder, freeze, hide, format, align, and custom-render Data Grid columns while preserving stable terminal geometry.
---

# Layout and rendering

Column layout is a geometry contract, not decoration. Width, order, visibility, and frozen state
must remain predictable when the viewport narrows, while rendering must preserve the typed value
behind every painted cell.

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
const columns = [
  column<Row, string>({ id: 'name', title: 'Name', value: (row) => row.name, width: 18 }),
  column<Row, number>({
    id: 'total',
    title: 'Total',
    value: (row) => row.total,
    format: (value) => value.toLocaleString(),
    width: 12,
    align: 'right',
  }),
];

const grid = new EditableDataGrid({
  columns,
  source: fromRows(rows, { rowKey: (row) => row.id }),
  freeze: 1,
});
```

## Column geometry

Use fixed widths for compact identifiers, flexible widths for descriptive text, and explicit
minimums for fields that must remain legible. Reorder and visibility state belong to the column
model; freezing should pin meaningful leading context rather than silently changing data order.

<PlayExample id="data-grid/layout-freezing"
  title="Layout and freezing"
  blurb="Resize, reorder, freeze, show, and hide columns while the lab reports the effective geometry and column order."
/>

## Cell rendering

Alignment should follow meaning: text normally starts at the leading edge, while comparable
numbers align on the trailing edge. Formatters and conditional roles receive typed values; custom
renderers should stay pure and bounded because they run for every visible cell.

<PlayExample id="data-grid/rendering"
  title="Rendering modes"
  blurb="Compare alignment, typed formatters, conditional theme roles, and a compact custom renderer on real grid cells."
/>

## Limits and practices

- Reserve width for headers, indicators, and scroll affordances before allocating data cells.
- Do not encode domain state only with color; keep a text or glyph cue.
- Keep custom renderers free of I/O and persistent mutation.
- Test narrow terminals and wide glyphs; JavaScript string length is not display-cell width.

## Related

- [Data & columns](/components/data-grid/data-and-columns) — define value semantics before paint.
- [Theming, accessibility & performance](/components/data-grid/theming-accessibility-performance)
  — preserve contrast and keyboard cues.
- [GridRows API](/api/ui/classes/GridRows) and [GridHeader API](/api/ui/classes/GridHeader) —
  generated signatures.
