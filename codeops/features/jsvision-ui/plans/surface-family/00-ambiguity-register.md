# Ambiguity Register — Surface family (`Surface` + `SurfaceView`)

> **Plan**: surface-family · **Feature**: jsvision-ui · **Implements**: jsvision-ui/RD-19
> **CodeOps Skills Version**: 3.3.0
> **Gate status**: ✅ **GATE PASSED** (all rows Resolved; user-confirmed 2026-07-05)

This register inventories every plan-level ambiguity for RD-19. RD-19 itself already resolved the
requirement-level decisions (its `AR-225…234` + preflight `PF-001…006`); this register captures the
**plan/implementation** decisions those left open. Rows tagged **[user]** are explicit user choices
(the make_plan Phase 1C questions, 2026-07-05); rows tagged **[source]** are source-determined or
single-dominant decisions recorded for traceability (RD AC / TV decode / house convention).

| # | Ambiguity | Resolution | Kind |
|---|-----------|------------|------|
| **PA-1** | `Surface.at()` read/write shape — `ScreenBuffer.get()` returns a **live mutable `Cell`** (buffer.ts:162), so an `at()` that returned it would let `surface.at(0,0).char = '\x1b[2J'` bypass sanitize (the AC-14/PF-001 bypass). | **Split read/write.** `at(x, y)` is a bounds-checked **read** returning a **readonly** cell (or `undefined` OOB); it never returns a mutable handle. All single-cell writes go through `Surface.set(x, y, char, style)` → the wrapped `ScreenBuffer.set` (sanitizes C0/DEL→space + bounds-checks). So no mutation path can store an unsanitized control byte ⇒ AC-14 holds **by construction**, and the faithful blit stays safe. | **[user]** |
| **PA-2** | `resize` content semantics — RD AC-1 says jsvision **preserves overlapping content**; the RD text characterised TV as "zero-initialised the tail". | **Decode correction + keep AC-1.** `TDrawSurface::resize` (`tsurface.cpp:40-70`) `memset 0`s the **entire** new buffer (`:60`, "Initialize the buffer, like TGroup does") — it preserves **nothing**. jsvision's overlap-preserving `resize` (fresh `ScreenBuffer` + copy of the still-fitting region) is therefore a deliberate **extension** of TV, not a faithful decode. `resize` is buffer management, **not** `TSurfaceView::draw` geometry, so the extension is in-scope for the fidelity directive. Record the accurate TV decode; AC-1 (preserve overlap) stands as the oracle. | **[source]** |
| **PA-3** | Surface scrolled **fully outside** the viewport — what draws? | **All-empty fill (AC-9).** TV's clip-empty guard (`tsurface.cpp:108-109`) means a fully-scrolled-out surface draws **nothing** (leaves stale cells) — undefined in practice. jsvision treats *clip-empty* identically to *null surface*: fill the **whole** view with empty-area spaces (`windowInactive`). A safe, deterministic **extension** of TV; matches AC-9. | **[source]** |
| **PA-4** | Where the DrawContext paint facade obtains `theme`/`caps` for **offscreen** authoring (`makeDrawContext` requires both, draw-context.ts:64). | **Construction default + per-call override.** `new Surface({ size, theme?, caps? })` captures defaults (core `defaultTheme` + a mono/ASCII-safe caps profile); `getDrawContext(overrides?)` may override `theme`/`caps` per call. Zero-config default path plus flexibility. | **[user]** |
| **PA-5** | Content mutation (same Surface identity, in-place) must repaint the bound `SurfaceView` (AC-6); `ScreenBuffer` has no change signal. | **Auto-bump version Signal + explicit `invalidate()`.** A private `version` `Signal<number>` bumps automatically on every mutator (`set`/`text`/`clear`/`resize`/`grow`/facade-commit); `SurfaceView.draw` reads it so RD-03 coalesces to **one** repaint/tick. `Surface.invalidate()` is public for callers who poke `surface.buffer` directly. | **[user]** |
| **PA-6** | `SurfaceView` binding shape for `surface` + `delta`. | **House-convention bindings.** `surface: Surface | null | Accessor<Surface | null>` (static or reactive); `delta: Signal<Point>` a **two-way** signal the caller drives (default `signal({ x: 0, y: 0 })`). Mirrors the value-binding idiom of the other view families. `Point = { x, y }`. | **[source]** |
| **PA-7** | File split of `src/surface/`. | **Four files.** `surface-geometry.ts` (**pure**, view-free clip/margin math — the oracle-first testable core, mirroring `color-grid.ts`/`calendar-grid.ts`), `surface.ts` (the `Surface` buffer + facade + version signal), `surface-view.ts` (the `SurfaceView` draw), one barrel `index.ts`. Each ≤ 500 lines. | **[source]** |
| **PA-8** | `Surface.clear()` fill. | **Space in an optional style** (default `{ fg: 'default', bg: 'default' }`) via `buffer.fillRect(0,0,W,H,' ',style)` — TV `memset 0` decode (char 0 + attr 0); jsvision blanks to a visible space in the default/ supplied style. | **[source]** |
| **PA-9** | Which RD-19 **Should-Have** items land in this plan. | **All four land:** `scrollTo(delta)`/`panBy(dx,dy)` (clamped to `[0, max(0, surface−view)]`; raw `delta` stays writable), `onScroll(delta)` callback, `Surface.from(rows)` (ASCII-lines constructor — demo/story depend on it), `Surface.snapshot()` (→ `ScreenBuffer.clone()`). | **[user]** |
| **PA-10** | `Surface` **wraps** vs **extends** `ScreenBuffer`. | **Composition (wraps).** `Surface` holds a private `ScreenBuffer` exposed via a `buffer` getter. `resize` must **swap** the internal instance (allocate a new `ScreenBuffer` + copy the overlap) — impossible by subclassing (`width`/`height` are `readonly`, buffer.ts:60-61). AC-11's "no core export changes" + AR-226 "wrap, don't re-implement" both hold. | **[source]** |
| **PA-11** | Wide-glyph handling in the `SurfaceView` blit. | **Cell-aware blit.** The blit reads each visible surface cell via `surface.get(srcX, srcY)`: a `width:2` lead is written with `ctx.text` (occupies 2 view cells), a `width:0` continuation is **skipped** (its lead drew it), a `width:1` cell writes normally. A wide glyph straddling the view's clip edge is dropped whole by `ctx` (draw-context.ts:86-91) — never a half-cell. | **[source]** |
| **PA-12** | Verify command. | **`yarn verify`** (= `turbo run typecheck build test`), per the project CLAUDE.md. Fills every Verify line. | **[source]** |
| **PA-13** | `Point` re-export collision — 03-03 lists `Point` among the surface re-exports, but `Point` (`{x,y}`) is **already** re-exported from the ui barrel (`src/index.ts:40`, from `view/geometry.ts`); adding a second `Point` export is a TS duplicate-export compile error. | **Reuse the existing `Point`.** `surface-geometry.ts` imports `Point` from `../view/geometry.js` and `Rect` from `../layout/index.js` (no local duplicates, DRY); the surface re-export list drops `Point` (already public). Single viable path — a duplicate barrel export does not compile; no new user decision needed. | **[runtime]** |

## Traceability

- **[user]** PA-1/PA-4/PA-5/PA-9 — the four make_plan Phase 1C questions, answered 2026-07-05.
- **[source]** PA-2/PA-3/PA-6/PA-7/PA-8/PA-10/PA-11/PA-12 — TV decode (`tsurface.cpp`/`surface.h`),
  RD-19 ACs, verified `@jsvision/core`/RD-03 code, and house subsystem conventions; recorded for
  traceability (RD-19 `AR-99` convention).
- **PA-1** carried a security-hardening pass (the PF-001 collision of the two NON-NEGOTIABLE
  directives): the challenger "isn't `set()` already sanitizing enough?" was rejected because the
  bypass is the **raw mutable cell** `get()` hands back — so `at()` must be read-only. *Confidence:
  high. Hardening: reconciled against the actual `ScreenBuffer.get` return type (buffer.ts:162).*

> **GATE PASSED** — every row Resolved with an explicit decision; zero items deferred.
