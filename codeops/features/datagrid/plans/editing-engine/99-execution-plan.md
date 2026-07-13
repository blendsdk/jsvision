# Execution Plan: Editing Engine & Commit Model

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-13 12:45
> **Progress**: 16/43 tasks (37%)
> **CodeOps Skills Version**: 3.4.1

## Overview

Make the read-only `EditableDataGrid` (RD-01) editable: add the write seam + editor factory + theme roles
(Phase 1), the `EditableGridRows` cell cursor + overpaint (Phase 2), the editor-overlay lifecycle + commit
(Phase 3), dirty tracking (Phase 4), container integration (Phase 5), and the editable story + security + final
verify (Phase 6). Everything spec-first; additive over RD-01 (no ui promotion; one `column.set` addition; two
core theme roles).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Additive surface: `column.set`, `createCellEditor`, `gridCursor`/`gridDirty` roles | 9 |
| 2 | `EditableGridRows` — cell cursor, navigation, overpaint (no editing) | 7 |
| 3 | Editor-overlay lifecycle & commit (await-close) | 8 |
| 4 | Dirty tracking (registry + `isDirty` + `•` overpaint) | 7 |
| 5 | Container integration (`EditableDataGrid` owns the shared cursor + `onCommit`) | 7 |
| 6 | Editable story, security & final verify | 5 |

**Total: 43 tasks across 6 phases** (no fabricated hour estimates).

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
> test means the implementation is wrong — fix the code, never the test. **One sanctioned exception this plan:**
> extending a theme spec's `LATER_ADDITIVE_ROLES` allowlist (Phase 1) is an additive registration, not an oracle
> edit — every pre-existing byte stays asserted (03-01).

---

## Phase 1: Additive surface

The three small additions everything else builds on (03-01). Blocks Phases 2–6.

### Step 1.1: Specification tests

**Reference**: [03-01](03-01-additive-surface.md) · [07 ST-15, ST-16]

- [x] 1.1.1 Write the editor-seam spec (ST-15: `column.set` writes; `isEditable` ⇔ `parse` && `set`; `createCellEditor` → `Input` for editable, `null` for read-only) + the theme spec (ST-16: `gridCursor`/`gridDirty` byte-frozen + `encode()` non-throw at all depths) — `packages/datagrid/test/cell-editor.spec.test.ts`, `packages/datagrid/test/grid-theme.spec.test.ts` ✅ (completed: 2026-07-13 12:19)
- [x] 1.1.2 Run — verify both FAIL (red: symbols/roles not yet added) ✅ (completed: 2026-07-13 12:19)

### Step 1.2: Implementation

**Reference**: [03-01 §1–3] · AR #1, #2, #3 (plan)

- [x] 1.2.1 Add `gridCursor` (black-on-white `#ffffff`) + `gridDirty` (brightRed fg) roles + plain-language JSDoc — `packages/core/src/engine/color/theme.ts` ✅ (completed: 2026-07-13 12:27) — mechanical correction: plan snippet said `PALETTE.brightWhite`, which the DOS-16 `PALETTE` has no key for; used `PALETTE.white` (`#ffffff`, the intended pure bright white, matching the `calendarCursor` precedent)
- [x] 1.2.2 Add `'gridCursor'`,`'gridDirty'` to each full-inventory allowlist (`LATER_ADDITIVE_ROLES`) — `packages/ui/test/{tabs,editor,feedback,date,color}-theme.spec.test.ts` (sanctioned additive edit, not an oracle change) ✅ (completed: 2026-07-13 12:27)
- [x] 1.2.3 Add `set?: (row, value: V) => void` to `GridColumn` + the `isEditable(col)` predicate (both with `@example`, no banned refs); export `isEditable` — `packages/datagrid/src/column.ts`, `src/index.ts` ✅ (completed: 2026-07-13 12:27)
- [x] 1.2.4 Add `createCellEditor(column, field, host)` + `CellEditorHost` + the default text-`Input` host (with `@example`); export — `packages/datagrid/src/cell-editor.ts`, `src/index.ts` ✅ (completed: 2026-07-13 12:27)
- [x] 1.2.5 Run the specs — verify they PASS (green) + `yarn workspace @jsvision/core test check:docs` + `yarn workspace @jsvision/datagrid check:docs` ✅ (completed: 2026-07-13 12:27)

### Step 1.3: Hardening

- [x] 1.3.1 Write the round-trip impl test (ST-17: `format`-seed / printable-replace / `parse`-commit; host arg ignored by `Input`) — `packages/datagrid/test/cell-editor.impl.test.ts` ✅ (completed: 2026-07-13 12:32)
- [x] 1.3.2 Full verify (datagrid + core: typecheck/test/check:docs); confirm no other theme tripwire fired ✅ (completed: 2026-07-13 12:32) — core tripwire caught+fixed: `monochromeTheme` (presets.ts) + `rolesFromAliases` (roles.ts) also needed the two roles

**Deliverables**: `column.set`+`isEditable`, `createCellEditor`+default `Input`, two byte-frozen core roles.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs` + `yarn workspace @jsvision/core test check:docs`

---

## Phase 2: `EditableGridRows` — cursor, navigation, overpaint

Depends on Phase 1 (`gridCursor`). Spec-first (03-02). No editing yet — F2/Enter/printable fall through to the
base until Phase 3.

### Step 2.1: Specification tests

**Reference**: [03-02 §Navigation, §Cell overpaint] · [07 ST-12, ST-13]

- [x] 2.1.1 Write the cursor/nav spec (ST-12: `←`/`→`/`Home`/`End`/`Ctrl+Home`/`Ctrl+End` clamp; `↑`/`↓`/`PgUp`/`PgDn` fall through to the base; ST-13: focused-cell overpaint in `gridCursor` only when the body is focused) — `packages/datagrid/test/editable-grid-rows.spec.test.ts` ✅ (completed: 2026-07-13 12:41)
- [x] 2.1.2 Run — verify it FAILS (red) ✅ (completed: 2026-07-13 12:41)

### Step 2.2: Implementation

**Reference**: [03-02 §`EditableGridRows`] · AR #4, #8 (plan)

- [x] 2.2.1 Implement `EditableGridRows<T>` + `EditableGridRowsConfig<T>`: `focusedCol` + injected shared signals; `onEvent` nav intercept (`←`/`→`/`Home`/`End`/`Ctrl+Home`/`Ctrl+End`) + `super.onEvent` fall-through for row/mouse **and for `F2`/`Enter`/printable on a read-only cell** (PF-003); `moveCol`/`colFirst`/`colLast`/`gridStart`/`gridEnd` (clamp; grid-corner clamps). **`Tab`/`Shift-Tab` are not intercepted — deferred to RD-10 (an unbound Tab is swallowed by the dispatch router; PF-001).** — `packages/datagrid/src/editable-grid-rows.ts` ✅ (completed: 2026-07-13 12:41) — config kept minimal (base + `focusedCol`); editing/dirty fields join in Phases 3–4. F2/Enter/printable fall through wholesale in Phase 2 (no editing yet); the editable-vs-read-only split lands with begin-edit wiring in 3.2.3.
- [x] 2.2.2 Implement `draw` override: `super.draw` then `paintCursorCell` (fill + redraw the cell text in `gridCursor`, only when `this.state.focused`); add the `focusedCol` `bind` in `onMount` — `packages/datagrid/src/editable-grid-rows.ts` ✅ (completed: 2026-07-13 12:41)
- [x] 2.2.3 Run the spec — verify it PASSES (green) ✅ (completed: 2026-07-13 12:41)

### Step 2.3: Hardening

- [x] 2.3.1 Write impl tests (corner clamp exactness; overpaint math at H-scroll offsets + partial-width edge columns; `focusedCol` bind repaint) — `packages/datagrid/test/editable-grid-rows.impl.test.ts` ✅ (completed: 2026-07-13 12:45)
- [x] 2.3.2 Full verify (datagrid) ✅ (completed: 2026-07-13 12:45) — 18 files / 56 tests green; check:docs clean

**Deliverables**: a cell-cursor grid body with a `gridCursor` overpaint; nav reassigned, base row nav intact.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs`

---

## Phase 3: Editor-overlay lifecycle & commit

Depends on Phases 1–2 (`createCellEditor` + the cursor). Spec-first (03-02 §lifecycle). Await-close (AR #15).

### Step 3.1: Specification tests

**Reference**: [03-02 §lifecycle] · [07 ST-1…ST-6, ST-9] · req AR-02/16/18/19

- [ ] 3.1.1 Write the lifecycle spec (ST-1 read-only fall-through; ST-2 editable mounts + `getFocused`; ST-3 printable replaces; ST-4 route + Enter→next row `focusedCol` unchanged; ST-5 Esc reverts + no `onCommit`; ST-6 `onCommit` once / false-open / true-close; ST-9 one-cell overlay + owner disposal) — `packages/datagrid/test/editing.spec.test.ts`. **(ST-7 Tab/Shift-Tab wrap is deferred to RD-10; PF-001.)**
- [ ] 3.1.2 Run — verify it FAILS (red)

### Step 3.2: Implementation

**Reference**: [03-02 §begin-edit/commit/cancel] · AR #7, #13, #15 (plan)

- [ ] 3.2.1 Implement the edit-lifecycle FSM (`idle`/`editing`) + `beginEdit` (seed field, `createCellEditor`, wrap in an editor-host `Group`, `mountCellOverlay` fed the `ev.focusView` seam, focus the inner editor) — `packages/datagrid/src/editing.ts`
- [ ] 3.2.2 Implement `onEditorKey` (**Enter/Esc via the focus-chain bubble** — Tab is swallowed by the router before the bubble, deferred to RD-10; PF-001) + `cancel` (dispose + refocus body, no `onCommit`) + `commit` (parse → `commitCell` with `apply = column.set` → `bumpVersion` → close + advance-to-next-row on true / keep-open on veto) — `packages/datagrid/src/editing.ts`
- [ ] 3.2.3 Wire `EditableGridRows.onEvent` F2/Enter/printable → `beginEdit` **on an editable cell** (read-only → `super.onEvent`, base activate/select — PF-003); printable **detection + seed** use the `Input.insertPrintable` idiom (`!ctrl && !alt` and `key === 'space' || [...key].length === 1`; seed `key === 'space' ? ' ' : key`), **not** the non-existent `inner.char` (PF-002) — `packages/datagrid/src/editable-grid-rows.ts`
- [ ] 3.2.4 Run the spec — verify it PASSES (green)

### Step 3.3: Hardening

- [ ] 3.3.1 Write impl tests (veto keeps the field for re-editing; `version` bump repaints a mutated-in-place row; the per-cell `committing` guard = ST-14; async resolve ordering) **and verify the post-resolve repaint/focus actually flush headlessly for a deferred-async commit (PF-005)** — `packages/datagrid/test/editing.impl.test.ts`
- [ ] 3.3.2 Full verify (datagrid)

**Deliverables**: begin-edit (F2/Enter/type), commit (Enter) with revert-on-veto, cancel (Esc), Enter row-advance. (Tab commit-advance is RD-10.)
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs`

---

## Phase 4: Dirty tracking

Depends on Phase 3 (commit sets/clears dirty). Spec-first (03-03 §1).

### Step 4.1: Specification tests

**Reference**: [03-03 §1] · [07 ST-8] · AR #6 (plan)

- [ ] 4.1.1 Write the dirty spec (ST-8: `isDirty` flips true across a **deferred** async `onCommit` and false on resolve `true`; the body overpaints `•` in `gridDirty` for a cell present in the registry) — `packages/datagrid/test/dirty.spec.test.ts`
- [ ] 4.1.2 Run — verify it FAILS (red)

### Step 4.2: Implementation

**Reference**: [03-03 §1] · AR #6 (plan)

- [ ] 4.2.1 Implement `createDirtyRegistry` (reactive `Signal<ReadonlySet<string>>`, fresh-ref add/delete) + `cellKey` (NUL join); export — `packages/datagrid/src/editing.ts`, `src/index.ts`
- [ ] 4.2.2 Wire `dirty.add`/`delete` around `commit` (Phase 3) + implement `paintDirtyMarkers` (`•` at `x+w−1`, `gridDirty.fg` composed over the cell/cursor bg) + a `dirty.keys()` `bind` for reactive repaint — `packages/datagrid/src/editable-grid-rows.ts`, `src/editing.ts`
- [ ] 4.2.3 Run the spec — verify it PASSES (green)

### Step 4.3: Hardening

- [ ] 4.3.1 Write impl tests (registry reactivity; `cellKey` NUL join; `isRowDirty`/`isGridDirty` rollups) — `packages/datagrid/test/dirty.impl.test.ts`
- [ ] 4.3.2 Full verify (datagrid)

**Deliverables**: a reactive dirty registry, the `•` overpaint, and the `isDirty` + rollup readers.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs`

---

## Phase 5: Container integration

Depends on Phases 2–4. Spec-first (03-03 §2). Wires the pieces into `EditableDataGrid`.

### Step 5.1: Specification tests

**Reference**: [03-03 §2] · [07 ST-4, ST-6, ST-8 end-to-end] · AR #4, #5 (plan)

- [ ] 5.1.1 Extend the grid spec: the container owns + injects `focused`/`focusedCol`/`selected`/`indent`; `onCommit` threads to the body; `isDirty`/`isRowDirty`/`isGridDirty`; an end-to-end edit→commit repaints via `version` — `packages/datagrid/test/grid.spec.test.ts`
- [ ] 5.1.2 Run — verify it FAILS (red)

### Step 5.2: Implementation

**Reference**: [03-03 §2] · AR #4, #5 (plan)

- [ ] 5.2.1 `EditableDataGrid`: add `focusedCol`/`version`/`dirty` fields; fold `version()` into the `display` computed; construct `overlay` before `rows`; swap `GridRows`→`EditableGridRows` with the injected config; add `EditableDataGridOptions.onCommit` — `packages/datagrid/src/grid.ts`
- [ ] 5.2.2 Implement `isDirty` + `isRowDirty` + `isGridDirty`; update the `EditableDataGrid` `@example` to an editable column + `onCommit`; add re-exports (`EditableGridRows`, `createCellEditor`, `isEditable`, dirty registry) — `packages/datagrid/src/grid.ts`, `src/index.ts`
- [ ] 5.2.3 Reconcile the RD-01 grid render baseline with the new cursor overpaint (only if a prior assertion pinned focused-cell colors — a sanctioned baseline update since RD-02 adds a documented cursor; text-in-source-order stays asserted); run the specs — verify they PASS (green)
- [ ] 5.2.4 Full verify (datagrid) — no RD-01 grid regression beyond the reconciled cursor baseline

### Step 5.3: Hardening

- [ ] 5.3.1 Extend `grid.impl` (shared-signal ownership + injection; `onCommit` threading; `version` repaint end-to-end) — `packages/datagrid/test/grid.impl.test.ts`

**Deliverables**: `EditableDataGrid` owns the shared cursor, mounts the editable body, exposes `onCommit`/`isDirty`.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs`

---

## Phase 6: Editable story, security & final verify

Depends on Phase 5. Realizes AC-9 + AC-10 + the whole-plan gate (03-03 §3–4).

### Step 6.1: Story & security

**Reference**: [03-03 §3–4] · [07 ST-10, ST-11] · AC-9, AC-10 · AR #12 (plan)

- [ ] 6.1.1 Write the `editing` story (editable Name + read-only ID, a bound-state echo, nav/edit/commit hints, `onCommit` vetoing empty) + register it — `packages/datagrid/test/kitchen-sink/stories/editing.story.ts`, `.../stories/index.ts`
- [ ] 6.1.2 Extend the security spec (ST-11: a control byte typed + committed → the serialized frame has no raw ESC/BEL; a spy `onCommit` is the only mutation path) — `packages/datagrid/test/security.spec.test.ts`
- [ ] 6.1.3 Run the smoke (ST-10) + security (ST-11) — verify they PASS (a painting story + unique id + metadata; sanitized frame). If the story paints nothing, fix the story, not the test.

### Step 6.2: Final verification

**Reference**: [01 §Success criteria] · RD-02 AC-1…AC-10

- [ ] 6.2.1 Full `yarn verify` — green across `@jsvision/datagrid`, `@jsvision/core` (new roles), and `@jsvision/ui` (allowlist edits); no core/ui regression
- [ ] 6.2.2 Confirm every RD-02 AC-1…AC-10 is realized by a green ST-1…ST-17 (map in [07](07-testing-strategy.md))

**Deliverables**: an editable showcase story + security proof; the whole editing engine green under `yarn verify`.
**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (surface: set + factory + roles)
   └─→ Phase 2 (cursor + overpaint)  ─┐
                                      ├─→ Phase 3 (lifecycle + commit) ─→ Phase 4 (dirty) ─→ Phase 5 (container) ─→ Phase 6
   └────────────────────────────────┘   (Phase 3 also needs Phase 1's createCellEditor + column.set)
```

Phase 1 blocks everything (roles + write seam + factory). Phase 2 needs `gridCursor`. Phase 3 needs the cursor
(2) + the editor factory/write seam (1). Phase 4 needs commit (3). Phase 5 integrates 2–4. Phase 6 stories the
container (5). Strictly sequential in practice.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 6 phases completed (43 tasks `[x]`)
2. ✅ `yarn verify` passing (datagrid + core + ui; incl. `check:docs`/`check:deps`)
3. ✅ No warnings/errors; no core/ui regression (theme suites + `DataGrid` green; only the sanctioned allowlist + cursor-baseline updates)
4. ✅ No dead code — no unused parameters, functions, classes, or modules
5. ✅ Security hardened — editor text through `sanitize` (ST-11); no out-of-band persistence; zero native deps
6. ✅ Documentation updated — every public export has an `@example`; user/agent-facing JSDoc, no banned refs
7. ✅ RD-02 AC-1…AC-10 all realized by green ST-1…ST-17 (except AC-6/ST-7 — Tab — deferred to RD-10; PF-001)
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
