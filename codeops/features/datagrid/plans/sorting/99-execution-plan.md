# Execution Plan: Sorting

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-15 12:37
> **Progress**: 16/30 tasks (53%) — Phases 1–2 complete
> **CodeOps Skills Version**: 3.7.0

## Overview

Implement RD-05 in four spec-first phases: (1) the core `MouseEvent`-modifier prerequisite that unblocks
`Ctrl`+click (AR #16); (2) the pure sort model `sort.ts` + the `GridColumn` `compare?`/`nulls?` additions;
(3) the from-scratch `SortHeader` and the container wiring that unwinds the sort suppression and adds the
`Signal<SortKey[]>` source of truth, push-down effect, cursor re-anchor, and the sort API; (4) security +
the kitchen-sink story. The ui engine sort path is neither touched nor used (AR #1); the only foundation
change is Phase 1's additive optional mouse modifiers.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Core `MouseEvent` modifiers (prerequisite) | 6 |
| 2 | Sort model (`sort.ts` + `GridColumn` fields) | 9 |
| 3 | `SortHeader` + container wiring | 10 |
| 4 | Security + kitchen-sink story | 5 |

**Total: 30 tasks across 4 phases** (scope bounded by the task-size criteria, not hour estimates)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** + Last Updated after EVERY task — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps from `date '+%Y-%m-%d %H:%M'` — never invented. Spec-first ordering
> (`spec → red → implement → green → impl tests → verify`) is non-negotiable; a `*.spec.test.ts` is an
> immutable oracle (fix the code, never the test). The immutable-oracle rule binds subagent executors
> too — a failing spec test is a blocker to report, never a test to edit.

---

## Phase 1: Core `MouseEvent` modifiers (prerequisite)

### Step 1.1: Specification tests (RED)

**Reference**: `03-02 §Phase 1` · `07` (ST-1, ST-2) · AR #16
**Objective**: Pin that a Ctrl-held mouse-down decodes with `ctrl: true` before touching the decoder.

- [x] 1.1.1 Write `mouse-modifiers.spec.test.ts` (ST-1, ST-2): an SGR mouse-down with the Ctrl bit → `ctrl: true`; a plain mouse-down → `ctrl`/`alt`/`shift` falsy — `packages/core/test/mouse-modifiers.spec.test.ts` (or fold into the existing mouse-decode spec) ✅ (completed: 2026-07-15 11:28)
- [x] 1.1.2 Verify RED — the modifier assertions fail (fields not emitted yet) ✅ (completed: 2026-07-15 11:28)

### Step 1.2: Implementation (GREEN)

**Reference**: `03-02 §Phase 1` · AR #16
**Objective**: Expose optional modifiers on `MouseEvent`, populated by the decoder.

- [x] 1.2.1 Add optional `ctrl?`/`alt?`/`shift?: boolean` to `MouseEvent` — `packages/core/src/engine/input/events.ts` ✅ (completed: 2026-07-15 11:29)
- [x] 1.2.2 Populate them in `buildEvent`'s mouse branch from `CTRL_BIT`/`ALT_BIT`/`SHIFT_BIT` (already parsed for wheel) — `packages/core/src/engine/input/mouse.ts`; add a minor additive line to `CHANGELOG.md`. (Note: `safety/redact.ts` was reviewed and is intentionally left unchanged — it is a log-only helper off the dispatch path; see `03-02 §Phase 1`.) ✅ (completed: 2026-07-15 11:29 — core CHANGELOG `[Unreleased]` added)
- [x] 1.2.3 Verify GREEN — ST-1, ST-2 pass ✅ (completed: 2026-07-15 11:29)

### Step 1.3: Implementation tests & hardening

**Reference**: `07 §Implementation Tests`
**Objective**: Cover the other modifiers/kinds and confirm zero ripple.

- [x] 1.3.1 Write impl coverage: Alt/Shift bits set; `up`/`drag` kinds also carry the flags — `packages/core/test/mouse-modifiers.impl.test.ts` ✅ (completed: 2026-07-15 11:41) — also added a bare-`move` case
- [x] 1.3.2 Verify (full) — `yarn verify`; the ~109 existing `type:'mouse'` literals still compile (optional fields), core/ui/files/examples suites green ✅ (completed: 2026-07-15 11:41) — surfaced AR #17 (runtime): the `input-corpus` `mouse.json` golden fixture asserts decoder output with `toStrictEqual`; updated its 8 records to carry the new flags (matching `wheel.json`). Full `yarn verify` green (26/26).

**Deliverables**:
- [x] Optional mouse modifiers on core `MouseEvent`, decoder-populated, backward-compatible ✅
- [x] All verification passing ✅

**Verify**: `yarn verify`

---

## Phase 2: Sort model (`sort.ts` + `GridColumn` fields)

### Step 2.1: Specification tests (RED)

**Reference**: `03-01` · `07` (ST-3 … ST-12) · AR #2, #6, #11, #13, #14
**Objective**: Pin the multi-key comparator contract before any code exists.

- [x] 2.1.1 Write `sort.spec.test.ts` covering ST-3 … ST-12 (numeric value order, multi-key + tie fall-through, stability, case-insensitive strings, custom `compare`, `nulls` first/last absolute-of-dir, unknown-id drop, empty-key source order + non-mutation, desc) — `packages/datagrid/test/sort.spec.test.ts` ✅ (completed: 2026-07-15 12:35)
- [x] 2.1.2 Verify RED — fails (no `sort.ts`/`sortRowsMulti` yet) ✅ (completed: 2026-07-15 12:35)

### Step 2.2: Implementation (GREEN)

**Reference**: `03-01 §Implementation Details` · AR #2, #11, #13, #14
**Objective**: The pure sort model.

- [x] 2.2.1 Create `sort.ts`: `SortDir`, `SortKey` (moved here), a memoized case-insensitive `Intl.Collator`, `compareValues`, `compareOneKey` (nulls absolute-of-dir), and `sortRowsMulti` (unknown-id drop, stable, non-mutating) — `packages/datagrid/src/sort.ts` ✅ (completed: 2026-07-15 12:37)
- [x] 2.2.2 Re-home `SortKey`: `data-source.ts` imports `SortKey` from `./sort.js` and drops its local declaration (`setSort` signature unchanged) — `packages/datagrid/src/data-source.ts` ✅ (completed: 2026-07-15 12:37)
- [x] 2.2.3 Add `compare?(a: V, b: V): number` + `nulls?: 'first' | 'last'` to `GridColumn` (leave `defaultCompare`/`toEngineColumn` untouched) — `packages/datagrid/src/column.ts` ✅ (completed: 2026-07-15 12:37)
- [x] 2.2.4 Barrel: export `SortDir` + `sortRowsMulti` (with `@example`), and re-point `SortKey`'s export to `sort.ts` (same name/shape) — `packages/datagrid/src/index.ts` ✅ (completed: 2026-07-15 12:37)
- [x] 2.2.5 Verify GREEN — ST-3 … ST-12 pass; `import type { SortKey } from '@jsvision/datagrid'` still resolves (plan AC-2) ✅ (completed: 2026-07-15 12:37 — typecheck green across the barrel re-point)

### Step 2.3: Implementation tests & hardening

**Reference**: `07 §Implementation Tests`
**Objective**: Edge coverage for the comparator.

- [x] 2.3.1 Write `sort.impl.test.ts` — Date ordering, mixed/other-type stringify, empty/single-row, all-null column, `compare`+`nulls` interaction, ≥3 keys, non-mutation guard — `packages/datagrid/test/sort.impl.test.ts` ✅ (completed: 2026-07-15 12:37)
- [x] 2.3.2 Verify (full) — `yarn verify` ✅ (completed: 2026-07-15 12:37 — 170 datagrid tests, full verify 26/26 green)

**Deliverables**:
- [x] `sortRowsMulti` + one shared comparator (case-insensitive strings, `compare`/`nulls` honored) ✅
- [x] `SortKey` re-homed with an unchanged public shape/export; `GridColumn.compare?`/`nulls?` added ✅
- [x] All verification passing ✅

**Verify**: `yarn verify`

---

## Phase 3: `SortHeader` + container wiring

### Step 3.1: Specification tests (RED)

**Reference**: `03-02` · `07` (ST-13 … ST-20) · AR #1, #3, #5, #6, #7, #14, #16
**Objective**: Pin header render + click machine + wiring + re-anchor + readout + the safe unwind.

- [ ] 3.1.1 Write `sort-header.spec.test.ts` covering ST-13 … ST-20 (click sorts + `▲`; Ctrl+click adds key 2 + `1`/`2`; plain-click resets from multi; push-down spy vs client `sortRowsMulti`; tri-state asc→desc→none; cursor re-anchor by row-key; `grid.sort()` readout; empty sort ⇒ no indicator + source order) — `packages/datagrid/test/sort-header.spec.test.ts`. (Mouse events are new to the datagrid suite — use the two seams in `07 §Test-seam note`: barrel-exported `SortHeader` + synthetic `DispatchEvent` for unit-level; `loop.dispatch({type:'mouse',kind:'down',x,y:0,…})` for container-level.)
- [ ] 3.1.2 Verify RED — fails (header suppressed, no sort API yet)

### Step 3.2: Implementation (GREEN)

**Reference**: `03-02 §Implementation Details` · AR #1, #3, #5, #6, #7, #10, #14
**Objective**: Own the header + unwind the suppression + wire the model.

- [ ] 3.2.1 Create `sort-header.ts`: `SortHeader` View + `SortHeaderConfig` — self-contained `draw()` (arrows + priority digits, indicator-cell reservation per AR #10, shared `apportionColumns`/`alignCell`/`stringWidth`), `onEvent()` columnId hit-test (`columnAtX`), reads `inner.ctrl` — `packages/datagrid/src/sort-header.ts`
- [ ] 3.2.2 `grid.ts`: remove `ReadonlyGridHeader`, the `signal<SortState>(null)`, and the `SortState`/`GridHeader` imports; **promote `source`, `display`, and the new `columnMap` from constructor locals to instance fields** (so the sort API methods in 3.2.4 can read them — `applySort`/`sortBy`/`addSort` are class methods); route `display` through `sortRowsMulti` (client) / passthrough when `source.setSort` (push-down) — `packages/datagrid/src/grid.ts`
- [ ] 3.2.3 `grid.ts`: mount `SortHeader` (onHeaderClick → `sortBy`/`addSort`); register the guarded push-down `bind` effect (`if (source.setSort)` → `setSort(keys)`, in `onMount`) — `packages/datagrid/src/grid.ts`
- [ ] 3.2.4 `grid.ts`: the sort API `sortBy`/`addSort`/`clearSort`/`sort` + `applySort` (row-key cursor/selection re-anchor on the client path) + the tri-state cycle helpers + unknown-id guard — `packages/datagrid/src/grid.ts`
- [ ] 3.2.5 Update the `EditableDataGrid` class JSDoc (drop "suppressed"/"source order"); barrel-export `SortHeader` + `SortHeaderConfig` with `@example` — `packages/datagrid/src/grid.ts`, `packages/datagrid/src/index.ts`
- [ ] 3.2.6 Verify GREEN — ST-13 … ST-20 pass

### Step 3.3: Implementation tests & hardening

**Reference**: `07 §Implementation Tests`
**Objective**: Header/geometry edges + click-machine corners.

- [ ] 3.3.1 Write `sort-header.impl.test.ts` — narrow-column indicator clamp (`w<reserve`), digit for key ≥3, indented/H-scrolled hit-test, click on divider/empty area (no-op), Ctrl+click toggles an existing key's dir, header repaints on `sortKeys` change — `packages/datagrid/test/sort-header.impl.test.ts`
- [ ] 3.3.2 Verify (full) — `yarn verify`; no regression in the RD-01…RD-04 datagrid suites

**Deliverables**:
- [ ] `SortHeader` renders single/multi indicators; the click machine (AR #5) drives the container signal
- [ ] Container owns `Signal<SortKey[]>`; client `sortRowsMulti` / guarded push-down; row-key re-anchor; the sort API
- [ ] ui engine sort path untouched and unused (plan AC-1); no ui source change
- [ ] All verification passing

**Verify**: `yarn verify`

---

## Phase 4: Security + kitchen-sink story

### Step 4.1: Specification tests (RED)

**Reference**: `07 §Security` (ST-21) · RD AC-9 · AR #14
**Objective**: Prove an unknown `columnId` is never forwarded to a source query.

- [ ] 4.1.1 Add ST-21 to `security.spec.test.ts`: `grid.sortBy('nope')` is a no-op; a keys list with an unknown id never reaches the spy `setSort` — `packages/datagrid/test/security.spec.test.ts`
- [ ] 4.1.2 Verify — the unknown-id guard holds on both the API and the push-down path

### Step 4.2: Implementation (kitchen-sink story)

**Reference**: `07 §Kitchen-sink` (ST-22) · RD AC-8 · CLAUDE.md kitchen-sink gate
**Objective**: The showcase story.

- [ ] 4.2.1 Add the `sorting` story (multi-column value-aware sort — numeric + string + nullable columns — with a live `grid.sort()` echo and interaction hints) and register it — `packages/datagrid/test/kitchen-sink/stories/sorting.story.ts`, `.../stories/index.ts`
- [ ] 4.2.2 Verify GREEN — the smoke test (ST-22) passes for the new story

### Step 4.3: Hardening

**Reference**: `01 §Acceptance Criteria`
**Objective**: Full green, no regressions.

- [ ] 4.3.1 Full `yarn verify`; confirm no regressions in the RD-01…RD-04 datagrid suites and the core/ui/files/examples suites; `check:docs` green — verify only

**Deliverables**:
- [ ] Unknown-`columnId` ignored on the API and push-down paths (AC-9)
- [ ] `sorting` story registered + smoke-passing (AC-8)
- [ ] `yarn verify` green, no regressions, `check:docs` green

**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (core mouse modifiers — unblocks Ctrl+click)
    ↓
Phase 2 (sort model — sort.ts + GridColumn fields)
    ↓
Phase 3 (SortHeader + container wiring — consumes Phase 1 modifiers + Phase 2 model)
    ↓
Phase 4 (security + kitchen-sink story)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ `yarn verify` green
3. ✅ No warnings/errors; no `@jsvision/ui` source change (AR #1); the only core change is Phase 1's additive optional mouse modifiers (AR #16)
4. ✅ No dead code — no unused params/exports (`noUnusedLocals`/`noUnusedParameters`)
5. ✅ Security hardened — unknown `columnId` never forwarded to a source query (AC-9); structured `SortKey[]` only, never raw SQL
6. ✅ Documentation — new barrel exports carry `@example`; `check:docs` green; core CHANGELOG line added
7. ✅ Kitchen-sink `sorting` story registered + smoke-passing (AC-8)
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
