# Testing Strategy: Footer, Aggregation & Master-Detail

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core business logic (`aggregate.ts` fold, `fromReactiveRows`) | 90% |
| Supporting modules (`footer-band.ts`, `grid-footer.ts`, `master-detail.ts`) | 80% |
| UI / glue (band assembly, showcase glue) | 60% |

- Test names state behavior: `should [expected] when [condition]`.
- Two vitest projects: `unit` (`*.spec.test.ts` / `*.impl.test.ts`) and `e2e`. Spec tests are the
  immutable oracle; impl tests cover internals/edges.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from RD-09, the 03-XX specs, and the Ambiguity Register. Expectations come from
> the spec, never from imagined implementation output. **Immutable oracle rule:** if a spec test fails
> after implementation, the implementation is wrong. In-code traceability comments quote behavior in
> **plain language** — never an `ST-`/`AR-`/`RD-` id or a `codeops/` path.

### A. Column aggregate — reactive, end-to-end (`grid-footer.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | A `{ fn:'sum' }` aggregate on a numeric column; displayed rows have values 10, 20, 30 | The footer cell under that column renders `60`, aligned to the column's x-origin | RD AC#1 / AR-9 |
| ST-2 | Edit that column's cell `30 → 40` and commit | The sum cell updates to `70` (reactive on the `version` tick) | RD AC#1 / AR-9 |
| ST-3 | `insertRow` with value 5 | The sum cell updates to `75` | AR-9 |
| ST-4 | `deleteRows` removing the value-10 row | The sum cell updates to `65` | AR-9 |
| ST-5 | Apply a filter hiding the value-20 row | The sum folds over the **displayed** set → `40` (excludes the filtered-out 20) | RD AC#1 / AR-9 |
| ST-6 | Change the sort direction | The sum is unchanged (order-independent) and stays aligned under its column | AR-9 |

### B. Fold semantics — pure (`aggregate.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-7 | `foldAggregate('avg', [10, 20, null])` | `15` — average over the finite contributors only (30 / 2) | AR-6 |
| ST-8 | `foldAggregate('sum', [10, null, NaN, Infinity, 'x', 20])` | `30` — non-finite / non-number values skipped | AR-6 |
| ST-9 | `foldAggregate('min', [5, -2, 3])` / `foldAggregate('max', [5, -2, 3])` | `-2` / `5` | AR-6 |
| ST-10 | `foldAggregate('count', [1, null, 3])` | `3` — counts rows, null included | AR-6 / RD Tech |
| ST-11 | `foldAggregate('sum', [])` / `foldAggregate('count', [])` | `0` / `0` | AR-6 |
| ST-12 | `foldAggregate('avg'\|'min'\|'max', [])` → `undefined`; `formatAggregate({fn:'sum',label:'Σ'}, undefined, false)` → `""`; `formatAggregate({fn:'sum',label:'Σ'}, 60, true)` → `"Σ 60 (loaded)"` | undefined→blank; partial appends `" (loaded)"` | AR-6 / AR-2 |

### C. Widget slots (`grid-footer.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-13 | A footer `Button({ command:'export' })` is activated (click/Enter) | A `command` event `'export'` is raised on the dispatch tick (an `onCommand('export')` handler fires) | RD AC#2 / AR-3 |
| ST-26 | Footer `Text(() => \`${grid.filteredCount()} of ${grid.totalCount()}\`)` and `Text(() => \`${grid.selectedKeys().size} selected\`)`; then a filter hides rows and a row is selected | Both read-outs update reactively to the new counts | RD AC#6 / AR-3 |

### D. Sticky + frozen alignment (`footer-band.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-14 | A grid taller than its viewport; scroll the body vertically | The footer band stays at the bottom row, fully visible (not scrolled away) | RD AC#3 / AR-7 |
| ST-15 | Same grid; read the footer band's y after scroll | The footer occupies the fixed bottom band; the body window scrolled beneath it | RD AC#3 / AR-7 |
| ST-16 | A frozen-left column + a scrolling column, each with a `sum`; measure the aggregate cell x | Each aggregate cell aligns to its column's x across the frozen/scrolling split (frozen cell does not pan; center cell pans with `indent`) | RD AC#3 / AR-7 |

### E. Aggregate honesty (`grid-footer.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-17 | A test-double source whose `complete()` returns `false`; a `{fn:'sum',label:'Σ'}` | The footer cell carries the `" (loaded)"` qualifier (e.g. `"Σ 60 (loaded)"`) | RD AC#4 / AR-2 |
| ST-18 | A `fromRows` source (no `complete`, ⇒ complete) or `complete()===true` | The footer cell shows a clean total with **no** `"(loaded)"` qualifier | RD AC#4 / AR-2 |

### F. Master-detail + reactive source (`master-detail.spec.test.ts`, `reactive-source.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-19 | Move the master row cursor to row 2 | `master.focusedRow()` returns row 2's record; `master.focusedKey()` returns its `rowKey` (reactive) | RD AC#5 / AR-8 |
| ST-20 | With the cursor on a record, apply a sort that moves that record | `focusedRow()` still returns the **same record** (re-anchored by `rowKey`) | AR-8 |
| ST-21 | `masterDetail(master, buildDetail)`; move the master focus to a different record | The detail grid's rows update to the new focused record's related rows | RD AC#5 / AR-4 |
| ST-22 | Call the `dispose()` returned by `masterDetail`, then change master focus | The detail's reactive wiring no longer recomputes (scope torn down) | RD AC#5 / AR-8 |
| ST-23 | `fromReactiveRows(read, {rowKey})` where `read` is a signal-backed getter; change the backing signal | The source's `length()`/`rowAt()` reflect the new rows (reactive read) | AR-4 |
| ST-24 | `fromReactiveRows(read, {rowKey, insert, remove})`; `insertRow(x)` then `deleteRows([k])` | The `insert`/`remove` writers run and the **owned** collection reflects the change (persists across a `read()` re-eval) | AR-4 |
| ST-25 | `fromReactiveRows(read, {rowKey})` (writers omitted); `insertRow(x)` / `deleteRows([k])` | Both no-op (read-only-structural) — no throw, owned collection unchanged | AR-4 |

### G. Security (`grid-footer.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-27 | `aggregates` with an unknown columnId key and an entry with an invalid `fn` | Both entries are ignored (not rendered) and a `devWarn` is emitted; valid entries still render | RD AC#8 / AR-12 |
| ST-28 | A footer `label`/widget text containing control bytes (e.g. `"\x1b[31mΣ"`) | The rendered footer cell is stripped of the control bytes at the `ctx.text` boundary | RD AC#8 / AR-12 |

> **⚠️ AUTHORING RULE:** expectations derive from the spec docs above, not from imagined
> implementation output. Any expectation not determinable from the spec is an ambiguity → register it.

## Test Categories

### Specification Tests (from ST-cases)

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `aggregate.spec.test.ts` | ST-7…ST-12 | Aggregate fold model |
| `grid-footer.spec.test.ts` | ST-1…ST-6, ST-13, ST-17, ST-18, ST-26, ST-27 | Footer controller + reactive aggregates + widgets + honesty + validation |
| `footer-band.spec.test.ts` | ST-14, ST-15, ST-16, ST-28 | The band view — sticky, frozen alignment, sanitize |
| `master-detail.spec.test.ts` | ST-19…ST-22 | `focusedRow`/`focusedKey` + `masterDetail` |
| `reactive-source.spec.test.ts` | ST-23…ST-25 | `fromReactiveRows` |

### Implementation Tests (edges, internals)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `aggregate.impl.test.ts` | fold precision, mixed-type coercion edges, format permutations | High |
| `grid-footer.impl.test.ts` | `grid.ts` stays `<1200`; controller instantiated (not inlined); band height math; rebuild recreates the footer | High |
| `master-detail.impl.test.ts` | dispose idempotence; no scope leak; empty-master `read()`→`[]` | Med |

### Integration / E2E

| Scenario | Steps | Expected |
| -------- | ----- | -------- |
| Footer + frozen panels + filter | freeze a column, filter, read footer | totals fold over filtered set, aligned across the split |
| Editable master-detail round-trip | select master, edit + insert a detail row, re-select | edits/inserts persisted in the owned collection |
| Kitchen-sink smoke | mount `footer-master-detail.story.ts` headlessly | renders, unique id, metadata (smoke gate) |

## Test Data

- Fixtures: a small typed row set with a numeric column (sums/avgs), a nullable numeric column
  (skip-null), a master (orders) + detail (lines) pair, and a **test-double windowed source** whose
  `complete()` returns `false` (for ST-17). Reuse `datagrid-showcase/stories/lib/` data where practical.
- Mocks: prefer real reactive signals + a spy `onCommand` handler (ST-13); no mock of the reactive core.

## Verification Checklist
- [ ] All ST-cases (ST-1…ST-28) defined with concrete input/output pairs
- [ ] Every ST case traces to RD-09 / a 03-XX spec / an AR entry
- [ ] Spec tests written BEFORE implementation; verified RED before implementing
- [ ] All spec tests pass after implementation (GREEN)
- [ ] Impl tests written for edges/internals (incl. `grid.ts < 1200`)
- [ ] No regressions in RD-01…08 suites; full `yarn verify` green
