---
title: Data Grid
description: Choose and compose JSVision's read-only DataGrid or typed EditableDataGrid, then follow the specialist guides for data, interaction, editing, scale, and trust.
---

# Data Grid

JSVision has two complementary grid surfaces. `DataGrid` from `@jsvision/ui` is the compact choice
for displaying rows with a header. `EditableDataGrid` from `@jsvision/datagrid` adds typed columns,
sorting, filtering, selection, editors, validation, footers, export, and personalization. Start with
the smaller surface that owns the behavior your application actually needs.

## Quick start

Both grids need stable row identity and deliberate column sizing. The editable grid keeps the row
type in its column definitions, so formatting and editing remain type checked.

```ts
import { DataGrid, signal } from '@jsvision/ui';
import { EditableDataGrid, fromRows } from '@jsvision/datagrid';

const report = new DataGrid({ columns, rows: signal(reportRows) });
const ledger = new EditableDataGrid<AccountRow>({
  columns: accountColumns,
  source: fromRows(signal(accounts), { rowKey: (row) => row.id }),
});
```

<PlayExample id="data-grid/quick-start"
  title="Choose a grid"
  blurb="Compare the concise read-only DataGrid and typed EditableDataGrid in a maximized lab, then restore or resize it to inspect their responsive layout."
/>

## Capability map

| Goal                                        | Start here                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| Define rows, stable keys, and typed columns | [Data & columns](/components/data-grid/data-and-columns)                        |
| Control geometry and cell presentation      | [Layout & rendering](/components/data-grid/layout-and-rendering)                |
| Find and order records                      | [Sorting & filtering](/components/data-grid/sorting-and-filtering)              |
| Move through and select records             | [Rows, selection & navigation](/components/data-grid/rows-selection-navigation) |
| Edit, validate, and commit                  | [Editing & cell editors](/components/data-grid/editing-and-editors)             |
| Handle large collections honestly           | [Data at scale](/components/data-grid/data-at-scale)                            |

## Cross-cutting practices

- Keep row keys stable across sorting, filtering, edits, and refreshes.
- Treat loading, empty, filtered-empty, and error as separate states with separate explanations.
- Keep export escaping and formula neutralization at the trust boundary.
- Measure performance with the intended source model; a 100,000-row window is not a
  100,000-element in-memory array.
- Make grid workspaces resizable and preserve their padded layout across maximize and restore.

## DataGrid

Use `DataGrid` when the application owns transformations and needs a straightforward tabular view.
Its `GridHeader` and `GridRows` surfaces can also be composed when a custom host owns surrounding
chrome. See the generated API for
[DataGrid](/api/ui/classes/DataGrid), [GridHeader](/api/ui/classes/GridHeader), and
[GridRows](/api/ui/classes/GridRows).

## Editable Data Grid

Use `EditableDataGrid` when the grid should own typed editing and richer interaction. The package
adds dedicated header, filter, editor, footer, and personalization surfaces without making the
read-only grid pay for those policies.

The generated API documents [EditableDataGrid](/api/datagrid/classes/EditableDataGrid),
[EditableGridRows](/api/datagrid/classes/EditableGridRows),
[SortHeader](/api/datagrid/classes/SortHeader),
[QuickFilterRow](/api/datagrid/classes/QuickFilterRow),
[FilterPopup](/api/datagrid/classes/FilterPopup), [ValueList](/api/datagrid/classes/ValueList),
[FooterBand](/api/datagrid/classes/FooterBand), and
[personalizeGrid](/api/datagrid/functions/personalizeGrid).

## Related

- [Guide curriculum](/guide/) — return to the complete framework learning path.
- [Reactive state](/guide/reactive-state) — model source rows, derivations, and owned updates.
- [Scrolling, lists & large content](/guide/scrolling-lists-and-large-content) — choose viewport
  ownership and distinguish resident data from windowed sources.
- [Forms](/guide/forms) — understand typed validation, async work, and persistence boundaries
  before composing editable cells.
- [Data & columns](/components/data-grid/data-and-columns) — establish the data model first.
- [API map](/components/data-grid/api) — find each visual and non-visual public surface.
- [DataGrid API](/api/ui/classes/DataGrid) and
  [EditableDataGrid API](/api/datagrid/classes/EditableDataGrid) — generated signatures.
