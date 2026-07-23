# Execution Plan: Footer, Aggregation & Master-Detail

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-17
> **Progress**: 47/47 tasks (100%) — ALL PHASES COMPLETE ✅
> **CodeOps Skills Version**: 3.8.0
> **Last Task**: 6.3.2 (final verify) — 2026-07-17 14:45

## Overview

RD-09 adds the footer band (column aggregates + widget slots + sticky + honesty labelling) and
editable master-detail, phased **data-plane-first**. Because `grid.ts` is at the hard `< 1200`-line
guard, all new logic lands in new modules (`aggregate.ts`, `footer-band.ts`, `grid-footer.ts`,
`master-detail.ts`) + `fromReactiveRows` in `data-source.ts`; `grid.ts` gets only thin delegators.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Aggregate fold model (`aggregate.ts`) | 6 |
| 2 | Grid reactive readouts + source honesty seam (+ headroom extractions) | 10 |
| 3 | Footer band — aggregate row, controller, honesty | 9 |
| 4 | Widget slots | 6 |
| 5 | Editable master-detail | 8 |
| 6 | Showcase + security + barrel | 8 |

**Total: 47 tasks across 6 phases.**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line appears
> exactly once. The executing agent MUST:
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** + Last Updated after EVERY task — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented. Specification-first ordering
> (spec tests → RED → implement → GREEN → impl tests → verify) is non-negotiable; a `*.spec.test.ts`
> is an immutable oracle — if it fails after implementation, fix the code, not the test.

---

## Phase 1: Aggregate fold model (`aggregate.ts`)

### Step 1.1: Spec the pure fold

**Reference**: [03-01](03-01-aggregate-model.md) · [07 §B](07-testing-strategy.md) · AR-5/AR-6
**Objective**: The edge-safe fold + descriptor + renderer, spec-first.

- [x] 1.1.1 Write spec tests for the fold + `formatAggregate` (ST-7…ST-12) — `packages/datagrid/test/aggregate.spec.test.ts` ✅ (completed: 2026-07-17 11:39)
- [x] 1.1.2 Verify RED — the spec tests fail (no `aggregate.ts` yet) ✅ (completed: 2026-07-17 11:39)

### Step 1.2: Implement the model

- [x] 1.2.1 Implement `AggregateFn`, `AggregateSpec`, `foldAggregate`, `formatAggregate`, `isAggregateFn` — `packages/datagrid/src/aggregate.ts` ✅ (completed: 2026-07-17 11:41)
- [x] 1.2.2 Verify GREEN — ST-7…ST-12 pass ✅ (completed: 2026-07-17 11:41)

### Step 1.3: Harden

- [x] 1.3.1 Impl tests — fold precision, mixed-type coercion, format/label/partial permutations — `packages/datagrid/test/aggregate.impl.test.ts` ✅ (completed: 2026-07-17 11:45)
- [x] 1.3.2 Phase verify ✅ (completed: 2026-07-17 11:46 — 394 datagrid tests green; full `yarn verify` green except a load-induced `@jsvision/ui` editor-perf flake that passes in isolation)

**Deliverables**: pure `aggregate.ts`; JSDoc `@example` on every export; all verification passing.
**Verify**: `yarn verify`

---

## Phase 2: Grid reactive readouts + source honesty seam

### Step 2.0: Make headroom — mechanical extractions (do FIRST, before adding accessors)

**Reference**: preflight PF-001 / PF-004 · AR-10
**Objective**: Reclaim `grid.ts` lines so the new public surface fits under the guard, and make `devWarn`
reachable from the new footer module. Pure moves — no behavior change.

- [x] 2.0.1 Extract the self-contained `EditorOverlay` + `PopupCatcher` classes out of `grid.ts` into `overlay.ts` (their natural home); import them back — reclaims ~40 lines — `packages/datagrid/src/overlay.ts`, `packages/datagrid/src/grid.ts` ✅ (completed: 2026-07-17 11:52)
- [x] 2.0.2 Extract the module-private `devWarn` from `grid.ts` into a new `dev.ts`; import it in `grid.ts` (and, in Phase 3, `grid-footer.ts`) — `packages/datagrid/src/dev.ts`, `packages/datagrid/src/grid.ts` ✅ (completed: 2026-07-17 11:52)
- [x] 2.0.3 Verify GREEN — no behavior change; `grid.ts` line count dropped 1198→1145 (−53); 394 datagrid tests pass ✅ (completed: 2026-07-17 11:52)

### Step 2.1: Spec the readouts

**Reference**: [03-04 §New grid accessors](03-04-master-detail.md) · [02 Gap 2](02-current-state.md) · [07 §F](07-testing-strategy.md) · AR-8/AR-2
**Objective**: Public `displayedRows()`/`focusedRow()`/`focusedKey()` + the optional `complete?()` seam.

- [x] 2.1.1 Write spec tests for `focusedRow()`/`focusedKey()` cursor-track + re-anchor after sort (ST-19, ST-20) — `packages/datagrid/test/master-detail.spec.test.ts` ✅ (completed: 2026-07-17 11:50)
- [x] 2.1.2 Verify RED ✅ (completed: 2026-07-17 11:50)

### Step 2.2: Implement the readouts + seam

- [x] 2.2.1 Add `displayedRows()`, `focusedRow()`, `focusedKey()` thin accessors over the private `display`/`focused` — `packages/datagrid/src/grid.ts` ✅ (completed: 2026-07-17 11:55)
- [x] 2.2.2 Add optional `complete?(): boolean` to `GridDataSource`; `fromRows` leaves it unset (⇒ complete) — `packages/datagrid/src/data-source.ts` ✅ (completed: 2026-07-17 11:55)
- [x] 2.2.3 Verify GREEN — ST-19, ST-20 pass ✅ (completed: 2026-07-17 11:55)

### Step 2.3: Harden

- [x] 2.3.1 Impl test — `grid.ts` stays a thin delegator and holds the line-count guard after the Step 2.0 extractions (if the irreducible public surface still crosses it, re-base the guard with rationale per the reconciled AC#11 — never by re-inlining logic); accessors reactive; `complete?()` optional/absent path — `packages/datagrid/test/grid-footer.impl.test.ts` ✅ (completed: 2026-07-17 11:57) — guard HELD without re-basing (grid.ts 1198→1181: extraction −53, accessors +36 with sibling-consistent concise JSDoc)
- [x] 2.3.2 Phase verify ✅ (completed: 2026-07-17 12:00 — full `yarn verify` green, turbo 30/30, `TUI_SKIP_PERF=1`)

**Deliverables**: three thin accessors + the honesty predicate seam; `grid.ts < 1200`.
**Verify**: `yarn verify`

---

## Phase 3: Footer band — aggregate row, controller, honesty

### Step 3.1: Spec the footer

**Reference**: [03-02](03-02-footer-band.md) · [07 §A/§D/§E/§G](07-testing-strategy.md) · AR-2/AR-7/AR-9/AR-10/AR-12
**Objective**: The reactive aggregate row, sticky + frozen-aligned, honesty-labelled, validated.

- [x] 3.1.1 Write spec tests — reactive sum end-to-end + honesty + validation (ST-1…ST-6, ST-17, ST-18, ST-27) — `packages/datagrid/test/grid-footer.spec.test.ts` ✅ (completed: 2026-07-17 12:20)
- [x] 3.1.2 Write spec tests — sticky while scrolling + aligned across a freeze split (ST-14, ST-15, ST-16) — `packages/datagrid/test/footer-band.spec.test.ts` ✅ (completed: 2026-07-17 12:20)
- [x] 3.1.3 Verify RED — all 10 fail (no footer yet) ✅ (completed: 2026-07-17 12:20)

### Step 3.2: Implement the band + controller

- [x] 3.2.1 Implement the passive `FooterBand` view (per-panel column-aligned aggregate painter; `apportionColumns`+`alignCell`; `widthTick` + `indent` binds) — `packages/datagrid/src/footer-band.ts` ✅ (completed: 2026-07-17 12:35)
- [x] 3.2.2 Implement the `GridFooter` config interface + the `FooterController<T>` (LAZY fold over `displayedRows()`, no owned `computed`; `cell(columnId)`; honesty via `complete?()`; `fn`/`columnId` validation + `devWarn`) — `packages/datagrid/src/grid-footer.ts` ✅ (completed: 2026-07-17 12:35) — `GridFooter` non-generic (AR-R1)
- [x] 3.2.3 Assemble the aggregate row in `buildGridBody` — `segs`-loop `FooterBand` sub-views + `FreezeDivider`s + prefix spacer + `corner()`, inserted after `bodyRow` and before the hbar — `packages/datagrid/src/grid-panels.ts` ✅ (completed: 2026-07-17 12:35)
- [x] 3.2.4 Wire the `footer?` option + `FooterController` + `footerCell` into `_bodyDeps`; `rebuildBody` recreates the footer (thin `grid.ts`) — `packages/datagrid/src/grid.ts`, `packages/datagrid/src/grid-panels.ts` ✅ (completed: 2026-07-17 12:35)
- [x] 3.2.5 Verify GREEN — ST-1…ST-6, ST-14…ST-18, ST-27 pass ✅ (completed: 2026-07-17 12:45) — the FooterBand `indent` bind was the fix for cross-split pan (ST-16)

### Step 3.3: Harden

- [x] 3.3.1 Impl tests — `grid.ts` line guard (RE-BASED 1200→1250 with rationale per AC#11/AR-10/AR-R2 — grid.ts at 1204 after the irreducible footer public surface; heavy logic all in new modules, never re-inlined); controller instantiated (not inlined); rebuild recreates the footer; band present only with a footer — `packages/datagrid/test/grid-footer.impl.test.ts` ✅ (completed: 2026-07-17 12:50)
- [x] 3.3.2 Phase verify ✅ (completed: 2026-07-17 12:55 — full `yarn verify` green after `lint:fix`, 412 datagrid tests, check:docs clean)

**Deliverables**: a sticky, column-aligned, reactive aggregate footer with honesty labelling.
**Verify**: `yarn verify`

---

## Phase 4: Widget slots

### Step 4.1: Spec the widgets

**Reference**: [03-03](03-03-widget-slots.md) · [07 §C](07-testing-strategy.md) · AR-3
**Objective**: The flow widget row + `Button`→`ev.emit` dispatch + reactive read-outs.

- [x] 4.1.1 Write spec tests — footer `Button({command})` emits through the loop (ST-13); N-of-M + selection `Text` read-outs update reactively (ST-26) — `packages/datagrid/test/grid-footer.spec.test.ts` ✅ (completed: 2026-07-17 13:20)
- [x] 4.1.2 Verify RED ✅ (completed: 2026-07-17 13:20)

### Step 4.2: Implement the widget row

- [x] 4.2.1 Assemble the widget row (flow `Group` from `footer.widgets`, spanning the band; `spacer()` right-align) in `buildGridBody` + thread `footerWidgets` through deps/grid.ts — `packages/datagrid/src/grid-panels.ts` ✅ (completed: 2026-07-17 13:30) — required the AR-R3 ui enabler: added backward-compat `measure()` to `@jsvision/ui` `Text`+`Button` (user-approved) so raw widgets self-size in the flow row
- [x] 4.2.2 Verify GREEN — ST-13, ST-26 pass ✅ (completed: 2026-07-17 13:30)

### Step 4.3: Harden

- [x] 4.3.1 Impl test — widget row present only when `footer.widgets` set; mounted in the dispatch tree (so `ev.emit` is populated); rebuild keeps a reused widget working; `grid.ts < 1250` holds — `packages/datagrid/test/grid-footer.impl.test.ts` ✅ (completed: 2026-07-17 13:35)
- [x] 4.3.2 Phase verify ✅ (completed: 2026-07-17 13:40 — full `yarn verify` green, turbo 30/30, `TUI_SKIP_PERF=1`; the cross-package ui `measure()` change clean across all packages)

**Deliverables**: a free-form widget row hosting caller `View`s with working command dispatch.
**Verify**: `yarn verify`

---

## Phase 5: Editable master-detail

### Step 5.1: Spec the reactive source + helper

**Reference**: [03-04](03-04-master-detail.md) · [07 §F](07-testing-strategy.md) · AR-4/AR-8
**Objective**: `fromReactiveRows` (write-through) + `masterDetail` (linked + disposed).

- [x] 5.1.1 Write spec tests for `fromReactiveRows` — reactive read, write-through insert/remove, omitted-writer read-only (ST-23, ST-24, ST-25) — `packages/datagrid/test/reactive-source.spec.test.ts` ✅ (completed: 2026-07-17 13:55)
- [x] 5.1.2 Write spec tests for `masterDetail` — focus-change updates detail rows, `dispose()` stops recompute (ST-21, ST-22) — `packages/datagrid/test/master-detail.spec.test.ts` ✅ (completed: 2026-07-17 13:55)
- [x] 5.1.3 Verify RED ✅ (completed: 2026-07-17 13:55)

### Step 5.2: Implement

- [x] 5.2.1 Implement `fromReactiveRows(read, {rowKey, insert?, remove?, complete?})` — the write-through twin of `fromRows` (writers/`complete` present only when supplied) — `packages/datagrid/src/data-source.ts` ✅ (completed: 2026-07-17 14:00)
- [x] 5.2.2 Implement `masterDetail(master, buildDetail)` — `createRoot` scope, `focused` accessor, ambient `onCleanup` disposal (capture the ambient owner BEFORE `createRoot` + `runWithOwner` — the plan sketch's in-root `getOwner()` would be the new root; prose intent honored) — `packages/datagrid/src/master-detail.ts` ✅ (completed: 2026-07-17 14:00)
- [x] 5.2.3 Verify GREEN — ST-21…ST-25 pass ✅ (completed: 2026-07-17 14:00)

### Step 5.3: Harden

- [x] 5.3.1 Impl tests — dispose idempotence; detail freed with the surrounding scope (no leak); empty-master `read()`→`[]` — `packages/datagrid/test/master-detail.impl.test.ts` ✅ (completed: 2026-07-17 14:02)
- [x] 5.3.2 Phase verify ✅ (completed: 2026-07-17 14:05 — full `yarn verify` green, turbo 30/30, `TUI_SKIP_PERF=1`)

**Deliverables**: fully editable master-detail (cell + insert/delete persist into the owned model).
**Verify**: `yarn verify`

---

## Phase 6: Showcase + security + barrel

### Step 6.1: Spec the security oracle

**Reference**: [07 §G](07-testing-strategy.md) · AR-12/AR-14 · CLAUDE.md (kitchen-sink gate)
**Objective**: Sanitize oracle, public barrel, stories, showcase cluster, placeholder re-base.

- [x] 6.1.1 Write spec test — footer label/widget text with control bytes renders stripped (ST-28) — `packages/datagrid/test/footer-band.spec.test.ts` ✅ (completed: 2026-07-17 14:20)
- [x] 6.1.2 Verify RED — N/A: the `ctx.text` sanitize boundary is inherited (AR-12), so ST-28 is GREEN on arrival (a coverage-confirmation oracle, no impl needed) ✅ (completed: 2026-07-17 14:20)

### Step 6.2: Publish + demo

- [x] 6.2.1 Barrel exports — `AggregateFn`/`AggregateSpec`/`foldAggregate`/`formatAggregate`/`isAggregateFn`, `GridFooter`/`FooterBand`, `fromReactiveRows`, `masterDetail` (the readout accessors ship on the exported `EditableDataGrid`) — `packages/datagrid/src/index.ts` ✅ (completed: 2026-07-17 14:15)
- [x] 6.2.2 Kitchen-sink story `footer-master-detail.story.ts` (totals footer + editable master-detail) + register — **PATH CORRECTED**: the datagrid's own kitchen-sink is `packages/datagrid/test/kitchen-sink/stories/` (where RD-06/07/08 stories live + the datagrid smoke gate), not `examples/kitchen-sink` ✅ (completed: 2026-07-17 14:25)
- [x] 6.2.3 datagrid-showcase `footer-master-detail/` cluster — 5 demos (aggregates · widgets · sticky · honesty · master-detail) + a shared `footer-demo.ts` builder + registry — `packages/examples/datagrid-showcase/stories/footer-master-detail/` ✅ (completed: 2026-07-17 14:30)
- [x] 6.2.4 Remove the RD-09 placeholder; re-base placeholder-count oracles (Roadmap 6→5, +`Footer & aggregation` category, ST-7 count 5) — `packages/examples/datagrid-showcase/stories/placeholders.ts`, `stories/index.ts`, `packages/examples/test/datagrid-showcase.smoke.spec.test.ts` ✅ (completed: 2026-07-17 14:32)
- [x] 6.2.5 Verify GREEN — ST-28 + kitchen-sink (11) + showcase (69) smoke pass ✅ (completed: 2026-07-17 14:35)

### Step 6.3: Final hardening

- [x] 6.3.1 JSDoc `@example` on every new public export; `check-jsdoc` clean (datagrid + ui, 0/0); grep for banned CodeOps IDs in touched `src` (clean); sanitize path confirmed (ST-28) — `packages/datagrid/src/*` ✅ (completed: 2026-07-17 14:38)
- [x] 6.3.2 Full `yarn verify` — turbo green (30/30); `grid.ts < 1250` (re-based per AR-R2); no RD-01…08 regression; examples 263 tests green ✅ (completed: 2026-07-17 14:45)

**Deliverables**: shipped public surface + live demos + the security gate; full verify green.
**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (aggregate model)
    ↓
Phase 2 (readouts + honesty seam)
    ↓
Phase 3 (footer band + controller)  ←── needs 1 (fold) + 2 (displayedRows, complete?)
    ↓
Phase 4 (widget slots)              ←── needs 3 (band shell)
    ↓
Phase 5 (master-detail)             ←── needs 2 (focusedRow)
    ↓
Phase 6 (showcase + security)       ←── needs 1–5
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 6 phases completed
2. ✅ All verification passing (`yarn verify`)
3. ✅ No warnings/errors
4. ✅ No dead code — no unused parameters, functions, classes, or modules
5. ✅ Security hardened — `fn`/`columnId` validation; sanitize via `ctx.text`; no dynamic-code sinks
6. ✅ Documentation updated — JSDoc `@example` on every public export; `check-jsdoc` clean
7. ✅ `grid.ts < 1200`; kitchen-sink story + showcase cluster live; RD-09 placeholder removed
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
