# Testing Strategy: Sorting

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core sort logic (`sort.ts`, the comparator) | 90% |
| Header + container wiring (`sort-header.ts`, `grid.ts` sort path) | 80% |
| Core mouse-modifier decode | covered by the decoder spec |

- Test names state behavior: `should [expected] when [condition]`.
- Real objects over mocks: the only test double is a spy `GridDataSource` with a `setSort` to prove
  push-down (AC-4); everything else uses real columns/rows.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from RD-05 (`../../requirements/RD-05-sorting.md`), the component specs
> ([03-01](03-01-sort-model.md), [03-02](03-02-header-and-wiring.md)), and the Ambiguity Register.
> **IMMUTABLE ORACLE RULE:** if the implementation disagrees, the implementation is wrong.
> The `Source` ids below are plan-doc references only — the in-code traceability comment quotes the
> behavior in plain language, never an `ST-`/`AR #`/`RD-`/`requirements/` id (standards' doc ban).

### Core mouse modifiers (Phase 1)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | Decode an SGR mouse-down whose button byte has the Ctrl bit set | `MouseEvent` with `ctrl === true` | AR #16 |
| ST-2 | Decode a plain SGR mouse-down (no modifier bits) | `ctrl`/`alt`/`shift` are all falsy (unset/false) | AR #16 |

### Sort model — `sort.ts` (`sortRowsMulti`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-3 | Numeric column, `[{col,'asc'}]`, rows with values 1000 and 9 | 9 orders **before** 1000 (value order, not `"1000" < "9"` lexical) | RD AC-1 |
| ST-4 | Two keys `[{a,'asc'},{b,'asc'}]`; rows tie on `a` | Ordered by `a` then `b`; equal-`a` rows fall back to `b` | RD AC-2 |
| ST-5 | Rows with equal keys | Equal-key rows retain source order (stable) | RD §Must |
| ST-6 | String column, values `['banana','Apple','apple']`, asc | Case-insensitive collator order: `apple`/`Apple` adjacent, before `banana` | RD AC-5 / AR #2 |
| ST-7 | Column with a custom `compare`, asc | Order follows `compare`, overriding the type-aware default | RD AC-5 |
| ST-8 | Column `nulls:'first'`, asc, some `value` null/undefined | Null rows placed **before** non-null | RD AC-7 |
| ST-9 | Column default `nulls` (`'last'`), asc and desc | Null rows placed **after** non-null in both directions (absolute of `dir`) | AR #13 |
| ST-10 | Keys include an unknown `columnId` | That key is ignored; no throw; result = sort by the remaining valid keys | RD AC-9 / AR #14 |
| ST-11 | Empty key list (`[]`) | Returns source order; the input array is **not** mutated | AR #6 |
| ST-12 | Single key `dir:'desc'` over non-null values | Reverses the ascending non-null order | RD §Sort model |

### Header + container — `sort-header.ts` / `grid.ts`

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-13 | Click a numeric column header (in-memory source) | Sorts asc, header shows `▲`, the value-9 row paints above the value-1000 row | RD AC-1 |
| ST-14 | Click header A, then Ctrl+click header B | B added as key 2; headers show `1` and `2`; rows ordered by A then B | RD AC-2 |
| ST-15 | After a multi-sort, plain-click one participating header | Resets to a single key on the clicked column (asc) | RD AC-3 |
| ST-16 | Sort with a source exposing `setSort` (spy) vs. an in-memory source | Push-down: `setSort(keys)` called, `sortRowsMulti` **not** run client-side; in-memory: `sortRowsMulti` produces the view | RD AC-4 / AR #6/#7 |
| ST-17 | Tri-state: click the sole sorted header three times | asc → desc → none; `none` restores source order | RD AC-6 |
| ST-18 | Cursor on record X, then a re-sort moves X | Cursor (and selection, if set) follows X to its new index (row-key re-anchor) | AR #3 |
| ST-19 | `grid.sortBy`/`addSort`/`clearSort` then read `grid.sort()` | Reactive readout reflects the current `SortKey[]` | RD §Must API |
| ST-20 | Fresh grid (empty `sortKeys`) | Header paints no indicator; body renders in source order | AR #1 / plan AC-1 |

### Security

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-21 | `grid.sortBy('nope')` and a keys list with an unknown `columnId` | No state change / the unknown key never reaches the spy `setSort` (not forwarded to a query) | RD AC-9 / AR #14 |

### Kitchen-sink

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-22 | The `sorting` story under the headless smoke test | Mounts, paints, unique id + required metadata | RD AC-8 / CLAUDE.md gate |

> **⚠️ AUTHORING RULE:** expectations derive from the spec above, never from imagined implementation
> output. Any expectation not determinable from the spec is an ambiguity → register it, don't guess.

> **Test-seam note (mouse events are new to the datagrid suite).** No existing datagrid test dispatches
> a mouse event — the suite uses only key dispatch (`grid.spec.test.ts` `loop.dispatch(key(...))`) and
> buffer reads (`createRenderRoot`). The click cases here use two seams:
> - **Standalone header unit tests** (ST-13 render side, and the `sort-header.impl` hit-test/divider
>   cases): construct the **barrel-exported** `SortHeader` directly with a fake `SortHeaderConfig`, then
>   call `header.onEvent(ev)` with a synthetic `DispatchEvent` whose inner event is
>   `{ type:'mouse', kind:'down', x, y, button:0, ctrl:… }` and whose `ev.local` is set. (`SortHeader`
>   is barrel-exported by task 3.2.5; the container's own header instance is private.)
> - **Container-level click→body-order tests** (ST-14/ST-15/ST-17 through the mounted grid): dispatch the
>   mouse-down through the loop — `loop.dispatch({ type:'mouse', kind:'down', x, y:0, button:0, ctrl })` —
>   the header sits at `y=0` and mouse routing is hit-test-based (independent of focus), so it lands on
>   the header. Ctrl+click sets `ctrl:true` (Phase 1).

## Test Categories

### Specification Tests (from ST-cases above)
> Written BEFORE implementation. `*.spec.test.ts`.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `packages/core/test/mouse-modifiers.spec.test.ts` (or fold into the existing mouse-decode spec) | ST-1, ST-2 | Core `MouseEvent` |
| `packages/datagrid/test/sort.spec.test.ts` | ST-3 … ST-12 | `sortRowsMulti` |
| `packages/datagrid/test/sort-header.spec.test.ts` | ST-13 … ST-20 | Header + wiring |
| `packages/datagrid/test/security.spec.test.ts` (addition) | ST-21 | Security |
| `packages/datagrid/test/kitchen-sink.smoke.spec.test.ts` (existing) | ST-22 | Story smoke |

### Implementation Tests (edge cases, internals)
> Written AFTER implementation. `*.impl.test.ts`.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/datagrid/test/sort.impl.test.ts` | mixed-type columns, Date ordering, empty rows, single-row, all-null column, `compare` + `nulls` interaction, non-mutation, ≥3 keys | High |
| `packages/datagrid/test/sort-header.impl.test.ts` | narrow-column indicator clamp (`w<reserve`), digit ≥ key 3, indent/H-scroll hit-test, click on divider/empty area, Ctrl+click toggles an existing key's dir, header repaint on `sortKeys` change | Med |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| Header click → model → body order | `SortHeader` + `grid` + body | A real click reorders the painted body (ST-13/14 exercised through the container) |
| Edit-then-resort | `grid` + editing | A committed edit to a sorted column reorders that row (AR #8 documented behavior) |

### End-to-End Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| Multi-column sort in the showcase | Mount the `sorting` story, drive clicks headlessly | Multi-key order + indicators render; smoke passes |

## Test Data

### Fixtures Needed
- A small typed row set with a numeric column (values incl. 9 and 1000), a string column with case
  variants, a nullable column, and a `Date` column.
- A spy `GridDataSource` capturing `setSort` calls (records the `SortKey[]` it receives).

### Mock Requirements
- Only the spy `setSort` source (a true external seam). Everything else is real.

## Verification Checklist
- [ ] All ST-cases (ST-1 … ST-22) defined with concrete input/output pairs
- [ ] Every ST case traces to an RD AC, spec doc, or AR entry
- [ ] Specification tests written BEFORE implementation, verified to FAIL (red) first
- [ ] All specification tests pass after implementation (green)
- [ ] Implementation tests cover the edges above
- [ ] No regressions in the RD-01…RD-04 datagrid suites or the ui/core suites (the optional-field core change)
- [ ] `check:docs` green (new barrel exports carry `@example`)
