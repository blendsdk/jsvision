# Cell Rendering & Styling: Formatting & Cell Rendering

> **Document**: 03-02-cell-rendering.md
> **Parent**: [Index](00-index.md)

## Overview

Two per-cell hooks on `GridColumn` and the paint path that honors them: `render` (custom cell content,
drawn into a cell-local clipped context with draw-error isolation) and `cellStyle` (value-driven colour
composited under a fixed precedence). Because the base engine paints a whole row in one role via the
string accessor, the datagrid body takes over the per-cell paint with a self-contained `draw()` override
(AR #1) — no `@jsvision/ui` change.

## Architecture

### Current Architecture

`EditableGridRows.draw` (`editable-grid-rows.ts:264`) delegates the row/cell paint to `super.draw()`
(base `GridRows.draw`, `grid-rows.ts:184-237`), then overpaints `paintCursorCell` and
`paintDirtyMarkers`. The base resolves the row role (`grid-rows.ts:216-225`) and draws each cell as
`alignCell(col.accessor(row), width, align, stringWidth)` in that single role.

### Proposed Changes

Replace the `super.draw(ctx)` call with a self-contained row/cell loop in `EditableGridRows` that:

1. Re-limits the scroll bars (`this.vbar`/`this.hbar` are public; call `setRange` exactly as the base
   does) and computes `topItem`/`geometry`/`indent` exactly as the base does. Set `topItem` via the
   protected `this.updateTop()` — the `keepVisible`/`clampIndex` free functions the base `draw()` uses are
   **module-private to `@jsvision/ui` and not reachable** from datagrid (PF-003), so do NOT try to import
   or protected-access them. Reuse the inherited protected `geometry()` plus the imported
   `alignCell`/`stringWidth`, and replicate the one-line indent clamp (`min(maxIndent, max(0, indent()))`).
2. Per visible row: resolve the **row role** (focused>selected>zebra>normal, unchanged from the base) and
   blank the row in it.
3. Per cell, apply the **cell precedence** (below):
   - **cellStyle** — if the column has `cellStyle` **and** no higher-precedence row state owns the cell,
     resolve its colour and blank+draw the cell in it.
   - **render** — if the column has `render`, build a cell-local clipped ctx and invoke it (draw-error
     isolated); the renderer owns the cell's content.
   - **default** — otherwise `alignCell(col.accessor(row), width, align)` in the resolved style (the
     current behavior, byte-for-byte, when neither hook is set).
4. Paint the `│` dividers, then the **overpaints** `paintCursorCell` + `paintDirtyMarkers` last.

### The cell-paint precedence (RD-04 R5)

Fixed order, highest wins: **cursor > dirty > selected-row > cellStyle > zebra > normal.**

| Layer | Source | Applied by |
| ----- | ------ | ---------- |
| cursor | focused cell while the body has focus | `paintCursorCell` overpaint (last) |
| dirty | pending-commit `•` marker | `paintDirtyMarkers` overpaint (last) |
| selected-row | `selected` row band (dormant until RD-08 — AR #9) | row-role resolution |
| cellStyle | `column.cellStyle(value,row)` | per-cell, only when the row is **not** focused/selected |
| zebra | odd-row stripe (`staticText`) | row-role resolution |
| normal | `listNormal` | row-role resolution |

Because cursor and dirty are the final overpaints, they always win. `cellStyle` is gated: it paints only
when the cell's row is neither the focused row nor the selected row, which enforces **selected>cellStyle**
and (together with the cursor overpaint) **cursor>cellStyle** (RD-04 AC-6). The base's focused/selected/
zebra resolution is preserved verbatim so RD-02/RD-08 keep composing.

## Implementation Details

### New Types/Interfaces (`column.ts` additions + `cell-draw.ts`)

```ts
// --- column.ts: two optional fields on GridColumn<T,V> ---

/** Value-driven cell colour. Returns a theme role name OR an explicit Style. See precedence in 03-02. */
export type CellStyle<T, V> = (value: V, row: T) => ThemeRoleName | Style;

/** Custom cell painter. Receives a cell-local, cell-clipped ctx; draw-error isolated. */
export type CellRenderer<T, V> = (ctx: CellDrawContext, cell: RenderCell<T, V>) => void;

// on GridColumn<T, V>:
//   readonly render?: CellRenderer<T, V>;
//   readonly cellStyle?: CellStyle<T, V>;

// --- cell-draw.ts ---

/** The per-cell paint state handed to a custom renderer (read-only). */
export interface RenderCell<T, V> {
  readonly x: number;        // cell rect, body-local (for metrics; ctx origin is already the cell)
  readonly y: number;
  readonly width: number;
  readonly value: V;
  readonly row: T;
  readonly state: CellState;
}

/** Which composited states are active on the cell being rendered. */
export interface CellState {
  readonly focused: boolean;   // the cursor cell (body focused)
  readonly selected: boolean;  // the selected row (dormant until RD-08)
  readonly dirty: boolean;     // a pending commit
  readonly zebra: boolean;     // an odd zebra stripe
}

/** The cell-local draw surface a renderer sees. A thin facade over the body ctx: origin at the cell's
 *  top-left, writes clipped to the cell rect so a renderer cannot overflow into a neighbour (AR #3). */
export type CellDrawContext = Pick<DrawContext, 'text' | 'fillRect' | 'color' | 'role' | 'caps'>;
```

### New Functions/Methods (`cell-draw.ts`)

```ts
/** Build a cell-local clipped facade over the body ctx for the cell at (x,y,width). Writes are offset by
 *  (x,y) and dropped when they fall outside [x, x+width) on the cell's row — the renderer works in
 *  cell-local coordinates and cannot paint past its column. */
export function cellContext(ctx: DrawContext, x: number, y: number, width: number): CellDrawContext;

/** Run a column's `render` under draw-error isolation. On a throw, paint the row's background and a
 *  single '⚠' at the cell origin in `{ fg: ctx.color('gridDirty').fg, bg: rowStyle.bg }` (a theme-adaptive
 *  red over the row bg — there is NO semantic `danger` role, PF-001/AR #2), so one bad renderer degrades
 *  one cell and the rest of the frame renders normally (RD-04 AC-4). Returns nothing; never rethrows. */
export function safeRender<T, V>(
  ctx: DrawContext, x: number, y: number, width: number,
  rowStyle: Style, render: CellRenderer<T, V>, cell: RenderCell<T, V>,
): void;
```

`cellContext` is implemented without the raw buffer: it wraps `ctx.text`/`ctx.fillRect` with an `(x,y)`
offset and a `[0,width)` horizontal clamp (a write whose column falls outside the cell's width is
dropped), and passes `ctx.color`/`ctx.role`/`ctx.caps` through. Sanitization still happens downstream at
the buffer boundary (`buffer.ts:211`).

### Integration Points

- `EditableGridRows.draw` (`editable-grid-rows.ts`) is rewritten to the self-contained loop; the existing
  `paintCursorCell` / `paintDirtyMarkers` (and their geometry/indent math) are reused unchanged as the
  final overpaints.
- `cellStyle`/`render` are resolved from the parallel `typedColumns` the body already holds
  (`editable-grid-rows.ts:84`), not the engine `columns` (which lack the typed hooks).
- `cellStyle` returning a bare `Style` (`{fg,bg}`) is used directly; a `ThemeRoleName` resolves via
  `ctx.color(role)`.

## Code Examples

### Example: traffic-light renderer + conditional style

```ts
column({
  id: 'balance', title: 'Balance', align: 'right',
  value: (r: Account) => r.balance,
  ...fmt.currency({ locale: 'nl-NL', currency: 'EUR' }),
  set: (r, v) => { r.balance = v; },
  // Explicit Style — no `danger` role exists. `Color` is `#hex | Ansi16Name | 'default'`.
  cellStyle: (v) => (v < 0 ? { fg: 'brightRed', bg: 'cyan' } : 'listNormal'), // red when negative (unless a state wins)
});

column({
  id: 'flag', title: '', width: 3, value: (r: Account) => r.balance,
  render: (ctx, cell) => ctx.text(0, 0, cell.value < 0 ? '●' : '○',
    { fg: cell.value < 0 ? 'brightRed' : 'brightGreen', bg: 'cyan' }), // ctx is cell-local; (0,0) is the cell corner
});
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A custom `render` throws | Draw-error isolation: paint the row bg + a `⚠` in `{ fg: gridDirty.fg, bg: rowStyle.bg }` at the cell (no `danger` role exists); other cells/rows render normally (never rethrow) | AR #2 (PF-001) |
| A renderer writes past its cell width | Dropped by the cell-local clip in `cellContext` (cannot overflow into a neighbour) | AR #3 |
| A value/format/render string carries control bytes | Sanitized at the buffer boundary (`buffer.ts:211`) — no raw ESC/BEL on the frame | RD-04 AC-5 |
| `cellStyle` on a focused/selected/cursor/dirty cell | Suppressed by precedence — the higher layer paints | AR #1, AR #9 |
| Formatted string wider than the column | Truncated by `alignCell` without splitting a wide glyph (default path); custom renderers are cell-clipped | RD-04 AC-7 |

> **Traceability:** every strategy references the register entry that resolved it.

## Testing Requirements

- Spec (from ST cases): cellStyle colour applied; precedence cursor>cellStyle and selected>cellStyle;
  render glyph at the cell rect; render-throw isolation; cell-local clip (no overflow); width-correct
  truncation; default path unchanged when neither hook is set. See `07 §Cell rendering & styling`.
- Impl: the full precedence matrix, empty grid, a wide-glyph cell, `cellStyle` returning a bare `Style`
  vs a role name, dirty-marker survival over a cellStyle cell.
