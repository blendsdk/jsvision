# Execution Plan: Surface family (`Surface` + `SurfaceView`)

> **Document**: 99-execution-plan.md · **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-05
> **Progress**: 10/28 tasks (36%)
> **CodeOps Skills Version**: 3.3.0

## Overview

Implement `Surface` + `SurfaceView` in a new `packages/ui/src/surface/` subsystem over the shipped
RD-01…RD-18 facilities — **no** `@jsvision/core` edits (reuses `ScreenBuffer` + `windowInactive` +
`sanitize` + `defaultTheme`), **0 new theme roles**, **no** `dropdown/` edits. `SurfaceView` **has a TV
counterpart** (`TSurfaceView`, `tsurface.cpp`), so the **GATE-1 BEFORE-decode + GATE-2 AFTER-diff are
mandatory** (NON-NEGOTIABLE TV-fidelity directive + `codeops/tv-fidelity-gate.md`): decode the
`delta`-offset clip + blit + margin whitespace fill + null-surface case BEFORE, diff the composed
buffer cell-by-cell AFTER. The wrapping / overlap-`resize` / bounds+sanitize `at` / reactive-pan /
Should-Have extensions get spec oracles but **no** `.cpp` diff.

Spec-first ordering per phase: **Spec tests (red) → Implementation (green) → Impl tests & hardening**.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | GATE-1 decode + `surface-geometry.ts` pure clip/margin math (spec-first) | 5 |
| 2 | `surface.ts` — Surface buffer, faithful API, facade, version signal (spec-first) | 5 |
| 3 | `surface-view.ts` — faithful `delta`-viewport draw + empty fill + passive/reactive (spec-first) | 5 |
| 4 | GATE-2 AFTER-diff + Should-Haves + impl tests & hardening | 6 |
| 5 | Packaging + kitchen-sink story + `demo:surface` | 7 |

**Total: 28 tasks across 5 phases.**

---

## Phase 1: GATE-1 decode + `surface-geometry.ts` (spec-first)

**Reference**: [03-01](03-01-surface.md) · [03-02](03-02-surface-view.md) · [07](07-testing-strategy.md)
**Objective**: Record the fidelity decode; land the pure clip/margin/clamp math oracle-first.

| # | Task | File |
| - | ---- | ---- |
| 1.1 | **[GATE-1 BEFORE-decode]** Record the `tsurface.cpp:93-141` + `surface.h` decode cell-by-cell in `03-02` (clip `Rect(0,0,surface.size).move(-delta)∩extent`, direct-copy `clip==extent`, top/bottom `writeLine` bands, side bands via the `fillWithSpaces` scratch, `mapColor(1)`→`windowInactive`, null-surface, first-cell `at(max(delta,0))`) **and** the `resize` `memset 0`-whole-buffer correction (PA-2). Confirm the decode table. | `03-02-surface-view.md` |
| 1.2 | Write `surface-geometry.spec.test.ts` — `computeClip` (inside/partial/`clip==view`/fully-outside→empty/negative delta), `marginRects` (TV order; full-view→`[]`), `clampDelta` (per-axis; surface≤view→0). MUST NOT read impl. | `packages/ui/test/surface-geometry.spec.test.ts` |
| 1.3 | Run spec — verify **FAIL** (red; module not found). | — |
| 1.4 | Implement `surface-geometry.ts` (`computeClip`/`marginRects`/`clampDelta`, pure, integer, bounds-clamped; JSDoc cites `tsurface.cpp:105-132`). ≤ 500 lines. | `packages/ui/src/surface/surface-geometry.ts` |
| 1.5 | Run spec — verify **PASS** (green); `yarn verify`. | — |

**Verify**: `yarn verify`

---

## Phase 2: `surface.ts` — Surface buffer + facade + version (spec-first)

**Reference**: [03-01](03-01-surface.md) · [07](07-testing-strategy.md)
**Objective**: The wrapped-`ScreenBuffer` buffer, faithful API, read-only `at` + sanitizing `set`,
paint facade, version signal — oracle-first (AC-1/2/6/7/14).

| # | Task | File |
| - | ---- | ---- |
| 2.1 | Write `surface.spec.test.ts` (ST-1 API + resize-overlap + wide-glyph backing; ST-2 bounds-safe readonly `at`/no-op `set`; ST-7 facade≡raw + override; ST-14 sanitize-on-mutation incl. `set('\x1b[2J')`→space). MUST NOT read impl. | `packages/ui/test/surface.spec.test.ts` |
| 2.2 | Run — verify **FAIL** (red). | — |
| 2.3 | Implement `surface.ts` (`Surface` **wraps** `ScreenBuffer` PA-10; `resize` swaps buffer + copies overlap PA-2; `grow`/`clear` PA-8; **read-only** `at` + sanitizing `set` PA-1; `getDrawContext(overrides?)` construction-default+override PA-4; `version` Signal auto-bump + `invalidate` PA-5; `buffer` getter; `from`/`snapshot` PA-9). Record the `resize` deviation + reuse cites in JSDoc. ≤ 500 lines. | `packages/ui/src/surface/surface.ts` |
| 2.4 | Run `surface.spec` — verify **PASS** (green; fix code, never the spec). | — |
| 2.5 | `yarn verify`. | — |

**Verify**: `yarn verify`

---

## Phase 3: `surface-view.ts` — faithful viewport draw (spec-first)

**Reference**: [03-02](03-02-surface-view.md) · [07](07-testing-strategy.md)
**Objective**: The passive, reactive `delta`-viewport `View` — faithful draw + empty fill (AC-3/4/5/8/9/10).

| # | Task | File |
| - | ---- | ---- |
| 3.1 | Write `surface-view.spec.test.ts` (ST-3 draw geometry **cell-by-cell pre-serialize** vs decode; ST-4 empty/null; ST-5 reactive pan one-repaint; ST-8 passive/no-input + `ScrollBar`↔`delta`; ST-9 degenerate/fully-outside; ST-10 cells-own-colour + no new role; ST-6 reactive content; ST-13 bounds/sanitize). MUST NOT read impl. | `packages/ui/test/surface-view.spec.test.ts` |
| 3.2 | Run — verify **FAIL** (red). | — |
| 3.3 | Implement `surface-view.ts` (`SurfaceView extends View`, `focusable=false`, no key/mouse handling; draw = margins via `marginRects`+`ctx.fillRect` in `windowInactive`, blit via `surface.get` cell-aware incl. wide-glyph skip PA-11, reads `version()`/`delta()`/`surfaceValue()`; null/fully-outside → whole-view empty PA-3; reads `surface.buffer` fresh PA-10). **Record the GATE-1 decode in JSDoc.** ≤ 500 lines. | `packages/ui/src/surface/surface-view.ts` |
| 3.4 | Run `surface-view.spec` — verify **PASS** (green; on any fidelity mismatch the **code** is wrong — fix vs `tsurface.cpp`). | — |
| 3.5 | `yarn verify`. | — |

**Verify**: `yarn verify`

---

## Phase 4: GATE-2 AFTER-diff + Should-Haves + impl tests & hardening

**Reference**: [03-01](03-01-surface.md) · [03-02](03-02-surface-view.md) · [07](07-testing-strategy.md)
**Objective**: Verify the rendered viewport against `tsurface.cpp`; land the conveniences; cover edges.

| # | Task | File |
| - | ---- | ---- |
| 4.1 | **[GATE-2 AFTER-diff]** Re-open `tsurface.cpp` and diff the composed `SurfaceView` buffer **cell-by-cell**: `clip==extent` direct copy, top/bottom bands, left/right side bands, negative-delta inset, null surface, and the PA-3 fully-outside all-empty extension. Record the diff in `surface-view.ts` JSDoc / commit; fix code on any disagreement. | `surface-view.ts` JSDoc / commit |
| 4.2 | Implement the Should-Haves (PA-9): `SurfaceView.scrollTo`/`panBy` (clamp via `clampDelta`; raw `delta` stays writable) + `onScroll`; confirm `Surface.from`/`snapshot` from Phase 2. | `surface-view.ts`, `surface.ts` |
| 4.3 | Write `surface-geometry.impl.test.ts` (delta signs/magnitudes, `marginRects` order, `clampDelta` edges). | `packages/ui/test/surface-geometry.impl.test.ts` |
| 4.4 | Write `surface.impl.test.ts` (resize corner-overlap + shrink + non-positive clamp; `from` ragged/display-width; `snapshot` independence; `version` bumps; readonly-`at` immutability). | `packages/ui/test/surface.impl.test.ts` |
| 4.5 | Write `surface-view.impl.test.ts` (wide-glyph blit + straddle-drop; `scrollTo`/`panBy` clamp; `onScroll` change-only; surface **swap** on resize re-reads buffer; buffer-identity repaint). | `packages/ui/test/surface-view.impl.test.ts` |
| 4.6 | Full verification (`yarn verify`). | — |

**Verify**: `yarn verify`

---

## Phase 5: Packaging + kitchen-sink story + `demo:surface`

**Reference**: [03-03](03-03-packaging.md)
**Objective**: Public API, the NON-NEGOTIABLE showcase story, and the headless demo.

| # | Task | File |
| - | ---- | ---- |
| 5.1 | Write `surface.packaging.spec.test.ts` (ST-11/ST-10 half): `Surface`/`SurfaceView`(+types) re-exported from `@jsvision/ui`, `surface-geometry` NOT exported, `check:deps` clean, files ≤ 500, no core export/role-byte change, `encode(windowInactive)` non-throw. Run — verify **FAIL** (red, ui half). | `packages/ui/test/surface.packaging.spec.test.ts` |
| 5.2 | Add `surface/index.ts` barrel + explicit named re-exports in `packages/ui/src/index.ts` (`Surface`, `SurfaceView`, `SurfaceOptions`, `SurfaceViewOptions`, `Point`). | `packages/ui/src/surface/index.ts`, `packages/ui/src/index.ts` |
| 5.3 | Run — verify **PASS** (green). | — |
| 5.4 | **Kitchen-sink story (+ smoke, ST-12)** — `stories/surface-view.story.ts` (id `surface/surface-view`, category `Surface`, `rd:'RD-19'`; pannable ASCII canvas via `Surface.from`, `SurfaceView`, live `delta` echo + hints, story-owned key→`delta` or a bound `ScrollBar`) + one `stories/index.ts` line; passes `kitchen-sink.smoke.spec.test.ts`. | `packages/examples/kitchen-sink/stories/surface-view.story.ts`, `stories/index.ts` |
| 5.5 | Headless `demo:surface` — `surface-demo/main.ts` (ASCII frame per step: render → pan right → pan down → pan past edge → recentre) + `"demo:surface"` script. | `packages/examples/surface-demo/main.ts`, `packages/examples/package.json` |
| 5.6 | `surface-demo.e2e.test.ts` (ST-12) asserting the per-step frames incl. the `windowInactive` empty-area fill. | `packages/examples/test/surface-demo.e2e.test.ts` |
| 5.7 | Full verification incl. `yarn check:deps` + `test:e2e`; update CLAUDE.md/roadmap (exec_plan post-analysis). | — |

**Verify**: `yarn verify` (+ `yarn check:deps`, `yarn test:e2e`)

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** mark each task `[x]` with a timestamp immediately on completion; update the
> Progress header after every task; never batch. Immutable-oracle rule: a failing spec means the code
> is wrong — fix the code, never the spec. For the TV-derived `SurfaceView` draw, a spec oracle that
> disagrees with a faithful `tsurface.cpp` decode is the defect — fix it against the source, cite the `.cpp`.

### Phase 1: GATE-1 decode + `surface-geometry.ts`
- [x] 1.1 [GATE-1 BEFORE-decode] Record `tsurface.cpp:93-141`+`surface.h` decode + `resize` memset correction in 03-02 — done 2026-07-05 (re-verified faithful vs source cell-by-cell)
- [x] 1.2 Write `surface-geometry.spec` — done 2026-07-05 (17 oracles: computeClip/marginRects/clampDelta)
- [x] 1.3 Run — verify RED — done 2026-07-05 (module not found)
- [x] 1.4 Implement `surface-geometry.ts` (computeClip/marginRects/clampDelta) — done 2026-07-05 (reuses view/layout `Point`/`Rect`, PA-13)
- [x] 1.5 Run — verify GREEN; `yarn verify` — done 2026-07-05 (spec green; full verify 179 files/1048 tests)

### Phase 2: `surface.ts`
- [x] 2.1 Write `surface.spec` (ST-1/2/7/14) — done 2026-07-05 (15 oracles incl. sanitize + readonly-at)
- [x] 2.2 Run — verify RED — done 2026-07-05 (module not found)
- [x] 2.3 Implement `surface.ts` (wrap+resize-swap, readonly `at`+sanitizing `set`, facade, version) — done 2026-07-05
- [x] 2.4 Run `surface.spec` — verify GREEN — done 2026-07-05
- [x] 2.5 `yarn verify` — done 2026-07-05 (ui 180 files/1063 tests)

### Phase 3: `surface-view.ts`
- [ ] 3.1 Write `surface-view.spec` (ST-3/4/5/6/8/9/10/13)
- [ ] 3.2 Run — verify RED
- [ ] 3.3 Implement `surface-view.ts` (faithful draw + empty fill + passive/reactive; GATE-1 decode in JSDoc)
- [ ] 3.4 Run `surface-view.spec` — verify GREEN (fix code, never the spec)
- [ ] 3.5 `yarn verify`

### Phase 4: GATE-2 + Should-Haves + impl tests
- [ ] 4.1 [GATE-2 AFTER-diff] Cell-by-cell diff vs `tsurface.cpp`; record
- [ ] 4.2 Should-Haves: `scrollTo`/`panBy`/`onScroll` (+ confirm `from`/`snapshot`)
- [ ] 4.3 Write `surface-geometry.impl`
- [ ] 4.4 Write `surface.impl`
- [ ] 4.5 Write `surface-view.impl`
- [ ] 4.6 Full verification

### Phase 5: Packaging + story + demo
- [ ] 5.1 Write `surface.packaging.spec`; run RED (ui half)
- [ ] 5.2 Add `surface/index.ts` barrel + `src/index.ts` re-exports
- [ ] 5.3 Run — verify GREEN
- [ ] 5.4 Kitchen-sink `surface/surface-view` story (+ smoke)
- [ ] 5.5 `demo:surface` headless walkthrough + script
- [ ] 5.6 `surface-demo.e2e`
- [ ] 5.7 Full verification incl. `check:deps` + `test:e2e`; post-completion re-analysis

---

## Dependencies

```
Phase 1 (GATE-1 decode + surface-geometry.ts pure math)
    ↓
Phase 2 (surface.ts — wraps ScreenBuffer; needs nothing but the decode)
    ↓
Phase 3 (surface-view.ts — needs surface-geometry + Surface)
    ↓
Phase 4 (GATE-2 diff + Should-Haves + impl tests — need the rendered output)
    ↓
Phase 5 (packaging + story + demo — need the public API)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 28 tasks completed
2. ✅ `yarn verify` passing (typecheck + build + test across packages)
3. ✅ `yarn check:deps` clean (zero runtime deps); `yarn test:e2e` green
4. ✅ No dead code; every `src/surface/*` file ≤ 500 lines
5. ✅ **Security hardened** — no surface-mutation path stores an unsanitized control byte (read-only
   `at` + sanitizing `set`/`text`/facade, AC-14); all clip/blit/`at`/`set` indexing bounds-checked/
   clamped for any surface size, any `delta`, null surface, zero-size view (AC-13)
6. ✅ **GATE-1 BEFORE + GATE-2 AFTER** fidelity tasks done and the decode recorded in code/commit (the
   `delta`-clip + blit + margin fill + null surface vs `tsurface.cpp:93-141`; the `resize` memset
   correction)
7. ✅ **0 new core theme roles**; **no existing `@jsvision/core` export changed** (reuses `ScreenBuffer`
   + `windowInactive`); no `dropdown/` edit
8. ✅ Kitchen-sink `surface/surface-view` story passes smoke; `demo:surface` runs headless + e2e
9. ✅ Documentation/roadmap updated (post-completion re-analysis handled by the exec_plan skill)
```
