/**
 * `@jsvision/datagrid` — the public entry point for the editable, enterprise-class data grid built on
 * `@jsvision/ui`. The surface is populated as the foundation lands: the typed `value`/`format`/`parse`
 * column model and `column` helper, the `GridDataSource` seam with `fromRows`, the `commitCell` sink,
 * the `mountCellOverlay` helper, and the read-only `EditableDataGrid` container.
 */

// Typed column model — a `value`/`format`/`parse` column authored with `column()` (which infers each
// column's value type). The `ColumnWidth`/`ColumnAlign` sizing types are re-exported from the engine.
export { column, isEditable } from './column.js';
export type { GridColumn } from './column.js';
export type { ColumnWidth, ColumnAlign } from '@jsvision/ui';

// Data source — the read seam the grid binds to. `fromRows` is the in-memory source; every source
// carries a required `rowKey`. `SortKey`/`FilterModel` are forward-declared for later push-down.
export { fromRows } from './data-source.js';
export type { GridDataSource, SortKey, FilterModel } from './data-source.js';

// Commit sink — the `onCommit` veto contract and the `commitCell` primitive that applies an edit
// immediately and reverts it on veto.
export { commitCell } from './commit.js';
export type { CellCommit, OnCommit } from './commit.js';

// Cell overlay — `mountCellOverlay` mounts an editor view over a grid cell; `absoluteRect` gives a
// mounted view's absolute origin.
export { mountCellOverlay, absoluteRect } from './overlay.js';
export type { CellRect } from './overlay.js';

// Cell editor seam — `createCellEditor` builds the editor view for a cell (a text `Input` by default),
// or `null` for a read-only column. `CellEditorHost` carries what a richer editor needs later.
export { createCellEditor } from './cell-editor.js';
export type { CellEditorHost } from './cell-editor.js';

// Dirty tracking — the reactive pending-commit registry and the NUL-joined `cellKey` it is keyed by
// (the container owns the registry; the grid body paints its `•` markers). The controller is internal.
export { createDirtyRegistry, cellKey } from './editing.js';
export type { DirtyRegistry } from './editing.js';

// The editable grid body — the `GridRows` engine plus a two-axis cell cursor, the focused-cell
// overpaint, and the in-cell editor lifecycle. The container injects the shared cursor signals.
export { EditableGridRows } from './editable-grid-rows.js';
export type { EditableGridRowsConfig } from './editable-grid-rows.js';

// The grid container — composes the promoted engine over the column model and data source, owns the
// shared cursor state, and mounts the editable body with its optional `onCommit` veto sink.
export { EditableDataGrid } from './grid.js';
export type { EditableDataGridOptions } from './grid.js';
