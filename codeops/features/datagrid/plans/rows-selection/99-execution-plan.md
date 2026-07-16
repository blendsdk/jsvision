# Execution Plan: Rows, Records & Selection

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-16 15:24
> **Progress**: 34/50 tasks (68%)
> **CodeOps Skills Version**: 3.7.0

## Overview

RD-08 (Rows, Records & Selection) for `@jsvision/datagrid`, phased **data-plane-first** so acceptance
criteria land incrementally: the pure `selection.ts` model, then the container selection state +
gestures + paint, then the synthetic checkbox/gutter columns, then row CRUD, then the null policy,
then story + showcase + security. Every phase follows spec-first ordering (spec tests → red →
implement → green → impl tests → verify). **Zero `@jsvision/core`/`@jsvision/ui` change** (AR-1) —
selection paint reuses the datagrid body's own `draw()` override.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks | ACs |
| ----- | ----- | ----- | --- |
| 1 | Selection model (`selection.ts`, pure) | 7 | — (data plane) |
| 2 | Container selection state + gestures + set-membership paint | 9 | AC-1, AC-2, AC-4 |
| 3 | Synthetic columns: checkbox + row-number gutter | 9 | AC-3, AC-7 |
| 4 | Row CRUD (`RowMutations` seam + insert/delete/duplicate) | 9 | AC-5, AC-9 (mutation) |
| 5 | Null policy (per-column null vs empty) | 8 | AC-6 |
| 6 | Kitchen-sink story + showcase + security + hardening | 8 | AC-8, AC-9 |

**Total: 50 tasks across 6 phases.**

> **⚠️ EXECUTION RULE:** the checkboxes below are the single source of truth. Each task appears once.
> On implementation → `[~]` + `(implemented: YYYY-MM-DD HH:MM)`; on verify pass → `[x]` +
> `(completed: …)`. Update the Progress header after every task; only `[x]` counts. Resume by scanning
> top-to-bottom: first `[~]`, else first `[ ]`. Timestamps from `date '+%Y-%m-%d %H:%M'`.

---

## Phase 1: Selection model (`selection.ts`, pure)

**Reference**: `03-01` · `07 §Selection model` (ST-1…ST-7) · AR-9/AR-2/AR-10

### Step 1.1: Specification tests (red)
- [x] 1.1.1 Write `selection.spec.test.ts` (ST-1 toggle add/remove; ST-2 single replace; ST-3/ST-4 range forward+backward; ST-5 selectAll+clear; ST-6 triState none/some/all; ST-7 single-collapse + stale anchor) — `packages/datagrid/test/selection.spec.test.ts` (completed: 2026-07-16 14:14)
- [x] 1.1.2 Verify **red** — no `selection.ts` yet (completed: 2026-07-16 14:14 — import of `../src/selection.js` fails to resolve)

### Step 1.2: Implement (green)
- [x] 1.2.1 Create `selection.ts`: `Key`/`SelectionMode`/`TriState` types + pure `toggleKey`/`selectRange`/`selectAll`/`triState` (JSDoc + `@example`) — `packages/datagrid/src/selection.ts` (completed: 2026-07-16 14:15)
- [x] 1.2.2 Barrel: export the public types + pure ops — `packages/datagrid/src/index.ts` (completed: 2026-07-16 14:15)
- [x] 1.2.3 Verify **green** — ST-1…ST-7 pass (completed: 2026-07-16 14:15)

### Step 1.3: Impl tests & verify
- [x] 1.3.1 Write `selection.impl.test.ts` (absent-key toggle single vs multi; anchor == target; whole-display range; empty-set triState) — `packages/datagrid/test/selection.impl.test.ts` (completed: 2026-07-16 14:17)
- [x] 1.3.2 Full `yarn verify` (completed: 2026-07-16 14:17 — 30/30 turbo tasks + check-plugin PASS, TUI_SKIP_PERF=1)

**Deliverables**: pure selection model green; barrel updated. **Verify**: `yarn verify`

---

## Phase 2: Container selection state + gestures + set-membership paint

**Reference**: `03-02` · `07 §Container selection` (ST-8…ST-12) · AR-1/AR-2/AR-9/AR-10/AR-13

### Step 2.1: Specification tests (red)
- [x] 2.1.1 Write `grid-selection.spec.test.ts` (ST-8 Space toggle on a read-only cell single/multi; **ST-8b Space on an editable cell begins edit, selection unchanged; ST-8c plain click is cursor-only, selection unchanged**; ST-9 Shift range; ST-10 keys survive re-sort; ST-11 selected-role paint + precedence; ST-12 Ctrl+click toggle) — `packages/datagrid/test/grid-selection.spec.test.ts`
- [x] 2.1.2 Verify **red**

### Step 2.2: Implement (green)
- [x] 2.2.1 `grid.ts`: add `selectedKeys = signal<ReadonlySet<Key>>(new Set())` + `anchorKey` + `selectionMode` (from `opts.selectionMode ?? 'multi'`); **keep** `selected = signal(-1)` (the base's required, base-written click sink — removing it needs a ui change, forbidden by AR-1; AR-16); **remove only the selection half** of the sort/filter reconcile (the `selAnchor` lines at `:890`/`913`/`937`/`942`; keep the focus half) — a key set survives with no reconcile (AR-10) — `packages/datagrid/src/grid.ts`
- [x] 2.2.2 `editable-grid-rows.ts`: body config **adds** `selectedKeys: Signal<ReadonlySet<Key>>` **beside** the kept base `selected: Signal<number>` (AR-16); migrate **both** paint sites to `selectedKeys.has(rowKey(row))` — `draw()` role at `:480`–`:492` (feeding `rowOwns`/`CellState.selected` unchanged, AR-13) **and** `paintDirtyMarkers()` at `:581` (uses `rk` already in scope at `:568`) (AR-18); **override `select()`** to a cursor-only no-op so the base's per-click `selected.set(index)` no longer highlights (AR-17); repaint binds `selectedKeys` — `packages/datagrid/src/editable-grid-rows.ts`
- [x] 2.2.3 `editable-grid-rows.ts`: selection gestures in `onEvent` — `Space` toggles selection **only on a read-only focused cell** (on an editable cell `tryBeginEdit` keeps `Space`=begin-edit, `:318`, untouched; AR-19), `Ctrl`+click, `Shift`+click, `Shift`+`↑`/`↓` → injected `onToggleRow`/`onRangeToRow` callbacks; plain click is cursor-only (no selection change, via the `select()` override) — `packages/datagrid/src/editable-grid-rows.ts`
- [x] 2.2.4 `grid.ts`: wire the callbacks to the pure ops (`rowIndex`→key via `display()`; `toggleKey`/`selectRange`; set/clear `anchorKey`); add the public API (`selectedKeys`/`selectRow`/`toggleRow`/`selectRange`/`selectAllDisplayed`/`clearSelection`) + the `selectionMode` option with `@example` — `packages/datagrid/src/grid.ts`, `index.ts`
- [x] 2.2.5 Verify **green** — ST-8…ST-12 pass (AC-1, AC-2, AC-4)

### Step 2.3: Impl tests & verify
- [x] 2.3.1 Write `grid-selection.impl.test.ts` (anchor defaults to the focused row; single-mode Ctrl/Shift collapse to one key; selection highlight spans frozen panels; **a dirty `•` on a selected row keeps the `listSelected` background — the `paintDirtyMarkers` second site, AR-18**; **a plain click leaves `selectedKeys` unchanged — the `select()` override, AR-17**; **`grid.ts` line count checked ≤ ~1050 — extract a helper if exceeded, AR-6**) — `packages/datagrid/test/grid-selection.impl.test.ts`
- [x] 2.3.2 Full `yarn verify`

**Deliverables**: reactive multi/single selection + gestures + `selected`-role paint at both sites (AC-1/AC-2/AC-4); base `selected` kept as the click sink (AR-16), datagrid selection driven by `selectedKeys` with a cursor-only `select()` override (AR-17). **Verify**: `yarn verify`

---

## Phase 3: Synthetic columns — checkbox + row-number gutter

**Reference**: `03-03` · `07 §Synthetic columns` (ST-13…ST-15) · AR-5/AR-7/AR-11

### Step 3.1: Specification tests (red)
- [x] 3.1.1 Write `synthetic-columns.spec.test.ts` (ST-13 checkbox per-row toggle + tri-state header + stays pinned on H-scroll; ST-14 select-all over the filtered display; ST-15 gutter 1-based renumber after sort) — `packages/datagrid/test/synthetic-columns.spec.test.ts`
- [x] 3.1.2 Verify **red**

### Step 3.2: Implement (green)
- [x] 3.2.1 Create `synthetic-columns.ts`: `SyntheticPrefix`, `prefixWidth`, `checkboxGlyph`, `headerCheckboxGlyph`, `gutterLabel` (JSDoc + `@example`) — `packages/datagrid/src/synthetic-columns.ts`
- [x] 3.2.2 `grid-panels.ts`: prepend a fixed-width prefix segment to the leftmost panel's header + body + frozen-rows band (left frozen panel when `freeze*`, else the single body); fixed-x, non-scrolling (AR-11) — `packages/datagrid/src/grid-panels.ts`
- [x] 3.2.3 `grid.ts` + `grid-panels.ts`: `checkboxColumn?`/`rowNumbers?` options; per-row checkbox click → `toggleRow`; header box click → `selectAllDisplayed`/`clearSelection` by tri-state (over the **display** set, AR-7); gutter renders the 1-based display number — `packages/datagrid/src/grid.ts`, `grid-panels.ts`
- [x] 3.2.4 Barrel + `EditableDataGridOptions` docs (`checkboxColumn`/`rowNumbers`) + `@example` — `packages/datagrid/src/index.ts`, `grid.ts`
- [x] 3.2.5 Verify **green** — ST-13…ST-15 pass (AC-3, AC-7)

### Step 3.3: Impl tests & verify
- [x] 3.3.1 Write `synthetic-columns.impl.test.ts` (prefix alignment header↔body↔frozen-rows band; prefix composes with frozen columns; `prefixWidth` 0 leaves the no-prefix body byte-identical) — `packages/datagrid/test/synthetic-columns.impl.test.ts`
- [x] 3.3.2 Full `yarn verify`

**Deliverables**: opt-in checkbox column (tri-state header, AC-3) + row-number gutter (AC-7), left-pinned. **Verify**: `yarn verify`

---

## Phase 4: Row CRUD (`RowMutations` seam + insert/delete/duplicate)

**Reference**: `03-04` · `07 §Row CRUD` (ST-16…ST-18) + `§Security` (ST-21 mutation) · AR-4/AR-12/AR-9

### Step 4.1: Specification tests (red)
- [x] 4.1.1 Write `row-crud.spec.test.ts` (ST-16 insert at source index grows length; ST-17 delete removes + de-selects; ST-18 duplicate with/without `assignKey`) — `packages/datagrid/test/row-crud.spec.test.ts`
- [x] 4.1.2 Add the **mutation half** of ST-21 to `security.spec.test.ts` (a read-only source without `insert`/`remove` is never mutated by `insertRow`/`deleteRows`) — `packages/datagrid/test/security.spec.test.ts`
- [x] 4.1.3 Verify **red**

### Step 4.2: Implement (green)
- [x] 4.2.1 `data-source.ts`: add optional `insert?(row, at?)`/`remove?(keys)` to `GridDataSource`; `fromRows` implements both by splicing the `Signal<T[]>` (new array) — `packages/datagrid/src/data-source.ts`
- [x] 4.2.2 `grid.ts`: `insertRow(row, at?)` (source index, append default), `deleteRows(keys)` (seam + prune `selectedKeys`/`anchorKey`, AR-12), `duplicateRow(key)` (`structuredClone` + `assignKey` hook; no hook ⇒ no-op + `devWarn`) + the `assignKey?` option. The row-mutation logic is extracted to `row-mutations.ts` (`RowMutations<T>`, the twin of `GridSelection`) so grid.ts stays thin delegators under the line guard — `packages/datagrid/src/grid.ts`, `row-mutations.ts`
- [x] 4.2.3 Barrel + `RowMutations`/`assignKey` docs + `@example` — `packages/datagrid/src/index.ts`, `grid.ts`, `data-source.ts`
- [x] 4.2.4 Verify **green** — ST-16…ST-18 + ST-21 (mutation) pass (AC-5)

### Step 4.3: Impl tests & verify
- [x] 4.3.1 Write `row-crud.impl.test.ts` (insert under an active client sort lands by value; delete of a non-selected key leaves the selection intact; read-only source no-ops; **`duplicateRow` on a non-structured-cloneable row → devWarn + no-op, no partial insert, AR-21/PF-008**) — `packages/datagrid/test/row-crud.impl.test.ts`
- [x] 4.3.2 Full `yarn verify`

**Deliverables**: insert/delete/duplicate via the mutation seam; delete de-selects (AC-5); no mutation outside `RowMutations` (AC-9 mutation half). **Verify**: `yarn verify`

---

## Phase 5: Null policy (per-column null vs empty)

**Reference**: `03-05` · `07 §Null policy` (ST-19…ST-20) · AR-3/AR-15

### Step 5.1: Specification tests (red)
- [ ] 5.1.1 Write `null-policy.spec.test.ts` (ST-19 null renders `nullDisplay`, round-trips distinct from `''`; ST-20 empty commit → null on nullable, `''` on non-nullable) — `packages/datagrid/test/null-policy.spec.test.ts`
- [ ] 5.1.2 Verify **red**

### Step 5.2: Implement (green)
- [ ] 5.2.1 `column.ts`: add `readonly nullable?`/`nullDisplay?` to `GridColumn`; `toEngineColumn` accessor renders `nullDisplay ?? ''` for a nullish value **before** `format`/`String` — `packages/datagrid/src/column.ts`
- [ ] 5.2.2 Commit lowering in the edit controller (`editing.ts` `createEditController.commit()`, at the `tcol.parse!(field())` call `:274` — **not** `commitCell`/`editable-grid-rows.ts`, AR-20): an empty editor value (`''`) on a `nullable` column commits `null` (bypasses `parse`); non-nullable keeps today's behavior. Thread `nullable` onto the typed column the controller reads — `packages/datagrid/src/editing.ts`, `column.ts`
- [ ] 5.2.3 Barrel/docs for `nullable`/`nullDisplay` + `@example` — `packages/datagrid/src/index.ts`, `column.ts`
- [ ] 5.2.4 Verify **green** — ST-19, ST-20 pass (AC-6)

### Step 5.3: Impl tests & verify
- [ ] 5.3.1 Write `null-policy.impl.test.ts` (null renders `''` with no `nullDisplay`; a non-null value is unaffected; a numeric non-nullable empty commit still rejects) — `packages/datagrid/test/null-policy.impl.test.ts`
- [ ] 5.3.2 Full `yarn verify`

**Deliverables**: per-column null render + empty→null on nullable (AC-6); null vs `''` distinct. **Verify**: `yarn verify`

---

## Phase 6: Kitchen-sink story + showcase + security + hardening

**Reference**: `07 §Story & showcase` (ST-22, ST-23) + `§Security` (ST-21 sanitize) · CLAUDE.md §Kitchen-sink + §Documentation · AR-8

### Step 6.1: Kitchen-sink story (smoke)
- [ ] 6.1.1 Add `rows-selection.story.ts` (multi-row selection + checkbox column + row-number gutter, with a live `selectedKeys()` echo) + register in `stories/index.ts` — `packages/datagrid/test/kitchen-sink/stories/`
- [ ] 6.1.2 Verify the story passes `kitchen-sink.smoke.spec.test.ts` (ST-22, AC-8)

### Step 6.2: datagrid-showcase cluster (AR-8)
- [ ] 6.2.1 Replace the RD-08 "coming soon" placeholder with a live "Rows & selection" demo cluster (multi-select · checkbox column · gutter · row CRUD · null policy) under `stories/rows-selection/` + register — `packages/examples/datagrid-showcase/`
- [ ] 6.2.2 Re-base the showcase oracle: RD-08 placeholder removed (RD-09…14 remain), +1 category cluster — update the counts in `datagrid-showcase.smoke.spec.test.ts` (ST-23; the sanctioned requirement-changed oracle edit) — `packages/examples/test/`
- [ ] 6.2.3 Verify the showcase smoke + walkthrough tiers pass (ST-23)

### Step 6.3: Security & hardening (final gate)
- [ ] 6.3.1 Add the **sanitize half** of ST-21 to `security.spec.test.ts` (header/cell text stays sanitized after insert/duplicate/select-all/reorder); verify green (AC-9) — `packages/datagrid/test/security.spec.test.ts`
- [ ] 6.3.2 JSDoc + `@example` on every new public export; `yarn check:docs` green; **plus a plain `grep` for banned CodeOps ids** across `packages/datagrid/src` + `packages/examples` (the check:docs scanner truncates on `grid.ts`)
- [ ] 6.3.3 Full `yarn verify` (final gate — no datagrid/examples regressions)

**Deliverables**: `rows-selection` story (AC-8) + showcase cluster (AR-8); AC-9 security confirmed (mutation + sanitize); full `yarn verify` green. **Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (selection model, pure)
    ↓
Phase 2 (container selection + gestures + paint)   ← AC-1, AC-2, AC-4
    ↓
Phase 3 (synthetic checkbox + gutter)              ← AC-3, AC-7
    ↓
Phase 4 (row CRUD + mutation seam)                 ← AC-5, AC-9 (mutation)
    ↓
Phase 5 (null policy)                              ← AC-6
    ↓
Phase 6 (story + showcase + security + hardening)  ← AC-8, AC-9
```

Phase 3 depends on Phase 2 (the checkbox drives the selection API). Phase 4's delete-prunes-selection
depends on Phase 2's selection state. Phases 4 and 5 are independent of each other and could interleave,
but are sequenced (CRUD first) to keep each phase's spec suite isolated.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 50 tasks complete
2. ✅ `yarn verify` green (lint + typecheck + build + test + check:docs)
3. ✅ No dead code; **no `@jsvision/core`/`@jsvision/ui` change** (selection paint reuses the datagrid body's own `draw()` override, AR-1)
4. ✅ Security: no mutation outside `RowMutations`; text sanitized after any CRUD/selection change; inserted values validated (AC-9)
5. ✅ `@example` on every new public export; `check:docs` green (+ plain-grep banned-ref check)
6. ✅ RD-08 AC-1…AC-9 satisfied (Must-Have; the Should-Have `*`-row / navigator / drag stay Phase B/C)
7. ✅ Kitchen-sink `rows-selection` story + datagrid-showcase cluster green (AC-8, AR-8)
8. ✅ `grid.ts` kept within the size guideline (extract a helper if it crossed ~1050, AR-6)
9. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
