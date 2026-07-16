<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->

# API — Data views

The `DataGrid` table and the `Tree` outline.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## alignCell

Clip `text` to exactly `width` cells (width-aware — never splits a wide/CJK glyph), then pad to the requested alignment: `left` pads on the right, `right` pads on the left, `center` splits the remainder (an odd extra cell goes to the right).

```ts
alignCell(text: string, width: number, align: ColumnAlign, measure: (s: string) => number): string
```

## apportionColumns

Apportion per-column integer widths and absolute start columns for a viewport — the O(cols) per-draw pass.

```ts
apportionColumns<T>(columns: Column<T>[], autoWidths: (number | null)[], viewportWidth: number, dividers = true): ColumnGeometry
```

## Column

A single heterogeneous column of a `DataGrid<T>` — a title, a field accessor, a sizing rule, and optional alignment / typed comparator / min-max clamps.

```ts
interface Column<T> {
  title: string;   // The header cell text.
  accessor: (row: T) => string;   // Extracts this column's display string from a row.
  width: ColumnWidth;   // Sizing: fixed cell count, `${n}fr` flex share, or `auto` (widest cell over all rows).
  align?: ColumnAlign;   // Text alignment within the column width (default `'left'`).
  compare?: (a: T, b: T) => number;   // Typed sort comparator; default = locale-aware string compare of the `accessor` output.
  minWidth?: number;   // Lower clamp on the resolved width.
  maxWidth?: number;   // Upper clamp on the resolved width, and the cap applied when measuring an `auto` column.
}
```

## ColumnAlign

Horizontal alignment of a cell's text within its column width.

```ts
type ColumnAlign = 'left' | 'right' | 'center'
```

## ColumnGeometry

Resolved per-column geometry for one draw (all integer, post-apportion).

```ts
interface ColumnGeometry {
  widths: number[];   // Content cells per column (excludes the divider cell).
  starts: number[];   // Absolute x of each column's content, pre-indent: `starts[c] = Σ_{k<c}(widths[k] + gap)`, where `gap` is 1 with dividers, 0 compact.
  totalWidth: number;   // The H-scroll content width: `Σ(widths[c] + gap)` (`gap` = 1 with dividers, 0 compact).
}
```

## ColumnWidth

How a column is sized: an exact cell count, an `fr` flex weight, or `auto` (measured over rows).

```ts
type ColumnWidth = number | `${number}fr` | 'auto'
```

## DataGrid

A focusable, multi-column data table: a sticky header row, a virtual-scrolling body that only paints its visible window (so it stays fast over large datasets), and owned vertical + horizontal scroll bars.

```ts
new DataGrid<T>(opts: DataGridOptions<T>)   // extends Group
// methods & signals:
rows: GridRows<T>
focused: Signal<number>
selected: Signal<number>
sort: Signal<SortState>
indent: Signal<number>
sortBy(col: number, dir: 'asc' | 'desc'): void
```

## DataGridOptions

Construction options for DataGrid.

```ts
interface DataGridOptions<T> {
  rows: Signal<T[]>;   // The source rows (source order; the grid sorts the *display* only).
  columns: Column<T>[];   // The heterogeneous columns (title + accessor + sizing + optional align/compare/min-max).
  focused?: Signal<number>;   // The focused (highlighted) POSITIONAL display index (default an internal signal at 0).
  selected?: Signal<number>;   // The selected (chosen) display index (default an internal signal at -1).
  sort?: Signal<SortState>;   // The active sort (default an internal signal at `null` = source order).
  indent?: Signal<number>;   // The horizontal cell offset (default an internal signal at 0; shared with the horizontal bar).
  onSelect?: (index: number, row: T) => void;   // Activation callback (Enter/Space or double-click); `index` is the display-order row, `row` the value.
  command?: string;   // Command name emitted on Enter/Space activation, handled elsewhere (menu/status/app handler).
  zebra?: boolean;   // Stripe odd rows for readability (below focus/selection in priority; default false).
}
```

## GridHeader

The non-scrolling sticky header: column titles in `tableHeader`, a sort indicator, click-to-sort.

```ts
new GridHeader<T>(cfg: GridHeaderConfig<T>)   // extends View
```

## GridHeaderConfig

Shared configuration handed from a `DataGrid` to its GridHeader.

```ts
interface GridHeaderConfig<T> {
  columns: Column<T>[];   // The heterogeneous columns.
  autoWidths: () => (number | null)[];   // The memoized `auto`-width measurement (shared with GridRows so both use identical geometry).
  indent: Signal<number>;   // The horizontal cell offset (shared with the rows — the header pans in lockstep).
  sort: Signal<SortState>;   // The active sort (this view draws its `▲`/`▼` indicator + a header click toggles it).
}
```

## GridRows

The focusable, multi-column, virtual-scroll grid body — draws only the visible window.

```ts
new GridRows<T>(cfg: GridRowsConfig<T>)   // extends View
// methods & signals:
vbar?: ScrollBar
hbar?: ScrollBar
```

## GridRowsConfig

Shared configuration handed from a `DataGrid` to its GridRows.

```ts
interface GridRowsConfig<T> {
  display: () => T[];   // The sorted display rows (a `computed` in `DataGrid`; `focused`/`selected` index THIS list).
  columns: Column<T>[];   // The heterogeneous columns.
  autoWidths: () => (number | null)[];   // The memoized `auto`-width measurement (a `computed` over the source rows).
  indent: Signal<number>;   // The horizontal cell offset (shared with the owned horizontal scroll bar's value).
  focused: Signal<number>;   // The focused (highlighted) display index (shared with the vertical scroll bar's value).
  selected: Signal<number>;   // The selected (chosen) display index (`-1` = none).
  zebra: boolean;   // Stripe odd rows for readability (below focus/selection in priority).
  onSelect?: (index: number, row: T) => void;   // Activation callback (Enter/Space or double-click); `index` is display order, `row` the value.
  command?: string;   // Command name emitted on activation, handled elsewhere.
}
```

## MarkerStyle

How a Tree draws its per-row expand/collapse marker. - `'tv'` — the default: a single `+` on a collapsed node, `─` on an expanded node or a leaf, drawn flush against the node text (no separating space). - `'brackets'` — pure-ASCII `[+]`/`[-]` on collapsible nodes, each followed by one space before the text; a leaf shows just that single space.

```ts
type MarkerStyle = 'tv' | 'brackets' | 'triangle'
```

## measureAutoWidths

Pre-measure `auto` columns to a fixed cell width across ALL current rows.

```ts
measureAutoWidths<T>(columns: Column<T>[], rows: T[], measure: (s: string) => number): (number | null)[]
```

## sortRows

Produce a new display ordering of `rows` by column + direction.

```ts
sortRows<T>(rows: T[], columns: Column<T>[], sort: SortState): T[]
```

## SortState

The active sort: a column index + direction, or `null` for source order.

```ts
type SortState = { readonly col: number; readonly dir: 'asc' | 'desc' } | null
```

## Tree

A focusable, virtual-scrolling, expandable outline (file tree, nav tree, etc.).

```ts
new Tree<T>(opts: TreeOptions<T>)   // extends Group
// methods & signals:
layout: LayoutProps
rows: TreeRows<T>
focused: Signal<number>
selected: Signal<number>
isExpanded(node: TreeNode<T>): boolean
expand(node: TreeNode<T>): void
collapse(node: TreeNode<T>): void
toggle(node: TreeNode<T>): void
expandAll(): void
collapseAll(): void
expandSubtree(node: TreeNode<T>): void
```

## TreeNode

A plain, reactive-friendly tree node.

```ts
interface TreeNode<T> {
  value: T;   // The user payload rendered via `getText`.
  children: TreeNode<T>[];   // Child nodes in display order (empty for a leaf).
}
```

## TreeOptions

Construction options for Tree.

```ts
interface TreeOptions<T> {
  roots: Signal<TreeNode<T>[]>;   // The reactive forest of root nodes; a single-root tree is the 1-element case.
  getText: (value: T) => string;   // Render a node's value to its row text.
  focused?: Signal<number>;   // The focused (highlighted) flattened-visible index (default an internal signal at 0).
  selected?: Signal<number>;   // The selected (chosen) flattened-visible index (default an internal signal at -1).
  onSelect?: (index: number, node: TreeNode<T>) => void;   // Activation callback (Enter / text double-click); `index` is the flattened index, `node` the node.
  command?: string;   // Command name emitted on activation, handled elsewhere; no built-in default.
  expandedByDefault?: boolean;   // Seed every node that has children as expanded at construction (default false = all collapsed).
  guides?: boolean;   // Draw the `│├└─` connectors (default true); false = flat indent, markers unchanged.
  markerStyle?: MarkerStyle;   // The expand-marker style (default `'tv'` — a faithful single `+`/`─`). `'brackets'` draws `[+]`/`[-]` (pure ASCII, the most legible); `'triangle'` draws `▸`/`▾` and falls back to `'brackets'` on a terminal without Unicode. Only the marker column changes — indentation and connectors are identical across styles.
}
```
