# Execution Plan: Columns & Layout

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-15 22:39
> **Progress**: 16/57 tasks (28%) — Phase 1–2 ✅
> **CodeOps Skills Version**: 3.7.0

## Overview

The complete RD-07 (AR-1: everything) for `@jsvision/datagrid`, phased **data-plane-first** so
acceptance criteria land incrementally: the pure column model, then the container state + API, then
the frozen-panel refactor, then the two gestures, then frozen-rows + density, then story + showcase +
security. Every phase follows spec-first ordering (spec tests → red → implement → green → impl tests
→ verify). No core/ui change (AR-12).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks | ACs |
| ----- | ----- | ----- | --- |
| 1 | Column model (`column-model.ts`, pure) | 7 | — (data plane) |
| 2 | Container column-state API + per-column min/max | 9 | AC-3, AC-9 |
| 3 | Frozen L/C/R panels + sticky header + shared cursor/scroll | 10 | AC-4, AC-5, AC-6 |
| 4 | Column resize gesture + auto-fit | 9 | AC-1, AC-7 |
| 5 | Column reorder gesture | 7 | AC-2 |
| 6 | Frozen rows + density mode | 8 | (AR-1 extras) |
| 7 | Kitchen-sink story + showcase upgrade + security + hardening | 7 | AC-8, AC-9 |

**Total: 57 tasks across 7 phases.**

> **⚠️ EXECUTION RULE:** the checkboxes below are the single source of truth. Each task appears once.
> On implementation → `[~]` + `(implemented: YYYY-MM-DD HH:MM)`; on verify pass → `[x]` +
> `(completed: …)`. Update the Progress header after every task; only `[x]` counts. Resume by scanning
> top-to-bottom: first `[~]`, else first `[ ]`. Timestamps from `date '+%Y-%m-%d %H:%M'`.

---

## Phase 1: Column model (`column-model.ts`, pure)

**Reference**: `03-01` · `07 §Column model` (ST-1…ST-7) · AR-8/AR-13/AR-4/AR-5

### Step 1.1: Specification tests (red)
- [x] 1.1.1 Write `column-model.spec.test.ts` (ST-1 `visibleOrder`; ST-2/ST-3 `partition`; ST-4/ST-5 `reorderWithinPanel` incl. cross-boundary reject; ST-6 `clampWidth`; ST-7 `overPinnedIds`) — `packages/datagrid/test/column-model.spec.test.ts` ✅ (completed: 2026-07-15 22:28)
- [x] 1.1.2 Verify **red** — no `column-model.ts` yet ✅ (completed: 2026-07-15 22:28)

### Step 1.2: Implement (green)
- [x] 1.2.1 Create `column-model.ts`: `FreezePartition`/`FreezeSpec` types, `DEFAULT_MIN_WIDTH`/`DEFAULT_AUTOFIT_MAX`, and pure `visibleOrder`/`partition`/`reorderWithinPanel`/`clampWidth`/`overPinnedIds` (JSDoc + `@example`) — `packages/datagrid/src/column-model.ts` ✅ (completed: 2026-07-15 22:28)
- [x] 1.2.2 Barrel: export the public types + pure ops + constants — `packages/datagrid/src/index.ts` ✅ (completed: 2026-07-15 22:28)
- [x] 1.2.3 Verify **green** — ST-1…ST-7 pass ✅ (completed: 2026-07-15 22:28)

### Step 1.3: Impl tests & verify
- [x] 1.3.1 Write `column-model.impl.test.ts` (edges: empty order, all-hidden, single-panel partition, reorder no-op same index, clamp min>max, over-pin drops innermost-first) — `packages/datagrid/test/column-model.impl.test.ts` ✅ (completed: 2026-07-15 22:28)
- [x] 1.3.2 Full `yarn verify` ✅ (completed: 2026-07-15 22:28)

**Deliverables**: pure column model green; barrel updated. **Verify**: `yarn verify`

---

## Phase 2: Container column-state API + per-column min/max

**Reference**: `03-04` · `07 §Container API` (ST-8…ST-13) + `§Security` (ST-26) · AR-13/AR-4/AR-9

### Step 2.1: Specification tests (red)
- [x] 2.1.1 Write `grid-layout.spec.test.ts` (ST-8 width clamp/unknown no-op; ST-9 setColumnOrder permutation; ST-10 setColumnVisible + sort-still-works; ST-11 `frozen()`; ST-12 autoFit bound; ST-13 min/max threaded to engine) — `packages/datagrid/test/grid-layout.spec.test.ts` ✅ (completed: 2026-07-15 22:39)
- [x] 2.1.2 Add ST-26 (unknown id in every layout call is ignored, never enters state) to `security.spec.test.ts` ✅ (completed: 2026-07-15 22:39)
- [x] 2.1.3 Verify **red** ✅ (completed: 2026-07-15 22:39)

### Step 2.2: Implement (green)
- [x] 2.2.1 `column.ts`: add `readonly minWidth?`/`maxWidth?` to `GridColumn`; thread both in `toEngineColumn` (ST-13) — `packages/datagrid/src/column.ts` ✅ (completed: 2026-07-15 22:39)
- [x] 2.2.2 `grid.ts`: add `columnOrderSig`/`columnWidths`/`hidden` signals + `freezeSpec`; add `visibleIds`/`partitionSig` derived computeds (incl. `applyOverPin` + `overPinnedIds`) — `packages/datagrid/src/grid.ts` ✅ (completed: 2026-07-15 22:39)
- [x] 2.2.3 `grid.ts`: add the reactive API (`columnOrder`/`setColumnOrder`/`columnWidth`/`setColumnWidth`/`setColumnVisible`/`frozen`/`autoFitColumn`/`autoFitAll`) with unknown-id guards (AC-3, AC-9) — `packages/datagrid/src/grid.ts` ✅ (completed: 2026-07-15 22:39)
- [x] 2.2.4 Barrel + `EditableDataGridOptions` docs: `freezeLeft`/`freezeRight`/`freeze`/`freezeRows`/`density` options + `@example` — `packages/datagrid/src/index.ts`, `grid.ts` ✅ (completed: 2026-07-15 22:39)
- [x] 2.2.5 Verify **green** — ST-8…ST-13, ST-26 pass ✅ (completed: 2026-07-15 22:39)

### Step 2.3: Verify
- [x] 2.3.1 Full `yarn verify` ✅ (completed: 2026-07-15 22:39)

**Deliverables**: reactive column-layout API + per-column min/max; over-pin projection (no UI yet). **Verify**: `yarn verify`

---

## Phase 3: Frozen L/C/R panels + sticky header + shared cursor/scroll

**Reference**: `03-02` · `07 §Frozen panels` (ST-14…ST-19) · AR-5/AR-6/AR-7/AR-9/AR-11/AR-2

### Step 3.1: Specification tests (red)
- [ ] 3.1.1 Write `frozen-panels.spec.test.ts` (ST-14 frozen left panel + no H-shift + divider; ST-15 row highlight spans panels; ST-16 sticky header + panel alignment; ST-17 over-pin clamp + one devWarn; ST-18 linear cross-panel cursor + Ctrl+Home/End; ST-19 no-freeze single-body) — `packages/datagrid/test/frozen-panels.spec.test.ts`
- [ ] 3.1.2 Verify **red**

### Step 3.2: Implement (green)
- [ ] 3.2.1 `editable-grid-rows.ts`: add the panel column-slice seam — inject `columnOffset`/`columnCount` (global range) + `totalCols`; range-limit the cursor paint/`cellRect`/dirty-in-cursor to `[offset, offset+count)` mapping to local indices (H2) — `packages/datagrid/src/editable-grid-rows.ts`
- [ ] 3.2.2 `editable-grid-rows.ts`: rewrite the column-cursor keys to move the **global** `focusedCol` over `[0, totalCols)` (linear cross-panel; `Ctrl+Home`/`End` span the grid) + center auto-scroll of `indent` (AR-2) — `packages/datagrid/src/editable-grid-rows.ts`
- [ ] 3.2.3 `sort-header.ts`: accept a column slice so a per-panel header renders its slice aligned to its panel (AR-11); extend `onFunnelClick` to carry the **clicked header** (or its absolute origin) so a funnel popup anchors on the right panel's header (PF-002) — `packages/datagrid/src/sort-header.ts`
- [ ] 3.2.4 `grid.ts`: `buildBody()` — single-body path when not frozen (AR-5); else 3 panels + 3 headers + freeze dividers, center binds `indent` / frozen bind `signal(0)`, rebuilt in an effect on `partitionSig` — `packages/datagrid/src/grid.ts` (extract `grid-panels.ts` if over the 700-line cap)
- [ ] 3.2.5 `grid.ts`: over-pin guard wired into layout (`applyOverPin` → move to center + de-duped `devWarn`, AR-9); route begin-edit + overlay origin to the panel owning `focusedCol` (H4/AR-10) — `packages/datagrid/src/grid.ts`
- [ ] 3.2.6 Verify **green** — ST-14…ST-19 pass

### Step 3.3: Impl tests & verify
- [ ] 3.3.1 Write `frozen-panels.impl.test.ts` (three panels' `topItem` agree after a vertical scroll — **load-bearing invariant guard, PF-008**; center auto-scroll keeps the focused center col visible; editing a frozen cell mounts over the right panel) — `packages/datagrid/test/frozen-panels.impl.test.ts`
- [ ] 3.3.2 Full `yarn verify`

**Deliverables**: frozen L/C/R panels (AC-4), sticky per-panel headers (AC-5), over-pin guard (AC-6), linear cross-panel cursor (keyboard + mouse, PF-004/005). **PF-010: the new `EditableGridRows`/`SortHeader` seams default so the no-freeze single-body path is byte-identical — every existing datagrid spec oracle stays green.** **Verify**: `yarn verify`

---

## Phase 4: Column resize gesture + auto-fit

**Reference**: `03-03 §Resize/Auto-fit` · `07 §Resize` (ST-20, ST-21) · AR-12/AR-4

### Step 4.1: Specification tests (red)
- [ ] 4.1.1 Write `resize-reorder.spec.test.ts` resize section (ST-20 grip-drag live width + min clamp; ST-21 double-click grip auto-fit) — `packages/datagrid/test/resize-reorder.spec.test.ts`
- [ ] 4.1.2 Verify **red**

### Step 4.2: Implement (green)
- [ ] 4.2.1 `sort-header.ts`: add the hit-zone classifier (grip/title/none) + config `onColumnResize`/`onColumnAutoFit`/`columnOffset` — `packages/datagrid/src/sort-header.ts`
- [ ] 4.2.2 `sort-header.ts`: resize capture gesture — down on grip → `ev.setCapture`, captured drag → `clampWidth`→`onColumnResize` (live), up → `releaseCapture`, with the `!hasCapture` stale-abort guard — `packages/datagrid/src/sort-header.ts`
- [ ] 4.2.3 `sort-header.ts`: double-click grip → `onColumnAutoFit` — `packages/datagrid/src/sort-header.ts`
- [ ] 4.2.4 `grid.ts`: pass `onColumnResize`→`setColumnWidth`, `onColumnAutoFit`→`autoFitColumn` to each header — `packages/datagrid/src/grid.ts`
- [ ] 4.2.5 Verify **green** — ST-20, ST-21 pass (AC-1, AC-7)

### Step 4.3: Impl tests & verify
- [ ] 4.3.1 Write resize impl tests (drag below min stops at min; resizing an `fr`/`auto` column pins it; stale-capture aborts cleanly) — `packages/datagrid/test/resize-reorder.impl.test.ts`
- [ ] 4.3.2 Full `yarn verify`

**Deliverables**: live column resize (AC-1) + auto-fit (AC-7). **Verify**: `yarn verify`

---

## Phase 5: Column reorder gesture

**Reference**: `03-03 §Reorder` · `07 §Reorder` (ST-22, ST-23) · AR-12 / RD-07 AR#22

### Step 5.1: Specification tests (red)
- [ ] 5.1.1 Add the reorder section to `resize-reorder.spec.test.ts` (ST-22 title-drag reorders within panel + plain click still sorts; ST-23 cross-boundary drop rejected)
- [ ] 5.1.2 Verify **red**

### Step 5.2: Implement (green)
- [ ] 5.2.1 `sort-header.ts`: reorder gesture — press-and-drag past threshold → drop indicator at the target slot, panel-constrained; up → `onColumnReorder(fromVisible, toVisible)` (a plain click without drag stays sort/funnel) — `packages/datagrid/src/sort-header.ts`
- [ ] 5.2.2 `grid.ts`: wire `onColumnReorder` → `reorderWithinPanel` (map panel-local via `columnOffset` → global visible order) → `setColumnOrder`; cross-panel drop is a no-op — `packages/datagrid/src/grid.ts`
- [ ] 5.2.3 Verify **green** — ST-22, ST-23 pass (AC-2)

### Step 5.3: Impl tests & verify
- [ ] 5.3.1 Write reorder impl tests (drop onto own slot no-op; drop indicator pins at panel edge when dragged past)
- [ ] 5.3.2 Full `yarn verify`

**Deliverables**: within-panel reorder + drop indicator + cross-boundary reject (AC-2). **Verify**: `yarn verify`

---

## Phase 6: Frozen rows + density mode

**Reference**: `03-05` · `07 §Frozen rows & density` (ST-24, ST-25) · AR-14/AR-15

### Step 6.1: Specification tests (red)
- [ ] 6.1.1 Write `frozen-rows-density.spec.test.ts` (ST-24 `freezeRows:1` pins first row + body window offset + stays on scroll; ST-25 `density:'compact'` drops divider + wider content + aligned both modes) — `packages/datagrid/test/frozen-rows-density.spec.test.ts`
- [ ] 6.1.2 Verify **red**

### Step 6.2: Implement (green)
- [ ] 6.2.1 `grid.ts` + `editable-grid-rows.ts`: `freezeRows?` band — a fixed-height pinned band mirroring the panel split; body virtual window offset by N; clamp + `devWarn` on over-freeze (AR-14) — `packages/datagrid/src/grid.ts`, `packages/datagrid/src/editable-grid-rows.ts`
- [ ] 6.2.2 Density: add the **additive optional divider param** to `apportionColumns` in `@jsvision/ui` (gates both `columns.ts:126` `- numCols` and `:157` `+ 1`; existing callers byte-identical when omitted — AR-17); thread `density?`→`compact` into header + all panels + bands; compact passes `dividers:false` so geometry reserves 0 divider cells and painters skip the `│` (AR-15) — `packages/ui/src/table/columns.ts`, `packages/datagrid/src/grid.ts`, `editable-grid-rows.ts`, `sort-header.ts`
- [ ] 6.2.3 Barrel + options docs for `freezeRows`/`density` + `@example` — `packages/datagrid/src/index.ts`, `grid.ts`
- [ ] 6.2.4 Verify **green** — ST-24, ST-25 pass

### Step 6.3: Impl tests & verify
- [ ] 6.3.1 Write impl tests (frozen-rows × frozen-cols intersection pins both axes; over-freeze rows clamp; compact alignment header↔body) — `packages/datagrid/test/frozen-rows-density.impl.test.ts`
- [ ] 6.3.2 Full `yarn verify`

**Deliverables**: pinned frozen-rows band + compact density mode. **Verify**: `yarn verify`

---

## Phase 7: Kitchen-sink story + showcase upgrade + security + hardening

**Reference**: `07 §Story & showcase` (ST-27…ST-29) · CLAUDE.md §Kitchen-sink + §Documentation · AR-3

### Step 7.1: Kitchen-sink story (smoke)
- [ ] 7.1.1 Add `columns-layout.story.ts` (frozen columns + live resize/reorder + show/hide toggle, with a bound-state echo) + register in `stories/index.ts` — `packages/datagrid/test/kitchen-sink/stories/`
- [ ] 7.1.2 Verify the story passes `kitchen-sink.smoke.spec.test.ts` (ST-28, AC-8)

### Step 7.2: datagrid-showcase upgrade (AR-3)
- [ ] 7.2.1 Replace the RD-07 "coming soon" placeholder (`placeholders.ts:42`) with a live columns-layout demo cluster (frozen panels · resize/reorder · show/hide · frozen rows · density) under `stories/columns-layout/` + register in `stories/index.ts` — `packages/examples/datagrid-showcase/`
- [ ] 7.2.2 Verify the showcase smoke + walkthrough tiers pass (ST-29)

### Step 7.3: Security & hardening (final gate)
- [ ] 7.3.1 Add ST-27 (header/cell text stays sanitized after a reorder + hide) to `security.spec.test.ts`; verify green (AC-9)
- [ ] 7.3.2 JSDoc + `@example` on every new public export; `yarn check:docs` green (no banned refs, `@example` present)
- [ ] 7.3.3 Full `yarn verify` (final gate — no datagrid/examples regressions)

**Deliverables**: `columns-layout` story (AC-8) + showcase upgrade (AR-3); AC-9 security confirmed; full `yarn verify` green. **Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (column model)
    ↓
Phase 2 (container API + per-column min/max)         ← AC-3, AC-9 (state)
    ↓
Phase 3 (frozen panels + sticky header + cursor)     ← AC-4, AC-5, AC-6
    ↓
Phase 4 (resize + auto-fit)  ← AC-1, AC-7
    ↓
Phase 5 (reorder)            ← AC-2
    ↓
Phase 6 (frozen rows + density)  ← AR-1 extras
    ↓
Phase 7 (story + showcase + security + hardening) ← AC-8, AC-9
```

Phases 4 and 5 both extend `SortHeader` gestures and could interleave, but are sequenced (resize
first) to keep each phase's spec suite isolated.

---

## Success Criteria

1. ✅ All 57 tasks complete
2. ✅ `yarn verify` green (lint + typecheck + build + test + check:docs)
3. ✅ No dead code; no core change; the only ui change is AR-17's additive optional divider param on `apportionColumns` (existing callers byte-identical)
4. ✅ Security: unknown ids ignored in every layout call; text sanitized after any layout change (AC-9)
5. ✅ `@example` on every new public export; `check:docs` green
6. ✅ RD-07 AC-1…AC-9 satisfied + the AR-1 extras (frozen rows, density)
7. ✅ Kitchen-sink story + datagrid-showcase cluster green (AC-8, AR-3)
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
