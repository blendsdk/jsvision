/**
 * Barrel for the RD-16 table subsystem — the `DataGrid<T>` multi-column table + its column model.
 * The single public entry (`src/index.ts`) re-exports `DataGrid` + the `Column`/`ColumnWidth`/
 * `SortState`/`DataGridOptions` types from here. The `GridRows`/`GridHeader` renderers + the pure
 * `columns.ts` math are internal (not re-exported through the package entry). `.js` per NodeNext.
 */
export { DataGrid } from './data-grid.js';
export type { DataGridOptions, Column, ColumnWidth, ColumnAlign, SortState, ColumnGeometry } from './data-grid.js';
