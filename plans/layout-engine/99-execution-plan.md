# Execution Plan — Layout Engine

> **Implements**: RD-02 · **Plan**: `plans/layout-engine/`
> **CodeOps Skills Version**: 2.0.0

Specification-first ordering is **non-negotiable**: every feature phase runs three sessions —
**(A) Spec Tests → confirm RED → (B) Implementation → confirm GREEN → (C) Impl Tests & Hardening**.
Spec tests derive from RD-02 ACs (the immutable oracles in
[07-testing-strategy.md](07-testing-strategy.md)). Commits reference **/gitcm** (commit) or
**/gitcmp** (commit + push) — never raw git. Commit scope: `layout`. Verify with `yarn verify`;
iterate with `yarn workspace @jsvision/ui test`.

Four phases build the engine on the existing `apportion`/`solveTrack` spike (kept unchanged):
node model + main-axis sizing → cross-axis/justify/align/padding → recursion/overflow/col/degenerate
→ packaging/hardening. Each phase produces files ≤ 500 lines (PA-1 layout) with full JSDoc on
public symbols.

---

## Phase 1 — Node model & main-axis sizing (`types.ts`, `measure.ts`, single-container main solve)

Self-contained on **one axis, one level**: the box model, defaults, intrinsic `auto` sizing,
and the `auto→fixed→solveTrack` main-axis solve with `gap`. Covers AC-1,2,3,4,5,6.

### Session 1A — Spec tests (RED)
- [x] T1.1 — Add `layout.sizing.spec.test.ts` (ST-01…ST-06). Imports from `../src/layout/index.js`. (AC-1–6) <!-- 2026-06-29 -->
- [x] T1.2 — Run `yarn workspace @jsvision/ui test` → confirm the new sizing specs **fail (RED)** (existing apportion/reactive tests stay green). <!-- 2026-06-29 -->

### Session 1B — Implementation (GREEN)
- [x] T1.3 — `types.ts`: `Size2D`, `Rect`, `Padding`, `Size`, `Justify`, `Align`, `LayoutProps`, `LayoutBox`, `LayoutResult` + the defaults normalizer (PA-3) and ≥0 clamps. (03-01) <!-- 2026-06-29 -->
- [x] T1.4 — `measure.ts`: `naturalSize(box, available)` — `measure()` leaf path + derived-from-children container path + `auto`-leaf→0. (AR-21, PA-5) <!-- 2026-06-29 -->
- [x] T1.5 — `layout.ts` (partial): the main-axis sizing helper — map children to `TrackItem` (`auto` pre-resolved), call `solveTrack(contentMain, items, gap)`. Wire a minimal `layout()` that lays out a single container's direct children along the main axis at origin (cross/justify/align stubbed to start/stretch). (03-01, 03-02, PA-5) <!-- 2026-06-29 -->
- [x] T1.6 — Extend the `layout/index.ts` barrel **and** add the new named exports to `src/index.ts:19-20` (layout uses **explicit** named re-exports, not `export *` — new symbols don't flow automatically; see 02-current-state §Patterns). Run tests → Phase-1 sizing specs **GREEN**. <!-- 2026-06-29 -->

### Session 1C — Impl tests & hardening
- [x] T1.7 — `layout.sizing.impl.test.ts` (negative clamps, mixed `fr` weights, nested-`auto` natural size, fractional `measure` clamp). (07 §impl) <!-- 2026-06-29 -->
- [x] T1.8 — `yarn verify` + `check:deps` + `lint` green; no file > 500 lines. **/gitcm** (`feat(layout): node model + main-axis sizing (auto/fr/fixed + gap)`). <!-- 2026-06-29 (verify/check:deps/lint green; types.ts 183 lines max) -->

---

## Phase 2 — Cross-axis, justify, align, padding

Completes a **single container → parent-relative rects**: padding inset, `justify` main-axis
placement, cross-axis sizing + `align`. Covers AC-7, AC-8, AC-9.

### Session 2A — Spec tests (RED)
- [ ] T2.1 — Add `layout.align.spec.test.ts` (ST-07 padding, ST-08 justify, ST-09 align). (AC-7,8,9)
- [ ] T2.2 — Run tests → align specs **RED** (Phase-1 specs stay green).

### Session 2B — Implementation (GREEN)
- [ ] T2.3 — `layout.ts`: padding → content box; `justify` offsets (`start`/`center`/`end`/`space-between` via `apportion` of leftover); cross-axis size + `align` offsets (`stretch` default vs natural via `naturalSize`). Axis-abstracted (main/cross). (03-02, AR-24,25,29)
- [ ] T2.4 — Run tests → **GREEN**.

### Session 2C — Impl tests & hardening
- [ ] T2.5 — `layout.align.impl.test.ts` (`space-between` single child = start, odd-leftover `center` floors, non-stretch cross clamp, uniform vs per-side padding). (07 §impl)
- [ ] T2.6 — `yarn verify` + `lint` green. **/gitcm** (`feat(layout): justify, cross-axis align, padding`).

---

## Phase 3 — Recursion, overflow, `col`, degenerate

Makes the pass **recursive** over the tree, mirrors `row`/`col` via the axis abstraction, and
nails the edges. Covers AC-10,11,12,13,14,15.

### Session 3A — Spec tests (RED)
- [ ] T3.1 — Add `layout.tree.spec.test.ts` (ST-10 nesting, ST-11 parent-relative, ST-12 overflow, ST-13 degenerate, ST-14 `col`, ST-15 integer/non-negative). (AC-10–15)
- [ ] T3.2 — Run tests → tree specs **RED**.

### Session 3B — Implementation (GREEN)
- [ ] T3.3 — `layout.ts`: recurse into each child with its computed rect, building the full `LayoutResult` map (one entry per box); confirm `col` works through the axis map; overflow (fixed/auto extend past edge, `fr`→0); degenerate viewport → zero rects; integer/≥0 invariants. Split pure helpers into `layout-axis.ts` if approaching 500 lines (PA-1). (03-02, AR-22,27,28)
- [ ] T3.4 — Run tests → **GREEN**.

### Session 3C — Impl tests & hardening
- [ ] T3.5 — `layout.tree.impl.test.ts` (leaf container no child entries, deep-nesting offset composition, one map entry per box, nested overflow scoped to inner content box). (07 §impl)
- [ ] T3.6 — `yarn verify` + `lint` green; `layout.ts` ≤ 500 lines. **/gitcm** (`feat(layout): recursive pass + overflow + col + degenerate`).

---

## Phase 4 — Packaging, purity & final gate

Validates the assembled public surface and the cross-cutting guarantees. Covers AC-16,17,18.

### Session 4A — Spec + verification
- [ ] T4.1 — `layout.packaging.spec.test.ts` (ST-16 purity/no-mutation/repeatable; ST-17 all symbols+types import from `@jsvision/ui` + `check:deps`; ST-18 security: degenerate→zero rects not throw, bounded finite traversal). (AC-16,17,18)
- [ ] T4.2 — Confirm `layout`, `LayoutBox`, `LayoutProps`, `Size`, `Rect` (+ unchanged `apportion`/`solveTrack`/`TrackItem`) are listed in **both** `layout/index.ts` and the explicit named re-exports at `src/index.ts:19-20` (layout is not `export *`); JSDoc on every public symbol.
- [ ] T4.3 — `yarn workspace @jsvision/ui check:deps` passes (no native/third-party deps).

### Session 4B — Final gate
- [ ] T4.4 — Full `yarn verify` (typecheck + build + tests, all packages) green; `yarn lint` clean; no dead code; no file > 500 lines.
- [ ] T4.5 — Update `plans/00-roadmap.md` RD-02 row → stage `Done` (roadmap skill). **/gitcmp** (`feat(layout): packaging + acceptance gate — RD-02 complete`).

---

## Master Progress Checklist

**Phase 1 — Node model & main-axis sizing**
- [x] 1A Spec (RED): T1.1–T1.2
- [x] 1B Impl (GREEN): T1.3–T1.6
- [x] 1C Impl tests & harden: T1.7–T1.8 ✅ commit

**Phase 2 — Cross-axis, justify, align, padding**
- [ ] 2A Spec (RED): T2.1–T2.2
- [ ] 2B Impl (GREEN): T2.3–T2.4
- [ ] 2C Impl tests & harden: T2.5–T2.6 ✅ commit

**Phase 3 — Recursion, overflow, col, degenerate**
- [ ] 3A Spec (RED): T3.1–T3.2
- [ ] 3B Impl (GREEN): T3.3–T3.4
- [ ] 3C Impl tests & harden: T3.5–T3.6 ✅ commit

**Phase 4 — Packaging & final gate**
- [ ] 4A Spec + verification: T4.1–T4.3
- [ ] 4B Final gate: T4.4–T4.5 ✅ commit + push

## Estimates

| Phase | Sessions | Est. |
|-------|----------|------|
| 1 — Node model & main-axis sizing | 3 | 5–7 h |
| 2 — Cross-axis, justify, align, padding | 3 | 4–6 h |
| 3 — Recursion, overflow, col, degenerate | 3 | 4–6 h |
| 4 — Packaging & gate | 2 | 2–3 h |
| **Total** | **11** | **15–22 h** |

## Done = all of

18 spec tests (ST-01…ST-18) green · impl tests green · `yarn verify` green · `check:deps`
passes · `yarn lint` clean · `layout`/`LayoutBox`/`LayoutProps`/`Size`/`Rect` importable from
`@jsvision/ui` · every `layout/` file ≤ 500 lines with JSDoc · roadmap synced.
