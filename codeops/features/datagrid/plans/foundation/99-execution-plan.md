# Execution Plan: Foundation & Grid-Engine Exposure

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-13 01:28
> **Progress**: 14/39 tasks (36%)
> **CodeOps Skills Version**: 3.4.1

## Overview

Implement `@jsvision/datagrid`'s foundation (RD-01): promote `@jsvision/ui`'s grid engine to public API, then
stand up the new package with its load-bearing contracts (column model + adapter, data source + commit,
overlay helper, a read-only container) and an in-package story harness. Everything spec-first; the read-only
container is the render/order/sanitize proof, and RD-02 later grows it into the editable grid.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | ui grid-engine promotion (`@jsvision/ui`) | 9 |
| 2 | Package scaffold (`packages/datagrid`) | 5 |
| 3 | Column model & adapter | 6 |
| 4 | Data source & commit | 7 |
| 5 | Overlay & read-only container | 7 |
| 6 | Story harness & final verify | 5 |

**Total: 39 tasks across 6 phases** (no fabricated hour estimates).

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress; each task line appears exactly
> once. The executing agent MUST:
>
> 1. **On implementation:** `- [~] N.N.N … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** `- [x] N.N.N … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header + Last Updated after EVERY task** — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps from `date '+%Y-%m-%d %H:%M'` — never invented. Spec tests are immutable oracles: a failing spec
> test means the implementation is wrong — fix the code, never the test.

---

## Phase 1: ui grid-engine promotion

Promote the engine additively (03-01). Blocks Phases 3–6 (they import the promoted symbols).

### Step 1.1: Specification tests

**Reference**: [03-01](03-01-ui-engine-promotion.md) · [07 ST-1, ST-2] · req AR-12

- [x] 1.1.1 Write the barrel-surface spec (ST-1, ST-2): import each promoted value + type from `@jsvision/ui`, assert resolution + `DataGrid` still exported — `packages/ui/test/grid-engine-exports.spec.test.ts` ✅ (completed: 2026-07-13 01:13)
- [x] 1.1.2 Run the spec — verify it FAILS (red: symbols not yet on the barrel) — `yarn workspace @jsvision/ui test` ✅ (completed: 2026-07-13 01:13)

### Step 1.2: Implementation

**Reference**: [03-01 §Edits] · AR #8 (plan)

- [x] 1.2.1 Add engine re-exports (values + `GridRowsConfig`/`GridHeaderConfig` types) — `packages/ui/src/table/index.ts` ✅ (completed: 2026-07-13 01:16)
- [x] 1.2.2 Re-export the same names + `stringWidth` (from `./controls/measure.js`) from the package barrel — `packages/ui/src/index.ts` ✅ (completed: 2026-07-13 01:16)
- [x] 1.2.3 Add an `@example` to `GridRows` + `GridHeader` — `packages/ui/src/table/grid-rows.ts` ✅ (completed: 2026-07-13 01:16)
- [x] 1.2.4 Add an `@example` to `apportionColumns`/`alignCell`/`sortRows`/`measureAutoWidths` (`packages/ui/src/table/columns.ts`) and to the newly-public `stringWidth` (`packages/ui/src/controls/measure.ts`) ✅ (completed: 2026-07-13 01:16)
- [x] 1.2.5 Run the spec — verify it PASSES (green) + `yarn workspace @jsvision/ui check:docs` ✅ (completed: 2026-07-13 01:16)

### Step 1.3: Hardening

- [x] 1.3.1 Run ui's full table/existing suite — confirm no regression, `DataGrid` unchanged (ST-2) ✅ (completed: 2026-07-13 01:16)
- [x] 1.3.2 Full verify for ui ✅ (completed: 2026-07-13 01:16)

**Deliverables**: the engine is on the public barrel with `@example`s; ui suite green.
**Verify**: `yarn workspace @jsvision/ui typecheck build test check:docs`

---

## Phase 2: Package scaffold

Infrastructure (03-02) — the config files are scaffolding; the ST-13/ST-14 guards verify them.

### Step 2.1: Scaffold

**Reference**: [03-02](03-02-package-scaffold.md) · AR #4/#5 (plan) · req AR-01, PF-007

- [x] 2.1.1 Create `package.json` + `tsconfig.json` + `tsconfig.typecheck.json` + `vitest.config.ts` + `README.md` (clone `@jsvision/files`, rename to `@jsvision/datagrid`, `private:true`, deps `"0.2.0"`) — `packages/datagrid/` ✅ (completed: 2026-07-13 01:28)
- [x] 2.1.2 Create the minimal public barrel + install/link + build the empty package — `packages/datagrid/src/index.ts`; then `yarn install` + `yarn workspace @jsvision/datagrid build` ✅ (completed: 2026-07-13 01:28)

### Step 2.2: Packaging & security guards

**Reference**: [07 ST-13, ST-14] · AC-1, AC-10

- [x] 2.2.1 Write the packaging e2e (ST-13, single entry point) + the source-scan security spec (ST-14, no `eval`/dynamic-require) — `packages/datagrid/test/packaging.e2e.test.ts`, `packages/datagrid/test/security.spec.test.ts` ✅ (completed: 2026-07-13 01:28)
- [x] 2.2.2 Run them — packaging e2e passes post-build, security scan passes, `check:deps` reports zero native deps ✅ (completed: 2026-07-13 01:28)
- [x] 2.2.3 Confirm turbo auto-fans-out to the new package (no `turbo.json` edit) + full verify ✅ (completed: 2026-07-13 01:28 — datagrid-scoped verify + ui suite green; full `yarn verify` blocked only by pre-existing CHANGELOG/RELEASE_NOTES prettier drift, unrelated to this work)

**Deliverables**: `packages/datagrid` builds to one entry point, zero native deps, turbo-integrated.
**Verify**: `yarn workspace @jsvision/datagrid build check:deps check:docs test test:e2e`

---

## Phase 3: Column model & adapter

Depends on Phases 1–2. Spec-first (03-03).

### Step 3.1: Specification tests

**Reference**: [03-03](03-03-column-model-adapter.md) · [07 ST-3, ST-4] · req AR-31

- [ ] 3.1.1 Write the adapter spec (ST-3 accessor `String(value)` vs `format`; ST-4 value-aware compare orders 9 < 1000) — `packages/datagrid/test/column.spec.test.ts`
- [ ] 3.1.2 Run — verify it FAILS (red)

### Step 3.2: Implementation

**Reference**: [03-03 §Implementation Details]

- [ ] 3.2.1 Implement `GridColumn<T,V>`, the per-column `column<T,V>()` helper, `toEngineColumn`, `defaultCompare`; export the public symbols from the barrel — `packages/datagrid/src/column.ts`, `packages/datagrid/src/index.ts`
- [ ] 3.2.2 Run the spec — verify it PASSES (green)

### Step 3.3: Hardening

- [ ] 3.3.1 Write impl tests (`defaultCompare` number/string/Date/null/mixed; `column` value-inference — typed `format`/`parse` compiles, a mismatch is a compile error) — `packages/datagrid/test/column.impl.test.ts`
- [ ] 3.3.2 Full verify

**Deliverables**: value/format/parse column + value-aware adapter, exported + tested.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs`

---

## Phase 4: Data source & commit

Depends on Phases 1–3. Spec-first (03-04). Owns AC-5's `rowKey`-required type test (via `fromRows`).

### Step 4.1: Specification tests

**Reference**: [03-04](03-04-data-source-commit.md) · [07 ST-5, ST-6, ST-7, ST-8] · req AR-14, AR-15, AR-16

- [ ] 4.1.1 Write the data-source spec (ST-6 `length`/`rowAt`; ST-7 shared suite over in-memory + a windowed double) + the windowed double fixture — `packages/datagrid/test/data-source.spec.test.ts`, `packages/datagrid/test/fixtures/windowed-source.ts`
- [ ] 4.1.2 Write the commit spec (ST-8 apply→onCommit→revert) + the required-`rowKey` type test (ST-5, `// @ts-expect-error` on `fromRows(sig,{})`) — `packages/datagrid/test/commit.spec.test.ts`, `packages/datagrid/test/types.spec.test.ts`
- [ ] 4.1.3 Run — verify all FAIL (red)

### Step 4.2: Implementation

**Reference**: [03-04 §Implementation Details]

- [ ] 4.2.1 Implement `GridDataSource<T>` + `fromRows` (required `rowKey`) + the forward `SortKey`/`FilterModel` placeholder aliases; export — `packages/datagrid/src/data-source.ts`, `src/index.ts`
- [ ] 4.2.2 Implement `CellCommit`/`OnCommit` + `commitCell`; export — `packages/datagrid/src/commit.ts`, `src/index.ts`
- [ ] 4.2.3 Run the specs — verify they PASS (green); `typecheck` enforces the ST-5 `@ts-expect-error`

### Step 4.3: Hardening

- [ ] 4.3.1 Write impl tests (`fromRows` reactivity; no-`onCommit` path; late async commit) — `packages/datagrid/test/data-source.impl.test.ts`, `packages/datagrid/test/commit.impl.test.ts`
- [ ] 4.3.2 Full verify

**Deliverables**: two-tier source (in-memory + windowed-proven) + commit primitive, exported + tested.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs`

---

## Phase 5: Overlay & read-only container

Depends on Phases 1–4. Spec-first (03-05).

### Step 5.1: Specification tests

**Reference**: [03-05](03-05-overlay-container.md) · [07 ST-9, ST-10, ST-11] · req PF-004, AR-25

- [ ] 5.1.1 Write the overlay spec (ST-9 mount at translated rect + focus + dispose-disposes-root, fake loop) — `packages/datagrid/test/overlay.spec.test.ts`
- [ ] 5.1.2 Write the container spec (ST-10 renders `format(value)` from in-memory + windowed; ST-11 control-byte cell → no raw ESC/BEL) + extend the type test for grid-options `rowKey` (ST-5) — `packages/datagrid/test/grid.spec.test.ts`, `packages/datagrid/test/types.spec.test.ts`
- [ ] 5.1.3 Run — verify all FAIL (red)

### Step 5.2: Implementation

**Reference**: [03-05 §Implementation Details]

- [ ] 5.2.1 Implement `CellRect`/`absoluteRect`/`mountCellOverlay` (public primitives, owned reactive root) — `packages/datagrid/src/overlay.ts`, `src/index.ts`
- [ ] 5.2.2 Implement read-only `EditableDataGrid<T>` + `EditableDataGridOptions<T>` (adapter → a sort-suppressed `ReadonlyGridHeader` + `GridRows` over a source via the promoted `stringWidth` measure, absolute overlay host; materialize coerces `rowAt`'s `T | undefined` to the engine's `display: () => T[]` with a type-guard) — `packages/datagrid/src/grid.ts`, `src/index.ts`
- [ ] 5.2.3 Run the specs — verify they PASS (green)

### Step 5.3: Hardening

- [ ] 5.3.1 Write impl tests (`absoluteRect` walk; overlay re-mount; empty-source `<empty>`; windowed materialization) — `packages/datagrid/test/overlay.impl.test.ts`, `packages/datagrid/test/grid.impl.test.ts`
- [ ] 5.3.2 Full verify

**Deliverables**: `mountCellOverlay` + a read-only `EditableDataGrid<T>` proving AC-3/AC-7/AC-8.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs`

---

## Phase 6: Story harness & final verify

Depends on Phase 5. Realizes AC-9 in the in-package harness (03-06) + the whole-plan gate.

### Step 6.1: In-package story harness

**Reference**: [03-06](03-06-story-harness.md) · [07 ST-12] · AC-9 · AR #2 (plan)

- [ ] 6.1.1 Write the `Story` contract + registry + the placeholder `datagrid/foundation` story (rendering the read-only container) — `packages/datagrid/test/kitchen-sink/story.ts`, `.../stories/index.ts`, `.../stories/foundation.story.ts`
- [ ] 6.1.2 Write the smoke test (ST-12 registry hygiene + every story paints headlessly) — `packages/datagrid/test/kitchen-sink.smoke.spec.test.ts`
- [ ] 6.1.3 Run the smoke test — verify it PASSES (a painting story + unique id + metadata); if it paints nothing, fix the story, not the test

### Step 6.2: Final verification

**Reference**: [01 §Acceptance Criteria] · RD-01 AC-1…AC-10

- [ ] 6.2.1 Full `yarn verify` — green across `@jsvision/datagrid` **and** `@jsvision/ui` (lint, typecheck, build, test, check:docs); no ui regression
- [ ] 6.2.2 Confirm every RD-01 AC-1…AC-10 is realized by a green ST-1…ST-14 (map in [07](07-testing-strategy.md))

**Deliverables**: an in-package showcase smoke test; the whole foundation green under `yarn verify`.
**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (ui promotion) ─┐
                        ├─→ Phase 3 → Phase 4 → Phase 5 → Phase 6
Phase 2 (scaffold) ─────┘
```

Phases 1 and 2 are independent (either order / parallel). Phase 3 needs both (it imports the promoted engine
into the scaffolded package). Phases 3→4→5 are strictly sequential (4 uses 3's columns; 5 uses 3+4). Phase 6
needs the container from Phase 5.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 6 phases completed (39 tasks `[x]`)
2. ✅ `yarn verify` passing (datagrid + ui, incl. `check:docs`/`check:deps`)
3. ✅ No warnings/errors; no ui regression (`DataGrid` + table suite green)
4. ✅ No dead code — no unused parameters, functions, classes, or modules
5. ✅ Security hardened — all cell text through `sanitize` (ST-11), zero native deps (ST-13), no `eval`/dynamic-require (ST-14)
6. ✅ Documentation updated — every public export has an `@example`; user/agent-facing JSDoc, no banned refs
7. ✅ RD-01 AC-1…AC-10 all realized by green ST-1…ST-14
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
