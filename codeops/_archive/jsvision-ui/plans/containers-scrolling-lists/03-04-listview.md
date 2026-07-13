# 03-04 — ListView / ListBox (Phase 3)

> **TV source**: `TListViewer` `source/tvision/tlstview.cpp`; `TListBox` `tlistbox.cpp`; `TSortedListBox`
> `stddlg.cpp`. Decl `views.h`/`dialogs.h`.
> **Files**: `packages/ui/src/list/{virtual,list-rows,list-view,list-box}.ts` · **CodeOps**: 3.1.0
> **PA-2, PA-3, PA-5, PA-10, PA-15, AR-104, AR-106**  · depends on ScrollBar (Phase 1)

## TV decode (GATE 1) — decode BEFORE writing

**`TListViewer::draw`** (`tlstview.cpp:77`; the item-index line is `:110`, getColor 1–5 span `:88-95`/`:150`):
- Item index (column-major): `item = j*size.y + i + topItem`. **Single column ⇒ `item = topItem + i`**
  (row `i` shows item `topItem+i`). `colWidth = size.x/numCols + 1` ⇒ single-col `= size.x + 1`.
- Per row: blank the cell in the row colour; if `item < range`, `getText(dest, item, 255)` and draw at
  `curCol+1`, clipped to `colWidth`, left-scrolled by `indent = hScrollBar?.value`.
- **Focus indicator (colour mode): NO glyph** — the focused row is drawn in `focusedColor` and the
  hardware cursor is placed at `(curCol+1, i)` via `setCursor`; unfocused ⇒ cursor hidden `(-1,-1)`.
- Divider `│ 0xB3` in `getColor(5)` at `curCol+colWidth-1` — for a **single column** that column is
  `size.x` (one past the visible `0..size.x-1`) ⇒ **off-screen; single-col lists show no divider**.
- `showMarkers` markers `specialChars={»0xAF, «0xAE, →0x1A, ←0x1B, ' ', ' '}` (`tvtext1.cpp:62`) are
  **monochrome-only** (`if(showMarkers)` gate, `:141`) — not drawn in colour, same gate as the button `[ ]`.
- `emptyText="<empty>"` (`tvtext2.cpp:147`) drawn once top-left when `range==0`, `getColor(1)`.
- `getColor`: **1** normal (active) + empty · **2** normal (inactive) · **3** focused · **4** selected ·
  **5** divider.

**`focusItem(item)`** (`:159`) — `focused=item`; mirror into `vScrollBar.value`; recompute `topItem` to
keep the focused item visible (`item<topItem ⇒ topItem=item`; `item≥topItem+size.y ⇒
topItem=item-size.y+1`, single-col). `focusItemNum` clamps to `[0, range-1]`.

**`handleEvent`** (`:213`) — mouse-down: `newItem = mouse.y + size.y*(mouse.x/colWidth) + topItem`
(single-col ⇒ `mouse.y + topItem`); drag auto-scrolls; **double-click** (`range>newItem`) →
`selectItem`. Keys (via `ctrlToArrow`): ↑=`focused-1`, ↓=`focused+1`, ←/→ = `±size.y` (multi-col only,
else ignored), PgUp/PgDn = `±size.y·numCols`, Home=`topItem`, End=`topItem+size.y·numCols-1`, CtrlPgUp=0,
CtrlPgDn=`range-1`, **Space** (`focused<range`) → `selectItem`. `selectItem` (`tlstview.cpp:357`)
broadcasts `cmListItemSelected=56`.

**Palette** (`tlstview.cpp:30`): `cpListViewer="\x1A\x1A\x1B\x1C\x1D"` → gray dialog (PA-10):
normal `0x30` black-on-cyan, focused `0x2F` white-on-green, selected `0x3E` yellow-on-cyan, divider
`0x31` blue-on-cyan.

**`TListBox::getText`** (`tlistbox.cpp:52`) = `items->at(item)` (a `char*`), truncated. `newList` (`:63`)
destroys the old list, sets `range=count`, `focusItem(0)`.

**`TSortedListBox::handleEvent`** (`stddlg.cpp:110`) — `searchPos` incremental prefix search over a
**sorted** collection via `list()->search(key)`; on a prefix match, `focusItem(value)`; Backspace shrinks,
`.` jumps to the extension; reset on focus-move / `cmReleasedFocus`.

## Spec (what we build) — PA-2/3/5/15

**`ListView<T>` extends `Group`** = an internal focusable rows-renderer + an auto-owned vertical
`ScrollBar`, laid out `[rows fr | bar 1]` (PA-2). Single column only (multi-col → RD-07, AR-104).

```ts
export interface ListViewOptions<T> {
  items: Signal<T[]>;
  getText: (item: T) => string;
  focused?: Signal<number>;        // highlighted row (default internal signal, 0)
  selected?: Signal<number>;       // chosen row (default internal)
  onSelect?: (index: number, item: T) => void; // Enter/double-click; index is DISPLAY order, item is the T (PF-003)
  command?: string;                // emitted on select (like Button)
  sorted?: boolean;                // ordered display (AR-104)
  typeAhead?: boolean;             // linear prefix search (PA-3)
}
export class ListView<T> extends Group { /* rows-renderer + owned ScrollBar */ }
export class ListBox extends ListView<string> { /* identity getText, Signal<string[]> (PA-15) */ }
```

- **`ListRows<T>`** (internal leaf, `list-rows.ts`, `focusable=true`) — draws only the visible rows
  (`topItem … topItem+viewportRows-1`) via `getText`, using `listNormal` (unfocused row) / `listFocused`
  (the `focused` row when the list is active) / `listSelected` (the `selected` row); the visible-window
  math lives in `virtual.ts` (`topItem`, `visibleRange`, `focusItem` keep-visible — decoded from
  `focusItem`). **No focus glyph, no hardware cursor** (PA-5) — the `listFocused` colour is the indicator.
  Single-column ⇒ no divider (decoded).
- **Owned ScrollBar** — `value` shared with `topItem`/`focused` (TV mirrors `focusItem → vScrollBar.value`);
  `max = range - viewportRows` (clamped ≥ 0); the bar auto-hides/shows per `scrollbars` like Scroller.
- **Keyboard/mouse** (on `ListRows`) — ↑↓/PgUp/PgDn/Home/End move `focused` (clamped) + keep it visible;
  a row click focuses+selects it (`newItem = mouse.y + topItem`); Enter/double-click/Space → select ⇒
  set `selected`, call `onSelect`, `ev.emit(command)` if set (mirrors `cmListItemSelected`);
  **mouse-wheel over the rows** moves `focused` by `±3` (PF-008) so wheel-over-content scrolls, not only
  wheel-over-bar.
- **Sorted** (`sorted:true`) — display the items in ascending `getText` order (stable); `focused`/
  `selected` index the *displayed* order. **Foot-gun note (PF-003):** since `items` stays in source
  order, `items()[selected()]` is the wrong element under `sorted` — consumers should read the item via
  `onSelect(index, item)` (or the displayed row), not by indexing the source signal. `ListBox`'s
  `getText` is identity, so the same caution applies to a sorted `ListBox`.
- **Type-ahead** (`typeAhead:true`, PA-3) — printable keys accumulate a prefix buffer; **linear**
  case-insensitive first-match scan over `getText(item)` sets `focused`; Backspace shrinks; the buffer
  resets on focus-move (matches TV's `searchPos` reset). No sorted requirement, no comparator.
- **`ListBox`** — `ListView<string>` with `getText = (s) => s`, bound to a `Signal<string[]>`; when the
  items signal changes, `range` updates and `focused` clamps to `[0, range-1]` (TV `newList`).

## Spec oracles

- **ST-05** (virtual scroll) — a `ListView` over 1000 items renders only the ~viewport rows via `getText`
  (a spy counts calls ≪ 1000); ↑↓ move `focused`, PgDn pages, the focused row stays visible, the owned
  `ScrollBar.value` reflects position; the focused row uses `listFocused`. *(AC-4)*
- **ST-06** (select + emit) — Enter/double-click emits `command` (via `ev.emit`) + calls `onSelect` +
  sets `selected`; a row click focuses+selects it (`listSelected`). *(AC-5)*
- **ST-07** (sorted + type-ahead) — `sorted:true` displays items ordered; `typeAhead:true` + typing a
  prefix jumps `focused` to the first match (case-insensitive); both are **off by default** (unsorted, no
  search). *(AC-6)*
- **ST-08** (ListBox) — a `ListBox` over `Signal<string[]>` lists the strings; updating the signal
  re-renders the visible rows and clamps `focused`. *(AC-7)*
- **ST-14** (geometry, shared) — normal/focused/selected colours + single-col no-divider + no focus glyph
  asserted vs the decode. *(AC-13)*

## GATE 2 (AFTER) — re-open `tlstview.cpp`/`tlistbox.cpp`/`stddlg.cpp`: diff the row-colour selection
(getColor 1–5), `topItem`/keep-visible math, mouse `newItem`, select broadcast, and confirm single-col
no-divider + no-marker in colour mode. Record in the commit.
