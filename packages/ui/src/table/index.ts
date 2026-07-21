/**
 * Public entry for the table widget — the `DataGrid<T>` multi-column table plus its column model,
 * and the reusable grid engine underneath it: the `GridRows`/`GridHeader` renderers and the pure,
 * view-free column math. The engine is exposed so another package can compose a bespoke grid on the
 * same virtual-scroll body, sticky header, and apportion/align/sort helpers instead of re-deriving
 * them.
 */
export { DataGrid } from './data-grid.js';
export type { DataGridOptions, Column, ColumnWidth, ColumnAlign, SortState, ColumnGeometry } from './data-grid.js';
export { GridRows, GridHeader } from './grid-rows.js';
export type { GridRowsConfig, GridHeaderConfig } from './grid-rows.js';
export { apportionColumns, alignCell, sortRows, measureAutoWidths } from './columns.js';
