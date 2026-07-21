# 03-03 — Scroller (Phase 2)

> **TV source**: `TScroller` — `source/tvision/tscrolle.cpp`, decl `views.h`.
> **File**: `packages/ui/src/scroll/scroller.ts` · **CodeOps**: 3.1.0 · **PA-8, AR-105** · depends on ScrollBar (Phase 1)

## TV decode (GATE 1) — decode BEFORE writing

`TScroller` is a **passive viewport** driven by its two scrollbars — it has no keyboard/wheel of its own
(those live in `TScrollBar`). Key methods:

- **`handleEvent`** (`tscrolle.cpp:83`) — reacts only to `cmScrollBarChanged` from *its own* `hScrollBar`/
  `vScrollBar` → `scrollDraw()`.
- **`scrollDraw`** (`:95`) — `d = { x: hScrollBar?.value ?? 0, y: vScrollBar?.value ?? 0 }`; if `d != delta`,
  shift the cursor by the delta change, set `delta = d`, redraw. `delta` = current scroll offset.
- **`scrollTo(x,y)`** (`:120`) — writes the scrollbars' `value` (which broadcast back).
- **`setLimit(x,y)`** (`:131`) — content extent = `limit`; sets each bar `setParams(value, 0,
  limit-size, size-1, arStep)` ⇒ **range `[0, limit − size]`, `pageStep = size − 1`**.
- **`changeBounds`** (`:58`) — re-applies `setLimit` under a `drawLock` (coalesced redraw).
- **`setState`** (`:165`) — shows/hides both bars with the scroller's active/selected state.
- **Palette** (`:35`) — `cpScroller="\x06\x07"` (normal/highlighted text — the content decides). Our
  Scroller draws no text itself (the content child does); no new role needed.

## Spec (what we build) — PA-8

`Scroller` is a **`Group`** clipping an oversized content child and offsetting it by `-delta`; the RD-03
`DrawContext` already clips children to the group's bounds, so a content child positioned at a negative
offset reveals exactly the visible window (no new clipping machinery).

```ts
export interface ScrollerOptions {
  content: View;                                   // the (oversized) content
  extent: Size2D | (() => Size2D);                 // content's natural size = the scroll limit
  scrollbars?: 'vertical' | 'horizontal' | 'both' | 'none'; // default 'vertical' (AR-105)
}
export class Scroller extends Group { /* owns content + auto-created ScrollBar(s) */ }
```

- **Composition** — children: the `content` (absolute, `rect = { x:-delta.x, y:-delta.y, width:extentW,
  height:extentH }`) + one `ScrollBar` per requested axis, laid out in the reserved edge cells (vertical
  bar = rightmost column width 1; horizontal bar = bottom row height 1). The content viewport shrinks by
  the reserved edge(s).
- **Delta ↔ bars** — each bar's `value: Signal<number>` is the delta on its axis; the Scroller binds
  `delta ← bar.value` (repaint by re-setting the content child's `rect` + `invalidateLayout`), and the
  bar's `max` is set to `extent − viewport` on mount/resize (TV `setLimit`, `pageStep = viewport − 1`).
- **Keyboard / wheel — an intentional extension (PF-004/PF-008).** The GATE-1 decode above notes TV's
  `TScroller` has *no keyboard/wheel of its own* — in TV those live on the `TScrollBar` (which is a
  selectable view) or the derived viewer. jsvision's `ScrollBar` is passive/non-focusable (PA-14), so
  the **focusable owner drives it**: the `Scroller` is focusable and its `onEvent` handles
  ↑↓/←→/PgUp/PgDn/Home/End **and mouse-wheel** by adjusting the owned bars' `value` (clamped), matching
  TV's arrow/page deltas (the bar's `scrollStep`) and wheel `±3·arStep`. This is a behavioral extension
  the fidelity rule permits (drawing/geometry stay TV-exact); the wheel handler makes wheel-over-content
  scroll (not only wheel-over-bar).
- **Clamp** — `delta ∈ [0, max(0, extent − viewport)]` on each axis (no over-scroll; content smaller than
  the viewport ⇒ `max==min` ⇒ the bar shows the disabled `▓` full track).

## Spec oracles

- **ST-03** (clip + reveal) — a `Scroller` (viewport `10×5`) over content `10×20`: initially rows 0–4
  visible; after `↓`/PgDn/thumb, `delta.y` increases, lower rows appear, and it clamps at
  `extent − viewport`; the owned vertical `ScrollBar.value` tracks `delta.y`, and dragging the bar scrolls
  the content. *(AC-2)*
- **ST-04** (owns bars) — `Scroller({ scrollbars:'vertical' })` auto-creates + wires one vertical bar with
  no manual construction; `'none'` → no bar (content fills); `'both'` → vertical + horizontal bars in the
  reserved edges. *(AC-3)*

## GATE 2 (AFTER) — re-open `tscrolle.cpp`: confirm `delta` mirrors the bar `value`, the range/`pageStep`
math (`setLimit`), and clamp behaviour match. Record in the commit.
