/**
 * `@jsvision/datagrid` — the public entry point for the editable, enterprise-class data grid built on
 * `@jsvision/ui`. The surface is populated as the foundation lands: the typed `value`/`format`/`parse`
 * column model and `column` helper, the `GridDataSource` seam with `fromRows`, the `commitCell` sink,
 * the `mountCellOverlay` helper, and the read-only `EditableDataGrid` container.
 */

// Typed column model — a `value`/`format`/`parse` column authored with `column()` (which infers each
// column's value type). The `ColumnWidth`/`ColumnAlign` sizing types are re-exported from the engine.
// A column may opt into a null policy: `nullDisplay` renders a null value distinctly from `''` (never
// the literal `"null"`), and `nullable` lets an empty editor commit store `null` rather than `''`.
export { column, isEditable } from './column.js';
export type { GridColumn } from './column.js';
export type { ColumnWidth, ColumnAlign } from '@jsvision/ui';

// Formatter registry — locale-aware `Intl` formatters (`fmt.number/currency/percent/date/datetime/
// boolean/enumLabel/lookupLabel`). The numeric kinds ship a matched inverse `parse`; `PARSE_FAILED` is
// the sentinel it returns for an unparseable string (the commit path rejects it).
export { fmt, PARSE_FAILED } from './format.js';
export type {
  ParseFailed,
  NumberFormatOptions,
  CurrencyFormatOptions,
  InvertibleFormat,
  DisplayFormat,
} from './format.js';

// Cell rendering & conditional styling — the `render`/`cellStyle` column hooks, the cell-local draw
// surface a custom renderer sees, and the read-only per-cell state handed to it.
export type { CellStyle } from './column.js';
export type { CellRenderer, CellDrawContext, RenderCell, CellState } from './cell-draw.js';

// Data source — the read/mutate seam the grid binds to. `fromRows` is the in-memory source; every
// source carries a required `rowKey` and may implement the optional `insert`/`remove` mutation seam
// (`fromRows` does, by splicing its signal). A source without it is read-only — the grid never persists
// on its own, so `insertRow`/`deleteRows`/`duplicateRow` become no-ops.
export { fromRows, fromReactiveRows } from './data-source.js';
export type { GridDataSource } from './data-source.js';

// Windowing — the windowed read path. `isWindowed` detects a windowed source (one exposing `ensureRange`);
// `windowedView` presents it as the length-correct lazy `display: () => T[]` the grid body demands (only
// `.length` + integer indexing; every whole-array op throws, so a missed guard is a located test failure,
// never a silent full-scan). A windowed source drives its own loading and pushes sort/filter down, and
// signals a landed page through the optional reactive `revision?()` member on `GridDataSource`.
export { isWindowed, windowedView } from './windowing.js';

// View export — `grid.exportView(format)` serializes the current view (visible columns in display order,
// formatted values, the filtered + sorted rows) to CSV / HTML / JSON / TSV. `ExportFormat` is the target
// selector; CSV/TSV are RFC-4180 with spreadsheet formula-injection escaping, HTML is a standalone escaped
// document, JSON is raw values keyed by column id. The grid returns a string; the caller owns the sink.
export type { ExportFormat } from './export-view.js';

// Layout variants — a named, serializable snapshot of a grid's full column layout (order, widths,
// visibility, freeze, sort, filter) that `grid.saveVariant(name)` returns and `grid.applyVariant(v)`
// restores. The caller persists the `GridVariant`; the grid holds no registry. `setFrozen(left, right)`
// (a method on the grid) is the runtime freeze mutation variants rely on.
export type { GridVariant, GridVariantColumn } from './variant.js';

// Filter model — the pure `filterRows` multi-column AND evaluator and `computeDistinct` label
// enumeration, plus the `ColumnFilter` per-column condition, the `FilterModel` map the source's
// `setFilter` push-down consumes, the `DistinctResult` a value-list reads, and the `FilterType` a
// column's condition popup presents.
export { filterRows, computeDistinct } from './filter.js';
export type { ColumnFilter, FilterModel, DistinctResult, FilterType } from './filter.js';

// Column-layout model — the pure, view-free column-layout ops (visible order, the frozen L/C/R
// `partition`, within-panel `reorderWithinPanel`, `clampWidth`, and the `overPinnedIds` guard) plus
// the `FreezePartition`/`FreezeSpec` shapes and the default width bounds. The data-plane twin of the
// sort/filter models; the container wraps these in signals and injects them into the panels.
export {
  visibleOrder,
  partition,
  reorderWithinPanel,
  clampWidth,
  overPinnedIds,
  DEFAULT_MIN_WIDTH,
  DEFAULT_AUTOFIT_MAX,
} from './column-model.js';
export type { FreezePartition, FreezeSpec } from './column-model.js';

// Sort model — the pure `sortRowsMulti` multi-key comparator plus the `SortKey`/`SortDir` shape a
// sort directive uses (a single-column sort is a one-element key list). `SortKey` is the same shape
// the data source's `setSort` push-down consumes.
export { sortRowsMulti } from './sort.js';
export type { SortKey, SortDir } from './sort.js';

// Selection model — the pure, view-free set-membership ops (`toggleKey`, `selectRange`, `selectAll`,
// `triState`) every selection gesture shares, plus the `Key`/`SelectionMode`/`TriState` shapes. The
// data-plane twin of the sort/filter models: the container wraps these in a `selectedKeys` signal + an
// anchor key. Selection is keyed by `rowKey`, so it survives re-sort/re-filter with no reconcile.
export { toggleKey, selectRange, selectAll, triState } from './selection.js';
export type { Key, SelectionMode, TriState } from './selection.js';

// Synthetic prefix helpers — the pure geometry/glyph functions behind the opt-in checkbox column and
// row-number gutter (`prefixWidth`, `checkboxGlyph`, `headerCheckboxGlyph`, `gutterLabel`) plus the
// `SyntheticPrefix` shape. Enabled via the `checkboxColumn`/`rowNumbers` grid options; exported so a
// bespoke grid can size or paint its own leading affordances.
export { prefixWidth, checkboxGlyph, headerCheckboxGlyph, gutterLabel } from './synthetic-columns.js';
export type { SyntheticPrefix } from './synthetic-columns.js';

// The sort header — the datagrid's own multi-key sticky header View (arrows + priority digits + the
// per-column filter funnel, columnId-keyed, click-to-sort / click-to-open-filter). The container
// mounts one internally; it is exported so a bespoke grid (or a later frozen-panel split) can bind
// several headers to one sort/filter signal.
export { SortHeader } from './sort-header.js';
export type { SortHeaderConfig } from './sort-header.js';

// The quick-filter row — the opt-in band of per-column text inputs that drive a live `contains` filter
// as you type. The container builds one internally when `quickFilter` is set; it is exported so a
// bespoke grid can mount its own band over the shared column geometry.
export { QuickFilterRow } from './quick-filter-row.js';
export type { QuickFilterRowConfig } from './quick-filter-row.js';

// The condition-filter popup — the funnel-opened panel with a per-type operator selector and operand
// editors that emits a `ColumnFilter`. The container opens one on a funnel click; it is exported so a
// bespoke grid can drive it programmatically.
export { FilterPopup } from './filter-popup.js';
export type { FilterPopupConfig, FilterPopupContext } from './filter-popup.js';

// The Excel value-list — the distinct-value checkbox picker (async-populated, type-ahead search, Select
// All, truncation disclosure) that the condition popup embeds. Exported for bespoke composition.
export { ValueList } from './value-list-popup.js';
export type { ValueListConfig } from './value-list-popup.js';

// Commit sink — the `onCommit` veto contract, the `beforeSave` gate that layers above it (a veto reverts
// and skips `onCommit`), and the `commitCell` primitive that applies an edit immediately and reverts it
// on veto.
export { commitCell } from './commit.js';
export type { CellCommit, OnCommit, BeforeSave } from './commit.js';

// Validation surfacing — the reactive invalid-cell registry (`createErrorRegistry`, the twin of
// `createDirtyRegistry`: a message per blocked cell plus one active-message channel for the band) and
// the `RowValidation` result a grid `validateRow` returns (`{ ok; message?; field? }`). A cell is marked
// invalid on a blocked/vetoed commit and cleared on a successful re-commit or an abandoned edit.
export { createErrorRegistry } from './error-registry.js';
export type { ErrorRegistry } from './error-registry.js';
export type { RowValidation } from './validation.js';

// Lifecycle — the `GridStatus` a caller's `status` getter returns (loading / ready / error, with string
// shorthands); the grid derives the empty state (filter-aware) from the displayed count. Loading/error
// swap the body region for a spinner/error placeholder while the header stays visible.
export type { GridStatus } from './grid-lifecycle.js';

// Cell overlay — `mountCellOverlay` mounts an editor view over a grid cell; `absoluteRect` gives a
// mounted view's absolute origin.
export { mountCellOverlay, absoluteRect } from './overlay.js';
export type { CellRect } from './overlay.js';

// Cell editor seam — `createCellEditor` builds the editor view for a cell (a text `Input` by default),
// or `null` for a read-only column. `CellEditorHost` carries what a richer editor needs; the
// `CellEditorSpec`/`CellEditorKind` descriptor a column declares selects the typed widget it mounts.
export { createCellEditor } from './cell-editor.js';
export type { CellEditorHost, CellEditorKind, CellEditorSpec, LookupItem, LookupProvider } from './cell-editor.js';

// Dirty tracking — the reactive pending-commit registry and the NUL-joined `cellKey` it is keyed by
// (the container owns the registry; the grid body paints its `•` markers). The controller is internal.
export { createDirtyRegistry, cellKey } from './editing.js';
export type { DirtyRegistry } from './editing.js';

// The editable grid body — the `GridRows` engine plus a two-axis cell cursor, the focused-cell
// overpaint, and the in-cell editor lifecycle. The container injects the shared cursor signals.
export { EditableGridRows } from './editable-grid-rows.js';
export type { EditableGridRowsConfig } from './editable-grid-rows.js';

// The grid container — composes the promoted engine over the column model and data source, owns the
// shared cursor state, and mounts the editable body with its optional `onCommit` veto sink. It exposes
// the reactive readouts `displayedRows()` (the aggregate fold target), `focusedRow()`/`focusedKey()`
// (the record/key under the cursor, re-anchored across sort/filter), and `filteredCount()`/`totalCount()`.
// The `keymap` option remaps input; `nextCell()`/`prevCell()`/`isBodyFocused()`/`isEditing()` drive Tab
// cell-traversal (via `installGridNavigation`).
export { EditableDataGrid } from './grid.js';
export type { EditableDataGridOptions } from './grid.js';

// Keymap model — the remappable input surface: the `GridAction` vocabulary, the frozen `DEFAULT_KEYMAP`
// chord→action table, `resolveGridAction` (a key→action lookup), and `mergeKeymap` (layer a caller's
// overrides over the default; unknown actions and malformed chords are dropped, never thrown). Pass a
// `GridKeymap` to the grid's `keymap` option to remap a chord.
export { DEFAULT_KEYMAP, resolveGridAction, mergeKeymap } from './keymap.js';
export type { GridAction, GridKeymap, KeymapKeyEvent } from './keymap.js';

// Tab cell-traversal — the pure cursor math (`nextCellIndex`/`prevCellIndex`, wrapping at row ends,
// `'exit'` at the grid edge), the `gridKeymap` loop-fragment binding Tab/Shift+Tab to grid-navigation
// commands, and `installGridNavigation` (registers the command handlers for one or more grids; the app
// opts in — no core/ui change). `NavGrid` is the structural grid shape the helper drives.
export { nextCellIndex, prevCellIndex, gridKeymap, installGridNavigation } from './navigation.js';
export type { CellMove, NavGrid } from './navigation.js';

// Aggregate model — the pure fold behind a footer aggregate: the `AggregateFn` reductions, the
// `AggregateSpec` descriptor, `foldAggregate` (edge-safe), `formatAggregate` (with the honesty
// qualifier), and the `isAggregateFn` config-time guard. Exported so a bespoke grid can fold its own totals.
export { foldAggregate, formatAggregate, isAggregateFn } from './aggregate.js';
export type { AggregateFn, AggregateSpec } from './aggregate.js';

// Footer — the `GridFooter` config (per-column aggregates + free-form widgets + the reserved sticky flag)
// a caller passes to the grid's `footer` option, and the `FooterBand` view (the passive per-panel
// aggregate painter the grid assembles internally; exported for bespoke composition).
export type { GridFooter } from './grid-footer.js';
export { FooterBand } from './footer-band.js';

// Master-detail — `fromReactiveRows` (above) plus `masterDetail`, which links a detail grid to a master's
// focused record and disposes the reactive link with the surrounding scope.
export { masterDetail } from './master-detail.js';
