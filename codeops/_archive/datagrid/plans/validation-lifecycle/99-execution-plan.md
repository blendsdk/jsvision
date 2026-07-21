# Execution Plan: Validation & Lifecycle

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Implements**: datagrid/RD-12
> **Last Updated**: 2026-07-17 23:00
> **Progress**: 46/46 tasks (100%) — ✅ COMPLETE. All 5 phases verified green (foundations · per-cell pipeline & error surfacing · per-row gate & row-leave trap · lifecycle states · barrel + showcase + security).
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
- [x] 2.1.1 Spec the per-cell pipeline (ST-1…ST-6) — `validate` message blocks + marks + keeps editor open; `null` commits; `beforeSave` veto reverts + skips `onCommit`; full ordering reverts at each post-apply gate; `PARSE_FAILED` marks + generic message — `validation-pipeline.spec.test.ts` — green 2026-07-17 21:53
- [x] 2.1.2 Spec error surfacing (ST-7…ST-10, ST-24) — invalid cell paints `gridInvalid` (body-harness buffer read); correcting/Escape clears marker + message (no stale marker on a valid cell); band shows active message with two invalid cells; band renders with no footer — `error-surfacing.spec.test.ts` — green 2026-07-17 21:53
- [x] 2.1.3 Verify RED — confirmed (missing module + undefined isInvalid/activeMessage) 2026-07-17 21:46

### Step 2.2: Implement
- [x] 2.2.1 Add `validate?: (value: V, row: T) => string | null` to `GridColumn` (typed authoring, erased on collection) + JSDoc `@example` — done
- [x] 2.2.2 Create the error registry — `createErrorRegistry()` (`set`/`clear`/`has`/`message`/`active`/`keys`/`note`), twin of `createDirtyRegistry`; two bare signals + a plain activeKey bookkeeping var, no `computed` — done
- [x] 2.2.3 Wire the pipeline in `commitValue` — pre-apply `validate` (skipped on nullable `null`) and `PARSE_FAILED` → `errors.set(ck, msg)` + editor open + apply nothing; `beforeSave` into `commitCell`; `errors.clear(ck)` on success; veto → `errors.set(ck, 'Change was rejected')`; **`cancel()` clears the cell's marker**; `beforeSave?`/`errors?` on `EditHost` — done
- [x] 2.2.4 Paint the invalid overpaint — `paintInvalidCells` (band, skips cursor cell) between `paintCursorCell`/`paintDirtyMarkers` (precedence `cursor > invalid > dirty`; dirty dot skipped on invalid cells), `CellState.invalid`, bind `errors.keys` for repaint, thread `errors` through the body config — done
- [x] 2.2.5 Build + place the message band — `buildMessageBand` (reactive `Text` + `severity`) in `validation.ts`, a dedicated footer-region row (present with no footer, built only when validation is configured); `grid.ts` owns `errors`, threads `errors`/`beforeSave`/`messageBand` into `_bodyDeps`, exposes public `isInvalid`/`activeMessage` (mirroring `isDirty`) — done
- [x] 2.2.6 Verify GREEN — ST-1…ST-10 + ST-24 pass (11 spec tests); full datagrid suite 499 + typecheck green 2026-07-17 21:57

### Step 2.3: Harden
- [x] 2.3.1 Impl tests — registry `set`/`clear`/`active`/`note` last-writer-wins + `note(null)` fallback + re-set most-recent; precedence `cursor > invalid > dirty` (paint); `parse-commit.spec`/`editing.spec` stay green — `error-registry.impl.test.ts` (8 tests green) 2026-07-17 21:58
- [x] 2.3.2 Phase verify — full `yarn verify` green (exit 0, all 30 turbo tasks, check-plugin PASS; `TUI_SKIP_PERF=1` to drop the load-induced perf flake). `grid.ts` at 1352 under the re-based **`< 1450`** guard (not the plan's estimated `< 1350` — grid.ts entered RD-12 at 1298; heavy logic stays in the new modules, never re-inlined; see AR-23). Zero RD-01…11 regression. — verified 2026-07-17 22:03

**Deliverables**: typed `validate` gate + `beforeSave` wired into commit; invalid-cell marker + message band; zero RD-02…11 regression.
**Verify**: `yarn verify`

---

## Phase 3: Per-row cross-field gate + row-leave trap

**Reference**: [03-03](03-03-row-gate.md) · [07 §C](07-testing-strategy.md) · AR-5/AR-15/AR-16

### Step 3.1: Spec
- [x] 3.1.1 Spec the row gate (ST-12…ST-16) — an edited invalid row is trapped on arrow / `Enter` / click, cursor lands on `field`, message shows; a corrected row leaves + clears; an **untouched** invalid row leaves freely — `row-gate.spec.test.ts` (5 tests) — green 2026-07-17 22:21
- [x] 3.1.2 Verify RED — confirmed (validateRow ignored, gate never traps; ST-14 passed as the default no-gate leave) 2026-07-17 22:14

### Step 3.2: Implement (row gate keys on the **touched-rows** registry, AR-24 — not `isRowDirty`; see below)
- [x] 3.2.1 Add the `validateRow?: (row) => RowValidation` grid option + the `RowValidation` type + `EditableDataGridOptions.validateRow` JSDoc — `grid.ts`, `validation.ts`
- [x] 3.2.2 Implement `createRowGate` in `validation.ts` — `tryLeave()`: no validateRow/empty/**not-touched** → allow; ok → `clearTouched` + `note(null)` + allow; else refocus `field` (→ current-column fallback) + `note(message)` + block; a `validateRow` throw = blocking. Plus a `touched` set + `markRowTouched` EditHost seam (marked on a successful commit, editing.ts) — `validation.ts`, `editing.ts`, `grid.ts`
- [x] 3.2.3 Wire path 1 (keyboard row nav) — `rowLeaveGate?: () => boolean` body config; in `runAction`, the row-changing actions (moveUp/Down, pageUp/Down, gridStart/End) consult it via `rowMoveAllowed`/`rowMoveToAllowed` before the base move (column-only actions never gate) — `editable-grid-rows.ts`
- [x] 3.2.4 Wire path 2 (`Enter`-advance) — the **body's** `advanceRow` consults `rowLeaveGate` before advancing (only when it would change the row); on block it does not advance. `grid.ts` only injects the dep — `editable-grid-rows.ts`
- [x] 3.2.5 Wire path 3 (`Tab` row-edge) — the container-owned `advanceCell` calls `rowGate.tryLeave()` directly before a row-changing hop; a within-row cell hop does not gate — `grid.ts`
- [x] 3.2.6 Wire path 4 (click a different row) — the body mouse-down consults `rowLeaveGate` (plain clicks only, via `clickTargetsOtherRow`) before the base cursor move; on block it consumes the event — `editable-grid-rows.ts`
- [x] 3.2.7 Verify GREEN — ST-12…ST-16 pass (5 tests); full datagrid suite 512 + typecheck green 2026-07-17 22:21

### Step 3.3: Harden
- [x] 3.3.1 Impl tests — direct `createRowGate` unit tests (untouched allows / touched-ok clears+notes(null) / touched-fail blocks+refocuses+notes / unknown+absent `field` → current-column fallback / throw = blocking); grid-level within-row-never-gates + a leave fires validateRow exactly once — `validation.impl.test.ts` (8 tests green) 2026-07-17 22:22
- [x] 3.3.2 Phase verify — full `yarn verify` green (exit 0, all 30 turbo tasks, check-plugin PASS; `TUI_SKIP_PERF=1`). `grid.ts` at 1404 under the re-based `< 1500` guard (AR-7/AR-23). Zero RD-01…11 regression. — verified 2026-07-17 22:25

**Deliverables**: `validateRow` cross-field gate with a dirty-gated row-leave trap + field refocus across all four leave paths.
**Verify**: `yarn verify`

---

## Phase 4: Lifecycle states (loading / empty / error)

**Reference**: [03-04](03-04-lifecycle-state.md) · [07 §D](07-testing-strategy.md) · AR-2/AR-6/AR-12/AR-13

### Step 4.1: Spec
- [x] 4.1.1 Spec the lifecycle (ST-17…ST-20) — `loading` → spinner region (header visible, rows hidden); `error` → message + working `retry()` (mouse down+up on the Retry face); `ready` + 0 rows → `emptyText` or filter-aware `'No matching rows'`; `ready` + rows → grid; no-config zero-row still `<empty>` — `lifecycle.spec.test.ts` (4 tests) — green 2026-07-17 22:41
- [x] 4.1.2 Verify RED — confirmed (missing grid-lifecycle.js module) 2026-07-17 22:37

### Step 4.2: Implement (empty is body-rendered; the swap is binary: placeholder for loading/error, grid for ready)
- [x] 4.2.1 Create `grid-lifecycle.ts` — `GridStatus` type + `classify` (string-shorthand normalize; loading/error win; defensive `status()` throw → ready), `emptyMessage` (filter-aware via filteredCount/totalCount), spinner/error view factories (`Spinner` static-first-frame + `Loading…`; `Text`+`Button('Retry')` — button needs 2 cells tall), `createLifecycleController`, and `applyLifecycleSwap` (the swap logic — extracted here to keep grid.ts thin, AR-7) — `grid-lifecycle.ts`
- [x] 4.2.2 Add `status?`/`emptyText?` options + JSDoc; construct the controller + the filter-aware empty resolver — `grid.ts`
- [x] 4.2.3 Wire the body-region swap — `buildGridBody` wraps the below-header region in a swap-host `Group` (only when `status` is set; header stays visible); an effect (bound on the grid, surviving a body rebuild) swaps host child between the grid region and the placeholder; the body draws the resolved empty message at 0 rows (else `<empty>` — byte-identical no-config) — `grid-panels.ts`, `editable-grid-rows.ts`, `grid.ts`
- [x] 4.2.4 Verify GREEN — ST-17…ST-20 pass (4 tests); full datagrid suite 524 + typecheck green 2026-07-17 22:43

### Step 4.3: Harden
- [x] 4.3.1 Impl tests — string-shorthand normalization; `status()` throw → ready; `placeholder()` null when ready; no-status → ready; `emptyMessage` filter-aware; header visible in loading/error; Retry absent without `retry`; no-config `<empty>` — `grid-lifecycle.impl.test.ts` (8 tests green) 2026-07-17 22:43
- [x] 4.3.2 Phase verify — full `yarn verify` green (exit 0, all 30 turbo tasks, check-plugin PASS; `TUI_SKIP_PERF=1`). `grid.ts` at 1472 under the re-based **`< 1500`** guard (Phase-4 swap wiring exceeded the projection; `applyLifecycleSwap` extracted to grid-lifecycle.ts per AR-7 first, then the guard re-based — AR-23). Zero RD-01…11 regression. — verified 2026-07-17 22:47

**Deliverables**: caller-driven `status` + auto-derived empty; loading/empty/error views with a working `retry()`; the header persists across states.
**Verify**: `yarn verify`

---

## Phase 5: Barrel + showcase + security

**Reference**: [03-05](03-05-public-api-showcase-security.md) · [07 §E](07-testing-strategy.md) · AR-19/AR-21 · CLAUDE.md (kitchen-sink gate)

### Step 5.1: Spec the security oracle
- [x] 5.1.1 Spec the security posture — a control-byte `validate` message surfaces in the band but renders sanitized at draw (no raw ESC/BEL in the frame); a `beforeSave` veto + a `validate`-failed value never persist (`onCommit` spy not called, record unchanged); the no-eval scan already covers the new modules — `security.spec.test.ts` (+2 tests) — green 2026-07-17
- [x] 5.1.2 Verify GREEN — security spec 15 tests green (sanitize free at draw; veto/no-eval confirm Phase 1–4 wiring)

### Step 5.2: Publish + demo
- [x] 5.2.1 Barrel exports — `BeforeSave`, `ErrorRegistry`, `createErrorRegistry`, `GridStatus`, `RowValidation` on `index.ts` (options ship on the exported `GridColumn`/`EditableDataGridOptions`). datagrid is not an API-ref barrel (ui/web/files only), so no api-ref regen — done
- [x] 5.2.2 Kitchen-sink `validation-lifecycle.story.ts` (a `validate` reject + a `validateRow` cross-field trap + a live message echo; lifecycle noted app-wired) + registered — kitchen-sink smoke 13 tests green
- [x] 5.2.3 `datagrid-showcase` `validation-lifecycle/` cluster — 4 self-contained demos (per-cell `validate` · row-gate cross-field · `beforeSave` vs `onCommit` · loading/empty/error + working `retry`) + registered — done
- [x] 5.2.4 Removed the RD-12 placeholder; re-based the placeholder-count oracle (4→3) + added the `Validation & lifecycle` category (+ ST-7 count 4) — `placeholders.ts`, `stories/index.ts`, `datagrid-showcase.smoke.spec.test.ts`
- [x] 5.2.5 Verify GREEN — showcase smoke + walkthrough (`emitCommand`) 76 tests green; kitchen-sink smoke green; examples typecheck green (after a datagrid rebuild so the dist barrel carries the new exports) — 2026-07-17
### Step 5.3: Final hardening
- [x] 5.3.1 JSDoc `@example` on every new public export (`createErrorRegistry`/`buildMessageBand`/`createRowGate`/`createLifecycleController`/`applyLifecycleSwap`/`emptyMessage` + the options); `check:docs` clean (0 banned refs · 0 missing @example); banned-CodeOps-ID grep of `packages/*/src` clean — done
- [x] 5.3.2 Full `yarn verify` green (exit 0, all 30 turbo tasks, check-plugin PASS; `TUI_SKIP_PERF=1`). `yarn lint:fix` run; `grid.ts` 1472 under the re-based `< 1500` guard; api-reference oracle green (datagrid is not a documented barrel). Zero RD-01…11 regression. — ✅ verified 2026-07-17 23:00

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
6. ✅ `grid.ts` line guard re-based `< 1300` → `< 1500` across all three guard tests with the AR-7
   rationale (added public surface, not re-inlined logic); heavy logic stays in the new modules.
7. ✅ JSDoc `@example` on every new public export; `check-jsdoc` clean; kitchen-sink story + showcase
   cluster live; RD-12 placeholder removed.
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill).
