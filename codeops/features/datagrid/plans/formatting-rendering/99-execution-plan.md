# Execution Plan: Formatting & Cell Rendering

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-14 00:46
> **Progress**: 24/24 tasks (100%)
> **CodeOps Skills Version**: 3.7.0

## Overview

Implement RD-04 in three spec-first phases: the pure `fmt` registry (with matched inverse parsers), the
`render`/`cellStyle` paint path (self-contained `EditableGridRows.draw()` override, AR #1), and the
security + kitchen-sink coverage. Built-in formatting already flows through the `toEngineColumn` accessor,
so Phase 1 adds no paint code; Phase 2 owns the new per-cell paint. No `@jsvision/ui` change.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Formatter registry (`fmt`) + parse contract | 10 |
| 2 | Cell rendering & conditional styling | 9 |
| 3 | Security + kitchen-sink story | 5 |

**Total: 24 tasks across 3 phases** (scope bounded by the task-size criteria, not hour estimates)

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
> immutable oracle (fix the code, never the test).

---

## Phase 1: Formatter registry (`fmt`)

### Step 1.1: Specification tests (RED)

**Reference**: `03-01 §Implementation Details` · `07 §Formatter registry` (ST-1…ST-9) · AR #4–#8
**Objective**: Pin the formatter contract before any code exists.

- [x] 1.1.1 Write `format.spec.test.ts` covering ST-1…ST-9 (currency format+parse, number round-trip, percent, enum/lookup/boolean labels, date/datetime display-only, adapter value-order) — `test/format.spec.test.ts` ✅ (completed: 2026-07-14 00:17)
- [x] 1.1.2 Verify RED — the new spec file fails (no `fmt`/`format.ts` yet) ✅ (completed: 2026-07-14 00:17)

### Step 1.2: Implementation (GREEN)

**Reference**: `03-01` · AR #4–#8
**Objective**: The `fmt` registry + inverse parsers.

- [x] 1.2.1 Create `format.ts`: `NumberFormatOptions`/`CurrencyFormatOptions`, `PARSE_FAILED` sentinel, `InvertibleFormat`/`DisplayFormat`, and `fmt` (number/currency/percent with `Intl.NumberFormat` + `formatToParts`-driven inverse; date/datetime/boolean/enumLabel/lookupLabel display-only) — `src/format.ts` ✅ (completed: 2026-07-14 00:18)
- [x] 1.2.2 Export `fmt` + `PARSE_FAILED` + the option/format types from the barrel, each with `@example` JSDoc — `src/index.ts` ✅ (completed: 2026-07-14 00:18)
- [x] 1.2.3 Verify GREEN — ST-1…ST-9 pass ✅ (completed: 2026-07-14 00:18)

### Step 1.3: Implementation tests & hardening

**Reference**: `07 §Implementation Tests`
**Objective**: Edge coverage.

- [x] 1.3.1 Write `format.impl.test.ts` — negatives/zero/large, fraction-digit options, `nl-NL` symbols, percent scaling, unknown keys, date/datetime styles, `PARSE_FAILED` on garbage — `test/format.impl.test.ts` ✅ (completed: 2026-07-14 00:20)
- [x] 1.3.2 Verify (full) — 135 datagrid unit tests green (116 baseline + 19 new) ✅ (completed: 2026-07-14 00:20)

### Step 1.4: Parse contract widening + commit rejection (AR-13, PF-002)

**Reference**: `03-01 §parse failure signalling` · `07 §Parse contract & commit rejection` (ST-20) · AR #13
**Objective**: Let an `fmt.*` invertible spread straight into a column, and reject an unparseable commit.

- [x] 1.4.1 Write `parse-commit.spec.test.ts` (ST-20): an editable currency column; committing `"abc"` leaves the record value unchanged (RED) — `test/parse-commit.spec.test.ts` ✅ (completed: 2026-07-14 00:23)
- [x] 1.4.2 Verify RED — the sentinel is written / commit not rejected yet (contract not widened) ✅ (completed: 2026-07-14 00:23)
- [x] 1.4.3 Widen `GridColumn.parse` to `(text) => V | typeof PARSE_FAILED` (`src/column.ts`) and guard the commit at the `tcol.parse!(field())` site (`src/editing.ts:263`): on `PARSE_FAILED`, keep the editor open and write nothing — GREEN (ST-20) ✅ (completed: 2026-07-14 00:25)

**Deliverables**:
- [x] `fmt` registry with tested inverse parsers for number/currency/percent
- [x] `GridColumn.parse` widened to the sentinel union; commit rejects `PARSE_FAILED` (no `NaN`/sentinel persisted)
- [x] All verification passing — full `yarn verify` green (26/26 turbo tasks, 136 datagrid tests)

**Verify**: `yarn verify`

---

## Phase 2: Cell rendering & conditional styling

### Step 2.1: Specification tests (RED)

**Reference**: `03-02` · `07 §Cell rendering & styling` (ST-10…ST-16) · AR #1–#3, #9
**Objective**: Pin render/cellStyle/precedence before touching the paint path.

- [x] 2.1.1 Write `cell-rendering.spec.test.ts` covering ST-10…ST-16 (cellStyle colour; cursor>cellStyle; selected>cellStyle; render glyph; render-throw isolation; cell-local clip + width-correct truncation; default path unchanged) — `test/cell-rendering.spec.test.ts` ✅ (completed: 2026-07-14 00:40)
- [x] 2.1.2 Verify RED — the 4 behaviour-dependent cases fail (no `render`/`cellStyle` paint yet); the precedence/identity guards already hold ✅ (completed: 2026-07-14 00:40)

### Step 2.2: Implementation (GREEN)

**Reference**: `03-02 §Implementation Details` · AR #1–#3
**Objective**: The self-contained per-cell paint path.

- [x] 2.2.1 Add `render?`/`cellStyle?` to `GridColumn` and the `CellStyle`/`CellRenderer`/`RenderCell`/`CellState`/`CellDrawContext` types — `src/column.ts`, `src/cell-draw.ts` ✅ (completed: 2026-07-14 00:40) — `CellRenderer` placed in `cell-draw.ts` (with the cell-draw types) to avoid a circular type import; `CellStyle` in `column.ts`
- [x] 2.2.2 Implement `cellContext` (cell-local clipped facade) + `safeRender` (draw-error isolation → `⚠` in `gridDirty` fg over the row bg; no `danger` role — PF-001) — `src/cell-draw.ts` ✅ (completed: 2026-07-14 00:40)
- [x] 2.2.3 Rewrite `EditableGridRows.draw` as the self-contained row/cell loop honoring precedence (cursor>dirty>selected>cellStyle>zebra>normal); set `topItem` via the protected `this.updateTop()` (the `keepVisible`/`clampIndex` helpers are unreachable — PF-003), keep `paintCursorCell`/`paintDirtyMarkers` as final overpaints — `src/editable-grid-rows.ts` ✅ (completed: 2026-07-14 00:40)
- [x] 2.2.4 Export the public render/cellStyle/cell-draw types from the barrel with `@example` JSDoc — `src/index.ts` ✅ (completed: 2026-07-14 00:40)
- [x] 2.2.5 Verify GREEN — ST-10…ST-16 pass (143 datagrid unit tests green) ✅ (completed: 2026-07-14 00:40)

### Step 2.3: Implementation tests & hardening

**Reference**: `07 §Implementation Tests`
**Objective**: Full precedence matrix + edges.

- [x] 2.3.1 Write `cell-rendering.impl.test.ts` — precedence matrix, empty grid, wide-glyph cell, `Style` vs role-name return, dirty-marker over a cellStyle cell, scrolled/indented clip — `test/cell-rendering.impl.test.ts` ✅ (completed: 2026-07-14 00:42)
- [x] 2.3.2 Verify (full) — full `yarn verify` green (150 datagrid unit tests) ✅ (completed: 2026-07-14 00:42)

**Deliverables**:
- [x] `render`/`cellStyle` on `GridColumn` with the fixed precedence, draw-error isolated, cell-clipped
- [x] Default (no-hook) path renders identically to the pre-RD-04 base (ST-16)
- [x] All verification passing

**Verify**: `yarn verify`

---

## Phase 3: Security + kitchen-sink story

### Step 3.1: Specification tests (RED)

**Reference**: `07 §Security` (ST-17, ST-18) · RD-04 AC-5/AC-9
**Objective**: Prove the sanitize boundary holds for format output and render output.

- [x] 3.1.1 Add ST-17 (format-output control-byte) + ST-18 (render-output control-byte) sanitize-boundary tests to `security.spec.test.ts` — `test/security.spec.test.ts` ✅ (completed: 2026-07-14 00:44)
- [x] 3.1.2 Verify — the format/render paths render sanitized (no raw ESC/BEL); the render test exercises the Phase-2 paint code ✅ (completed: 2026-07-14 00:44)

### Step 3.2: Implementation (kitchen-sink story)

**Reference**: `07 §Kitchen-sink` (ST-19) · RD-04 AC-8 · CLAUDE.md kitchen-sink gate
**Objective**: The showcase story.

- [x] 3.2.1 Add the `datagrid` formatting story (currency-formatted column + `cellStyle` conditional column + a `render`-hook cell) and register it — `test/kitchen-sink/stories/formatting.story.ts`, `test/kitchen-sink/stories/index.ts` ✅ (completed: 2026-07-14 00:46)
- [x] 3.2.2 Verify GREEN — the smoke test (ST-19) passes for the new story ✅ (completed: 2026-07-14 00:46)

### Step 3.3: Hardening

**Reference**: `01 §Acceptance Criteria`
**Objective**: Full green, no regressions.

- [x] 3.3.1 Full `yarn verify`; confirm no regressions in the RD-01/02/03 suites (116-test baseline) and `check:docs` green — verify only ✅ (completed: 2026-07-14 00:46) — 153 datagrid unit tests green (116 baseline + 37 new), full monorepo verify + check-plugin green

**Deliverables**:
- [x] Sanitize-boundary verified for format + render output
- [x] Formatting story registered + smoke-passing
- [x] `yarn verify` green, no regressions

**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (fmt registry — no paint code)
    ↓
Phase 2 (render/cellStyle paint path)
    ↓
Phase 3 (security tests exercise the paint path; story showcases both)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ `yarn verify` green (AR #11)
3. ✅ No warnings/errors; no `@jsvision/ui` source change (AR #1)
4. ✅ No dead code — no unused params/exports (`noUnusedLocals`/`noUnusedParameters`)
5. ✅ Security hardened — sanitize boundary verified for format + render output (AC-5/AC-9); no `eval`/`Function`
6. ✅ Documentation — barrel exports carry `@example`; `check:docs` green
7. ✅ Kitchen-sink formatting story registered + smoke-passing (AC-8)
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
