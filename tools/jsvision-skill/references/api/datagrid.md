<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:update`. Source: @jsvision/* JSDoc. -->

# API — @jsvision/datagrid — editable enterprise grids

Typed columns, editing, sorting, filtering, selection, variants, and windowing.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## AggregateFn

The built-in reductions a footer aggregate can apply to a column.

```ts
type AggregateFn = 'sum' | 'avg' | 'min' | 'max' | 'count'
```

## AggregateSpec

A per-column footer aggregate.

```ts
interface AggregateSpec {
  fn: AggregateFn;   // The reduction to apply.
  format?: (v: number) => string;   // Render the numeric fold result to display text; defaults to `String(v)` when omitted.
  label?: string;   // An optional static prefix placed before the value (e.g. `'Σ'`).
}
```

## BeforeSave

A per-cell gate that decides **whether** an already-applied edit may proceed to `onCommit`, layered directly above it.

```ts
type BeforeSave<T> = (change: CellCommit<T>) => boolean | Promise<boolean>
```

## CellCommit

The change described to an `OnCommit` sink: which cell changed, its new and previous values, and the (already-updated) row.

```ts
interface CellCommit<T, V = unknown> {
  rowKey: string | number;   // Stable key of the edited row.
  columnId: string;   // Id of the edited column.
  value: V;   // The new value (already applied to the record).
  previous: V;   // The value before the edit (restored on veto).
  row: T;   // The row record (already updated to `value`).
}
```

## CellDrawContext

The cell-local draw surface a renderer sees — a thin facade over the body context: the origin is the cell's top-left, and writes are clipped to the cell rect so a renderer cannot paint into a neighbour.

```ts
type CellDrawContext = Pick<DrawContext, 'text' | 'fillRect' | 'color' | 'role' | 'caps'>
```

## CellEditorHost

What an editor may need to open its own sub-UI (a dropdown or value-help popup).

```ts
interface CellEditorHost {
  overlay: Group;   // The grid's absolute overlay group — an editor with a popup mounts it here.
}
```

## CellEditorKind

The concrete editor a cell mounts.

```ts
type CellEditorKind = 'text' | 'integer' | 'decimal' | 'boolean' | 'date' | 'enum' | 'lookup' | 'readonly' | 'custom'
```

## CellEditorSpec

The declarative editor descriptor a column carries.

```ts
interface CellEditorSpec {
  kind: CellEditorKind;   // Which typed editor the cell mounts.
  validator?: Validator;   // Live keystroke filter (defaults per kind; overrides the built-in default when set).
  values?: readonly string[];   // The value set for `kind: 'enum'` — rendered in order; selecting one commits that string.
  items?: LookupProvider;   // The rows for `kind: 'lookup'` (a static array or an async provider).
  create?: (field: Signal<string>, host: CellEditorHost) => View | null;   // The factory for `kind: 'custom'` — returns a `View` bound to `field`, honoring Enter=commit/Esc=cancel.
}
```

## CellMove

Where the cursor lands next, or `'exit'` at the grid edge.

```ts
type CellMove = { readonly col: number; readonly row: number } | 'exit'
```

## CellRect

A cell rect in the grid body's local coordinates.

```ts
interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

## CellRenderer

A custom cell painter.

```ts
type CellRenderer<T, V> = (ctx: CellDrawContext, cell: RenderCell<T, V>) => void
```

## CellState

Which composited states are active on the cell being rendered.

```ts
interface CellState {
  focused: boolean;   // The cursor cell (the body has focus).
  selected: boolean;   // The selected row (dormant until row selection lands).
  dirty: boolean;   // A pending commit.
  invalid: boolean;   // A blocked commit — the last edit failed validation / a veto and never took.
  zebra: boolean;   // An odd zebra stripe.
}
```

## CellStyle

Value-driven cell colour.

```ts
type CellStyle<T, V> = (value: V, row: T) => ThemeRoleName | Style
```

## ColumnAlign

Horizontal alignment of a cell's text within its column width.

```ts
type ColumnAlign = 'left' | 'right' | 'center'
```

## ColumnFilter

A single column's filter condition.

```ts
type ColumnFilter<V = unknown> = | { readonly kind: 'set'; readonly selected: ReadonlySet<string> }
  | { readonly kind: 'text'; readonly op: 'contains' | 'startsWith' | 'endsWith' | 'equals'; readonly value: string }
  | { readonly kind: 'number'; readonly op: 'gt' | 'lt' | 'between' | 'eq'; readonly a: number; readonly b?: number }
  | {
      readonly kind: 'date';
      readonly op: 'before' | 'after' | 'between' | 'on';
      readonly a: CalendarDate;
      readonly b?: CalendarDate;
    }
  | { readonly kind: 'custom'; readonly predicate: (value: V, row: unknown) => boolean }
```

## ColumnWidth

How a column is sized: an exact cell count, an `fr` flex weight, or `auto` (measured over rows).

```ts
type ColumnWidth = number | `${number}fr` | 'auto'
```

## CurrencyFormatOptions

Currency options — `currency` (an ISO 4217 code) is required; a bare number is never styled implicitly.

```ts
interface CurrencyFormatOptions {
  currency: string;   // ISO 4217 currency code, e.g. `'EUR'` or `'USD'`.
}
```

## DEFAULT_AUTOFIT_MAX

The default upper bound for auto-fit when a column declares no `maxWidth` (generous but bounded).

```ts
const DEFAULT_AUTOFIT_MAX: 60
```

## DEFAULT_KEYMAP

The one documented default binding table.

```ts
const DEFAULT_KEYMAP: GridKeymap
```

## DEFAULT_MIN_WIDTH

The minimum a column may be resized to when it declares no `minWidth` (fits an ellipsis + a glyph).

```ts
const DEFAULT_MIN_WIDTH: 3
```

## DirtyRegistry

A reactive registry of cells with a pending (not-yet-confirmed) commit.

```ts
interface DirtyRegistry {
  add(key: string): void;   // Mark a cell key pending.
  delete(key: string): void;   // Clear a cell key.
  has(key: string): boolean;   // Whether a cell key is pending — a reactive read (re-runs in an effect on change).
  keys(): ReadonlySet<string>;   // The current pending set — a reactive read (for the row/grid rollups and the marker overpaint).
}
```

## DisplayFormat

A display-only formatter (date/datetime/boolean/enum/lookup) — no inverse.

```ts
interface DisplayFormat<V> {
  format: (value: V, row: unknown) => string;   // Formats a value for display.
}
```

## DistinctResult

The distinct-value enumeration a value-list popup consumes: the formatted labels plus whether the source capped the list (so the popup can disclose truncation instead of silently under-reporting).

```ts
interface DistinctResult {
  values: readonly string[];   // The distinct formatted labels.
  truncated?: boolean;   // `true` when the source truncated the list (a bounded/windowed distinct query).
}
```

## EditableDataGrid

An editable, self-drawing data grid over a typed column model and a GridDataSource.

```ts
new EditableDataGrid<T>(opts: EditableDataGridOptions<T>)   // extends Group
// methods & signals:
rows: EditableGridRows<T>
overlay: Group
popupOverlay: Group
isDirty(rowKey: string | number, columnId: string): boolean
isRowDirty(rowKey: string | number): boolean
isGridDirty(): boolean
isInvalid(rowKey: string | number, columnId: string): boolean
activeMessage(): string | null
sortBy(columnId: string, dir?: SortDir): void
addSort(columnId: string, dir?: SortDir): void
clearSort(): void
sort(): SortKey[]
setFilter(columnId: string, filter: ColumnFilter): void
clearFilter(columnId?: string): void
filterModel(): FilterModel
filteredCount(): number
totalCount(): number
displayedRows(): readonly T[]
exportView(format: ExportFormat): string
columnOrder(): string[]
columns(): readonly GridColumnInfo[]
defaultColumnLayout(): readonly GridColumnInfo[]
setColumnOrder(ids: string[]): void
columnWidth(id: string): number
setColumnWidth(id: string, w: number): void
clearColumnWidth(id: string): void
setColumnVisible(id: string, visible: boolean): void
frozen(): { left: string[]; right: string[] }
setFrozen(left: string[], right: string[]): void
saveVariant(name: string): GridVariant
applyVariant(variant: GridVariant): void
autoFitColumn(id: string): void
autoFitAll(): void
selectedKeys(): ReadonlySet<Key>
focusedRow(): T | undefined
focusedKey(): Key | undefined
isBodyFocused(): boolean
isEditing(): boolean
nextCell(): Promise<'moved' | 'exit'>
prevCell(): Promise<'moved' | 'exit'>
selectRow(key: Key): void
toggleRow(key: Key): void
selectRange(toKey: Key): void
selectAllDisplayed(): void
clearSelection(): void
insertRow(row: T, at?: number): void
deleteRows(keys: readonly Key[]): void
duplicateRow(key: Key): void
```

## EditableDataGridOptions

Construction options for EditableDataGrid.

```ts
interface EditableDataGridOptions<T> {
  columns: GridColumn<T>[];   // The typed columns (authored with `column()`); adapted to the engine internally.
  source: GridDataSource<T>;   // The data source (carries the required `rowKey`).
  zebra?: boolean;   // Stripe odd rows for readability (default `false`).
  selectionMode?: SelectionMode;   // Row selection mode (default `'multi'`). `'single'` keeps at most one row selected — each pick replaces the prior; `'multi'` accumulates (`Space`/`Ctrl`+click toggle, `Shift` extends a range). Selection gestures are always live; the checkbox column and row-number gutter are separately opt-in.
  checkboxColumn?: boolean;   // Show a leading **selection checkbox column** (default `false`): a per-row `[ ]`/`[x]` box plus a tri-state header box (none/some/all of the displayed rows). It is a fixed-width, left-pinned cell — not a sortable/filterable column and never reached by the `←`/`→` cursor. A per-row click toggles the row; the header box selects/clears all displayed rows.
  rowNumbers?: boolean;   // Show a leading **row-number gutter** (default `false`): 1-based, right-aligned display numbers that renumber whenever the display re-derives (after a sort/filter). Left-pinned and display-only.
  quickFilter?: boolean;   // Show the opt-in quick-filter row — a band of per-column text inputs below the header that drive a live `contains` filter as you type (default `false`; the band is never built when off).
  onCommit?: OnCommit<T>;   // The per-cell veto sink — accept or reject each edit (see OnCommit).
  beforeSave?: BeforeSave<T>;   // A per-cell gate that runs **above** `onCommit`: after the optimistic in-memory write and before `onCommit`. Return `true` to proceed to `onCommit`, or `false`/a rejected promise to veto — a veto reverts the cell to its previous value, surfaces a rejection message, and `onCommit` is never called. Use it for a policy check (permission, a business rule) that should short-circuit persistence. Client-side gating is UX only — the authoritative check still belongs in `onCommit`/the source.
  validateRow?: (row: T) => RowValidation;   // A per-row cross-field gate that runs when the cursor leaves a row **that was edited** this visit (a cell in it committed). Return `{ ok: true }` to allow the leave, or `{ ok: false, message?, field? }` to block it: the cursor stays on the row, refocuses the `field` column (the offending field), and `message` surfaces in the message band. An untouched row — even a pre-existing invalid one — leaves freely; a row that once passes will not re-trap. Use it for cross-field rules a single cell cannot check (e.g. `end` after `start`). Client-side gating is UX only — the source stays authoritative.
  keymap?: GridKeymap;   // A per-grid keyboard remap layered over the default binding table (see `DEFAULT_KEYMAP`). Each entry maps a chord (`'ctrl+alt+shift+key'`) to a `GridAction`; a caller entry wins on a chord conflict, and the untouched defaults still fire. An entry naming an unknown action or a malformed chord is ignored (a dev warning, never thrown), so a typo can never break construction. Omit to use the defaults.
  freezeLeft?: string[];   // Column ids to pin to the left (frozen) panel.
  freezeRight?: string[];   // Column ids to pin to the right (frozen) panel.
  freeze?: number;   // Shorthand for freezing the first N columns to the left (ignored when `freezeLeft` is set).
  freezeRows?: number;   // Pin the first N data rows as a non-scrolling band directly below the header — the horizontal mirror of frozen columns. The scrolling body's window starts after them, so a pinned row never scrolls off or renders twice. Clamped so at least one scrolling row always remains (a value larger than the row count is reduced, with a dev warning). Composes with frozen columns: the top-left cell is pinned on both axes. Default `0` (no band).
  density?: 'normal' | 'compact';   // Row density (default `'normal'`). `'compact'` drops the inter-column `│` divider, reclaiming its cell per column so content packs tighter (the header, body, and quick-filter all reflow together and stay aligned). Horizontal only — rows are 1 cell tall in either mode.
  filterPopup?: (ctx: FilterPopupContext<T>) => View;   // Replace the built-in condition-filter popup with a custom view. The factory receives a FilterPopupContext (the column, its filter type, the current filter, the value-list `distinct` thunk, the apply/clear/close sinks, and a `defaultPopup()` builder) and returns the view to mount. Call `ctx.defaultPopup()` to reuse or wrap the built-in popup; return your own view to replace it entirely. The returned view is mounted **anchored** under the column and clamped into the viewport, at the size it sets on its own `layout` (or the default popup size when it sets none); if it exposes a `focusTarget()` method that view is focused. Omit to use the built-in popup.
  assignKey?: (clone: T, original: T) => T;   // Mint the fresh key for EditableDataGrid.duplicateRow — the caller owns key generation. It receives a structured clone of the original row plus the original, and returns the row to insert (typically the clone with a new `rowKey`). Without it, `duplicateRow` is a no-op (it never inserts a key-colliding row).
  footer?: GridFooter;   // An optional footer band: per-column aggregates (totals aligned under their columns, folded reactively over the displayed rows, honesty-labelled for a not-fully-loaded source) and/or a free-form widget row. See GridFooter. Omit for no footer.
  status?: () => GridStatus;   // A caller-driven reactive lifecycle status. Return `'loading'` to show a spinner (the header stays, the rows hide), `'ready'` to show the grid, or `{ kind: 'error', message, retry? }` to show the message and a Retry button (clicking it calls `retry`). The **empty** state is auto-derived: when `ready` with zero displayed rows the grid shows emptyText (or the filter-aware `'No matching rows'`). Evaluated in the grid's reactive scope, so flipping the value it reads swaps the view. Omit for an always-`ready` grid (a zero-row grid then shows the plain `<empty>` body).
  emptyText?: string;   // The message shown when the grid is `ready` with zero displayed rows and no active filter (default `'No rows'`). When a filter has reduced a non-empty source to zero, the built-in `'No matching rows'` is shown instead. Setting this (or status) opts the grid into the lifecycle empty state; a grid with neither keeps the plain `<empty>` body at zero rows.
  prefetch?: number;   // Prefetch buffer size in rows on each side of the visible window, for a **windowed** source (one exposing `ensureRange`). As the grid scrolls it requests `[top − prefetch, top + visible + prefetch)`, coalesced to at most one call per frame. **Unset ⇒ one viewport** (the current visible row count, resolved per draw) — there is no static default because the viewport height is not known at construction. Ignored for an eager in-memory source.
}
```

## EditableGridRows

The editable grid body — a GridRows with a two-axis cell cursor and a focused-cell overpaint.

```ts
new EditableGridRows<T>(cfg: EditableGridRowsConfig<T>)   // extends GridRows<T>
// methods & signals:
columnOffset: number
columnCount: number
isEditing(): boolean
commitEdit(): Promise<boolean>
```

## EditableGridRowsConfig

Construction config for EditableGridRows: the base grid config plus the editing wiring.

```ts
interface EditableGridRowsConfig<T> {
  focusedCol: Signal<number>;   // The shared column cursor index, owned by the container and injected (so panels can share it).
  keymap?: GridKeymap;   // The merged chord→action keymap the body resolves keys against. The container computes it once (`mergeKeymap(callerOverrides)`) and passes the same frozen map to every panel, so a remap is shared across a frozen-panel split. Omit to use the default table.
  typedColumns: GridColumn<T>[];   // The typed columns (parse/set/format live here; the base `columns` are the engine adapters).
  overlay: Group;   // The editor mount host (the container's absolute overlay group).
  onCommit?: OnCommit<T>;   // The optional per-cell veto sink.
  beforeSave?: BeforeSave<T>;   // The optional per-cell gate above `onCommit` (a veto reverts and skips `onCommit`).
  rowKey: (row: T) => string | number;   // The row-identity function (from the data source).
  bumpVersion: () => void;   // Bump-on-write so an in-place `set` repaints the mutated row.
  dirty?: DirtyRegistry;   // The shared dirty registry (pending-commit markers); omit to disable dirty tracking.
  errors?: ErrorRegistry;   // The shared invalid-cell registry (the `gridInvalid` band + message); omit to disable surfacing.
  markRowTouched?: (rowKey: string | number) => void;   // Mark a row as edited (a cell committed) — fed to the container's row-leave gate.
  rowLeaveGate?: () => boolean;   // The row-leave gate: consulted before a **row-changing** move (keyboard row-nav, the `Enter`-advance, or a click on a different row). Returns `true` to allow the leave, `false` to block it (the gate has already refocused the offending field). A within-row column move never consults it. Omit for no gate.
  emptyText?: () => string;   // The message to draw when the body has zero rows (the lifecycle empty state). Omit to keep the plain `<empty>` placeholder, so a grid with no lifecycle configured is byte-identical.
  selectedKeys?: Signal<ReadonlySet<Key>>;   // The datagrid selection set, keyed by `rowKey` — the body paints a row's `selected` role by membership here (not the base's single `selected` index, which is kept only as the base's required click sink). Optional: omit for a body that shows no selection (defaults to an empty set).
  onToggleRow?: (rowIndex: number) => void;   // Toggle the selection of the row at a display index — wired to `Space` on a read-only focused cell and `Ctrl`+click. The container maps the index to a key, moves the cursor to it, and toggles it. Omitted for a body without selection (the gesture then falls through to the base).
  onRangeToRow?: (rowIndex: number) => void;   // Extend the selection range to the row at a display index — wired to `Shift`+click and `Shift`+↑/↓. The container captures the pre-move cursor row as the range's default anchor, moves the cursor to the target, and unions the display-order run. Omitted for a body without selection.
  columnOffset?: number;   // This panel's start index in the GLOBAL column order (default `0`). In a frozen-panel grid the shared `focusedCol` is a single global index; a panel owns `[columnOffset, columnOffset + count)` and maps the global cursor to its local column via this offset. `0` for a single body.
  totalCols?: () => number;   // The GLOBAL visible column count (default: this panel's own column count). The cursor keys move `focusedCol` over `[0, totalCols())`; a single body's `totalCols` is just its column count, so its navigation is unchanged.
  onCursorEnterPanel?: (globalCol: number, ev: DispatchEvent) => void;   // Called when a cursor move lands `focusedCol` outside this panel's range, so the container can re-focus the panel that now owns the cursor (a leaf-focus hop). Omitted for a single body.
  onOpenFilter?: (globalCol: number, ev: DispatchEvent) => void;   // Open-filter sink: fired when `Alt+Down` is pressed on the non-editing body, with the GLOBAL focused column index and the live dispatch envelope (so the popup inherits `ev.focusView`/`ev.popupHost`). The container resolves the column's filterability and owning header and opens the condition popup. Optional — a body without it ignores `Alt+Down` (which then falls through to the base row cursor).
  mouseColumns?: boolean;   // When set, a mouse-down sets the global column cursor to the clicked column (frozen-panel mode).
  autoScrollColumns?: boolean;   // When set, moving the cursor to an off-screen column scrolls this panel to reveal it (center panel).
  panelActive?: () => boolean;   // Grid-wide focus predicate (frozen-panel mode). When set, the focused-row highlight, the cursor cell, and the dirty markers light up whenever *any* sibling panel holds focus — not only this one — so the shared row cursor reads as one continuous row across the frozen boundary. Omit for a single body (focus is then this view's own).
  widthTick?: () => unknown;   // A reactive column-geometry trigger. Bound for repaint so a change to a column's width override (a live resize / auto-fit) re-apportions and repaints — `draw` reads widths through the column objects but does not auto-track, so this explicit read is what schedules the repaint. Omit when the grid has no resizable columns.
  compact?: boolean;   // Compact density (default `false`): drop the inter-column `│` divider, reclaiming its cell so columns pack tighter. The geometry apportions over the full width with no divider cells and `draw` skips the `│`; the header/quick-filter must use the same setting so every band stays column-aligned.
  rowFloor?: number;   // Clamp the top of this panel's virtual window to `[rowFloor, rowCeil]` (default `[0, ∞)`). Used to split the row axis for frozen rows: a **pinned band** sets `rowFloor: 0, rowCeil: 0` (its window never scrolls off row 0), while the **scrolling body** sets `rowFloor: N` (its window starts after the N pinned rows, so a pinned row is never rendered twice). The shared `focused` cursor still ranges over the whole row set; the panel that does not own the cursor simply doesn't render it (its window excludes that row), and the sibling that does render it lights it up.
  rowCeil?: number;
  ensureRange?: (start: number, end: number) => void | Promise<void>;   // Windowed prefetch seam: request the page range covering the visible window (plus a buffer each side) as it scrolls, coalesced to ≤1 call per frame for the settled window. Omit for an eager source — the windowed loading path is then entirely inert.
  rowCount?: () => number;   // The source's total row count (windowed) — the window clamp reads it. Omit for an eager source.
  prefetch?: number;   // Prefetch buffer size in rows on each side of the viewport. Unset ⇒ one viewport (the current visible row count, resolved per-draw, since the viewport height is not known at config time); a number pins a fixed buffer.
}
```

## ErrorRegistry

A reactive registry of cells whose last commit was blocked, each with a message, plus the active one.

```ts
interface ErrorRegistry {
  set(key: string, message: string): void;   // Mark a cell invalid with `message`; it also becomes the active (band) message.
  clear(key: string): void;   // Clear a cell. If it held the active message, the band recomputes to the next still-invalid cell.
  has(key: string): boolean;   // Whether a cell is invalid — a reactive read (re-runs in an effect on change).
  message(key: string): string | undefined;   // The message for a cell, or `undefined` — a reactive read.
  active(): string | null;   // The current active message to show in the band, or `null` — a reactive read.
  note(message: string | null): void;   // Push (or clear, with `null`) a **transient** message that has no cell key — used by the row gate for a cross-field message not anchored to one invalid cell. It shares the single last-writer-wins active channel with keyed `set`. `note(null)` recomputes the active message to the most-recent still-invalid keyed cell (else `null`), so clearing a transient message never hides one a red cell still needs.
  keys(): ReadonlySet<string>;   // The invalid-cell key set (for the paint pass) — a reactive read.
}
```

## ExportFormat

The serialization target for a grid export. - `'csv'` / `'tsv'` — RFC-4180 framing (records joined by CRLF; a field containing the delimiter, a double-quote, or a newline is double-quoted with embedded quotes doubled), plus spreadsheet formula-injection escaping. - `'html'` — a standalone document whose `<table>` reproduces the view (every title/cell markup-escaped). - `'json'` — an array of objects with the raw column values keyed by column id.

```ts
type ExportFormat = 'csv' | 'html' | 'json' | 'tsv'
```

## FilterModel

The active per-column filters, keyed by `GridColumn.id`.

```ts
type FilterModel = ReadonlyMap<string, ColumnFilter>
```

## FilterPopup

The condition-filter popup for one column — see the module overview.

```ts
new FilterPopup<T>(cfg: FilterPopupConfig<T>)   // extends Group
// methods & signals:
operandA: Signal<string>
operandB: Signal<string>
dateOperandA: Signal<CalendarDate | null>
dateOperandB: Signal<CalendarDate | null>
operators(): readonly string[]
currentOperator(): string
selectOperator(op: string): void
needsSecondOperand(): boolean
focusTarget(): View
apply(): void
clear(): void
```

## FilterPopupConfig

Construction config for FilterPopup.

```ts
interface FilterPopupConfig<T> {
  column: GridColumn<T>;   // The column being filtered (used by the reserved value-list section).
  columnId: string;   // The column id — reported back through `onApply`/`onClear`.
  current?: ColumnFilter;   // The column's existing filter, pre-filling the operator + operands when reopening.
  filterType: FilterType;   // The resolved filter type — selects the operator set and operand editors.
  distinct?: () => Promise<DistinctResult>;   // When present, embeds the value-list section (added in a later phase).
  onApply: (columnId: string, filter: ColumnFilter) => void;   // Reports an applied condition filter for the column.
  onClear: (columnId: string) => void;   // Reports that the column's filter should be cleared.
  onClose: () => void;   // Closes the popup — called after Apply/Clear and on Escape / click-away.
}
```

## FilterPopupContext

The context a FilterPopupConfig-shaped `filterPopup` factory receives — everything needed to build a custom popup for one column.

```ts
interface FilterPopupContext<T> {
  column: GridColumn<T>;   // The column whose popup is being opened.
  columnId: string;   // The column id — reported back through `onApply`/`onClear`.
  filterType: FilterType;   // The resolved filter type (selects the operator set + operand editors).
  current?: ColumnFilter;   // The column's existing filter, if any (pre-fills a reopened popup).
  distinct: () => Promise<DistinctResult>;   // The distinct-value source for the value-list section.
  onApply: (columnId: string, filter: ColumnFilter) => void;   // Report an applied condition/set filter for the column.
  onClear: (columnId: string) => void;   // Report that the column's filter should be cleared.
  onClose: () => void;   // Close the popup — call after applying/clearing, or on cancel.
  defaultPopup(): FilterPopup<T>;   // Build the built-in FilterPopup with this context (for wrapping or reuse).
}
```

## FilterType

The filter type a column presents in the condition popup — its operator family.

```ts
type FilterType = 'text' | 'number' | 'date'
```

## FooterBand

A single-row band painting one panel's footer aggregate cells, aligned to their columns.

```ts
new FooterBand<T>(cfg: FooterBandConfig<T>)   // extends View
```

## FreezePartition

A freeze partition: the visible column ids grouped into each panel, in visible order.

```ts
interface FreezePartition {
  left: string[];   // Left-pinned column ids, in order.
  center: string[];   // Center (horizontally-scrolling) column ids, in order.
  right: string[];   // Right-pinned column ids, in order.
}
```

## FreezeSpec

The freeze specification as authored at construction.

```ts
interface FreezeSpec {
  freezeLeft?: string[];   // Column ids to pin to the left panel.
  freezeRight?: string[];   // Column ids to pin to the right panel.
  freeze?: number;   // Shorthand: pin the first N visible columns to the left (ignored when `freezeLeft` is set).
}
```

## GridAction

One grid input intent — the vocabulary a chord resolves to and the body dispatch acts on.

```ts
type GridAction = | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'rowStart'
  | 'rowEnd'
  | 'gridStart'
  | 'gridEnd'
  | 'pageUp'
  | 'pageDown'
  | 'nextCell' // command-triggered (Tab); never bound as a body key
  | 'prevCell'
  // editing
  | 'beginEdit'
  | 'commit' // editor-host-scoped (documented here, not body-resolved)
  | 'cancel'
  // selection
  | 'toggleSelect'
  | 'extendUp'
  | 'extendDown'
  // value help + filter
  | 'valueHelp'
  | 'openFilter'
```

## GridColumn

One typed column of a data grid: a stable `id`, a header `title`, a typed `value` accessor (the sort/filter key), and optional display `format`, edit `parse`, sizing `width`, and `align`.

```ts
interface GridColumn<T, V = unknown> {
  id: string;   // Stable column identifier (used by sort/filter/layout state).
  title: string;   // Header cell text.
  value: (row: T) => V;   // Extracts this column's typed value from a row — the sort/filter key.
  format?: (value: V, row: T) => string;   // Formats the value for display (default: `String(value)`).
  parse?: (text: string) => V | ParseFailed;   // Parses edited text back to the typed value (editable columns only). May return the `PARSE_FAILED` sentinel for an unparseable string (as the invertible `fmt.*` formatters do); the commit path rejects that — the record is left unchanged and the editor stays open.
  set?: (row: T, value: V) => void;   // Writes the parsed value back into the record (editable columns only). Pairs with `parse`: a column is editable exactly when it has both, so an edit round-trips text → value → record.
  validate?: (value: V, row: T) => string | null;   // Validate the parsed value at commit time (editable columns). Return `null` to accept, or a short message describing why the value is invalid. On a message the commit is blocked, nothing is written, the editor stays open, and the cell is marked in the `gridInvalid` role with the message surfaced in the grid's message band. Runs on the typed value **after** `parse`, so it composes with the editor's live keystroke filter (which is unaffected). Not called when a `nullable` column is cleared to `null` — an empty clear is not a typed value to validate, so a validator written for the typed `V` never receives `null`. Client-side validation is **UX only**: the authoritative gate is the caller's `onCommit`/source.
  width?: ColumnWidth;   // Sizing rule (default `'auto'` when adapted): fixed cells, `${n}fr`, or `'auto'`.
  minWidth?: number;   // Minimum width in cells. A resize clamps to this floor and an `'auto'`/`fr` column never apportions below it. Defaults to a small built-in floor when omitted.
  maxWidth?: number;   // Maximum width in cells. Caps apportionment and bounds auto-fit (auto-fit falls back to a generous built-in default when omitted). An interactive resize is not capped unless this is set.
  align?: ColumnAlign;   // Text alignment within the column width.
  editor?: CellEditorSpec | ((row: T) => CellEditorSpec);   // The cell editor to mount: a literal CellEditorSpec, or a per-row function that returns one. Absent on an editable column (one with `parse` + `set`) mounts a plain text input; a read-only column ignores it. Use it to pick a typed widget — e.g. `{ kind: 'boolean' }` or `{ kind: 'lookup', items }` — or `{ kind: 'readonly' }` to make an otherwise-editable column read-only.
  render?: CellRenderer<T, V>;   // Custom cell painter — the escape hatch for glyph indicators, badges, and traffic lights. Draws into a cell-local, cell-clipped context (origin at the cell's top-left) and is draw-error isolated: a throw degrades only its own cell. When set, it replaces the default formatted text for the cell.
  cellStyle?: CellStyle<T, V>;   // Value-driven cell colour, composited under the fixed precedence (cursor > dirty > selected-row > cellStyle > zebra > normal): it paints only when no higher state (the cursor cell, a pending commit, or the selected/focused row) owns the cell.
  compare?: (a: V, b: V) => number;   // Custom order for this column's values, overriding the type-aware default (numbers, dates, then a case-insensitive collator). Receives only non-null values — null/undefined ordering is governed by `nulls`. Returns `<0` / `0` / `>0` like `Array.prototype.sort`'s comparator.
  nulls?: 'first' | 'last';   // Where null/undefined values sort, independent of direction (default `'last'`).
  nullable?: boolean;   // Allow this cell to hold `null`: an editor that commits an empty value stores `null` (not `''`), so a null round-trips distinctly from an empty string. A non-nullable column parses `''` as usual. Consequence: a nullable column cannot also store a literal empty string distinct from null — empty means null there; a caller who needs a literal `''` leaves the column non-nullable.
  nullDisplay?: string;   // Text shown for a null/undefined value (default `''`), distinct from an empty string and never the literal `"null"`. Resolved in the render accessor upstream of `format`, so it applies to the default text path; a column with a custom `render` hook owns its own null handling (it receives the raw `null`, not `nullDisplay`).
  filterType?: FilterType;   // The operator family the column's filter popup presents (`'text'` / `'number'` / `'date'`). When omitted it is inferred at runtime from a sampled non-null value (a number → `'number'`, a `Date` or `CalendarDate` → `'date'`, otherwise `'text'`); set it to override a sparse or ambiguous column whose sample would misclassify.
  filterable?: boolean;   // Whether this column participates in filtering (default `true`). A `false` column shows **no** header funnel and its funnel cell is not hit-testable, its quick-filter input is omitted, and the `Alt+Down` open-filter shortcut is a no-op while one of its cells is focused — use it for action/icon columns, or any column that should never be filtered. Column geometry is unaffected: the funnel reserve and the quick-filter slot are simply not taken.
  showFunnel?: boolean;   // Show the filter funnel `▽` on this column's header **at all times** (default `false`). By default a column's funnel appears only while it has an active filter (emphasized) and the header is otherwise clean; set this to advertise the filter affordance permanently — the glyph is drawn muted when unfiltered and emphasized when a filter is active. Independent of the keyboard opener: `Alt+Down` opens the condition popup on any filterable column regardless of this flag. Ignored when `filterable` is `false` (a non-filterable column never shows a funnel). Reserving the funnel cell clips a title that would otherwise fill the full column width by one cell.
}
```

## GridColumnInfo

Read-only, resolved column metadata for a personalization UI: one column's id, header title, current visibility, resolved freeze side, and resolved width in cells.

```ts
interface GridColumnInfo {
  id: string;   // The column id.
  title: string;   // The header title.
  visible: boolean;   // Whether the column is currently visible (not hidden).
  frozen: 'left' | 'right' | 'none';   // The resolved freeze side: pinned left, pinned right, or not frozen.
  width: number;   // The resolved width in cells (override → declared → auto → title).
}
```

## GridDataSource

The read/mutate seam the grid body binds to.

```ts
interface GridDataSource<T> {
  rowKey: (row: T) => string | number;   // Stable identity for a row (required).
  length(): number;   // Total row count (best-known for a windowed source).
  rowAt(index: number): T | undefined;   // The row at a display-ordered index, or `undefined` when out of range / not yet loaded.
  insert(row: T, at?: number): void | Promise<void>;   // Insert a row at a **source-array** index (append when `at` is omitted). Optional — a source that omits it is read-only, so the grid can never add through it. The row must already carry its own `rowKey` (the caller owns key generation). A windowed/server source uses this callback to persist.
  remove(keys: readonly Key[]): void | Promise<void>;   // Remove rows by key. Optional — a source that omits it is read-only, so the grid can never delete through it. Keys not present are ignored. A windowed/server source uses this callback to persist.
  ensureRange(start: number, end: number): void | Promise<void>;   // Prefetch a window of rows (windowed sources; a later release).
  setSort(keys: SortKey[]): void;   // Push sort down to the source; omit for client-side sorting (a later release).
  setFilter(model: FilterModel): void;   // Push filtering down to the source; omit for client-side filtering (a later release).
  distinct(columnId: string): Promise<DistinctResult>;   // Distinct formatted labels for a column, for value-list filtering (a later release). Returns the labels plus an optional `truncated` flag so a bounded/windowed source can disclose a capped list instead of silently under-reporting.
  complete(): boolean;   // Whether every row is loaded in memory. Omit it (or return `true`) for an eager in-memory source, so a footer aggregate renders a clean grand total. A windowed/server source that has loaded only part of the dataset returns `false`, and the footer labels its aggregates `"(loaded)"` — a total over the loaded set is never passed off as a whole-dataset grand total.
  revision(): number;   // A reactive revision counter for a windowed/async source: the grid reads it inside its display derivation, so a bump (a fetched window has landed) re-derives the display and repaints the newly-loaded rows. It **must** be a tracked signal read (e.g. the getter of a `signal<number>`), not a plain counter — a non-reactive read never subscribes, so the grid would never repaint on resolve. Omit it for an eager in-memory source (its rows signal already drives repaint); the grid's read is then inert.
}
```

## GridFooter

The footer configuration a caller passes to the grid's `footer` option: a row of column-aligned aggregates and/or a row of free-form widgets.

```ts
interface GridFooter {
  sticky?: boolean;   // Keep the footer visible while the body scrolls. Defaults to `true`; v1 footers are always sticky (the fixed-band layout gives it for free), so a `false` here is reserved — it is treated as `true` with a dev warning until a non-sticky/inline footer ships.
  aggregates?: Record<string, AggregateSpec>;   // Per-column aggregates, keyed by `columnId`. Each renders a total aligned under its column, folded over the displayed rows. An entry whose key is not a known column, or whose `fn` is not a built-in reduction, is ignored (with a dev warning).
  widgets?: readonly View[];   // A free-form widget row — any `View`s (totals `Text`, command `Button`s, the reactive "N of M" and selection-count read-outs), laid out in a flow row spanning the footer band.
}
```

## GridKeymap

A chord→action map.

```ts
type GridKeymap = Record<string, GridAction>
```

## GridStatus

The grid's lifecycle status, driven by the caller's reactive `status` getter.

```ts
type GridStatus = | 'loading'
  | 'ready'
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string; retry?: () => void }
```

## GridVariant

A named, serializable snapshot of a grid's column layout — the object `saveVariant` returns and `applyVariant` consumes.

```ts
interface GridVariant {
  name: string;   // A caller-facing label for the variant.
  columns: GridVariantColumn[];   // The full column order (hidden interleaved), each with its visibility and optional width.
  freeze: { left: string[]; right: string[] };   // The frozen partition: column ids pinned to the left and right panels.
  sort: SortKey[];   // The sort model (ordered keys; the first is primary).
  filter: Array<{ columnId: string; filter: ColumnFilter }>;   // The per-column filters, as `{ columnId, filter }` pairs.
}
```

## GridVariantColumn

One column entry in a GridVariant: its id, whether it is visible, and — only when the column carries an explicit width override — that width.

```ts
interface GridVariantColumn {
  id: string;   // The column id.
  visible: boolean;   // Whether the column is visible (a hidden column stays in the order with `visible: false`).
  width?: number;   // An explicit width override, in cells; omitted when the column has no override (auto/declared width).
}
```

## InvertibleFormat

A formatter that also round-trips: the display string AND its matched inverse.

```ts
interface InvertibleFormat<V> {
  format: (value: V, row: unknown) => string;   // Formats a value for display.
  parse: (text: string) => V | ParseFailed;   // Inverse of `format`; returns PARSE_FAILED for a non-parseable string (never `NaN`).
}
```

## Key

A stable row identity — the same value a source's `rowKey(row)` returns.

```ts
type Key = string | number
```

## KeymapKeyEvent

The structural key-event subset resolveGridAction reads (a subset of the core `KeyEvent`).

```ts
interface KeymapKeyEvent {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}
```

## LookupItem

One row of a value-help lookup: the stored `key` (what commits) and the shown `label` (what displays).

```ts
interface LookupItem {
  key: string;   // The value written to the record on select (the stored key).
  label: string;   // The human-readable text shown in the dropdown.
}
```

## LookupProvider

A lookup editor's rows: a static array, or an async provider invoked once when the editor opens.

```ts
type LookupProvider = readonly LookupItem[] | (() => Promise<LookupItem[]>)
```

## NavGrid

The grid capabilities installGridNavigation drives.

```ts
interface NavGrid {
  isBodyFocused(): boolean;   // Whether this grid's body currently holds focus.
  isEditing(): boolean;   // Whether an in-cell editor is open on this grid (focus is then on the editor, not the body).
  nextCell(): Promise<'moved' | 'exit'>;   // Advance the cursor by one cell (commit-then-advance while editing); `'exit'` at the grid edge.
  prevCell(): Promise<'moved' | 'exit'>;   // Retreat the cursor by one cell; `'exit'` at the grid start.
  rows: View;   // The focusable body view (re-focused after a `'moved'` result).
}
```

## NumberFormatOptions

Shared options for the numeric formatters: BCP-47 locale plus fraction-digit control.

```ts
interface NumberFormatOptions {
  locale?: string;   // BCP-47 locale tag; defaults to the host default locale.
  minimumFractionDigits?: number;   // Minimum fraction digits (forwarded to `Intl.NumberFormat`).
  maximumFractionDigits?: number;   // Maximum fraction digits (forwarded to `Intl.NumberFormat`).
}
```

## OnCommit

A per-cell veto sink.

```ts
type OnCommit<T> = (change: CellCommit<T>) => boolean | Promise<boolean>
```

## PARSE_FAILED

The sentinel an inverse `parse` returns for a string it cannot convert — distinct from a valid value and from `NaN`, so the commit path can reject an unparseable edit instead of writing garbage.

```ts
const PARSE_FAILED: unique symbol
```

## ParseFailed

The type of the PARSE_FAILED sentinel — used to widen a column's `parse` return type.

```ts
type ParseFailed = typeof PARSE_FAILED
```

## PersonalizeOptions

Options for personalizeGrid.

```ts
interface PersonalizeOptions {
  store: VariantStore;   // The app-provided store the dialog reads and writes variants through.
  host: ModalDialogHost;   // The modal host (an `Application` satisfies it — as `formDialog`/`openFile` use).
  title?: string;   // The dialog title (default `'Personalize columns'`).
}
```

## PersonalizeResult

The outcome of personalizeGrid: `ok` is `true` only when the user committed with OK.

```ts
interface PersonalizeResult {
  ok: boolean;   // `true` when OK committed the pending layout; `false` on Cancel/Esc (the grid is untouched).
}
```

## QuickFilterRow

The datagrid's opt-in quick-filter band — see the module overview.

```ts
new QuickFilterRow<T>(cfg: QuickFilterRowConfig<T>)   // extends Group
```

## QuickFilterRowConfig

Construction config for QuickFilterRow.

```ts
interface QuickFilterRowConfig<T> {
  columns: Column<T>[];   // The engine columns — shared with the header + body so geometry never disagrees.
  columnIds: readonly string[];   // Column ids parallel to `columns` (index → columnId).
  autoWidths: () => (number | null)[];   // The memoized `auto`-width measurement (shared with the header + body).
  indent: Signal<number>;   // The horizontal cell offset (shared — the band pans in lockstep with header and body).
  onQuickFilter: (columnId: string, text: string) => void;   // Reports a column's live quick-filter text. An **empty** string means "clear this column's filter" — never an empty-needle `contains`, which would match every row.
  compact?: boolean;   // Compact density (default `false`): no reserved inter-column divider cell, so each input fills its column's full width and the band stays aligned with a compact header/body.
  filterable?: boolean[];   // Per-column filterability, parallel to `columns` (index → filterable). A `false` entry omits that column's input entirely — a blank, non-interactive slot — while the surrounding inputs keep their positions under their columns. Omit to make every column filterable.
}
```

## RenderCell

The per-cell paint state handed to a custom renderer (read-only).

```ts
interface RenderCell<T, V> {
  x: number;   // Cell rect origin x, body-local (metrics only — the ctx origin is already the cell).
  y: number;   // Cell rect origin y, body-local.
  width: number;   // Cell width in columns.
  value: V;   // The cell's typed value.
  row: T;   // The row record.
  state: CellState;   // Which composited states are active on this cell.
}
```

## RowValidation

The result of a per-row cross-field `validateRow` check: `ok` accepts the row; on `!ok` the row-leave is blocked, `message` is surfaced, and the cursor refocuses the column named by `field` (falling back to the current column when `field` is absent or unknown).

```ts
interface RowValidation {
  ok: boolean;   // Whether the row passes — `false` blocks the leave.
  message?: string;   // The message to surface on failure.
  field?: string;   // The column id to refocus on failure (the offending field).
}
```

## SelectionMode

How a pick composes with the existing selection.

```ts
type SelectionMode = 'single' | 'multi'
```

## SortDir

A sort direction.

```ts
type SortDir = 'asc' | 'desc'
```

## SortHeader

The datagrid's multi-key sticky header — see the module overview.

```ts
new SortHeader<T>(cfg: SortHeaderConfig<T>)   // extends View
// methods & signals:
funnelAnchor(columnId: string): { x: number; y: number } | null
```

## SortHeaderConfig

Construction config for SortHeader.

```ts
interface SortHeaderConfig<T> {
  columns: Column<T>[];   // The engine columns (titles + sizing) — shared with the body so geometry never disagrees.
  columnIds: readonly string[];   // Column ids parallel to `columns` (index → columnId), so a click resolves to a stable id.
  autoWidths: () => (number | null)[];   // The memoized `auto`-width measurement (shared with the body).
  indent: Signal<number>;   // The horizontal cell offset (shared with the body — header and body pan in lockstep).
  sort: Signal<SortKey[]>;   // The container's sort model, read to render the indicators.
  onHeaderClick: (columnId: string, additive: boolean) => void;   // Reports a header click: the clicked `columnId` and whether Ctrl was held (an additive multi-key click).
  filterModel: Signal<FilterModel>;   // The container's filter model, read to render the funnel on columns that have an active filter.
  onFunnelClick: (columnId: string, anchor: { x: number; y: number }, ev: DispatchEvent) => void;   // Reports a funnel-cell click: the clicked `columnId`, the funnel cell's header-local anchor (for positioning the filter popup), and the **live dispatch envelope**. The envelope is forwarded because the focus/popup seam (`ev.focusView` / `ev.popupHost`) lives on it — the container needs it to focus the mounted popup and to let the popup's nested dropdowns open (a `ComboBox`/`DatePicker` silently no-ops without `ev.popupHost`). The `{x,y}` anchor alone is not sufficient.
  onColumnResize?: (columnId: string, width: number) => void;   // Reports a live column resize (a captured drag on a column's right-edge grip): the `columnId` and the new width in cells, already clamped to the column's `[minWidth, maxWidth]`. Fired on every captured drag so the grid resizes live. Optional — a header without it has no resize grips (a sort/filter-only grid is unaffected).
  onColumnAutoFit?: (columnId: string) => void;   // Reports a double-click on a column's grip: the `columnId` to auto-fit to its widest visible cell. Optional — omit to disable grip auto-fit.
  widthTick?: () => unknown;   // A reactive column-geometry trigger, bound for repaint so a width-override change (a live resize / auto-fit) re-apportions the header — `draw` reads widths through the column objects but does not auto-track. Omit when the grid has no resizable columns.
  onColumnReorder?: (fromVisible: number, toVisible: number) => void;   // Reports a committed column reorder (a title press-drag-drop): the `from` and `to` indices in the **global visible order** (this panel's local index plus columnOffset). The target is constrained to this panel, so `from`/`to` never cross a freeze boundary. Optional — a header without it has no reorder gesture (a title stays a plain sort click).
  onReorderStart?: () => void;   // Fired once, when a title press turns into a reorder drag (the pointer moved past the threshold). The container uses it to revert the sort the press triggered on mouse-down, so a drag reorders without a net sort while a plain click still sorts. Optional — pairs with onColumnReorder.
  columnOffset?: number;   // This panel's start index in the global visible order (default `0`), added to a local column index so onColumnReorder reports global visible indices. `0` for a single body.
  compact?: boolean;   // Compact density (default `false`): drop the inter-column `│` divider, reclaiming its cell so columns pack tighter. Must match the body/quick-filter setting so header and body stay column-aligned.
  filterable?: boolean[];   // Per-column filterability, parallel to `columns` (index → filterable). A `false` column shows **no** funnel and its funnel cell is not hit-testable. Omit to make every column filterable.
  showFunnel?: boolean[];   // Per-column always-visible funnel opt-in, parallel to `columns` (index → showFunnel). A `true` column draws its funnel at all times (muted when unfiltered, emphasized when filtered); a `false` column draws the funnel only while it has an active filter (default: a clean header otherwise). Ignored where `filterable` is `false`. Omit to default every column to `false`.
}
```

## SortKey

One directive in an ordered sort: which column, which way.

```ts
interface SortKey {
  columnId: string;   // The column to sort by (its `GridColumn.id`).
  dir: SortDir;   // Sort direction.
}
```

## SyntheticPrefix

Which synthetic prefix cells are enabled, and the row count that sizes the gutter.

```ts
interface SyntheticPrefix {
  checkbox: boolean;   // Show the per-row selection checkbox + the tri-state header box (`opts.checkboxColumn`).
  rowNumbers: boolean;   // Show the 1-based display-number gutter (`opts.rowNumbers`).
  rowCount: number;   // The displayed row count — sizes the gutter to the widest 1-based number.
}
```

## TriState

The header select-all tri-state over the displayed rows: `none` (no displayed row selected), `all` (every displayed row selected), or `some` (a non-empty, non-total subset).

```ts
type TriState = 'none' | 'some' | 'all'
```

## ValueList

The Excel value-list picker — see the module overview.

```ts
new ValueList(cfg: ValueListConfig)   // extends Group
// methods & signals:
search: Signal<string>
visibleLabels(): readonly string[]
desiredHeight(): number
checkedLabels(): ReadonlySet<string>
truncated(): boolean
loading(): boolean
toggle(label: string): void
selectAll(): void
apply(): void
```

## ValueListConfig

Construction config for ValueList.

```ts
interface ValueListConfig {
  distinct: () => Promise<DistinctResult>;   // Resolves to the column's distinct formatted labels (and a `truncated` flag when capped).
  current?: ReadonlySet<string>;   // The currently-selected labels, checked on reopen; when omitted, every label starts checked.
  onApply: (selected: ReadonlySet<string>) => void;   // Reports the checked label set (the container turns it into a `{ kind: 'set' }` filter).
  buttonWidth?: number;   // Forced Select All / Apply width, so a popup can size all its buttons alike; omit to self-size.
}
```

## VariantStore

The app-provided store the personalization dialog reads and writes variants through.

```ts
interface VariantStore {
  list(): readonly GridVariant[];   // All saved variants, in app/insertion order. A snapshot the dialog renders; not aliased to any internal array.
  save(variant: GridVariant): void;   // Insert a variant, or overwrite the existing one with the same `name` (in place, order preserved).
  delete(name: string): void;   // Remove the variant with this name (a no-op if absent). If it was the default, the default is cleared.
  setDefault(name: string): void;   // Mark the named variant the default (the store persists the name; it need not already exist).
  getDefault(): string | undefined;   // The default variant's name, or `undefined` when none is set.
}
```

## absoluteRect

A mounted view's absolute top-left, by summing parent-relative `bounds.x`/`y` up the tree (the root bounds are absolute).

```ts
absoluteRect(view: View): { x: number; y: number }
```

## cellKey

A stable cell key joining the row key and column id with a NUL byte.

```ts
const cellKey: (rowKey: string | number, columnId: string) => string
```

## checkboxGlyph

The per-row checkbox glyph for a selection state.

```ts
checkboxGlyph(selected: boolean): string
```

## clampWidth

Clamp a requested column width to `[minWidth ?? DEFAULT_MIN_WIDTH, maxWidth]`.

```ts
clampWidth(requested: number, minWidth?: number, maxWidth?: number): number
```

## column

Author a typed column.

```ts
column<T, V>(col: GridColumn<T, V>): GridColumn<T>
```

## commitCell

Apply a cell edit immediately, run the optional `beforeSave` then `onCommit` veto gates, and revert on veto.

```ts
commitCell<T, V>(args: {
  row: T;
  columnId: string;
  rowKey: string | number;
  previous: V;
  next: V;
  apply: (row: T, columnId: string, v: V) => void;
  beforeSave?: BeforeSave<T>;
  onCommit?: OnCommit<T>;
}): Promise<{ committed: boolean; value: V }>
```

## computeDistinct

The sorted distinct formatted labels for a column over a row snapshot — the grid-owned client distinct enumeration.

```ts
computeDistinct<T>(rows: readonly T[], col: GridColumn<T>): string[]
```

## createCellEditor

Build the editor view for a cell, two-way bound to `field`.

```ts
createCellEditor<T>(column: GridColumn<T>, field: Signal<string>, host: CellEditorHost, row?: T): View | null
```

## createDirtyRegistry

Create a reactive dirty registry.

```ts
createDirtyRegistry(): DirtyRegistry
```

## createErrorRegistry

Create a reactive ErrorRegistry.

```ts
createErrorRegistry(): ErrorRegistry
```

## createMemoryVariantStore

A reference in-memory VariantStore — an array of variants plus an optional default name.

```ts
createMemoryVariantStore(initial?: readonly GridVariant[]): VariantStore
```

## filterRows

Keep the rows that satisfy EVERY active column filter (they combine with AND).

```ts
filterRows<T>(rows: readonly T[], model: FilterModel, columns: ReadonlyMap<string, GridColumn<T>>): T[]
```

## fmt

The column-formatter registry.

```ts
const fmt: { number: (o?: NumberFormatOptions) => InvertibleFormat<number>; currency: (o: CurrencyFormatOptions) => InvertibleFormat<number>; percent: (o?: NumberFormatOptions) => InvertibleFormat<number>; date: (o?: { locale?: string; style?: DateOnlyStyle; }) => DisplayFormat<CalendarDate>; datetime: (o?: { locale?: string; dateStyle?: Intl.DateTimeFormatOptions["dateStyle"]; timeStyle?: Intl.DateTimeFormatOptions["timeStyle"]; }) => DisplayFormat<Date>; boolean: (labels?: { true: string; false: string; }) => DisplayFormat<boolean>; enumLabel: (labels: Record<string, string>) => DisplayFormat<string>; lookupLabel: (items: readonly LookupItem[]) => DisplayFormat<string>; }
```

## foldAggregate

Reduce `values` (one per displayed row — the column's typed `value(row)`) by `fn`.

```ts
foldAggregate(fn: AggregateFn, values: Iterable<unknown>): number | undefined
```

## formatAggregate

Render an aggregate cell's text: `"[label ][format(v) ?? String(v)]"`, with a trailing `" (loaded)"` honesty qualifier appended when `partial` is true and the value is present.

```ts
formatAggregate(spec: AggregateSpec, v: number | undefined, partial: boolean): string
```

## fromReactiveRows

Build a reactive, **write-through** GridDataSource — the twin of fromRows for rows that are a *function* of other state (e.g. a master grid's focused record).

```ts
fromReactiveRows<T>(read: () => readonly T[], opts: {
    rowKey: (row: T) => string | number;
    insert?: (row: T, at?: number) => void;
    remove?: (keys: readonly Key[]) => void;
    complete?: () => boolean;
  }): GridDataSource<T>
```

## fromRows

Build an in-memory data source over a reactive rows signal.

```ts
fromRows<T>(rows: Signal<T[]>, opts: { rowKey: (row: T) => string | number }): GridDataSource<T>
```

## gridKeymap

The loop-keymap fragment binding `Tab`/`Shift+Tab` to the grid-navigation commands.

```ts
const gridKeymap: import("@jsvision/ui").Keymap
```

## gutterLabel

The right-aligned 1-based display number for a body row, padded to `width` with a trailing gap cell so the number never touches the first data column.

```ts
gutterLabel(index0: number, width: number): string
```

## headerCheckboxGlyph

The tri-state header-checkbox glyph over the displayed rows.

```ts
headerCheckboxGlyph(state: TriState): string
```

## installGridNavigation

Register the `Tab`/`Shift+Tab` command handlers for one or more grids and return an uninstaller.

```ts
installGridNavigation(loop: EventLoop, grids: NavGrid | readonly NavGrid[]): () => void
```

## isAggregateFn

Type guard: whether `fn` names a known AggregateFn.

```ts
isAggregateFn(fn: string): fn is AggregateFn
```

## isEditable

Whether a column can be edited: it round-trips text through both `parse` (text → value) and `set` (value → record).

```ts
isEditable<T>(col: GridColumn<T>): boolean
```

## isWindowed

Whether a source is windowed — i.e. it drives its own loading through `ensureRange`, so the grid must take the lazy read path (windowedView) instead of materializing every row.

```ts
isWindowed<T>(source: GridDataSource<T>): boolean
```

## masterDetail

Link a detail grid to `master`'s focused record.

```ts
masterDetail<M, D>(master: EditableDataGrid<M>, buildDetail: (focused: () => M | undefined) => EditableDataGrid<D>): { detail: EditableDataGrid<D>; dispose: () => void }
```

## mergeKeymap

Merge a caller's keymap over DEFAULT_KEYMAP (the caller wins per-chord) and return a fresh, frozen table safe to compile and share.

```ts
mergeKeymap(user?: GridKeymap): GridKeymap
```

## mountCellOverlay

Mount `view` over a cell: place it on the cell derived from a body-local cell rect (correct even when the grid is nested far from the screen origin — the host's own offset is not double-counted), focus it through the loop seam, and return a disposer that removes the view and disposes its reactive scope (so its binding effects do not leak after the overlay closes).

```ts
mountCellOverlay(args: {
  host: Group;
  loop: { focusView(v: View): void };
  rect: CellRect;
  origin: { x: number; y: number };
  view?: View;
  build?: () => View | null;
  clamp?: { width: number; height: number };
}): () => void
```

## nextCellIndex

The cell one step forward (left-to-right, top-to-bottom) from `(col, row)` in a `cols × rows` grid, or `'exit'` past the last cell of the last row (and for an empty grid).

```ts
nextCellIndex(col: number, row: number, cols: number, rows: number): CellMove
```

## overPinnedIds

The frozen column ids to un-pin so the center panel keeps at least one cell — i.e. the columns that make the total frozen width meet or exceed the viewport.

```ts
overPinnedIds(part: FreezePartition, widthOf: (id: string) => number, viewportWidth: number): string[]
```

## partition

Partition the visible ids into left / center / right panels from a freeze spec.

```ts
partition(visible: readonly string[], freeze: FreezeSpec): FreezePartition
```

## personalizeGrid

Open the "Personalize columns" modal over `grid` and resolve once the user closes it.

```ts
personalizeGrid<T>(grid: EditableDataGrid<T>, opts: PersonalizeOptions): Promise<PersonalizeResult>
```

## prefixWidth

The total synthetic-prefix width in cells (0 when neither affordance is enabled).

```ts
prefixWidth(p: SyntheticPrefix): number
```

## prevCellIndex

The cell one step backward from `(col, row)` — the mirror of nextCellIndex.

```ts
prevCellIndex(col: number, row: number, cols: number, rows: number): CellMove
```

## reorderWithinPanel

Move a column within its own panel (a reorder).

```ts
reorderWithinPanel(visible: readonly string[], freeze: FreezeSpec, from: number, to: number): string[]
```

## resolveGridAction

Resolve one key event to a GridAction against a merged keymap, or `undefined` when the chord is unmapped (the body dispatch then applies its printable/base fallbacks).

```ts
resolveGridAction(ev: KeymapKeyEvent, keymap: GridKeymap): GridAction | undefined
```

## selectAll

Select every displayed row — the header checkbox's select-all target.

```ts
selectAll(displayKeys: readonly Key[]): ReadonlySet<Key>
```

## selectRange

Select the contiguous run between `anchorKey` and `toKey` **in display order**, returning a new set.

```ts
selectRange(current: ReadonlySet<Key>, anchorKey: Key, toKey: Key, displayKeys: readonly Key[], mode: SelectionMode): ReadonlySet<Key>
```

## sortRowsMulti

Ordered multi-key sort.

```ts
sortRowsMulti<T>(rows: readonly T[], keys: readonly SortKey[], columns: ReadonlyMap<string, GridColumn<T>>): T[]
```

## toggleKey

Toggle `key`'s membership, returning a new set.

```ts
toggleKey(current: ReadonlySet<Key>, key: Key, mode: SelectionMode): ReadonlySet<Key>
```

## triState

The header select-all tri-state over the displayed rows.

```ts
triState(current: ReadonlySet<Key>, displayKeys: readonly Key[]): TriState
```

## visibleOrder

Project the full column order into visible order, dropping the hidden ids and preserving the rest.

```ts
visibleOrder(order: readonly string[], hidden: ReadonlySet<string>): string[]
```

## windowedView

A length-correct, lazily-read view over a windowed source, presentable as the `display: () => T[]` the grid body demands.

```ts
windowedView<T>(source: GridDataSource<T>): T[]
```
