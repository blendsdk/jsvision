/**
 * `@jsvision/datagrid` — the public entry point for the editable, enterprise-class data grid built on
 * `@jsvision/ui`. The surface is populated as the foundation lands: the typed `value`/`format`/`parse`
 * column model and `column` helper, the `GridDataSource` seam with `fromRows`, the `commitCell` sink,
 * the `mountCellOverlay` helper, and the read-only `EditableDataGrid` container.
 */

// Typed column model — a `value`/`format`/`parse` column authored with `column()` (which infers each
// column's value type). The `ColumnWidth`/`ColumnAlign` sizing types are re-exported from the engine.
export { column } from './column.js';
export type { GridColumn } from './column.js';
export type { ColumnWidth, ColumnAlign } from '@jsvision/ui';
