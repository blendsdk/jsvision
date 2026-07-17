# Execution Plan: Validation & Lifecycle

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Implements**: datagrid/RD-12
> **Last Updated**: 2026-07-17 21:28
> **Progress**: 7/46 tasks (15%) — Phase 1 complete (foundations verified green)
> **CodeOps Skills Version**: 3.8.0

## Overview

RD-12 adds the commit-safety layer to `@jsvision/datagrid`: a typed per-cell `validate` gate, a per-row
`validateRow` cross-field gate (row-leave trap), a `beforeSave` veto above `onCommit`, invalid-cell +
message error surfacing, and `loading`/`ready`/`empty`/`error` lifecycle states. Phased
**foundation-first**: the `gridInvalid` core role + the `beforeSave` commit primitive; then the per-cell
pipeline + error surfacing; then the per-row gate + row-leave trap; then the lifecycle states; then the
barrel, showcase, and security oracle. `grid.ts` is at its `< 1300` guard, so all logic lands in new
modules (`validation.ts`, `error-registry.ts`, `grid-lifecycle.ts`); `grid.ts` gains only thin option
wiring + delegators (AR-7). The one cross-package change is the additive `gridInvalid` role in
`@jsvision/core` (AR-4/AR-18) — the first datagrid→core touch since RD-05.

**🚨 Update this document after EACH completed task.**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Foundations — `gridInvalid` core role + `beforeSave` commit primitive | 7 |
| 2 | Per-cell validation pipeline + error surfacing | 11 |
| 3 | Per-row cross-field gate + row-leave trap | 11 |
| 4 | Lifecycle states (loading / empty / error) | 8 |
| 5 | Barrel + showcase + security | 9 |

**Total: 46 tasks across 5 phases.**

> **⚠️ EXECUTION RULE:** the task checkboxes are the single source of truth. Mark `[~]` with a
> timestamp on implementation, promote to `[x]` only after verify passes; update the Progress header
> after every task. Spec-first (spec tests → RED → implement → GREEN → impl tests → verify) is
> non-negotiable; a `*.spec.test.ts` is immutable — a post-impl failure means the code is wrong.
> Timestamps from `date '+%Y-%m-%d %H:%M'`.

---

## Phase 1: Foundations — `gridInvalid` core role + `beforeSave` commit primitive

**Reference**: [03-01](03-01-column-validation-and-commit-pipeline.md) · [03-02 §gridInvalid](03-02-error-surfacing.md) · [07 §A/§B](07-testing-strategy.md) · AR-4/AR-9/AR-18

### Step 1.1: Spec the foundations
- [x] 1.1.1 Extend the core theme spec — `gridInvalid` present on `defaultTheme`, total role count **72**, encodes at every depth (ST-11) — `packages/core/test/severity-text-theme.spec.test.ts` (count 72 + presence) + `packages/datagrid/test/grid-theme.spec.test.ts` (byte-pin white-on-deep-red + encode-at-depth) — verified green 2026-07-17 21:28
- [x] 1.1.2 Spec the commit primitive — `commitCell` with `beforeSave`: a `false` `beforeSave` reverts + `onCommit` not called; a rejecting `beforeSave` = veto not crash; apply→beforeSave→onCommit ordering (ST-3/ST-4 at primitive level) — `packages/datagrid/test/commit.spec.test.ts` — verified green 2026-07-17 21:28
- [x] 1.1.3 Verify RED — core count assertion fails (still 71); grid-theme `gridInvalid` undefined; the `beforeSave` assertions fail (arg ignored) ✅ confirmed RED 2026-07-17 21:11

### Step 1.2: Implement
- [x] 1.2.1 Add `gridInvalid` to `@jsvision/core`: `Theme` interface + `defaultTheme` literal (white-on-deep-red `{fg:white,bg:red}`), the derived-role builder (`roles.ts`, **fixed red — NOT danger-seeded, AR-22**), the `monochromeTheme` literal (reverse-video); a CHANGELOG entry (additive role) — impl+verified 2026-07-17 21:16
- [x] 1.2.2 Extend `commitCell` with an optional `beforeSave?: BeforeSave<T>` gate (after `apply`, before `onCommit`, one shared revert path; reject = veto); export the `BeforeSave<T>` type — impl+verified 2026-07-17 21:14
- [x] 1.2.1b (discovered) Union `gridInvalid` into the 5 ui theme allowlist oracles (`color/date/editor/feedback/tabs-theme.spec`) + the 2 core danger-leak oracles resolved via AR-22 (non-danger derivation) — 2026-07-17 21:24

### Step 1.3: Harden
- [x] 1.3.1 Impl tests — `commitCell` beforeSave short-circuits onCommit; reject/throw = veto; ordering apply→beforeSave→onCommit; the core role-enumeration oracles (`serialize-theme`, `presets.spec`, `create-theme.spec`, ui `*-theme` allowlists) stay green — impl+verified 2026-07-17 21:18
- [x] 1.3.2 Phase verify — full core (748) + datagrid (488) + ui (1641) suites green; full `yarn verify` green except an unrelated load-induced perf flake (`editor-perf ST-35`, non-gating/off-CI) — verified 2026-07-17 21:28

**Deliverables**: additive `gridInvalid` core role (count 72); `commitCell` with a `beforeSave` gate; JSDoc `@example` on the new `BeforeSave` export.
**Verify**: `yarn verify`

---

## Phase 2: Per-cell validation pipeline + error surfacing

**Reference**: [03-01](03-01-column-validation-and-commit-pipeline.md) · [03-02](03-02-error-surfacing.md) · [07 §A/§B](07-testing-strategy.md) · AR-1/AR-8/AR-10/AR-11/AR-14/AR-17

### Step 2.1: Spec
- [ ] 2.1.1 Spec the per-cell pipeline (ST-1…ST-6) — `validate` message blocks + marks + keeps editor open; `null` commits; `beforeSave` veto reverts + skips `onCommit`; full ordering reverts at each post-apply gate; `PARSE_FAILED` marks + generic message — `packages/datagrid/test/validation-pipeline.spec.test.ts`
- [ ] 2.1.2 Spec error surfacing (ST-7…ST-10, ST-24) — invalid cell paints `gridInvalid`; correcting clears marker + message; Escape after a failed commit clears the marker + message (no stale marker on a valid cell); the band shows the active message with two invalid cells; the band renders with no footer — `packages/datagrid/test/error-surfacing.spec.test.ts`
- [ ] 2.1.3 Verify RED

### Step 2.2: Implement
- [ ] 2.2.1 Add `validate?: (value: V, row: T) => string | null` to `GridColumn` (typed authoring, erased on collection) + JSDoc `@example` — `packages/datagrid/src/column.ts`
- [ ] 2.2.2 Create the error registry — `createErrorRegistry()` (`set`/`clear`/`has`/`message`/`active`/`keys`/`note`), twin of `createDirtyRegistry`; bare signals, no `computed` — `packages/datagrid/src/error-registry.ts`
- [ ] 2.2.3 Wire the pipeline in `commitValue` — pre-apply `validate` (skipped when a nullable column resolves to `null`) and `PARSE_FAILED` → `errors.set(ck, msg)` + keep editor open + apply nothing; pass `host.beforeSave` into `commitCell`; `errors.clear(ck)` on success; **`cancel()` (Escape) also calls `errors.clear(ck)` before closing** (no stale marker on the untouched, valid value); add `beforeSave?`/`errors?` to `EditHost` — `packages/datagrid/src/editing.ts`
- [ ] 2.2.4 Paint the invalid overpaint — `paintInvalidCells` above `paintDirtyMarkers` (precedence `cursor > invalid > dirty`), `CellState.invalid` in `cell-draw.ts`, bind `errors.keys` for repaint; thread `errors` through the body config — `packages/datagrid/src/editable-grid-rows.ts`, `packages/datagrid/src/cell-draw.ts`
- [ ] 2.2.5 Build + place the message band — `buildMessageBand` (reactive `Text` + `severity`) in `validation.ts`, rendered as a dedicated line in the footer region (present with no footer); `grid.ts` owns `errors`, threads it into `_bodyDeps`/`EditHost`, and builds the band — `packages/datagrid/src/validation.ts`, `packages/datagrid/src/grid-panels.ts`, `packages/datagrid/src/grid.ts`
- [ ] 2.2.6 Verify GREEN — ST-1…ST-10 pass

### Step 2.3: Harden
- [ ] 2.3.1 Impl tests — registry `set`/`clear`/`active`/`note` last-writer-wins; precedence; band-with-no-footer; **regression: `parse-commit.spec` + `editing.spec` stay green** — `packages/datagrid/test/error-registry.impl.test.ts`
- [ ] 2.3.2 Phase verify — full datagrid suite + `grid.ts` under the line guard (re-based `< 1300` → `< 1350` across all three guard tests with the AR-7 rationale once the added public surface crosses 1299; never re-inline)

**Deliverables**: typed `validate` gate + `beforeSave` wired into commit; invalid-cell marker + message band; zero RD-02…11 regression.
**Verify**: `yarn verify`

---

## Phase 3: Per-row cross-field gate + row-leave trap

**Reference**: [03-03](03-03-row-gate.md) · [07 §C](07-testing-strategy.md) · AR-5/AR-15/AR-16

### Step 3.1: Spec
- [ ] 3.1.1 Spec the row gate (ST-12…ST-16) — an edited invalid row is trapped on arrow / `Enter` / click, cursor lands on `field`, message shows; a corrected row leaves + clears; an **untouched** invalid row leaves freely — `packages/datagrid/test/row-gate.spec.test.ts`
- [ ] 3.1.2 Verify RED

### Step 3.2: Implement
- [ ] 3.2.1 Add the `validateRow?: (row) => { ok; message?; field? }` grid option + the `RowValidation` type — `packages/datagrid/src/grid.ts`, `packages/datagrid/src/validation.ts`
- [ ] 3.2.2 Implement `createRowGate` in `validation.ts` — `tryLeave()`: undefined/empty/not-dirty → allow; ok → `note(null)` + allow; else refocus `field` (→ first-dirty → current fallback) + `note(message)` + block; a `validateRow` throw = blocking — `packages/datagrid/src/validation.ts`
- [ ] 3.2.3 Wire path 1 (keyboard row nav) — a `rowLeaveGate?: () => boolean` body config hook; in `runAction`, a **row-changing** nav action consults it before the base move (column-only actions never gate) — `packages/datagrid/src/editable-grid-rows.ts`
- [ ] 3.2.4 Wire path 2 (`Enter`-advance) — the **body's** `advanceRow` (`editable-grid-rows.ts:592`, bound to `EditHost.advanceRow`) consults the `rowLeaveGate` body-dep from 3.2.3 before advancing; on block it does not advance (field refocuses). NOTE: `advanceRow` is a body method — there is no `advanceRow` on the container — so this lands in the body, and `grid.ts` only injects the dep — `packages/datagrid/src/editable-grid-rows.ts`
- [ ] 3.2.5 Wire path 3 (`Tab` row-edge) — the container-owned `advanceCell` calls `rowGate.tryLeave()` directly before a row-changing hop; a within-row cell hop does not gate — `packages/datagrid/src/grid.ts`
- [ ] 3.2.6 Wire path 4 (click a different row) — the body mouse-down consults `rowLeaveGate` before setting the row cursor from a click on a different row — `packages/datagrid/src/editable-grid-rows.ts`
- [ ] 3.2.7 Verify GREEN — ST-12…ST-16 pass

### Step 3.3: Harden
- [ ] 3.3.1 Impl tests — `field` fallback chain; within-row moves never gate; `validateRow` throw handled; frozen multi-panel gates once; `note` clears on success — `packages/datagrid/test/validation.impl.test.ts`
- [ ] 3.3.2 Phase verify — full datagrid suite + `grid.ts` under the line guard (re-based `< 1300` → `< 1350` across all three guard tests with the AR-7 rationale once the added public surface crosses 1299; never re-inline)

**Deliverables**: `validateRow` cross-field gate with a dirty-gated row-leave trap + field refocus across all four leave paths.
**Verify**: `yarn verify`

---

## Phase 4: Lifecycle states (loading / empty / error)

**Reference**: [03-04](03-04-lifecycle-state.md) · [07 §D](07-testing-strategy.md) · AR-2/AR-6/AR-12/AR-13

### Step 4.1: Spec
- [ ] 4.1.1 Spec the lifecycle (ST-17…ST-20) — `loading` → spinner region (header visible); `error` → message + working `retry()`; `ready` + 0 rows → `emptyText` or the filter-aware `'No matching rows'`; `ready` + rows → grid, and the no-config zero-row path still shows the body `<empty>` — `packages/datagrid/test/lifecycle.spec.test.ts`
- [ ] 4.1.2 Verify RED

### Step 4.2: Implement
- [ ] 4.2.1 Create `grid-lifecycle.ts` — the `GridStatus` type (+ string-shorthand normalize), the effective-state computation (loading/error win; empty when ready + count 0; filter-aware via `filteredCount`/`totalCount`), the spinner/empty/error view factories (Spinner+runSpinner, `Text`, error `Text`+`Button('Retry')`), and the `LifecycleController` — `packages/datagrid/src/grid-lifecycle.ts`
- [ ] 4.2.2 Add `status?`/`emptyText?` options + construct the controller — `packages/datagrid/src/grid.ts`
- [ ] 4.2.3 Wire the body-region swap — a swap-host `Group` in the body region; an effect swaps between the assembled grid body+footer and the placeholder; the header stays visible; the no-config path keeps the body `<empty>` (byte-identical) — `packages/datagrid/src/grid-panels.ts`, `packages/datagrid/src/grid.ts`
- [ ] 4.2.4 Verify GREEN — ST-17…ST-20 pass

### Step 4.3: Harden
- [ ] 4.3.1 Impl tests — shorthand normalization; header visible across states; `status()` throw → ready; retry button absent without `retry`; no-config regression — `packages/datagrid/test/grid-lifecycle.impl.test.ts`
- [ ] 4.3.2 Phase verify — full datagrid suite + `grid.ts` under the line guard (re-based `< 1300` → `< 1350` across all three guard tests with the AR-7 rationale once the added public surface crosses 1299; never re-inline)

**Deliverables**: caller-driven `status` + auto-derived empty; loading/empty/error views with a working `retry()`; the header persists across states.
**Verify**: `yarn verify`

---

## Phase 5: Barrel + showcase + security

**Reference**: [03-05](03-05-public-api-showcase-security.md) · [07 §E](07-testing-strategy.md) · AR-19/AR-21 · CLAUDE.md (kitchen-sink gate)

### Step 5.1: Spec the security oracle
- [ ] 5.1.1 Spec the security posture (ST-21…ST-23) — a control-byte validation message renders sanitized; a veto/invalid value never persists (spy sinks); the new modules use no `eval`/`Function` — `packages/datagrid/test/security.spec.test.ts`
- [ ] 5.1.2 Verify RED/GREEN (sanitize is free at draw; the veto/no-eval assertions confirm the Phase 1–4 wiring)

### Step 5.2: Publish + demo
- [ ] 5.2.1 Barrel exports — `BeforeSave`, `ErrorRegistry`, `createErrorRegistry`, `GridStatus`, `RowValidation` (the new options ship on the exported `GridColumn`/`EditableDataGridOptions`) — `packages/datagrid/src/index.ts`
- [ ] 5.2.2 Kitchen-sink `validation-lifecycle.story.ts` (a rejected `validate` edit + a `validateRow` veto + a state echo; lifecycle noted app-wired) + register — `packages/datagrid/test/kitchen-sink/stories/`, `stories/index.ts`
- [ ] 5.2.3 `datagrid-showcase` `validation-lifecycle/` cluster — 4 demos (per-cell `validate` · row-gate veto · `beforeSave` vs `onCommit` · loading/empty/error + `retry`) + a shared builder + registry — `packages/examples/datagrid-showcase/stories/validation-lifecycle/`
- [ ] 5.2.4 Remove the RD-12 placeholder; re-base the placeholder-count oracle + add the `Validation & lifecycle` category — `packages/examples/datagrid-showcase/stories/placeholders.ts`, `stories/index.ts`, `packages/examples/test/datagrid-showcase.smoke.spec.test.ts`
- [ ] 5.2.5 Verify GREEN — ST-21…ST-23 + kitchen-sink smoke + showcase smoke + showcase walkthrough (`emitCommand`) pass

### Step 5.3: Final hardening
- [ ] 5.3.1 JSDoc `@example` on every new public export; `check-jsdoc` clean; grep all `packages/*/src` for banned CodeOps IDs (clean) — `packages/datagrid/src/*`, `packages/core/src/*`
- [ ] 5.3.2 Full `yarn verify` — turbo green; `grid.ts` under the re-based `< 1350` guard (all three guard tests re-based together with the AR-7 rationale; heavy logic stays in the new modules, never re-inlined); no RD-01…11 regression; `yarn lint:fix` before push

**Deliverables**: shipped public surface + live demos + the security gate; full verify green.
**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (gridInvalid role + beforeSave primitive)
    ↓
Phase 2 (per-cell pipeline + error surfacing)   ←── needs 1 (role + beforeSave)
    ↓
Phase 3 (per-row gate + row-leave trap)         ←── needs 2 (error registry + dirty-per-row)
    ↓
Phase 4 (lifecycle states)                      ←── independent of 2/3; needs the container shell
    ↓
Phase 5 (barrel + showcase + security)          ←── needs 1–4
```

Phase 4 depends only on the container (not on 2/3); it is sequenced after 3 for a clean showcase in 5,
but could execute right after 1 if reordering is ever wanted.

## Success Criteria

**Feature is complete when:**

1. ✅ All 5 phases complete; all verification passing (`yarn verify`).
2. ✅ No dead code — no unused params/exports; the pipeline gates compose cleanly.
3. ✅ Security hardened — client validation documented UX-only; messages sanitized; no persistence
   bypasses `onCommit`; no `eval` (ST-21…ST-23).
4. ✅ Zero RD-01…11 regression (full datagrid + examples suites).
5. ✅ `@jsvision/core` `gridInvalid` additive (count 72) + CHANGELOG; every theme oracle green.
6. ✅ `grid.ts` line guard re-based `< 1300` → `< 1350` across all three guard tests with the AR-7
   rationale (added public surface, not re-inlined logic); heavy logic stays in the new modules.
7. ✅ JSDoc `@example` on every new public export; `check-jsdoc` clean; kitchen-sink story + showcase
   cluster live; RD-12 placeholder removed.
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill).
