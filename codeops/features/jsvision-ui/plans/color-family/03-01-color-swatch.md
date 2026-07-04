# 03-01: `ColorSwatch` + `color-grid` (the color grid view)

> **Document**: 03-01-color-swatch.md
> **Parent**: [Index](00-index.md)
> **Components**: `packages/ui/src/color/color-grid.ts` (pure), `packages/ui/src/color/color-swatch.ts` (`View`)

`ColorSwatch` is a **decode** of Turbo Vision's `TColorSelector`. Its drawing, marker, and navigation
math are transcribed from `colorsel.cpp`, not designed. The generic `Color[]` palette, the truecolor
cells, the cursor-vs-`value` split, and the omitted frame are documented extensions.

---

## TV decode (GATE 1) — `TColorSelector`

**Source:** `/home/gevik/workdir/github/tvision/source/tvision/colorsel.cpp:111-237`, glyph table
`tvtext1.cpp:88`. Re-verified at the RD-21 preflight; to be re-affirmed cell-by-cell at GATE-2.

### `draw()` (`colorsel.cpp:120-147`)

```cpp
void TColorSelector::draw() {
    TDrawBuffer b;
    b.moveChar(0, ' ', 0x70, size.x);              // whole line pre-filled attr 0x70
    for (int i = 0; i <= size.y; i++) {
        if (i < 4) {
            for (int j = 0; j < 4; j++) {
                int c = i*4 + j;                    // color index = row*4 + col
                b.moveChar(j*3, icon, c, 3);        // 3 cells of `icon` in attribute `c`
                if (c == color) {                   // the selected cell
                    b.putChar(j*3+1, 8);            // CP437 8 = ◘ at the CENTRE cell
                    if (c == 0)                     // black is invisible on black bg
                        b.putAttribute(j*3+1, 0x70);// force black-on-lightGray
                }
            }
        }
        writeLine(0, i, size.x, 1, b);
    }
}
```

Decoded facts (→ PA-5/6/7):

| Fact | Decode | RD-21 realization |
|------|--------|-------------------|
| Line pre-fill | `moveChar(0, ' ', 0x70, size.x)` — the **first** draw() instruction pre-fills the whole view row with attr `0x70` (black-on-lightGray) before cells overwrite it | **No-op for a full grid** (16 cells cover all 12 columns → the fill is never visible), so RD-21 does **not** replicate it. The `0x70` byte survives only as the `colorMarker` role (PA-1). **Partial-row gaps** (a generic-palette last row with empty trailing columns) render at the host popup/`Window` background, **not** lightGray — an accepted extension deviation (TV's fixed 4×4 grid never exposes a gap). |
| Cell glyph | `icon = '\xDB'` = `█` U+2588 full block (`tvtext1.cpp:88`) | Each cell = `█` × 3 columns. |
| Cell width | `moveChar(j*3, icon, c, 3)` → **3 columns** at column `j*3` | `columns * 3` grid width. |
| Cell color | attribute = `c` (0–15) = `0x0c` (bg nibble `0`=black, fg nibble `c`) | `{ fg: cellColor, bg: PALETTE.black }` (raw `Color`, no role). |
| Marker glyph | `putChar(j*3+1, 8)` = `◘` U+25D8 at the **centre** column of the selected cell | `◘` at `cellX + 1`. |
| Black-cell marker | `if (c==0) putAttribute(j*3+1, 0x70)` = black-on-lightGray | The `colorMarker` role (PA-1); fired on **near-black** cells (PA-2). |
| Row count | `i < 4` for a foreground selector (16 colors / 4 cols = 4 rows) | `ceil(colors.length / columns)` rows (generic). |

### `handleEvent()` (`colorsel.cpp:159-233`)

- **`width = 4`**, **`maxCol = 15`** (fg) / `7` (bg). Generalized: `width = columns`, `maxCol =
  colors.length - 1`.
- **Keyboard wrap-around** (`:196-217`):
  - `kbLeft`:  `color > 0 ? color-- : color = maxCol`
  - `kbRight`: `color < maxCol ? color++ : color = 0`
  - `kbUp`:    `color > width-1 ? color -= width : (color == 0 ? color = maxCol : color += maxCol - width)`
  - `kbDown`:  `color < maxCol-(width-1) ? color += width : (color == maxCol ? color = 0 : color -= maxCol - width)`
- **Mouse** (`:165-177`): `oldColor = color`; then
  `do { if (mouseInView(where)) { local = makeLocal(where); color = local.y*4 + local.x/3; } else color
  = oldColor; colorChanged(); drawView(); } while (mouseEvent(evMouseMove));` — i.e. on down **and while
  dragging**, set `color = row*4 + localX/3`; a pointer **outside the view** reverts `color` to
  `oldColor` (the pre-drag value). Generalized hit: `row*columns + floor(localX/3)`.
- **Framing** (`:114`): `options |= ofFramed` — TV draws its own frame. **Omitted** (PA-12).

---

## `color-grid.ts` — pure geometry (no `View`)

Pure, unit-testable functions (mirrors `calendar-grid.ts`). All indexing bounds-checked/clamped.

```ts
/** Grid dimensions for a palette of `n` colors laid out in `columns` columns (≥1). */
export function gridDims(n: number, columns: number): { cols: number; rows: number; width: number };
//  cols = max(1, columns); rows = ceil(n / cols); width = cols * 3   (0 colors → rows 0, width cols*3)

/** True when a view-local point lies within the grid rect (`0 ≤ x < cols*3`, `0 ≤ y < rows`). */
export function insideGrid(localX: number, localY: number, n: number, columns: number): boolean;
//  the swatch calls this FIRST to pick revert-vs-clamp (PA-10): inside → clamp; outside → revert.

/** Cell index under a view-local point (PA-10): a real cell index, or `'overshoot'` (inside the grid
 *  rect but past the last cell of a partial row → caller clamps to n-1), or `'outside'` (beyond the
 *  grid rect → caller reverts to the pre-drag cell). The two null-like cases are DISCRIMINATED so the
 *  swatch's revert-vs-clamp branch (AC-5) can't conflate them. */
export function hitCell(localX: number, localY: number, n: number, columns: number): number | 'overshoot' | 'outside';
//  if !insideGrid(...) → 'outside'; idx = localY*cols + floor(localX/3); return idx < n ? idx : 'overshoot'

/** Left column of cell `i`'s 3-wide block. */  export function cellX(i: number, columns: number): number; // (i % cols) * 3
/** Row of cell `i`. */                          export function cellRow(i: number, columns: number): number; // floor(i / cols)

/** Wrap-around nav (PA-8) — returns the new cursor index for a direction, given n colors / columns. */
export function navLeft(cur: number, n: number, columns: number): number;
export function navRight(cur: number, n: number, columns: number): number;
export function navUp(cur: number, n: number, columns: number): number;
export function navDown(cur: number, n: number, columns: number): number;
//  maxCol = n-1, width = max(1,columns); transcribed from colorsel.cpp:196-217; n<=1 → cur (no-op, AC-14)

/** Near-black predicate (PA-2): true when the marker needs the forced-contrast role. */
export function isNearBlack(color: Color): boolean;
//  const rgb = toRgb(color) via try/catch → null on 'default' or throw ⇒ treat as near-black
//  luminance = 0.2126*r + 0.7152*g + 0.0722*b; return rgb === null || luminance < ~24
```

**Edge rules (AC-14):** `columns ≤ 0` coerces to `1`; `n === 0` ⇒ `gridDims` rows `0`, `insideGrid`
always `false` so `hitCell` always `'outside'`, nav returns `cur` unchanged; `n === 1` ⇒ nav is a
no-op (`maxCol === 0`, every branch returns `0` — no infinite wrap).

---

## `color-swatch.ts` — `ColorSwatch extends View`

### Options + public API

```ts
export interface ColorSwatchOptions {
  value: Signal<Color>;                 // two-way selected color
  colors?: readonly Color[];            // palette (default ANSI16_ORDER)
  columns?: number;                     // default 4 (TColorSelector)
  onChange?: (c: Color) => void;        // fired when value changes (Should-Have)
  nameFor?: (c: Color) => string;       // pure name accessor (Should-Have, PA-13) — used by ColorPicker
  onCommit?: (c: Color) => void;        // internal hook the ColorPicker wires to commit+close (PA-11)
}

export class ColorSwatch extends View {
  readonly value: Signal<Color>;
  select(color: Color): void;           // drive the signal programmatically (Should-Have)
  // internal: cursor: Signal<number>   // nav+marker SoT (PA-9)
}
```

### State model (PA-9 / AC-15)

- Internal **`cursor: Signal<number>`** is the single source of truth for nav + the marker. Initial
  `cursor = indexOf(value())` in `colors` if present, else **`0`**.
- `value` is a **derived two-way bind**: `bind(() => this.value(), (v) => { const i = indexOf(v); if (i
  >= 0) cursor.set(i); })` (external member `value` re-homes the cursor; a `value ∉ colors` leaves the
  cursor where it is). Commit sets `value = colors[cursor]` **and** calls `onChange`/`onCommit`.
- `value ∉ colors` ⇒ **no marker drawn** (the marked cell is `indexOf(value)`, which is `-1`); nav
  still works from `cursor`; Enter/Space commits `colors[cursor]` (replacing the off-palette value).

### `draw(ctx)`

For each cell `i` in `[0, colors.length)`:
1. `const x = cellX(i, columns); const y = cellRow(i, columns);`
2. `ctx.fillRect(x, y, 3, 1, '█', { fg: colors[i], bg: PALETTE.black });` — the 3-wide block (PA-5/7).
3. If `indexOf(value()) === i` (marker on the **value** cell, AC-3): draw `◘` at the centre:
   - near-black (`isNearBlack(colors[i])`) ⇒ `ctx.text(x+1, y, '◘', ctx.color('colorMarker'))` (`0x70`);
   - else ⇒ `ctx.text(x+1, y, '◘', { fg: colors[i], bg: PALETTE.black })` (the `◘` shows a black dot).

No frame (PA-12). `PALETTE`/`ANSI16_ORDER`/`toRgb` imported from `@jsvision/core`.

### `onEvent(ev)` — keyboard (AC-4)

- `key === 'left'/'right'/'up'/'down'` → `cursor.set(nav*(cursor(), n, columns))`; `ev.handled = true`;
  plain arrows do **not** leave the swatch (a focus-owning view).
- `key === 'enter'` or `' '` (space) → `commit()` (sets `value = colors[cursor]`, fires
  `onChange`/`onCommit`); `ev.handled = true`.

### `onEvent(ev)` — mouse (AC-5, the drag decode)

- On `kind === 'down'`: capture `pre = cursor()`; set cursor from `ev.local` via `hitCell` — a real
  index sets the cursor, `'overshoot'` (inside the grid rect, partial-row) clamps to `n-1`, `'outside'`
  keeps `pre`; request pointer capture (RD-04 `ev.setCapture`) so moves route here.
- On `kind === 'move'` while captured: recompute `hitCell(ev.local…)` and switch on its discriminated
  result — a real index → set cursor; `'overshoot'` → clamp to `n-1`; `'outside'` → revert to `pre`
  (TV `else color = oldColor`, PA-10). Repaint. (The revert-vs-clamp split is decided **inside**
  `color-grid.ts` — the swatch never re-derives the grid bounds.)
- On `kind === 'up'`: release capture. In a **standalone** swatch a click/drag selects (moves cursor)
  but does **not** auto-commit; the `ColorPicker` wires `onCommit` and treats the release-over-cell as
  commit+close (PA-11 — see 03-02). Standalone commit is Enter/Space or the caller's `select()`.

> **Commit boundary note (PA-11):** the standalone `ColorSwatch` follows TV — mouse moves the cursor;
> Enter/Space commits. The picker's "click a swatch commits + closes" is layered by the `ColorPicker`
> via `onCommit` fired on **mouse-up over a cell**, so a drag inside the popup previews (cursor tracks)
> and only the release commits. This keeps one `ColorSwatch` for both hosts.

### Security (AC-13)

`█`/`◘`/captions all route through `ctx` → `ScreenBuffer` + `sanitize`. Every index (`hitCell`, nav,
`indexOf`) is bounds-checked/clamped in `color-grid.ts` for any `colors.length` (incl. `0`/`1`),
`columns`, and drag position. No raw escape reaches the terminal.

**Line budget:** `color-grid.ts` ~120 lines, `color-swatch.ts` ~200 lines — both ≤ 500 (PA-4).
