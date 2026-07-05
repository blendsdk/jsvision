# 07 — Testing Strategy

> **Document**: 07-testing-strategy.md · **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.3.0

Spec-first (immutable oracles): **spec tests → red → implement → green → impl tests → verify**. A
`*.spec.test.ts` encodes an **AC** and never changes to match the code. For the **TV-derived**
`SurfaceView` draw, a spec oracle that disagrees with a faithful `tsurface.cpp` decode is the defect —
fix it against the source (cite the `.cpp`); the extensions' oracles come from the RD.

**Verify command:** `yarn verify` (PA-12). Vitest `unit` project = `*.{spec,impl}.test.ts`; `e2e` =
`*.e2e.test.ts`. Render-through tests mount via `createEventLoop` + `mount`, asserting the composed
`ScreenBuffer` **pre-`serialize`** cell-by-cell (the sibling idiom).

## Specification Test Cases (ST-# ↔ AC-#)

| ST | AC | File | Oracle (input → expected) |
|----|----|------|---------------------------|
| **ST-1** | AC-1 | `surface.spec` | `new Surface({size:{x:5,y:3}})` exposes `resize`/`grow`/`clear`/`at`; `grow({x:2,y:0})` ≡ `resize({x:7,y:3})`; `clear()` → every cell a space; after `resize` overlapping prior content preserved, new region blank; a wide glyph set via the facade occupies **2 cells** (lead width 2 + continuation width 0) — proves the `ScreenBuffer` backing. |
| **ST-2** | AC-2 | `surface.spec` | `at(x,y)` for OOB `(−1,0)`/`(W,0)`/`(0,H)` → `undefined`; `set(OOB,…)` → no-op (no throw), buffer unchanged; holds for a zero/degenerate surface (`size {x:1,y:1}` clamp). `at` returns a **readonly** cell (mutating the returned object does **not** change the surface). |
| **ST-3** | AC-3 | `surface-view.spec` | `SurfaceView` `Vw×Vh` bound to `Surface` `Sw×Sh` with `delta` blits exactly the cells in `computeClip` into view-local `(clip.x,clip.y)`; asserted **cell-by-cell pre-serialize** vs the `tsurface.cpp:93-141` decode across cases: surface-fills-view (`clip==extent`, direct copy), partial (top/bottom + side margins), negative delta (surface inset), delta into interior. |
| **ST-4** | AC-4 | `surface-view.spec` | Margins not covered by the surface, and the **whole** view when `surface` is `null`, are **spaces** in **`windowInactive`**; no non-space glyph in any margin cell. |
| **ST-5** | AC-5 | `surface-view.spec` | `delta.set({x:dx,y:dy})` moves the viewport and triggers **exactly one** coalesced repaint (spy the scheduler/frame); revealed region appears, vacated region replaced. |
| **ST-6** | AC-6 | `surface-view.spec` | Mutating surface content in place (facade `ctx.text` / `surface.set`) then the auto/explicit `invalidate()` repaints the visible region next tick (same Surface identity). |
| **ST-7** | AC-7 | `surface.spec` | Drawing via `getDrawContext()` (`ctx.text`/`ctx.fillRect`/`ctx.color(role)`) produces the **same cells** as the equivalent raw `surface.buffer.set`/`text` calls; `surface.buffer` remains accessible. Per-call `getDrawContext({theme})` override resolves `ctx.color(role)` against the override (PA-4). |
| **ST-8** | AC-8 | `surface-view.spec` | `SurfaceView.focusable === false`; a dispatched arrow/PgDn/wheel/click does **not** change `delta`. A `ScrollBar` bound to `delta` (`value` ↔ `delta`) scrolls the viewport (composition). |
| **ST-9** | AC-9 | `surface-view.spec` | Zero-or-negative view size → draws nothing (no cells touched / no throw); a zero-size `Surface` and a `delta` pushing the surface fully outside the viewport both render an **all-empty** viewport; no crash / no OOB indexing (fuzz a range of deltas incl. large + negative). |
| **ST-10** | AC-10 | `surface-view.spec` / `surface.packaging.spec` | Surface cells render as their **own** colours (not a theme role); empty area = `windowInactive`; **no new core theme role** exists and no existing role byte changed; `encode(windowInactive)` does not throw. |
| **ST-11** | AC-11 | `surface.packaging.spec` | `Surface`/`SurfaceView` (+ `SurfaceOptions`/`SurfaceViewOptions`/`Point`) importable from `@jsvision/ui`; `surface-geometry` helpers **not** exported; `yarn check:deps` clean; every `src/surface/*` file ≤ 500 lines; **no existing `@jsvision/core` export changed**. |
| **ST-12** | AC-12 | `kitchen-sink.smoke` / `surface-demo.e2e` | The `surface/surface-view` story mounts headlessly (paints, unique id, metadata) → smoke green; `demo:surface` runs headless with an ASCII frame per step incl. the empty-area-fill frame. |
| **ST-13** | AC-13 | `surface-view.spec` / `surface.spec` | Every blitted cell + empty space reaches the buffer sanitize-clean; `at`/`set` + the clip/blit math bounds-checked/clamped for any surface size, any `delta`, null surface, zero-size view (assert no `undefined` deref, no throw). |
| **ST-14** | AC-14 | `surface.spec` | **No mutation path stores an unsanitized control byte:** `surface.set(0,0,'\x1b[2J',s)` → cell char is a **space** (or sanitized), never `\x1b`; same for facade `ctx.text('\x1b…')` and `surface.text`; `at` exposes no writable handle (there is no `at`-based write). A subsequent `SurfaceView` blit emits no raw control byte. |

## Impl / edge tests (`*.impl.test.ts`)

- **`surface-geometry.impl`** — `computeClip` across delta signs & magnitudes (inside, partial, exact
  `clip==view`, fully-outside → empty); `marginRects` order + full-view → `[]`; `clampDelta` clamps per
  axis incl. surface ≤ view (→ 0).
- **`surface.impl`** — `resize` grow/shrink overlap preservation (corner cells), non-positive dim clamp;
  `grow` = resize; `clear` style; `from(rows)` sizing (ragged rows → max width; display-width aware);
  `snapshot()` independence (mutating original doesn't change snapshot); `version()` bumps on each
  mutator; the readonly-`at` immutability.
- **`surface-view.impl`** — wide-glyph blit (lead+continuation, straddling clip edge dropped whole);
  `scrollTo`/`panBy` clamp; `onScroll` fires on change only; surface **swap** on `resize` re-reads the
  new buffer; buffer-identity change repaints.

## GATE tasks (mandatory, TV-derived draw)

- **GATE-1 BEFORE** — record the `tsurface.cpp:93-141` + `surface.h` decode (clip/blit/margins/null +
  the `resize` `memset 0` correction) in `03-02` + the `surface-view.ts`/`surface.ts` JSDoc **before**
  writing draw code.
- **GATE-2 AFTER** — diff the composed `SurfaceView` buffer **cell-by-cell** vs `tsurface.cpp`:
  `clip==extent` direct copy, top/bottom bands, left/right side bands, negative-delta inset, null
  surface, and the PA-3 fully-outside all-empty extension; record the diff in the JSDoc/commit; fix
  **code** on any disagreement (the C++ outranks our spec for the TV-derived draw).
