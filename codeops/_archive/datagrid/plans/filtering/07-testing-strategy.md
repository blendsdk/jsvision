# Testing Strategy: Filtering

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Filter model (`filter.ts`) — core logic | 90% |
| Container wiring / distinct delegation | 85% |
| UI (quick-filter row, funnel header, popups) | 70% |

- Test names state behavior: `should [expected] when [condition]`.
- `filter.ts` is pure (no signals/views) → directly unit-testable, like `sort.ts`.
- UI tests mount headlessly (a `RenderRoot` + `render.flush()`) and drive synthetic mouse/text events,
  as the RD-05 `sort-header` and RD-03 editor tests do.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from RD-06, the `03-XX` specs, and the Ambiguity Register. Immutable oracle: if
> the implementation disagrees with an ST case, the implementation is wrong. The `Source` ids below
> stay in this plan — a generated `.spec.test` file quotes the behavior in plain language, never an
> `ST-`/`AR`/`RD` id or a `requirements/` path (per the JSDoc ban).

### Filter model — `filter.ts` (Phase 1)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `text` `contains` `'ali'` over rows formatted `'Alice'`, `'Bob'` (case-insensitive) | Keeps `'Alice'` only; `'ALI'` needle matches too | AC-1 / AR #4 |
| ST-2 | `text` `startsWith` / `endsWith` / `equals` `'a'` variants | `startsWith`→`'Alice'`; `endsWith 'e'`→`'Alice'`; `equals 'alice'` (folded)→`'Alice'` | AR #4 |
| ST-3 | `number` `between` `{a:100,b:500}` over values `50,100,300,500,900` (currency-formatted) | Keeps `100,300,500` (inclusive), evaluated on the numeric value not `'$300,00'` | AC-2 |
| ST-4 | `number` `gt 100` / `lt 100` / `eq 100` | `gt`→`>100`; `lt`→`<100`; `eq`→`===100`; a non-numeric value never matches | AR #14 |
| ST-5 | `date` `before`/`after`/`on`/`between` over `Date` values and `CalendarDate` values, operands `CalendarDate` | Day-ordinal comparison; `on`=same day; `between` inclusive; mixed `Date`/`CalendarDate` compare by day | RD §Filter model / AR #14 |
| ST-6 | `set` `{selected:{'Alice','Bob'}}` over rows `Alice,Bob,Cara` | Keeps `Alice,Bob` (membership on the formatted label); a nil value → label `''` | AC-3 / AR #10 |
| ST-7 | `custom` `{predicate:(v,row)=>v>0}` | Predicate receives the typed value and the row; keeps rows where it returns `true` | RD §Filter model |
| ST-8 | `filterRows` with two active column filters (region contains + qty between) | A row survives only if it satisfies **both** (AND) | AC-5 |
| ST-9 | `filterRows` with an empty model | Returns a **new array** of all rows in source order; input not mutated | RD §Filter model |
| ST-10 | `filterRows` with a filter whose `columnId` is absent from `columns` | The unknown filter is dropped; other filters still apply | AC-9 / AR #13 |
| ST-11 | `computeDistinct` over `['Ada','Ada','Bo',null]`; `resolveFilterType` over a number / Date / string sample; `filterType:'date'` override | Distinct = `['','Ada','Bo']` sorted (nil→`''`); type = `number`/`date`/`text`; override forces `date` | AR #9 / AR #14 |

### Container wiring — `grid.ts` (Phase 2)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-12 | `grid.setFilter('name', {text,contains,'a'})` on an in-memory grid | `filterModel()` has the entry; `display()` is filtered; `filteredCount()`=matched, `totalCount()`=all rows | AC-1 / AR #13 |
| ST-13 | `grid.clearFilter('name')` then `grid.clearFilter()` | The first removes that column's filter; the second empties the model | AR #13 |
| ST-14 | A source exposing `setFilter` (spy); `grid.setFilter('name', f)` | `setFilter(model)` is called with the structured model; the grid does **not** filter client-side; `filteredCount()` returns `display().length` (== `source.length()` for an eager push-down source) | AC-6 |
| ST-15 | `grid.setFilter('nope', f)` / `grid.clearFilter('nope')` (unknown id) | No-op; the `setFilter` push-down spy never receives a `'nope'` key | AC-9 |
| ST-16 | Client grid with an active filter **and** an active sort | `display()` is filtered **then** sorted (order preserved by the filter) | AR #7 |

### Quick-filter row & funnel header (Phase 3)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-17 | Grid built without `quickFilter` vs. with `quickFilter:true` | Off → no quick-filter band; on → a band with one `Input` per column | AR #3 |
| ST-18 | Type `'ali'` into a column's quick-filter `Input`; then clear it | Sets `{text,contains,'ali'}` for that column (formatted-display match) and updates `filteredCount()`; clearing removes the column's filter | AC-1 / AR #4 |
| ST-19 | A column gains an active filter, then it is cleared | The header shows the funnel `▽` on the filtered column; clearing removes the glyph | AC-4 |
| ST-20 | Mouse-down on a column's funnel cell vs. on its title | Funnel cell → `onFunnelClick(columnId,…)` fires (no sort change); title → `onHeaderClick` (sort) fires | AR #11 |

### Filter popups & distinct (Phases 4–5)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-21 | Open `FilterPopup` for a `text` / `number` / `date` column | Operator choices are `contains/startsWith/endsWith/equals` / `gt/lt/between/eq` / `before/after/on/between` respectively | RD §Condition filters / AR #14 |
| ST-22 | Choose `between` + operands `100`/`500` in a number popup, Apply | Emits `{number,between,a:100,b:500}` via `onApply`; a second operand appears only for `between` | AC-2 |
| ST-23 | Value-list over in-memory distinct `['A','B','C']`; check `A`,`B`, Apply; then Select All | Emits `{set,{'A','B'}}` keeping only `A,B` rows; Select All restores all | AC-3 / AR #10 |
| ST-24 | Value-list with a source exposing `distinct` (spy returns `{values:['X','Y']}`) | The popup lists `X,Y` from `source.distinct(columnId)` (not client compute) | RD §Distinct enumeration |
| ST-25 | `distinct()` resolves `{values:[…], truncated:true}` | The popup shows a visible "list truncated" disclosure; never silent | AC-7 / AR #5 |
| ST-26 | Type `'a'` in the value-list search over labels `['Ada','Bo','Cara']` | The visible list narrows to `Ada,Cara` (case-insensitive contains); the underlying selection is unchanged | RD §value-list |

### Security & story (Phase 6)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-27 | Push-down `setFilter` spy; inspect the model handed to it | The model is a structured `ReadonlyMap` of `{kind, op, literal operands}` — no string is concatenated into a query by the grid | AC-9 / RD §Security |
| ST-28 | Mount the `filtering` kitchen-sink story headlessly | Renders something; unique `id`; required `Story` metadata present (smoke) | AC-8 |

> **⚠️ AUTHORING RULE:** every expectation above is derived from RD-06 / the `03-XX` specs / the AR —
> not from imagined implementation output.

## Test Categories

### Specification Tests (from ST-cases)
> Written BEFORE implementation. Filed as `*.spec.test.ts`.

| Test File | ST Cases Covered | Component (Phase) |
| --------- | ---------------- | ----------------- |
| `filter.spec.test.ts` | ST-1…ST-11 | Filter model (1) |
| `grid-filter.spec.test.ts` | ST-12, ST-13, ST-14, ST-16 | Container API + composition + push-down (2) |
| `security.spec.test.ts` (additions) | ST-15, ST-27 | Unknown-column guard + structured push-down (2) |
| `quick-filter-row.spec.test.ts` | ST-17, ST-18 | Quick-filter band (3) |
| `sort-header.spec.test.ts` (additions) | ST-19, ST-20 | Funnel glyph + funnel-click routing (3) |
| `filter-popup.spec.test.ts` | ST-21, ST-22 | Condition popup (4) |
| `value-list-popup.spec.test.ts` | ST-23…ST-26 | Value-list + distinct (5) |
| `kitchen-sink.smoke.spec.test.ts` (existing) | ST-28 | The `filtering` story (6) |

### Implementation Tests (edge cases, internals)
> Written AFTER implementation. Filed as `*.impl.test.ts`.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `filter.impl.test.ts` | `between` with `b` omitted; nil under every kind; `dateOrdinal` boundaries; collator ties; non-mutation | High |
| `quick-filter-row.impl.test.ts` | Indent/geometry reposition; off-screen Input clipping; band height | Med |
| `filter-popup.impl.test.ts` | Reopen with a `current` filter pre-filled; Escape/click-away close; popup anchoring | Med |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| filter + sort + edit | grid, filter, sort, editing | Filter then sort, edit a surviving cell, cursor re-anchors across a row-removing filter |
| push-down both | grid, source | A source with `setSort`+`setFilter` receives both; the grid re-applies neither client-side |

## Test Data

### Fixtures Needed
- The `Sale { region: string; qty: number; closed: Date | null }` shape reused from the sorting tests
  (string + numeric + nullable-date columns exercise all three filter types).
- A spy `GridDataSource` exposing `setFilter`/`setSort`/`distinct` (extend the sorting push-down spy).

### Mock Requirements
- Real objects throughout (in-memory `fromRows`); the only "mock" is the spy source verifying
  push-down calls — a real object with recording methods, not a framework mock.

## Verification Checklist
- [ ] All ST cases (ST-1…ST-28) defined with concrete input/output pairs
- [ ] Every ST case traces to an RD criterion, `03-XX` spec, or AR entry
- [ ] Spec tests written BEFORE implementation and verified to FAIL (red) each phase
- [ ] All spec tests pass after implementation (green)
- [ ] Impl tests cover edges and internals
- [ ] No regressions in the existing 192 datagrid tests
- [ ] `yarn verify` green (lint + typecheck + build + test + check:docs)
