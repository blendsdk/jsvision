# Execution Plan: Footer, Aggregation & Master-Detail

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-17
> **Progress**: 6/47 tasks (13%) — Phase 1 complete ✅
> **CodeOps Skills Version**: 3.8.0
> **Last Task**: 1.3.2 (Phase 1 verify) — 2026-07-17 11:46

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

- [ ] 2.0.1 Extract the self-contained `EditorOverlay` + `PopupCatcher` classes out of `grid.ts` into `overlay.ts` (their natural home); import them back — reclaims ~40 lines — `packages/datagrid/src/overlay.ts`, `packages/datagrid/src/grid.ts`
- [ ] 2.0.2 Extract the module-private `devWarn` from `grid.ts` into a new `dev.ts`; import it in `grid.ts` (and, in Phase 3, `grid-footer.ts`) — `packages/datagrid/src/dev.ts`, `packages/datagrid/src/grid.ts`
- [ ] 2.0.3 Verify GREEN — no behavior change; `grid.ts` line count dropped; RD-01…08 suites pass

### Step 2.1: Spec the readouts

**Reference**: [03-04 §New grid accessors](03-04-master-detail.md) · [02 Gap 2](02-current-state.md) · [07 §F](07-testing-strategy.md) · AR-8/AR-2
**Objective**: Public `displayedRows()`/`focusedRow()`/`focusedKey()` + the optional `complete?()` seam.

- [ ] 2.1.1 Write spec tests for `focusedRow()`/`focusedKey()` cursor-track + re-anchor after sort (ST-19, ST-20) — `packages/datagrid/test/master-detail.spec.test.ts`
- [ ] 2.1.2 Verify RED

### Step 2.2: Implement the readouts + seam

- [ ] 2.2.1 Add `displayedRows()`, `focusedRow()`, `focusedKey()` thin accessors over the private `display`/`focused` — `packages/datagrid/src/grid.ts`
- [ ] 2.2.2 Add optional `complete?(): boolean` to `GridDataSource`; `fromRows` leaves it unset (⇒ complete) — `packages/datagrid/src/data-source.ts`
- [ ] 2.2.3 Verify GREEN — ST-19, ST-20 pass

### Step 2.3: Harden

- [ ] 2.3.1 Impl test — `grid.ts` stays a thin delegator and holds the line-count guard after the Step 2.0 extractions (if the irreducible public surface still crosses it, re-base the guard with rationale per the reconciled AC#11 — never by re-inlining logic); accessors reactive; `complete?()` optional/absent path — `packages/datagrid/test/grid-footer.impl.test.ts`
- [ ] 2.3.2 Phase verify

**Deliverables**: three thin accessors + the honesty predicate seam; `grid.ts < 1200`.
**Verify**: `yarn verify`

---

## Phase 3: Footer band — aggregate row, controller, honesty

### Step 3.1: Spec the footer

**Reference**: [03-02](03-02-footer-band.md) · [07 §A/§D/§E/§G](07-testing-strategy.md) · AR-2/AR-7/AR-9/AR-10/AR-12
**Objective**: The reactive aggregate row, sticky + frozen-aligned, honesty-labelled, validated.

- [ ] 3.1.1 Write spec tests — reactive sum end-to-end + honesty + validation (ST-1…ST-6, ST-17, ST-18, ST-27) — `packages/datagrid/test/grid-footer.spec.test.ts`
- [ ] 3.1.2 Write spec tests — sticky while scrolling + aligned across a freeze split (ST-14, ST-15, ST-16) — `packages/datagrid/test/footer-band.spec.test.ts`
- [ ] 3.1.3 Verify RED

### Step 3.2: Implement the band + controller

- [ ] 3.2.1 Implement the passive `FooterBand` view (per-panel column-aligned aggregate painter; `apportionColumns`+`alignCell`; `widthTick`) — `packages/datagrid/src/footer-band.ts`
- [ ] 3.2.2 Implement the `GridFooter<T>` config interface + the `FooterController<T>` (reactive aggregate `computed`s over `displayedRows()`; `cell(columnId)`; honesty via `complete?()`; `fn`/`columnId` validation + `devWarn`) — `packages/datagrid/src/grid-footer.ts`
- [ ] 3.2.3 Assemble the aggregate row in `buildGridBody` — `segs`-loop `FooterBand` sub-views + `FreezeDivider`s + `corner()`, inserted after `bodyRow` and before the hbar; band-height math — `packages/datagrid/src/grid-panels.ts`
- [ ] 3.2.4 Wire the `footer?` option + `displayedRows` into `_bodyDeps`; confirm `rebuildBody` recreates the footer (thin `grid.ts`) — `packages/datagrid/src/grid.ts`, `packages/datagrid/src/grid-panels.ts`
- [ ] 3.2.5 Verify GREEN — ST-1…ST-6, ST-14…ST-18, ST-27 pass

### Step 3.3: Harden

- [ ] 3.3.1 Impl tests — `grid.ts < 1200`; controller instantiated (not inlined); rebuild recreates the footer; band height with/without widgets — `packages/datagrid/test/grid-footer.impl.test.ts`
- [ ] 3.3.2 Phase verify

**Deliverables**: a sticky, column-aligned, reactive aggregate footer with honesty labelling.
**Verify**: `yarn verify`

---

## Phase 4: Widget slots

### Step 4.1: Spec the widgets

**Reference**: [03-03](03-03-widget-slots.md) · [07 §C](07-testing-strategy.md) · AR-3
**Objective**: The flow widget row + `Button`→`ev.emit` dispatch + reactive read-outs.

- [ ] 4.1.1 Write spec tests — footer `Button({command})` emits through the loop (ST-13); N-of-M + selection `Text` read-outs update reactively (ST-26) — `packages/datagrid/test/grid-footer.spec.test.ts`
- [ ] 4.1.2 Verify RED

### Step 4.2: Implement the widget row

- [ ] 4.2.1 Assemble the widget row (flow `Group` from `footer.widgets`, spanning the band; `spacer()` right-align) in `buildGridBody` — `packages/datagrid/src/grid-panels.ts`
- [ ] 4.2.2 Verify GREEN — ST-13, ST-26 pass

### Step 4.3: Harden

- [ ] 4.3.1 Impl test — widget row present only when `footer.widgets` set; mounted in the dispatch tree (so `ev.emit` is populated); `grid.ts < 1200` holds — `packages/datagrid/test/grid-footer.impl.test.ts`
- [ ] 4.3.2 Phase verify

**Deliverables**: a free-form widget row hosting caller `View`s with working command dispatch.
**Verify**: `yarn verify`

---

## Phase 5: Editable master-detail

### Step 5.1: Spec the reactive source + helper

**Reference**: [03-04](03-04-master-detail.md) · [07 §F](07-testing-strategy.md) · AR-4/AR-8
**Objective**: `fromReactiveRows` (write-through) + `masterDetail` (linked + disposed).

- [ ] 5.1.1 Write spec tests for `fromReactiveRows` — reactive read, write-through insert/remove, omitted-writer read-only (ST-23, ST-24, ST-25) — `packages/datagrid/test/reactive-source.spec.test.ts`
- [ ] 5.1.2 Write spec tests for `masterDetail` — focus-change updates detail rows, `dispose()` stops recompute (ST-21, ST-22) — `packages/datagrid/test/master-detail.spec.test.ts`
- [ ] 5.1.3 Verify RED

### Step 5.2: Implement

- [ ] 5.2.1 Implement `fromReactiveRows(read, {rowKey, insert?, remove?, complete?})` — the write-through twin of `fromRows` — `packages/datagrid/src/data-source.ts`
- [ ] 5.2.2 Implement `masterDetail(master, buildDetail)` — `createRoot` scope, `focused` accessor, ambient `onCleanup` disposal — `packages/datagrid/src/master-detail.ts`
- [ ] 5.2.3 Verify GREEN — ST-21…ST-25 pass

### Step 5.3: Harden

- [ ] 5.3.1 Impl tests — dispose idempotence; no scope leak; empty-master `read()`→`[]` — `packages/datagrid/test/master-detail.impl.test.ts`
- [ ] 5.3.2 Phase verify

**Deliverables**: fully editable master-detail (cell + insert/delete persist into the owned model).
**Verify**: `yarn verify`

---

## Phase 6: Showcase + security + barrel

### Step 6.1: Spec the security oracle

**Reference**: [07 §G](07-testing-strategy.md) · AR-12/AR-14 · CLAUDE.md (kitchen-sink gate)
**Objective**: Sanitize oracle, public barrel, stories, showcase cluster, placeholder re-base.

- [ ] 6.1.1 Write spec test — footer label/widget text with control bytes renders stripped (ST-28) — `packages/datagrid/test/footer-band.spec.test.ts`
- [ ] 6.1.2 Verify RED

### Step 6.2: Publish + demo

- [ ] 6.2.1 Barrel exports — `AggregateFn`/`AggregateSpec`/`foldAggregate`/`formatAggregate`, `GridFooter`/`FooterBand`, `fromReactiveRows`, `masterDetail`, `displayedRows`/`focusedRow`/`focusedKey` types — `packages/datagrid/src/index.ts`
- [ ] 6.2.2 Kitchen-sink story `footer-master-detail.story.ts` (totals footer + editable master-detail) + register — `packages/examples/kitchen-sink/stories/`
- [ ] 6.2.3 datagrid-showcase `footer-master-detail/` cluster (aggregates · widgets · sticky · honesty · master-detail demos + demo helper) + registry — `packages/examples/datagrid-showcase/stories/footer-master-detail/`
- [ ] 6.2.4 Remove the RD-09 placeholder; re-base placeholder-count oracles to RD-10…RD-14 — `packages/examples/datagrid-showcase/stories/placeholders.ts`, `stories/index.ts`, showcase smoke/walkthrough tests
- [ ] 6.2.5 Verify GREEN — ST-28 + kitchen-sink + showcase smoke pass

### Step 6.3: Final hardening

- [ ] 6.3.1 JSDoc `@example` on every new public export; `check-jsdoc` clean; grep for banned CodeOps IDs in touched `src`; confirm sanitize path — `packages/datagrid/src/*`
- [ ] 6.3.2 Full `yarn verify` — turbo green; `grid.ts < 1200`; no RD-01…08 regression

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
