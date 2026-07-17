# Execution Plan: Navigation & Interaction

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Implements**: datagrid/RD-10
> **Last Updated**: 2026-07-17 17:38
> **Progress**: 36/45 tasks (80%)
> **CodeOps Skills Version**: 3.8.0

## Overview

RD-10 consolidates the grid's input surface into one remappable keymap→`GridAction` dispatch, adds
`Tab`/`Shift-Tab` cell traversal (+ commit-advance) and double-click-to-edit, and asserts the
scroll-into-view guarantee. Phased **model-first**: the pure keymap model, then the body-dispatch
refactor (the highest-risk change — it must preserve every RD-02…09 gesture), then `Tab` traversal +
the app helper, then double-click + scroll, then story/showcase/security/barrel. All new logic lands in
`keymap.ts` + `navigation.ts`; the line-count guard is re-based `< 1250` → `< 1300` for the three new
public delegators (AR-8, PF-004). Preflight fixes are folded in: single-click column focus (PF-001),
malformed-chord guarding (PF-002), post-commit focus restore (PF-003), the `GridKeymap` rename (PF-005),
and the frozen-panel per-panel guard (PF-006).

**🚨 Update this document after EACH completed task.**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Keymap model (`keymap.ts`) | 6 |
| 2 | Body-dispatch refactor (`editable-grid-rows.ts`) | 10 |
| 3 | Tab traversal (`navigation.ts` + `commitEdit` seam) | 11 |
| 4 | Double-click + single-click focus + scroll-into-view | 9 |
| 5 | Showcase + security + barrel | 9 |

**Total: 45 tasks across 5 phases.**

> **⚠️ EXECUTION RULE:** the task checkboxes are the single source of truth. Mark `[~]` with a
> timestamp on implementation, promote to `[x]` only after verify passes; update the Progress header
> after every task. Spec-first (spec tests → RED → implement → GREEN → impl tests → verify) is
> non-negotiable; a `*.spec.test.ts` is immutable — a post-impl failure means the code is wrong.
> Timestamps from `date '+%Y-%m-%d %H:%M'`.

---

## Phase 1: Keymap model (`keymap.ts`)

**Reference**: [03-01](03-01-keymap-model.md) · [07 §A](07-testing-strategy.md) · AR-1/AR-4/AR-9/AR-10/AR-15

### Step 1.1: Spec the model
- [x] 1.1.1 Write spec tests for `GridAction`/`GridKeymap`/`DEFAULT_KEYMAP`/`resolveGridAction`/`mergeKeymap` (ST-1…ST-6) **plus ST-5b (malformed chord → skipped, no throw — PF-002)** — `packages/datagrid/test/keymap.spec.test.ts` ✅ (completed: 2026-07-17 16:24)
- [x] 1.1.2 Verify RED — the spec tests fail (no `keymap.ts` yet) ✅ (completed: 2026-07-17 16:24)

### Step 1.2: Implement the model
- [x] 1.2.1 Implement `keymap.ts` — the `GridAction` union, the `GridKeymap` type (renamed from `Keymap` to avoid colliding with core/ui's `Keymap` — PF-005), the frozen+exported `DEFAULT_KEYMAP`, `resolveGridAction` (compile the merged map to a core `Keymap` **once**, memoized; reuse core's chord canonicalization), and `mergeKeymap` (validate unknown actions **and malformed chords** via a per-entry `try/catch` compile → `devWarn`+skip; never throw — PF-002) — `packages/datagrid/src/keymap.ts` ✅ (completed: 2026-07-17 16:28)
- [x] 1.2.2 Verify GREEN — ST-1…ST-6 pass ✅ (completed: 2026-07-17 16:25)

### Step 1.3: Harden
- [x] 1.3.1 Impl tests — chord canonicalization edge cases (case-normalized letters, modifier order), merge idempotence, `devWarn` fired once per bad entry — `packages/datagrid/test/keymap.impl.test.ts` ✅ (completed: 2026-07-17 16:28)
- [x] 1.3.2 Phase verify ✅ (completed: 2026-07-17 16:28)

**Deliverables**: pure `keymap.ts`; JSDoc `@example` on every export; verification passing.
**Verify**: `yarn verify`

---

## Phase 2: Body-dispatch refactor (`editable-grid-rows.ts`)

**Reference**: [03-02](03-02-body-dispatch.md) · [07 §B](07-testing-strategy.md) · AR-1/AR-4/AR-9/AR-10

### Step 2.1: Spec the dispatch
- [x] 2.1.1 Write spec tests for chord→action routing + precedence (ST-7…ST-12) — `packages/datagrid/test/body-dispatch.spec.test.ts` ✅ (completed: 2026-07-17 16:49)
- [x] 2.1.2 Write the **regression** spec — the RD-02…09 gesture matrix with no `keymap` option behaves byte-identically (ST-13) **plus ST-13b (a non-owning frozen panel no-ops on edit/selection keys — PF-006)** — same file ✅ (completed: 2026-07-17 16:49)
- [x] 2.1.3 Verify RED — the new routing/precedence assertions fail (old handlers still hardcoded) ✅ (completed: 2026-07-17 16:49)

### Step 2.2: Implement the refactor
- [x] 2.2.1 Add `keymap: GridKeymap` to `EditableGridRowsConfig`; thread `mergeKeymap(opts.keymap)` from `grid.ts` into the body **and every panel (`makeBody` + `makeBand`)** so all share the one merged map — `packages/datagrid/src/editable-grid-rows.ts`, `packages/datagrid/src/grid.ts`, `packages/datagrid/src/grid-panels.ts` ✅ (completed: 2026-07-17 16:49)
- [x] 2.2.2 Rewrite `onEvent` to `resolveGridAction`→`runAction`, with `tryPrintableEdit` as the fallback; add `runAction` routing every `GridAction` to its existing seam (nav delegates to base `focusBy`/`focusTo`/`viewportRows`) preserving the `beginEdit`-before-`toggleSelect` editability precedence **and the `localCol() < 0` / `focused() < rowFloor` per-panel ownership short-circuit for edit/selection/value-help actions (PF-006)** — `packages/datagrid/src/editable-grid-rows.ts` ✅ (completed: 2026-07-17 16:49)
- [x] 2.2.3 Remove the now-superseded `handleColKey`/`tryBeginEdit`/`handleSelectionKey`/`handleOpenFilter` bodies (fold their logic into `runAction`/`tryPrintableEdit`); no dead code left — `packages/datagrid/src/editable-grid-rows.ts` ✅ (completed: 2026-07-17 16:49)
- [x] 2.2.4 Verify GREEN — ST-7…ST-12 pass ✅ (completed: 2026-07-17 16:49)
- [x] 2.2.5 Verify GREEN — ST-13 regression passes (zero RD-02…09 behavior change) ✅ (completed: 2026-07-17 16:49)

### Step 2.3: Harden
- [x] 2.3.1 Impl tests — frozen-panel cross-boundary cursor via the router (`setGlobalCol`/leaf-focus hop unchanged); a non-owning panel no-ops on edit/selection keys (PF-006); `enter`/`space` editable-vs-read-only precedence; grid.ts still a thin delegator — `packages/datagrid/test/body-dispatch.impl.test.ts` ✅ (completed: 2026-07-17 16:49)
- [x] 2.3.2 Phase verify — full datagrid suite + `grid.ts < 1300` ✅ (completed: 2026-07-17 16:49)

**Deliverables**: one remappable chord→action dispatch replacing four hardcoded handlers; zero regression.
**Verify**: `yarn verify`

---

## Phase 3: Tab traversal (`navigation.ts` + `commitEdit` seam)

**Reference**: [03-03](03-03-tab-traversal.md) · [07 §C](07-testing-strategy.md) · AR-2/AR-5/AR-6/AR-7/AR-8/AR-12

### Step 3.1: Spec the traversal
- [x] 3.1.1 Write spec tests for `nextCellIndex`/`prevCellIndex` (wrap + `'exit'`) (ST-14…ST-16) — `packages/datagrid/test/navigation.spec.test.ts` ✅ (completed: 2026-07-17 17:27)
- [x] 3.1.2 Write spec tests for `grid.nextCell()` commit-then-advance (ST-17), `gridKeymap` (ST-18), `installGridNavigation` focus/fallback/multi-grid (ST-19), **and post-commit focus restoration (ST-19b — after a Tab-commit the grid body still holds focus, PF-003)** — same file ✅ (completed: 2026-07-17 17:27)
- [x] 3.1.3 Verify RED ✅ (completed: 2026-07-17 17:27)

### Step 3.2: Implement
- [x] 3.2.1 Implement pure `nextCellIndex`/`prevCellIndex` (wrap at row ends; `'exit'` at grid edge / empty grid) — `packages/datagrid/src/navigation.ts` ✅ (completed: 2026-07-17 17:27)
- [x] 3.2.2 Add public `EditController.commitEdit(): Promise<boolean>` — extract the shared body from the existing private `commit()` (no duplicate logic); `Enter` keeps `advanceRow`, `Tab` advances by cell. **`commitEdit` closes the editor but does NOT refocus the body (no event envelope in the command path) — the caller restores focus (PF-003).** — `packages/datagrid/src/editing.ts` ✅ (completed: 2026-07-17 17:27)
- [x] 3.2.3 Add `EditableDataGrid.nextCell()`/`prevCell()` (commit-if-editing via `commitEdit`; a vetoed commit stays put returning `'moved'`; else move the container cursor) + public `isBodyFocused()`/`isEditing()` (AR-R1) — thin delegators over `navigation.ts` — `packages/datagrid/src/grid.ts` ✅ (completed: 2026-07-17 17:27)
- [x] 3.2.4 Implement `gridKeymap` (`createKeymap` fragment) + `installGridNavigation(loop, grid|grids[])` (one handler pair; active grid = `isBodyFocused() ‖ isEditing()` (AR-R1); advances → **`loop.focusView(grid.rows)` on `'moved'` to restore focus after a possible editor close (PF-003)**; else/`'exit'`→`focusNext`/`focusPrev`; structural `NavGrid` param, AR-R2) — `packages/datagrid/src/navigation.ts` ✅ (completed: 2026-07-17 17:27)
- [x] 3.2.5 **Re-base the line-count guard `< 1250` → `< 1300`** in both `grid-footer.impl.test.ts` and `grid-selection.impl.test.ts`, keeping their "thin delegator / no inlined logic" rationale (PF-004) — `packages/datagrid/test/grid-footer.impl.test.ts`, `packages/datagrid/test/grid-selection.impl.test.ts` ✅ (completed: 2026-07-17 17:27)
- [x] 3.2.6 Verify GREEN — ST-14…ST-19b pass ✅ (completed: 2026-07-17 17:27)

### Step 3.3: Harden
- [x] 3.3.1 Impl tests — `commitEdit` idempotent/idle→false; multi-grid single-advance guard; uninstaller unregisters; grid.ts `< 1300` — `packages/datagrid/test/navigation.impl.test.ts` ✅ (completed: 2026-07-17 17:27)
- [x] 3.3.2 Phase verify ✅ (completed: 2026-07-17 17:27)

**Deliverables**: `Tab`/`Shift-Tab` cell traversal with wrap, edge-exit, and commit-then-advance; the app-opt-in helper.
**Verify**: `yarn verify`

---

## Phase 4: Double-click + single-click focus + scroll-into-view

**Reference**: [03-04](03-04-mouse-doubleclick.md) · [07 §D](07-testing-strategy.md) · AR-3/AR-11 · PF-001

### Step 4.1: Spec
- [x] 4.1.1 Write spec tests for double-click-to-edit via `ev.clickCount` with a fake loop clock (ST-20…ST-22) **plus ST-20b (single click in a single-body grid moves the column cursor to the clicked cell — PF-001)** — `packages/datagrid/test/double-click.spec.test.ts` ✅ (completed: 2026-07-17 17:38)
- [x] 4.1.2 Write spec tests for the scroll-into-view guarantee (ST-23, ST-24) — same file ✅ (completed: 2026-07-17 17:38)
- [x] 4.1.3 Verify RED ✅ (completed: 2026-07-17 17:38)

### Step 4.2: Implement
- [x] 4.2.1 **Single-click cell focus (AC-4, PF-001):** set the column cursor on every body mouse-down — wire `mouseColumns: true` for the single/center body in `grid-panels.ts` (or drop the `if (this.mouseColumns)` guard so `setColFromClick` always runs); the pinned frozen-rows band stays passive (`focusable === false`) — `packages/datagrid/src/grid-panels.ts`, `packages/datagrid/src/editable-grid-rows.ts` ✅ (completed: 2026-07-17 17:38)
- [x] 4.2.2 Add `handleDoubleClickEdit` in the body mouse-down branch (before `super.onEvent`): `clickCount===2` + editable cell → `beginEdit`; read-only/single click fall through unchanged. With 4.2.1 in place the column is already set from the first down, so avoid a second divergent column-from-click path — `packages/datagrid/src/editable-grid-rows.ts` ✅ (completed: 2026-07-17 17:38)
- [x] 4.2.3 Confirm the AC-6 guarantee holds (add a clamp in `updateTop`/`autoScrollToCol` only if a spec exposes a gap — no new machinery by default) — no gap: ST-23/ST-24 pass over the existing `updateTop`/`autoScrollToCol` (no new code) — `packages/datagrid/src/editable-grid-rows.ts` ✅ (completed: 2026-07-17 17:38)
- [x] 4.2.4 Verify GREEN — ST-20…ST-24 pass (incl. ST-20b) ✅ (completed: 2026-07-17 17:38)

### Step 4.3: Harden
- [x] 4.3.1 Impl tests — single-body single- and double-click column resolution; a double-click on a read-only cell still activates (base focuses the row); different-cell rapid clicks reset the count — `packages/datagrid/test/double-click.impl.test.ts` ✅ (completed: 2026-07-17 17:38)
- [x] 4.3.2 Phase verify ✅ (completed: 2026-07-17 17:38)

**Deliverables**: double-click-to-edit (framework `clickCount`, no bespoke timer) + the asserted scroll-into-view guarantee.
**Verify**: `yarn verify`

---

## Phase 5: Showcase + security + barrel

**Reference**: [07 §E](07-testing-strategy.md) · AR-14/AR-16 · CLAUDE.md (kitchen-sink gate)

### Step 5.1: Spec the security oracle
- [ ] 5.1.1 Write spec — unknown keymap chords/actions ignored at the integration level; router uses no `eval`/dynamic dispatch (ST-25) — `packages/datagrid/test/body-dispatch.spec.test.ts`
- [ ] 5.1.2 Verify RED/GREEN as appropriate (validation lands in Phase 1; ST-25 is the integration-level confirmation)

### Step 5.2: Publish + demo
- [ ] 5.2.1 Barrel exports — `GridAction`/`GridKeymap`/`DEFAULT_KEYMAP`/`resolveGridAction`/`mergeKeymap`, `nextCellIndex`/`prevCellIndex`/`gridKeymap`/`installGridNavigation` (the `keymap` option + `nextCell`/`prevCell`/`isBodyFocused` ship on the exported `EditableDataGrid`) — `packages/datagrid/src/index.ts`
- [ ] 5.2.2 Kitchen-sink `navigation-interaction.story.ts` (keyboard + mouse + double-click + `Tab` via `installGridNavigation`; a visible keymap/state echo) + register — `packages/datagrid/test/kitchen-sink/stories/`
- [ ] 5.2.3 datagrid-showcase `navigation-interaction/` cluster — demos (keymap table · Tab traversal · double-click-to-edit · scroll-into-view · remap-a-chord) + a shared builder + registry — `packages/examples/datagrid-showcase/stories/navigation-interaction/`
- [ ] 5.2.4 Remove the RD-10 placeholder; re-base placeholder-count oracles (+ `Navigation & interaction` category) — `packages/examples/datagrid-showcase/stories/placeholders.ts`, `stories/index.ts`, `packages/examples/test/datagrid-showcase.smoke.spec.test.ts`
- [ ] 5.2.5 Verify GREEN — ST-25 + kitchen-sink + showcase smoke (ST-26, ST-27) pass

### Step 5.3: Final hardening
- [ ] 5.3.1 JSDoc `@example` on every new public export; `check-jsdoc` clean (datagrid); grep touched `src` for banned CodeOps IDs (clean) — `packages/datagrid/src/*`
- [ ] 5.3.2 Full `yarn verify` — turbo green; `grid.ts < 1300` (re-based guard, PF-004); no RD-01…09 regression; run `yarn lint:fix` before any PR-bound push

**Deliverables**: shipped public surface + live demos + the security gate; full verify green.
**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (keymap model)
    ↓
Phase 2 (body-dispatch refactor)   ←── needs 1 (resolveGridAction/mergeKeymap)
    ↓
Phase 3 (Tab traversal)            ←── needs 2 (dispatch) + the commitEdit seam
    ↓
Phase 4 (double-click + scroll)    ←── needs 2 (mouse-down branch)
    ↓
Phase 5 (showcase + security)      ←── needs 1–4
```

## Success Criteria

1. All 5 phases complete; all verification passing (`yarn verify`).
2. No dead code — the four old handlers fully folded into the router; no unused params/exports.
3. Zero RD-02…09 regression (ST-13).
4. Security — keymap validated (unknown ignored, no throw); actions via `switch`, no `eval`; text sanitized.
5. JSDoc `@example` on every public export; `check-jsdoc` clean.
6. `grid.ts < 1300` (guard re-based from 1250, PF-004); kitchen-sink story + showcase cluster live; RD-10 placeholder removed.
7. No core/ui change (AR-2).
8. Post-completion project re-analysis (handled by the exec_plan skill).
