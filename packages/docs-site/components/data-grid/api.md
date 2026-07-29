---
title: Data Grid API map
description: Map Data Grid visual surfaces, editing helpers, filtering, footer, export, and personalization APIs to their owning packages.
---

# Data Grid API map

The Data Grid hub spans `@jsvision/ui` and `@jsvision/datagrid`. This map keeps package ownership
visible: use the UI package for the compact read-only surface and the Data Grid package for typed
editing, transformations, aggregation, and personalization.

## Visual surfaces

| Surface                                                      | Package              | Role                     |
| ------------------------------------------------------------ | -------------------- | ------------------------ |
| [`DataGrid`](/api/ui/classes/DataGrid)                       | `@jsvision/ui`       | Compact read-only grid   |
| [`GridHeader`](/api/ui/classes/GridHeader)                   | `@jsvision/ui`       | Read-only column header  |
| [`GridRows`](/api/ui/classes/GridRows)                       | `@jsvision/ui`       | Read-only row viewport   |
| [`EditableDataGrid`](/api/datagrid/classes/EditableDataGrid) | `@jsvision/datagrid` | Typed interactive grid   |
| [`EditableGridRows`](/api/datagrid/classes/EditableGridRows) | `@jsvision/datagrid` | Editable row viewport    |
| [`SortHeader`](/api/datagrid/classes/SortHeader)             | `@jsvision/datagrid` | Sort state and priority  |
| [`QuickFilterRow`](/api/datagrid/classes/QuickFilterRow)     | `@jsvision/datagrid` | Per-column quick filters |
| [`FilterPopup`](/api/datagrid/classes/FilterPopup)           | `@jsvision/datagrid` | Condition filter editor  |
| [`ValueList`](/api/datagrid/classes/ValueList)               | `@jsvision/datagrid` | Distinct-value selection |
| [`FooterBand`](/api/datagrid/classes/FooterBand)             | `@jsvision/datagrid` | Aggregate footer surface |

## Ownership boundaries

The host owns domain rows, persistence, authorization, and remote source policy. The grid owns
viewport interaction and the configured transformation/edit lifecycle. Export callers own scope
and destination safety; `personalizeGrid` owns the reversible dialog interaction, while the host
owns variant persistence and migration.

Supporting column, editor, validation, source, export, and variant types live beside
`EditableDataGrid` in `@jsvision/datagrid`. Import through the package entry point so examples and
applications remain independent of workspace source layout.

## Related

- [Overview](/components/data-grid/) — choose the correct surface.
- [Editing & cell editors](/components/data-grid/editing-and-editors) — learn the edit lifecycle.
- [Export & personalization](/components/data-grid/export-and-personalization) — apply the trust
  and ownership boundaries.
- [`personalizeGrid` API](/api/datagrid/functions/personalizeGrid) — generated helper signature.
