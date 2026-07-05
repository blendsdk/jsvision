# Surface family (`Surface` + `SurfaceView`) Implementation Plan

> **Feature**: An offscreen `Surface` cell buffer + a `SurfaceView` scrollable viewport for `@jsvision/ui`
> **Status**: Planning Complete
> **Created**: 2026-07-05
> **Implements**: jsvision-ui/RD-19
> **CodeOps Skills Version**: 3.3.0

## Overview

RD-19 adds a **surface family** to `@jsvision/ui`: a **`Surface`** — an offscreen, freely-writable
cell buffer of a fixed `size`, implemented by **wrapping `@jsvision/core`'s `ScreenBuffer`** (so it
inherits width-correct cells, bounds-checking, `clone()`, and the full `set`/`text`/`fillRect`/`box`/
`shadow` API for free) with a faithful `resize`/`grow`/`clear`/`at` surface API and a **`DrawContext`
paint facade** — and a **`SurfaceView`** — a passive `View` that displays a `delta`-offset **viewport**
onto a bound `Surface`, blitting the visible region and filling the out-of-bounds margin (and a null
surface) with an empty-area colour.

`SurfaceView`'s **drawing is a decode, not a design** (the NON-NEGOTIABLE TV-fidelity directive): the
`delta`-offset clip `Rect(0,0,surface.size).move(-delta) ∩ viewExtent`, the cell blit, and the
top/bottom/side margin whitespace fill all match Turbo Vision's **`TSurfaceView::draw()`**
(`source/tvision/tsurface.cpp:93-141`) cell-by-cell, verified at GATE-1/GATE-2. The empty-area colour
reuses the existing **`windowInactive`** role (TV's `mapColor(1)` frame-passive decode) — **0 new core
theme roles**.

Everything else is a documented **extension** of TV (they get spec oracles but **no** `.cpp` diff): the
`ScreenBuffer` wrapping, the overlap-preserving `resize` (TV `memset 0`s the whole buffer — a real
decode correction, PA-2), the bounds-checked + sanitize-clean `at`/`set` (TV's `at` is unchecked, PA-1),
the reactive `surface`/`delta` bindings, the fully-scrolled-out "all-empty" fill (TV draws nothing,
PA-3), and the `scrollTo`/`panBy`/`onScroll`/`from`/`snapshot` conveniences.

RD-19 is **self-contained**: **0 new core theme roles**, **no existing `@jsvision/core` export
changes** (it reuses the already-public `ScreenBuffer` + `windowInactive`), and **no** `dropdown/` or
other-subsystem edits. It is the **last** of the six RD-12+ siblings and the **Later**-phase closer.

## Document Index

| #   | Document                                              | Description                                          |
| --- | ---------------------------------------------------- | ---------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)       | Zero-Ambiguity Gate decisions (PA-1…PA-12)           |
| 00  | [Index](00-index.md)                                 | This document — overview and navigation              |
| 01  | [Requirements](01-requirements.md)                   | Feature requirements and scope (Source: RD-19)       |
| 02  | [Current State](02-current-state.md)                 | Reuse points (`ScreenBuffer`, `makeDrawContext`, `windowInactive`) |
| 03-01 | [Surface + geometry](03-01-surface.md)             | The wrapped-buffer `Surface`, faithful API, facade, version signal, pure clip math |
| 03-02 | [SurfaceView](03-02-surface-view.md)               | The faithful `delta`-viewport draw + empty-area fill + passive/reactive behavior + GATE decode |
| 03-03 | [Packaging + story + demo](03-03-packaging.md)     | `src/surface/` re-exports, kitchen-sink story, `demo:surface` |
| 07  | [Testing Strategy](07-testing-strategy.md)           | ST-1…ST-15 spec oracles ↔ AC-1…AC-14                 |
| 99  | [Execution Plan](99-execution-plan.md)               | Phases, sessions, and task checklist                 |

## Quick Reference

### Usage Examples

```ts
import { signal } from '@jsvision/ui';
import { Surface, SurfaceView } from '@jsvision/ui';

// An offscreen canvas larger than its viewport, drawn with the same idiom as View.draw().
const surface = Surface.from([
  '+------------------ MAP ------------------+',
  '|  .-.   ~~~~~   /\\/\\   . . .   [town]    |',
  '|  villages, rivers, mountains, roads ... |',
  '+-----------------------------------------+',
]);
// or: const surface = new Surface({ size: { x: 120, y: 40 }, theme, caps });
//     surface.getDrawContext().text(2, 1, 'hello', style);   // facade paint
//     surface.set(0, 0, 'X', style);                          // single cell (sanitizes)
//     const cell = surface.at(0, 0);                          // readonly read (undefined OOB)

// A viewport panned by delta (bind delta to a ScrollBar, or drive it from app logic).
const delta = signal({ x: 0, y: 0 });
const view = new SurfaceView({
  surface,
  delta,
  onScroll: (d) => console.log(d),
});
view.panBy(3, 0);   // clamped pan; or delta.set({ x, y }) for the faithful unclamped case
```

### Key Decisions

| Decision                                | Outcome                                                                 | AR Ref |
| --------------------------------------- | ---------------------------------------------------------------------- | ------ |
| `Surface` ↔ `ScreenBuffer`              | **Composition** (wraps; `resize` swaps the internal buffer)            | PA-10  |
| `at()` shape (security)                 | **Read-only** `at(x,y)`; writes via `set`/`text`/facade (all sanitize) | PA-1   |
| `resize` semantics                      | **Preserve overlap** (TV `memset 0`s all — decode correction)         | PA-2   |
| Fully-scrolled-out surface              | **All-empty fill** (TV draws nothing — safe extension)                | PA-3   |
| Paint-facade theme/caps                 | **Construction default + per-call override**                          | PA-4   |
| Content invalidation                    | **Auto-bump version Signal + explicit `invalidate()`**                | PA-5   |
| File split                              | `surface-geometry.ts` (pure) + `surface.ts` + `surface-view.ts` + barrel | PA-7 |
| Empty-area role (GATE-1)                | Reuse `windowInactive` (`0x17`); **0 new roles**                     | RD AR-231 |
| Should-Haves                            | All four land (`scrollTo`/`panBy`/`onScroll`/`from`/`snapshot`)      | PA-9   |
| Draw geometry (GATE-1/2)                | Faithful to `TSurfaceView::draw()` (`tsurface.cpp:93-141`)           | RD AR-230 |

## Related Files

**New** — `packages/ui/src/surface/`: `surface-geometry.ts`, `surface.ts`, `surface-view.ts`, `index.ts`.
**Modified (additive)** — `packages/ui/src/index.ts` (explicit `surface/` re-exports). **No
`@jsvision/core` edits** (reuses `ScreenBuffer` + `windowInactive`).
**Consumed, not edited** — `packages/core` `ScreenBuffer`/`sanitize`/`defaultTheme`/`windowInactive`,
RD-03 `makeDrawContext`, RD-01 `signal`, RD-11 `ScrollBar` (composition only).
**New examples** — `packages/examples/kitchen-sink/stories/surface-view.story.ts`,
`packages/examples/surface-demo/`, `packages/examples/test/surface-demo.e2e.test.ts`.
