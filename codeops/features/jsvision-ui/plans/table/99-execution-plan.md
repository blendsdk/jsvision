# Execution Plan: Table / DataGrid

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-03 09:53
> **Progress**: 28/28 tasks (100%) — COMPLETE ✅
> **CodeOps Skills Version**: 3.1.0

## Overview

Implement RD-16's `DataGrid<T>` in four phases, foundation-first: the additive core theme role → the pure
columns module → the TV-derived DataGrid + GridRows renderer (with the GATE-1/GATE-2 fidelity tasks) →
packaging + the kitchen-sink story + `demo:table`. Every feature phase follows the mandatory spec-first
ordering (spec tests → red → implement → green → impl tests → verify).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
| ----- | ----- | -------- | --------- |
| 1 | Core theme role (`tableHeader`) | 1 | 30 min |
| 2 | Columns module (`columns.ts`) | 1 | 90 min |
| 3 | DataGrid + GridRows renderer (TV-derived) | 2 | 3–4 h |
| 4 | Packaging + kitchen-sink story + `demo:table` | 1 | 90 min |

**Total: ~5 sessions, ~6–7 hours**

---

## Phase 1: Core theme role (`tableHeader`)

### Session 1.1: The additive header role (compressed — data-only role)

**Reference**: [03-03-theme-packaging.md §1](03-03-theme-packaging.md) · AR-172
**Objective**: Add the one new `tableHeader` role, spec-first.

| # | Task | File |
|---|------|------|
| 1.1.1 | Write spec test ST-20 (`tableHeader` = `{white, cyan}`; `encode` no-throw; `list*` bytes unchanged) | `packages/ui/test/table-theme.spec.test.ts` |
| 1.1.2 | Run — verify it FAILS (red) | — |
| 1.1.3 | Add `tableHeader` to `Theme` interface + `defaultTheme` (`0x3F`), with the AR-172 extension JSDoc | `packages/core/src/engine/color/theme.ts` |
| 1.1.4 | Run — verify ST-20 PASSES (green); `yarn verify` | — |

**Deliverables**: [x] `tableHeader` role live · [x] ST-20 green · [x] verify passing

**Verify**: `yarn verify`

---

## Phase 2: Columns module (`columns.ts`)

### Session 2.1: Spec tests (BEFORE implementation)

**Reference**: [03-02-columns.md](03-02-columns.md) · AR-153, AR-158, AR-173, AR-179

| # | Task | File |
|---|------|------|
| 2.1.1 | Write spec tests ST-4, ST-5, ST-9, ST-10, ST-11 as unit tests over `measureAutoWidths`/`apportionColumns`/`alignCell`/`sortRows` (from 07-testing-strategy ST-cases; **do not read impl**) | `packages/ui/test/grid-columns.spec.test.ts` |
| 2.1.2 | Run — verify they FAIL (red) | — |

### Session 2.2: Implementation

| # | Task | File |
|---|------|------|
| 2.2.1 | Implement `Column<T>`/`ColumnWidth`/`ColumnGeometry` types + `measureAutoWidths` (O(rows) `auto` pre-measure over all rows, `maxWidth` cap) + `apportionColumns` (O(cols) divider reservation, `solveTrack`, min/max clamp fixpoint), `alignCell` (width-aware `glyphWidth` clip), `sortRows` (`{col,dir}` + `compare`/locale default) per 03-02 | `packages/ui/src/table/columns.ts` |
| 2.2.2 | Run — verify ST-4/5/9/10/11 PASS (green); if a spec fails, fix the code not the test | — |

### Session 2.3: Implementation tests & hardening

| # | Task | File |
|---|------|------|
| 2.3.1 | Write impl tests: min/max fixpoint, wide-glyph clip/align, fractional fr, zero-col/zero-row, `auto` fallback-to-title | `packages/ui/test/grid-columns.impl.test.ts` |
| 2.3.2 | `yarn verify` | — |

**Deliverables**: [x] `columns.ts` complete + pure · [x] all grid-columns tests green · [x] verify passing

**Verify**: `yarn verify`

---

## Phase 3: DataGrid + GridRows renderer (TV-derived — GATE 1 & 2 REQUIRED)

### Session 3.1: TV GATE-1 decode + spec tests (BEFORE implementation)

**Reference**: [03-01-data-grid.md](03-01-data-grid.md) · AR-155, AR-159, AR-172, AR-174, AR-177, AR-179, AR-182

| # | Task | File |
|---|------|------|
| 3.1.1 | **BEFORE-decode (GATE 1)** — re-open `source/tvision/tlstview.cpp`; decode `draw` (row colours, `indent`, `\xB3` divider `:130`, `emptyText`), `handleEvent` (Space-select `:282`, paging `numCols≡1`, Ctrl+PgUp/Dn), the `getColor` chain; record `file:line` facts to be pasted into the renderer JSDoc | (decode notes → 03-01 already; confirm current) |
| 3.1.2 | Write spec tests ST-1…ST-19, ST-22, ST-23 (draw/nav/sort/H-scroll/select/empty/zebra/security; assert buffer pre-`serialize`) | `packages/ui/test/datagrid.spec.test.ts` |
| 3.1.3 | Run — verify they FAIL (red) | — |

### Session 3.2: Implementation

| # | Task | File |
|---|------|------|
| 3.2.1 | Implement `GridRows<T>` + `GridHeader<T>` (virtual-scroll multi-column draw, per-column divider, H-`indent`, sticky header + `▲`/`▼` indicator, zebra priority, nav/mouse/select per AR-177/AR-182), citing the GATE-1 `file:line` facts in JSDoc | `packages/ui/src/table/grid-rows.ts` |
| 3.2.2 | Implement `DataGrid<T>` Group (compose `topRow[header fr\|corner 1] / body[rows fr\|vbar 1] / botRow[hbar fr\|corner 1]` so header/rows/hbar share width `W−1`, PF-101; wire `focused↔vbar`, `indent↔hbar`, shared `display` + `autoWidths` computeds; `sortBy`) | `packages/ui/src/table/data-grid.ts` |
| 3.2.3 | Run — verify ST-1…ST-23 (Phase-3 subset) PASS (green); fix code not tests | — |

### Session 3.3: TV GATE-2 diff + impl tests & hardening

| # | Task | File |
|---|------|------|
| 3.3.1 | **AFTER-diff (GATE 2)** — re-open `tlstview.cpp`; diff rendered output cell-by-cell (glyphs, column math, divider column, resolved colours); record the decode in the code/commit; fix any drift against the source | `grid-rows.ts` (JSDoc + fixes) |
| 3.3.2 | Write impl tests: indent clamp, clamp-on-shrink, header/row divider alignment, zebra+focus, click-below-last-row, Ctrl+PgUp/Dn | `packages/ui/test/datagrid.impl.test.ts` |
| 3.3.3 | `yarn verify` (confirm `grid-rows.ts` ≤ 500 lines; split `GridHeader`→`grid-header.ts` if over) | — |

**Deliverables**: [x] DataGrid + GridRows complete · [x] GATE-2 diff recorded · [x] all datagrid tests green · [x] files ≤ 500 lines · [x] verify passing

**Verify**: `yarn verify`

---

## Phase 4: Packaging + kitchen-sink story + `demo:table`

### Session 4.1: Spec tests (BEFORE implementation)

**Reference**: [03-03-theme-packaging.md §2–3](03-03-theme-packaging.md) · AR-161, AR-178

| # | Task | File |
|---|------|------|
| 4.1.1 | Write packaging spec ST-21 (`DataGrid`/`Column` import from `@jsvision/ui`; `table/` files ≤ 500 lines; `check:deps` clean) | `packages/ui/test/table.packaging.spec.test.ts` |
| 4.1.2 | Extend the kitchen-sink smoke with ST-24 (the `data-grid` story mounts + paints) | `packages/examples/test/kitchen-sink.smoke.spec.test.ts` |
| 4.1.3 | Run — verify they FAIL (red) | — |

### Session 4.2: Implementation

| # | Task | File |
|---|------|------|
| 4.2.1 | Add `table/index.ts` barrel + explicit named re-exports (`DataGrid` + types) | `packages/ui/src/table/index.ts`, `packages/ui/src/index.ts` |
| 4.2.2 | Add the `data-grid` story (typed grid: mixed fixed/fr/auto, a sortable numeric col, zebra, focused/selection echo) + register it | `packages/examples/kitchen-sink/stories/data-grid.story.ts`, `.../stories/index.ts` |
| 4.2.3 | Add `table-demo/` headless walkthrough (render → navigate → sort → H-scroll, one ASCII frame/step) + `demo:table` script | `packages/examples/table-demo/`, `packages/examples/package.json` |
| 4.2.4 | Run — verify ST-21, ST-24 PASS (green) | — |

### Session 4.3: E2E & full verification

| # | Task | File |
|---|------|------|
| 4.3.1 | Write `table-demo.e2e` (the walkthrough runs) | `packages/examples/test/table-demo.e2e.test.ts` |
| 4.3.2 | Full `yarn verify` + `yarn test:e2e` + `yarn check:deps`; confirm no regressions | — |

**Deliverables**: [x] re-exports live · [x] story + smoke green · [x] `demo:table` + e2e green · [x] full verify passing

**Verify**: `yarn verify && yarn test:e2e && yarn check:deps`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** mark each task `[x]` with a timestamp immediately on completion; update the
> Progress header after every task; never batch. Spec-first ordering is non-negotiable.

### Phase 1: Core theme role
- [x] 1.1.1 Spec test ST-20 (`tableHeader`) — 2026-07-03
- [x] 1.1.2 Verify red — 2026-07-03
- [x] 1.1.3 Implement `tableHeader` role (`0x3F`, AR-172) — 2026-07-03
- [x] 1.1.4 Verify green + `yarn verify` — 2026-07-03

### Phase 2: Columns module
- [x] 2.1.1 Spec tests ST-4/5/9/10/11 (`grid-columns.spec`) — 2026-07-03
- [x] 2.1.2 Verify red — 2026-07-03
- [x] 2.2.1 Implement `columns.ts` (measureAutoWidths/apportionColumns/alignCell/sortRows) — 2026-07-03
- [x] 2.2.2 Verify green — 2026-07-03
- [x] 2.3.1 Impl tests (`grid-columns.impl`) — 2026-07-03
- [x] 2.3.2 `yarn verify` — 2026-07-03

### Phase 3: DataGrid + GridRows (TV-derived)
- [x] 3.1.1 **GATE-1 BEFORE-decode** (`tlstview.cpp`) — 2026-07-03
- [x] 3.1.2 Spec tests ST-1…19/22/23 (`datagrid.spec`) — 2026-07-03
- [x] 3.1.3 Verify red — 2026-07-03
- [x] 3.2.1 Implement `grid-rows.ts` (GridRows + GridHeader) — 2026-07-03
- [x] 3.2.2 Implement `data-grid.ts` (DataGrid Group + sortBy) — 2026-07-03
- [x] 3.2.3 Verify green — 2026-07-03
- [x] 3.3.1 **GATE-2 AFTER-diff** (record decode; fix drift) — 2026-07-03
- [x] 3.3.2 Impl tests (`datagrid.impl`) — 2026-07-03
- [x] 3.3.3 `yarn verify` (files ≤ 500 lines: grid-rows 443) — 2026-07-03

### Phase 4: Packaging + story + demo
- [x] 4.1.1 Packaging spec ST-21 (`table.packaging.spec`) — 2026-07-03
- [x] 4.1.2 Smoke ST-24 (`kitchen-sink.smoke`) — 2026-07-03
- [x] 4.1.3 Verify red — 2026-07-03
- [x] 4.2.1 Barrel + re-exports — 2026-07-03
- [x] 4.2.2 `data-grid` story + register — 2026-07-03
- [x] 4.2.3 `table-demo/` + `demo:table` script — 2026-07-03
- [x] 4.2.4 Verify green — 2026-07-03
- [x] 4.3.1 `table-demo.e2e` — 2026-07-03
- [x] 4.3.2 Full verify + e2e + check:deps — 2026-07-03

---

## Dependencies

```
Phase 1 (theme role)
    ↓
Phase 2 (columns.ts)  ──┐
    ↓                   │
Phase 3 (DataGrid + GridRows)   ← needs Phase 1 role + Phase 2 columns
    ↓
Phase 4 (packaging + story + demo)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ `yarn verify` + `yarn test:e2e` + `yarn check:deps` passing
3. ✅ No warnings/errors
4. ✅ No dead code — no unused params/functions/modules
5. ✅ Security hardened — every cell/title sanitized; row/window/indent bounds-checked; cells width-clipped
6. ✅ TV fidelity: GATE-1 decode + GATE-2 diff recorded in the code/commit (row spine matches `TListViewer`)
7. ✅ Kitchen-sink `data-grid` story + `demo:table` present and green
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
