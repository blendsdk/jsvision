/**
 * Public entry for the table widget — the `DataGrid<T>` multi-column table plus its column model.
 * The `GridRows`/`GridHeader` renderers and the pure column math are internal implementation details
 * and are not exported here.
 */
export { DataGrid } from './data-grid.js';
export type { DataGridOptions, Column, ColumnWidth, ColumnAlign, SortState, ColumnGeometry } from './data-grid.js';
