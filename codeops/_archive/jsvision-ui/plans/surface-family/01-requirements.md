# 01 — Requirements & Scope

> **Document**: 01-requirements.md · **Parent**: [Index](00-index.md)
> **Source**: [RD-19](../../requirements/RD-19-surface.md)
> **CodeOps Skills Version**: 3.3.0

All functional requirements, scope boundaries, and acceptance criteria are owned by
[RD-19](../../requirements/RD-19-surface.md) — this plan does **not** restate them. This document
records only the plan-level scope framing and the delta the plan adds on top of the RD.

## In scope (this plan)

- **`Surface`** — an offscreen cell buffer wrapping core `ScreenBuffer` (PA-10 composition), with the
  faithful `resize`/`grow`/`clear` API (RD Must-Have), a **read-only** `at(x, y)` + sanitizing
  `set(x, y, char, style)` (PA-1), a `DrawContext` **paint facade** with construction-default +
  per-call theme/caps (PA-4), and an auto-bumping `version` `Signal` + `invalidate()` (PA-5).
- **`SurfaceView`** — a passive, non-focusable `View` rendering the faithful `delta`-offset clipped
  viewport + empty-area whitespace fill (`windowInactive`), decoded from `TSurfaceView::draw()`
  (`tsurface.cpp:93-141`), with a two-way `delta` Signal and reactive `surface` binding.
- **Should-Haves (all four, PA-9):** `SurfaceView.scrollTo`/`panBy` (clamped), `onScroll`,
  `Surface.from(rows)`, `Surface.snapshot()`.
- **GATE-1/GATE-2** cell-by-cell decode + diff of the `SurfaceView` draw against `tsurface.cpp`.
- **Kitchen-sink** `surface/surface-view` story (a pannable ASCII canvas) + headless `demo:surface`.

## Out of scope / deferred (from RD-19)

Owned by RD-19's *Won't Have* + *Deferred* register — **DEF-31** (built-in keyboard/wheel scroll on
`SurfaceView`; auto `Scroller`/`ScrollBar` chrome), the editor tier (`TEditor`/`TMemo`), a drawing/
graphics DSL, and persistence/image import-export. `SurfaceView` stays **passive** (TV-faithful);
scrolling is caller-driven via `delta` (compose a RD-11 `ScrollBar` if wanted).

## Acceptance criteria

The 14 immutable oracles are **AC-1…AC-14** in [RD-19 §Acceptance Criteria](../../requirements/RD-19-surface.md#acceptance-criteria).
[07-testing-strategy.md](07-testing-strategy.md) maps each to a specification test (ST-#).

## Key constraints

- **TV fidelity (NON-NEGOTIABLE):** the `SurfaceView` *draw geometry* is a decode of `tsurface.cpp` —
  GATE-1 before, GATE-2 after (03-02). Extensions (wrapping, `resize`, bounds/sanitize, reactivity)
  get spec oracles but no `.cpp` diff.
- **Security (NON-NEGOTIABLE):** no surface-mutation path stores an unsanitized control byte (PA-1,
  AC-14); all clip/blit indexing is bounds-checked/clamped (AC-13).
- **Packaging:** new `src/surface/` subsystem, explicit named re-exports from `src/index.ts`, zero
  runtime deps (`check:deps`), files ≤ 500 lines, **no** `@jsvision/core` export changes (AC-11).
- **Verify command:** `yarn verify` (PA-12).
