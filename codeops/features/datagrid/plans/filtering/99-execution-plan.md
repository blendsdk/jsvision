# Execution Plan: Filtering

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-15 13:37
> **Progress**: 0/45 tasks (0%)
> **CodeOps Skills Version**: 3.7.0

## Overview

Excel-class column filtering for `@jsvision/datagrid` (RD-06), all Must-Haves in one plan (AR #1),
phased **data-plane-first** so acceptance criteria land incrementally: the pure model, then the
container API + push-down, then the always-visible UI (quick-filter row + funnel), then the two
anchored popups, then the story + security hardening. Every phase follows spec-first ordering (spec
tests → red → implement → green → impl tests → verify) and mirrors the RD-05 sort architecture.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Filter model (`filter.ts`) | 9 |
| 2 | Container API + push-down + count (`grid.ts`) | 7 |
| 3 | Quick-filter row + funnel header | 10 |
| 4 | Condition-filter popup | 8 |
| 5 | Value-list popup + distinct | 7 |
| 6 | Kitchen-sink story + security + hardening | 4 |

**Total: 45 tasks across 6 phases.**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Each task line appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** and Last Updated after EVERY task — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

---

## Phase 1: Filter model (`filter.ts`)

### Step 1.1: Specification tests (red)

**Reference**: `03-01 §Implementation Details` · `07 §Filter model` (ST-1…ST-11) · AR #4/#6/#8/#9/#10/#14
**Objective**: Lock the model's behavior before it exists.

- [ ] 1.1.1 Write `filter.spec.test.ts` covering ST-1…ST-11 (text/number/date/set/custom predicates, `filterRows` AND + empty + unknown-drop + non-mutation, `computeDistinct`, `resolveFilterType`) — `packages/datagrid/test/filter.spec.test.ts`
- [ ] 1.1.2 Verify **red** — the spec tests fail (no `filter.ts` yet)

### Step 1.2: Implement (green)

**Reference**: `03-01` · AR #6
**Objective**: The pure model, re-pointed seams, and barrel.

- [ ] 1.2.1 Create `filter.ts`: `ColumnFilter`, `FilterModel`, `DistinctResult`, `FilterType`, `displayLabel`, `filterPredicate`, `filterRows`, `computeDistinct`, `resolveFilterType` (JSDoc + `@example` on public exports) — `packages/datagrid/src/filter.ts`
- [ ] 1.2.2 Add `readonly filterType?: FilterType` to `GridColumn` — `packages/datagrid/src/column.ts`
- [ ] 1.2.3 Re-point `data-source.ts`: import `FilterModel`/`DistinctResult` from `filter.ts` (drop the placeholder `FilterModel`); widen `distinct?` → `Promise<DistinctResult>` — `packages/datagrid/src/data-source.ts`
- [ ] 1.2.4 Barrel: export `filterRows`/`computeDistinct` + `ColumnFilter`/`FilterModel`/`DistinctResult`/`FilterType` types (re-point `FilterModel` here) — `packages/datagrid/src/index.ts`
- [ ] 1.2.5 Verify **green** — ST-1…ST-11 pass

### Step 1.3: Impl tests & verify

- [ ] 1.3.1 Write `filter.impl.test.ts` (edges: `between` `b`-omitted, nil under each kind, `dateOrdinal` boundaries, collator ties, non-mutation) — `packages/datagrid/test/filter.impl.test.ts`
- [ ] 1.3.2 Full `yarn verify`

**Deliverables**: `filter.ts` green; `FilterModel`/`distinct` seams re-pointed; barrel updated.
**Verify**: `yarn verify`

---

## Phase 2: Container API + push-down + count (`grid.ts`)

### Step 2.1: Specification tests (red)

**Reference**: `03-04 §Filter API/composition/push-down` · `07 §Container wiring` (ST-12…ST-16), `§Security` (ST-15, ST-27) · AR #7/#13
**Objective**: Lock the container's filter behavior.

- [ ] 2.1.1 Write `grid-filter.spec.test.ts` (ST-12 setFilter/count, ST-13 clearFilter, ST-14 push-down spy no-client-filter, ST-16 filter-then-sort composition) — `packages/datagrid/test/grid-filter.spec.test.ts`
- [ ] 2.1.2 Add ST-15 (unknown-column no-op, never forwarded) + ST-27 (structured push-down model, no query concatenation) to `security.spec.test.ts` — `packages/datagrid/test/security.spec.test.ts`
- [ ] 2.1.3 Verify **red**

### Step 2.2: Implement (green)

**Reference**: `03-04` · AR #2/#7/#13
**Objective**: Filter signal, `display` composition, push-down, API, count, re-anchor.

- [ ] 2.2.1 `grid.ts`: add `filters = signal<FilterModel<T>>(new Map())`; rewrite `display` to filter-then-sort (each half client-side only when its push-down seam is absent); add the `setFilter` push-down effect beside the sort one — `packages/datagrid/src/grid.ts`
- [ ] 2.2.2 `grid.ts`: add the filter API (`setFilter`/`clearFilter`/`filterModel`/`filteredCount`/`totalCount`) with the unknown-column guard, and `applyFilter` cursor/selection re-anchor (clamp on a row-removing filter) — `packages/datagrid/src/grid.ts`
- [ ] 2.2.3 Verify **green** — ST-12…ST-16, ST-15, ST-27 pass

### Step 2.3: Verify

- [ ] 2.3.1 Full `yarn verify`

**Deliverables**: reactive filter API + client filtering + `setFilter` push-down + N-of-M count.
**Verify**: `yarn verify`

---

## Phase 3: Quick-filter row + funnel header

### Step 3.1: Specification tests (red)

**Reference**: `03-02` · `07 §Quick-filter row & funnel` (ST-17…ST-20) · AR #3/#4/#11/#12
**Objective**: Lock the always-visible UI behavior.

- [ ] 3.1.1 Write `quick-filter-row.spec.test.ts` (ST-17 band absent unless `quickFilter`; ST-18 typing sets `text/contains`, clearing removes) — `packages/datagrid/test/quick-filter-row.spec.test.ts`
- [ ] 3.1.2 Add ST-19 (funnel glyph on a filtered column, gone when cleared) + ST-20 (funnel-cell click → `onFunnelClick`; title click → sort) to `sort-header.spec.test.ts` — `packages/datagrid/test/sort-header.spec.test.ts`
- [ ] 3.1.3 Verify **red**

### Step 3.2: Implement (green)

**Reference**: `03-02` · `03-04 §quick-filter band/funnel` · AR #11/#12/#18
**Objective**: The band, the funnel, and their container wiring.

- [ ] 3.2.1 Create `QuickFilterRow<T>`: one `Input` per column over the shared geometry/indent, `onQuickFilter(columnId, text)` (JSDoc + `@example`) — `packages/datagrid/src/quick-filter-row.ts`
- [ ] 3.2.2 Extend `SortHeader`: add `filterModel`/`onFunnelClick` config (the click **forwards the live `DispatchEvent`** — the focus/popup seam, AR #18), draw the funnel `▽` in a reserved cell on filtered columns, and route a funnel-cell click before the title click — `packages/datagrid/src/sort-header.ts`
- [ ] 3.2.3 `grid.ts`: add the `quickFilter?: boolean` option + mount the `QuickFilterRow` band between header and body when set; pass `filterModel`/`onFunnelClick` to `SortHeader` (`onFunnelClick` → a placeholder `openFilterPopup(columnId, anchor, ev)` no-op carrying the **final** signature incl. the forwarded `ev`, filled in Phase 4 — AR #18) — `packages/datagrid/src/grid.ts`
- [ ] 3.2.4 Barrel: export `QuickFilterRow` + `QuickFilterRowConfig`; extend `EditableDataGridOptions` (`quickFilter`) — `packages/datagrid/src/index.ts`
- [ ] 3.2.5 Verify **green** — ST-17…ST-20 pass

### Step 3.3: Impl tests & verify

- [ ] 3.3.1 Write `quick-filter-row.impl.test.ts` (indent/geometry reposition, off-screen Input clipping, band height) — `packages/datagrid/test/quick-filter-row.impl.test.ts`
- [ ] 3.3.2 Full `yarn verify`

**Deliverables**: opt-in quick-filter row (AC-1) + header funnel indicator + funnel-click routing (AC-4).
**Verify**: `yarn verify`

---

## Phase 4: Condition-filter popup

### Step 4.1: Specification tests (red)

**Reference**: `03-03 §FilterPopup` · `07 §Filter popups` (ST-21, ST-22) · AR #11/#14
**Objective**: Lock the operator sets + operand behavior.

- [ ] 4.1.1 Write `filter-popup.spec.test.ts` (ST-21 operator set per `filterType`; ST-22 number `between` reveals second operand + Apply emits `{number,between,a,b}`) — `packages/datagrid/test/filter-popup.spec.test.ts`
- [ ] 4.1.2 Verify **red**

### Step 4.2: Implement (green)

**Reference**: `03-03` · `03-04 §Funnel → popup` · AR #11/#14/#18
**Objective**: The condition popup + real anchoring (the funnel forwards the live `DispatchEvent`; the mount reuses `ev.focusView`/`ev.popupHost`, AR #18).

- [ ] 4.2.1 Create `FilterPopup<T>`: type-appropriate condition section (text/number/date operators + operand inputs, second operand for `between`), `onApply`/`onClear`/`onClose` (JSDoc + `@example`) — `packages/datagrid/src/filter-popup.ts`
- [ ] 4.2.2 `grid.ts`: implement `openFilterPopup(columnId, anchor, ev)` (resolve `filterType`, build `FilterPopup`, anchor via `absoluteRect(header)` + funnel anchor) mounting into a dedicated `popupOverlay` (hit-transparent when empty) via `mountCellOverlay` with `loop: { focusView: (v) => ev.focusView?.(v) }`, the popup's nested widgets consuming the spread envelope (AR #18); route Apply/Clear to `setFilter`/`clearFilter` — `packages/datagrid/src/grid.ts`
- [ ] 4.2.3 Barrel: export `FilterPopup` + `FilterPopupConfig` — `packages/datagrid/src/index.ts`
- [ ] 4.2.4 Verify **green** — ST-21, ST-22 pass (AC-2)

### Step 4.3: Impl tests & verify

- [ ] 4.3.1 Write `filter-popup.impl.test.ts` (reopen pre-filled with `current`; Escape/click-away close; anchoring) — `packages/datagrid/test/filter-popup.impl.test.ts`
- [ ] 4.3.2 Full `yarn verify`

**Deliverables**: funnel opens a working condition popup; number `between` filter (AC-2).
**Verify**: `yarn verify`

---

## Phase 5: Value-list popup + distinct

### Step 5.1: Specification tests (red)

**Reference**: `03-03 §ValueList/distinct` · `07 §Filter popups` (ST-23…ST-26) · AR #5/#9/#10
**Objective**: Lock the distinct picker + truncation disclosure.

- [ ] 5.1.1 Write `value-list-popup.spec.test.ts` (ST-23 check-subset + Select All on client distinct; ST-24 uses `source.distinct` when present; ST-25 `truncated` disclosure; ST-26 type-ahead search narrows visible labels) — `packages/datagrid/test/value-list-popup.spec.test.ts`
- [ ] 5.1.2 Verify **red**

### Step 5.2: Implement (green)

**Reference**: `03-03` · `03-04 §Distinct delegation` · AR #5/#9/#10
**Objective**: The value-list + distinct delegation embedded in the popup.

- [ ] 5.2.1 Create `ValueList`: async-populated distinct checkbox list + type-ahead search + Select All + truncation note; emits `{kind:'set',selected}` (JSDoc + `@example`) — `packages/datagrid/src/value-list-popup.ts`
- [ ] 5.2.2 `grid.ts`: add `distinctFor(columnId)` (client `computeDistinct` vs. `source.distinct`); pass a `distinct` thunk into `FilterPopup`, which embeds `ValueList` — `packages/datagrid/src/grid.ts`, `packages/datagrid/src/filter-popup.ts`
- [ ] 5.2.3 Barrel: export `ValueList` + `ValueListConfig` — `packages/datagrid/src/index.ts`
- [ ] 5.2.4 Verify **green** — ST-23…ST-26 pass (AC-3, AC-7)

### Step 5.3: Verify

- [ ] 5.3.1 Full `yarn verify`

**Deliverables**: Excel value-list (AC-3) + distinct enumeration + truncation disclosure (AC-7).
**Verify**: `yarn verify`

---

## Phase 6: Kitchen-sink story + security + hardening

### Step 6.1: Story (smoke)

**Reference**: `07 §Security & story` (ST-28) · CLAUDE.md §Kitchen-sink showcase · AR #2
**Objective**: The live demo + reactive N-of-M echo.

- [ ] 6.1.1 Add `filtering.story.ts` (quick-filter row + a value-list filter over region/qty/closed columns, with a live `Text(() => 'N of M')` echo of `filteredCount()`/`totalCount()`) + register in `stories/index.ts` — `packages/datagrid/test/kitchen-sink/stories/filtering.story.ts`, `.../stories/index.ts`
- [ ] 6.1.2 Verify the story passes `kitchen-sink.smoke.spec.test.ts` (ST-28)

### Step 6.2: Hardening & final gate

**Reference**: CLAUDE.md §Documentation · `03-*` · AR #2
**Objective**: Docs + full green.

- [ ] 6.2.1 JSDoc + `@example` pass on every new public export; `yarn check:docs` green (no banned refs, `@example` present)
- [ ] 6.2.2 Full `yarn verify` (final gate — lint + typecheck + build + test + check:docs; no regressions in the datagrid suite)

**Deliverables**: `filtering` story (AC-8); AC-9 security confirmed; full `yarn verify` green.
**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (filter model)
    ↓
Phase 2 (container API + push-down + count)
    ↓
Phase 3 (quick-filter row + funnel)   ← AC-1, AC-4
    ↓
Phase 4 (condition popup)             ← AC-2
    ↓
Phase 5 (value-list + distinct)       ← AC-3, AC-7
    ↓
Phase 6 (story + security + hardening) ← AC-8, AC-9
```

AC-5 (AND) and AC-6 (push-down) are satisfied at the model/container level (Phases 1–2).

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (`yarn verify`)
3. ✅ No warnings/errors
4. ✅ No dead code — no unused parameters, functions, classes, or modules
5. ✅ Security hardened — filter operands passed as structured literals to `setFilter`; the grid never
   builds a query; unknown-column filters ignored (AC-9)
6. ✅ Documentation updated — `@example` on every new public export; `check:docs` green
7. ✅ RD-06 acceptance criteria AC-1…AC-9 all satisfied
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
