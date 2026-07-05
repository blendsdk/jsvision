# 02 — Current State Analysis

> **Document**: 02-current-state.md · **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.3.0

RD-19 builds entirely on **shipped** facilities — there are no new engine primitives. This document
records the exact reuse points (verified `file:line`) the plan depends on, so the specs and impl can
cite them.

## Reuse points (verified)

| Facility | Where | What RD-19 uses it for | Verified |
|----------|-------|------------------------|----------|
| **`ScreenBuffer`** | `packages/core/src/engine/render/buffer.ts:59` | The cell buffer `Surface` **wraps** — width-correct cells, `inBounds`, `set`/`get`/`text`/`fillRect`/`box`/`shadow`/`clone`/`rows`. | ✅ |
| `ScreenBuffer` constructor | buffer.ts:73 | `new ScreenBuffer(w, h, fill)` — clamps w/h ≥ 1, floors; `Surface.resize` allocates a fresh one. | ✅ |
| `ScreenBuffer.set` | buffer.ts:133-159 | Bounds-checked (`:134`) + **sanitizes** C0/DEL → space (`:140-143`). `Surface.set` delegates here (PA-1). | ✅ |
| `ScreenBuffer.get` | buffer.ts:162-165 | Returns a **live mutable `Cell` | undefined**. `Surface.at` reads it but returns a **readonly** view (never the live handle) — the PA-1 hinge. | ✅ |
| `ScreenBuffer.text` | buffer.ts:188-216 | `sanitize(str)` at write (`:193`); the facade + `Surface.text` route through it. | ✅ |
| `ScreenBuffer.clone` | buffer.ts:322-329 | `Surface.snapshot()` (PA-9). Exact deep copy incl. wide-lead/continuation cells. | ✅ |
| **`ScreenBuffer.resize`** | — | **ABSENT.** Confirmed no `resize`; `width`/`height` are `readonly` (`:60-61`). ⇒ `Surface` must be **composition** and swap its internal buffer on `resize` (PA-10). | ✅ |
| `ScreenBuffer` change signal | — | **ABSENT.** No built-in reactivity ⇒ `Surface` adds a `version` `Signal` (PA-5, AC-6). | ✅ |
| **`makeDrawContext`** | `packages/ui/src/view/draw-context.ts:64` | The paint facade over any buffer: `makeDrawContext(buffer, viewRect, clip, theme, caps)`. Needs `theme`+`caps` ⇒ PA-4. Its writers already sanitize + clip + drop straddling wide glyphs (`:86-119`). | ✅ |
| **`windowInactive`** role | `packages/core/src/engine/color/theme.ts:335` | The empty-area colour = `0x17` lightGray-on-blue (TV `mapColor(1)` frame-passive). Used at window.ts:143 already. **0 new roles.** | ✅ |
| `sanitize` | `packages/core` (re-exported) | The injection boundary all writes route through. | ✅ |
| `defaultTheme` | `packages/core` | The paint-facade construction default (PA-4). | ✅ |
| `signal` | RD-01 reactive core | `surface`/`delta`/`version` bindings; RD-03 coalesces repaints. | ✅ |
| `View` / `DrawContext` / render root | RD-03 `src/view/` | `SurfaceView extends View`; `View.draw(ctx)`, `bind`, `invalidate`, the reflow pass. | ✅ |
| `ScrollBar` | RD-11 `src/scroll/scroll-bar.ts` | **Composition only** — the demo/story may bind a `ScrollBar.value` ↔ `delta` (AC-8). Not edited. | ✅ |
| Anchored popup (`dropdown/`) | RD-14/20 | **NOT touched** — RD-19 is self-contained (unlike RD-20/21). | ✅ |

## TV source (fidelity ground truth)

- `include/tvision/surface.h` — `TDrawSurface` (`data`/`size`/`resize`/`grow`/`clear`/`at`) +
  `TSurfaceView` (`surface`/`delta`/`draw`/`getPalette`); the `cpSurfaceView "\x01"` empty-area
  palette note (`:60-71`).
- `source/tvision/tsurface.cpp:1-147` — `TDrawSurface::resize`/`clear`/`at` (`:40-75`, memset-0
  whole-buffer, PA-2) + `TSurfaceView::draw()` (`:93-141`, the clip/blit/margin geometry to match) +
  `getPalette` (`:143-146`, `mapColor(1)`).

## Sibling patterns to mirror

- **Pure-helper file** — `color-grid.ts`/`calendar-grid.ts` isolate view-free geometry for oracle-first
  tests. `surface-geometry.ts` follows suit (clip + margin rects). (PA-7)
- **Draw decode in JSDoc** — `color-swatch.ts`/`calendar.ts` record the GATE-1 decode + `file:line` in
  the class JSDoc; `surface-view.ts` does the same.
- **Kitchen-sink + demo** — `color`/`date`/`tabs` each ship a story + a headless `demo:*` e2e; RD-19
  ships `surface/surface-view` + `demo:surface`.

## Gaps this plan fills

1. No offscreen buffer primitive today (`ScreenBuffer` is the on-screen compose target) → `Surface`.
2. No `delta`-viewport widget today (`Scroller` scrolls *live* children, not an offscreen buffer) →
   `SurfaceView`.
3. `ScreenBuffer` lacks `resize` + a change signal → added on the UI side (composition + `version`).
