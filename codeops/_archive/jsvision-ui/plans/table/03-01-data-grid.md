# DataGrid & GridRows: Table / DataGrid

> **Document**: 03-01-data-grid.md
> **Parent**: [Index](00-index.md)

## Overview

The `DataGrid<T>` `Group` container + its internal `GridRows<T>` renderer — the focusable, multi-column,
virtual-scrolling core. `DataGrid` composes chrome (header + V/H bars); `GridRows` does the drawing +
event routing. Faithful to Turbo Vision `TListViewer` for the row spine; the header + heterogeneous
columns + sort are the documented extension.

## TV decode (GATE 1) — `TListViewer` (`source/tvision/tlstview.cpp`)

> **NON-NEGOTIABLE:** decode BEFORE writing draw/geometry/colour code and diff AFTER (GATE-2). Cite
> `file:line` for every decoded fact in the code JSDoc.

- **`draw`** (`:76-152`):
  - Row colour: when `(sfSelected|sfActive)` — `normal=getColor(1)`, `focused=getColor(3)`,
    `selected=getColor(4)`; else `normal=getColor(2)` (`:83-98`). We collapse to the shipped
    `listNormal/listFocused/listSelected` per state; **priority focused > selected > normal**
    (`list-rows.ts:21` GATE-2 note).
  - `indent = hScrollBar->value` (`:99-102`) — the horizontal cell offset.
  - Per cell: `moveChar(curCol,' ',color,colWidth)` blanks the cell in its colour; `moveStr(curCol+1,
    text,color,colWidth,indent)` draws the text at `curCol+1` (`:118-124`).
  - **Divider:** `moveChar(curCol+colWidth-1,'\xB3',getColor(5),1)` — a `│` at the **right edge of every
    column** in `getColor(5)`=`listDivider` (`:130`; AR-179).
  - `emptyText` at `curCol+1` when `i==0 && j==0 && item>=range` (`:127-128`) → `<empty>` (AC-14).
- **`handleEvent`** (`:213-320`): Space → `selectItem(focused)` (`:282-286`); ↑↓ ±1; PgUp/PgDn
  `±size.y*numCols`; Home=`topItem`, End=`topItem+size.y*numCols-1`; Ctrl+PgUp=`0`, Ctrl+PgDn=`range-1`
  (`:294-317`). **This grid is one row per item (`numCols≡1`) ⇒ `±viewportRows` is the faithful paging**
  (AR-182) — a spec author must NOT transcribe `size.y*numCols`.
- **`focusItem`/`focusItemNum`** (`:159-186`) → `virtual.ts` `keepVisible`/`clampIndex` (reused).
- **Colours** already pinned: `listNormal 0x30`, `listFocused 0x2F`, `listSelected 0x3E`, `listDivider
  0x31` (`theme.ts:128-146`). Header = **new** `tableHeader 0x3F` (AR-172; see 03-03).
- **`showMarkers`** is monochrome-only (`tprogram.cpp:253`) — no markers on the colour-first grid (RD).

## Architecture

### Proposed Structure

```
DataGrid<T> extends Group                       layout: direction 'column'
├── topRow : Group   { fixed, cells:1 }, direction 'row'
│   ├── header : GridHeader (View)   { fr, weight:1 }   ← row 0, spans data width
│   └── tcorner: View                { fixed, cells:1 }  ← blank (above the vbar)
├── body   : Group   { fr, weight:1 }, direction 'row'
│   ├── rows : GridRows<T> (View)    { fr, weight:1 }   ← focus target
│   └── vbar : ScrollBar (vertical)  { fixed, cells:1 }, value = focused
└── botRow : Group   { fixed, cells:1 }, direction 'row'
    ├── hbar : ScrollBar (horizontal){ fr, weight:1 }, value = indent
    └── bcorner: View                { fixed, cells:1 }  ← blank (below the vbar)
```

Per AR-174: header, rows, and hbar each sit in an `fr` band **beside a fixed 1-cell sibling** (the vbar or
a blank corner), so all three resolve to the **same data width `W−1`** and their columns align exactly.
This is the crux of the layout: the layout engine defaults to `align:'stretch'`, so a direct column-child
would fill the **full** width `W` (`layout.ts:198-212`) — placing the header as a bare column-child would
make it width `W` while `rows` (an `fr` sibling of the 1-cell vbar) is `W−1`, drifting the header columns
off the data columns by one cell. Nesting header + hbar in their own `[content fr | corner 1]` rows keeps
all three widths identical. The two corner cells (above/below the vbar) draw blank in the background role.
`DataGrid.rows` is exposed as the focus target (a `Group` is not itself focusable), like `ListView.rows`.

> **Decision per AR-174:** header-over-data + vbar-in-body, header/hbar width-matched to the rows via the
> corner cells (the ASCII preview approved at plan time). **Alternative rejected:** vbar spanning the full
> height (incl. the header row) — it complicates the header's horizontal-lockstep scroll and the corner
> geometry. **Also rejected:** header as a bare full-width column-child — misaligns by one cell (above).

### Shared column geometry (single source of truth)

Both the header and every data row derive column positions from ONE apportion in `columns.ts` (03-02):
`apportionColumns(columns, autoWidths, viewportWidth) → { widths: number[], starts: number[], totalWidth }`
where `starts[c]` is the absolute x of column `c`'s content (before H-indent) and each column region is
`widths[c]` content cells + 1 divider cell. Because the header and rows now resolve to the **same width**
(PF-101) and call the same pure function with the same inputs, their geometry is identical — no header/row
drift (Risk 2, 02-current-state). The O(rows) `auto` measurement is memoized upstream in an `autoWidths`
computed; `apportionColumns` itself is O(cols) and per-draw (PF-102).

## Implementation Details

### `DataGrid<T>` (data-grid.ts)

```ts
/** A column descriptor (re-exported; full definition in columns.ts / 03-02). */
export interface Column<T> {
  readonly title: string;
  readonly accessor: (row: T) => string;
  readonly width: ColumnWidth;               // number | `${number}fr` | 'auto'
  readonly align?: 'left' | 'right' | 'center';
  readonly compare?: (a: T, b: T) => number; // typed sort; default = locale string compare of accessor
  readonly minWidth?: number;                // clamp on fr/auto (Should-Have, AR-175)
  readonly maxWidth?: number;                // clamp + the `auto` cap (AR-173/AR-175)
}

export type ColumnWidth = number | `${number}fr` | 'auto';
export type SortState = { readonly col: number; readonly dir: 'asc' | 'desc' } | null;

export interface DataGridOptions<T> {
  readonly rows: Signal<T[]>;
  readonly columns: Column<T>[];
  readonly focused?: Signal<number>;   // default internal signal(0); POSITIONAL index into the sorted view
  readonly selected?: Signal<number>;  // default internal signal(-1)
  readonly sort?: Signal<SortState>;   // default internal signal(null)
  readonly onSelect?: (index: number, row: T) => void;
  readonly command?: string;           // emitted on Enter/Space activation
  readonly zebra?: boolean;            // default false (AR-176)
}

export class DataGrid<T> extends Group {
  override layout: LayoutProps = { direction: 'column' };
  readonly rows: GridRows<T>;          // focus target
  readonly focused: Signal<number>;
  readonly selected: Signal<number>;
  readonly sort: Signal<SortState>;
  protected readonly indent: Signal<number>;  // horizontal cell offset (the hbar's value)
  protected readonly header: GridHeader<T>;
  protected readonly vbar: ScrollBar;
  protected readonly hbar: ScrollBar;
  protected readonly autoWidths: Computed<(number | null)[]>;  // memoized auto measure (PF-102, AR-173)
  // ... constructor composes topRow([header|corner]) + body([rows|vbar]) + botRow([hbar|corner]); wires
  //     focused↔vbar, indent↔hbar, shares the sorted `display` + `autoWidths` computeds across header & rows.

  /** Should-Have (AR-175): drive the sort signal programmatically. */
  sortBy(col: number, dir: 'asc' | 'desc'): void { this.sort.set({ col, dir }); }
}
```

- The **sorted display** is a `computed` in `data-grid.ts` shared by header (for the `▲`/`▼` indicator)
  and rows: `display = computed(() => sortRows(rows(), columns, sort()))` (comparator in 03-02; AR-158).
- `focused`/`selected` index the **sorted** `display` (positional, AR-155/AR-177). On a `rows` or `sort`
  change the length changes → `GridRows` clamps `focused` via `clampIndex` (mirrors `list-rows.ts:126-131`).

### `GridRows<T>` (grid-rows.ts) — the focusable renderer

`extends View`, `focusable = true`. Reuses the `ListRows` spine, extended to N columns:

```
draw(ctx):
  widths, starts, totalWidth = apportionColumns(columns, autoWidths(), ctx.size.width)  // 03-02, O(cols)
  vbar.setRange(0, max(0, range-1), max(1, rows-1))         // TV setRange, list-rows.ts:177
  hbar.setRange(0, max(0, totalWidth - ctx.size.width), ...) // H overflow range (0 when fr present)
  indent = clamp(this.indentSignal(), 0, maxIndent)
  topItem = keepVisible(focused, topItem, rows, range)      // virtual.ts
  for i in 0..rows-1:
    item = topItem + i
    role = item===focused ? (active ? listFocused : listSelected)
         : item===selected ? listSelected
         : zebra && (item & 1) ? staticText            // AR-176 odd-row stripe
         : listNormal                                   // AR-179 priority focused>selected>zebra>normal
    fillRect(row, ' ', role)                             // blank the row
    if range===0 and i===0: text(1,0,'<empty>', listNormal); continue   // AC-14
    for c in columns:
      x = starts[c] - indent
      cell = alignCell(accessor(display[item]), widths[c], align[c], measure)  // width-aware clip + pad
      ctx.text(x, i, cell, role)                         // ctx clips off-screen (H-scroll)
      ctx.text(x + widths[c], i, '│', ctx.color('listDivider'))   // divider at column right edge
```

- **Alignment** (`align()` helper, 03-02): left = pad-right, right = pad-left, center = split — within
  `widths[c]`, after clipping (AC-4).
- **Zebra** slots below focused/selected in the role priority so a highlighted row is never striped
  (AR-176).
- The **divider** is drawn per column at its right edge in `listDivider`, faithful to `tlstview.cpp:130`
  (AR-179). `ctx.text` sanitizes (AC-13).

### `GridHeader<T>` (in grid-rows.ts) — the sticky header

`extends View`, `focusable = false`. Draws once per column: blank the row in `tableHeader`, and — when the
column is the active sort column (`sort().col===c`) — reserve its **last content cell** for the `▲`/`▼`
indicator: clip the title to `widths[c]-1`, draw it at `starts[c]-indent`, then draw the indicator at that
last cell (before the divider). This guarantees the arrow is always visible even when the column width
equals the title width (PF-103: e.g. a width-3 `"Age"` col shows `"Ag▲"` **by design**, never a silently
truncated title). A non-sorted column draws the full `alignCell(title, widths[c])`. The `│` divider is
drawn at each column's right edge. Shares `apportionColumns` (via the same `autoWidths` + `indent`) with
`GridRows` — identical geometry, no drift (PF-101/PF-102).

### Event routing (`GridRows.onEvent`) — faithful `TListViewer` + AR-177/AR-182

| Input | Action | Source |
| ----- | ------ | ------ |
| ↑ / ↓ | `focusBy(∓1)` | `tlstview.cpp:296-299` |
| PgUp / PgDn | `focusBy(∓viewportRows)` | `:308-311` (numCols≡1, AR-182) |
| Home / End | `focusTo(topItem)` / `focusTo(topItem+viewportRows-1)` | `:312-315` |
| Ctrl+PgUp / Ctrl+PgDn | `focusTo(0)` / `focusTo(range-1)` | `:316-317` |
| ← / → | `indent ∓= 1` (clamped to `[0, maxIndent]`) when overflow | `:302-307` (hScroll) |
| Enter / Space | `select(focused)` + `emit(command)` | `:282-286` + `ListView` Enter/Space (AR-177) |
| wheel up/down | `focusBy(∓3)` | `list-rows.ts:223-227` |
| mouse down (data row) | `focusTo(topItem + local.y)` + `select(...)` — **no emit** | `list-rows.ts:229-243` (AR-177) |

- **Header mouse** is routed to `GridHeader.onEvent`: a click at `local.x` maps (via `apportionColumns` +
  `indent`) to a column → set `sort` = `{col, dir}` (toggle dir if already the active col; default `asc`)
  (AC-6, AR-158).
- Mouse-down maps a click below the last row to the last item (`Math.min(topItem+local.y, range-1)`),
  faithful `focusItemNum` clamp (`list-rows.ts:235-239`).

## Integration Points

- `DataGrid` mounts in any `Window`/`Dialog`/`Desktop` as a focusable view (RD-05). No overlay/capture
  beyond the `ScrollBar`'s own thumb-drag capture (already built).
- Reads the `Theme` via `DrawContext.color(role)`; the new `tableHeader` role (03-03) plus reused
  `listNormal/Focused/Selected/Divider` + `staticText`.

## Error Handling

| Error Case | Handling Strategy | AR |
| ---------- | ----------------- | -- |
| Empty `rows` (`[]`) | Header draws normally; data area draws `<empty>` at (1,0); no indexing | AR (AC-14) |
| Zero columns (`columns=[]`) | `apportionColumns` returns empty arrays; rows/header draw a blank field; no crash | AR (AC-14) |
| `focused`/`selected` out of range after data/sort change | `clampIndex` on the display-length bind (mirrors `list-rows.ts:126-131`) | AR-155/AR-177 |
| H-`indent` past content | Clamped to `[0, max(0, totalWidth - viewportWidth)]` each draw | AR-156 |
| Pathological long cell | `clip(cell, widths[c])` before draw — cannot overflow the column/viewport | AC-13 |
| Raw escapes in `accessor(row)`/`title` | `ctx.text` → `sanitize` (the canonical boundary) | AC-13 |

## Testing Requirements

- Spec tests (ST) from [07-testing-strategy.md](07-testing-strategy.md) — draw/geometry/colour/nav/sort/
  H-scroll/select/empty asserted against the buffer **pre-`serialize`**.
- Impl tests — `apportionColumns` edge cases (all-fr, all-fixed-overflow, mixed, zero-col), zebra priority,
  clamp-on-shrink, indent clamp, header/row divider-column alignment.
