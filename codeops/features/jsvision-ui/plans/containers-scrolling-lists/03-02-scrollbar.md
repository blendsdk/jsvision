# 03-02 — ScrollBar (Phase 1)

> **TV source**: `TScrollBar` — `source/tvision/tscrlbar.cpp`, glyphs `tvtext1.cpp:113`, decl `views.h`.
> **File**: `packages/ui/src/scroll/scroll-bar.ts` · **CodeOps**: 3.1.0 · **PA-14, PA-4, PA-10, AR-111**

## TV decode (GATE 1) — decode BEFORE writing draw/geometry code

**Glyphs** (`tvtext1.cpp:113`, `TScrollChars` 5-byte, positional):

| idx | vertical | horizontal | role | Unicode |
|-----|----------|------------|------|---------|
| 0 | `0x1E` ▲ | `0x11` ◄ | start arrow (up/left) | U+25B2 / U+25C4 |
| 1 | `0x1F` ▼ | `0x10` ► | end arrow (down/right) | U+25BC / U+25BA |
| 2 | `0xB1` ▒ | `0xB1` ▒ | page track | U+2592 |
| 3 | `0xFE` ■ | `0xFE` ■ | thumb / indicator | U+25A0 |
| 4 | `0xB2` ▓ | `0xB2` ▓ | disabled fill (`max==min`) | U+2593 |

Constructor picks vertical glyphs when `size.x==1`, else horizontal (`tscrlbar.cpp:47`). Map CP437→the
listed Unicode (unambiguous-narrow).

**`drawPos(pos)`** (`tscrlbar.cpp:65`; called from `draw()` `:60`) along the long axis, length `= getSize()`, `s = getSize()-1`:
`col 0` = start arrow `getColor(2)`; `cols 1..s-1` = track `▒` `getColor(1)` (or all `▓` `getColor(1)` if
`max==min`); thumb `■` `getColor(3)` overwrites the track cell at `pos`; `col s` = end arrow `getColor(2)`.

**`getPos()` / `getSize()`** (`tscrlbar.cpp:89`):
`getSize() = max(3, len)`; `getPos() = ((value-min)·(getSize()-3) + r/2) / r + 1` where `r = max-min`
(`r==0 ⇒ pos 1`). So `pos ∈ [1, getSize()-2]`; `value==min ⇒ 1`, `value==max ⇒ getSize()-2`.

**Hit-zones `getPartCode()`** (`tscrlbar.cpp:114`, `extent` = rect grown by (1,1)): along-axis coord
`mark` → `mark==pos`:thumb-drag; `mark<1`:line-back arrow; `1≤mark<pos`:page-back; `pos<mark<s`:page-fwd;
`mark≥s`:line-fwd arrow. Part codes `sbLeftArrow=0…sbIndicator=8`; vertical adds 4 to non-indicator.
**`scrollStep(part)`** (`:283`): `bit1` = page(`pgStep`) vs arrow(`arStep`), `bit0` = fwd(+) vs back(−).
**Wheel** (`evMouseWheel` case `:148`; the `value + 3·step` at `:169`): vertical consumes wheel-up/down, `setValue(value ± 3·arStep)`.

**Palette** (`tscrlbar.cpp:37,83`): `cpScrollBar="\x04\x05\x05"` → in a gray dialog all three resolve to
`0x13` **cyan-on-blue** (PA-4/PA-10). Roles: track/disabled → `scrollBarPage`; arrows + thumb →
`scrollBarControls` (getColor 2 and 3 both = slot 5).

## Spec (what we build)

```ts
export interface ScrollBarOptions {
  value: Signal<number>;                 // two-way position (AR-111)
  min?: number; max?: number;            // range; default 0..0 (disabled → all ▓)
  pageStep?: number; arrowStep?: number; // defaults: arrowStep 1, pageStep = axis length − 1
  orientation?: 'vertical' | 'horizontal'; // default vertical
}
export class ScrollBar extends View { override focusable = false; /* driven by mouse/owner */ }
```

- **`draw(ctx)`** — implement `drawPos(getPos())` exactly: pick the glyph set by `orientation`; `col 0` /
  `col s` arrows in `scrollBarControls`; track `▒` (or `▓` if `max==min`) in `scrollBarPage`; thumb `■`
  in `scrollBarControls` at `pos`. Length = the axis extent of `ctx.size`.
- **`getPos()`** — the exact TV formula (integer, rounded via `+ r/2`), clamped `[1, len-2]`.
- **`onEvent(ev)`** — mouse-down maps the click cell → part via the TV zones (arrows hittable through the
  grown extent = the two end cells); arrow → `value ± arrowStep`, page → `value ± pageStep`, thumb-down →
  `setCapture(this)` and drag maps the along-axis mouse position back to a proportional `value`; wheel →
  `value ± 3·arrowStep`. Every change writes `value` (clamped `[min,max]`) → repaint. Release →
  `releaseCapture()`.
- **Keyboard** (only when focusable/owned by a focused list — the list forwards): not focusable by
  default; the owning `ListView`/`Scroller` drive `value` (PA-2/PA-8), matching TV (the bar is passive
  chrome, the viewer owns the keys).
- **Binding** — `onMount` binds `value` (repaint on external change) + clamps into `[min,max]`.

## Spec oracles

- **ST-01** (draw) — a vertical `ScrollBar` `value=min` over height `H` draws `▲` at row 0, `▼` at row
  `H-1`, `▒` track between, `■` thumb at row 1 (`pos` for `value==min`); `value=max` puts the thumb at row
  `H-2`; a mid `value` puts it at the `getPos()` row; `max==min` fills the track with `▓`. Colours =
  `scrollBarControls` (arrows/thumb) + `scrollBarPage` (track). *(AC-1)*
- **ST-02** (step + clamp) — clicking the top arrow does `value -= arrowStep`; the lower page area does
  `value += pageStep`; both clamp to `[min,max]`; a horizontal bar mirrors with `◄`/`►`. *(AC-1)*
- **ST-14** (geometry, shared) — glyph bytes + colours asserted against the buffer pre-`serialize`. *(AC-13)*

## GATE 2 (AFTER) — re-open `tscrlbar.cpp` and diff cell-by-cell: arrow/track/thumb glyphs, `pos` for
min/mid/max, the disabled `▓` fill, and the resolved colours. Record the decode in the code JSDoc/commit.
