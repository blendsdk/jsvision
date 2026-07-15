# Requirements: Sorting

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-sorting.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

**Must-Have (RD-05 §Must):**
- Single-column header-click sort — asc↔desc two-state toggle (RD-05 §Must; click semantics per AR #5).
- Multi-column priority sort — `Ctrl`+click adds a key; each sorted header shows its `1`/`2`/`3` priority
  digit; plain click resets to a single key (RD-05 §Must; AR #5, AR #9, AR #10).
- Type-aware, value-based ordering via `column.value(row)` — never the formatted string (RD-05 §Must; AR #2).
- Stable sort (RD-05 §Must).
- Server-side push-down when `source.setSort` exists; else client-side (RD-05 §Must; AR #6, AR #7).
- Sort model API — `grid.sortBy`/`addSort`/`clearSort`/`sort(): SortKey[]` (RD-05 §Must).

**Foundation prerequisite (AR #16):**
- Expose optional `ctrl?`/`alt?`/`shift?` on core `MouseEvent`, populated by the decoder — required so
  the header can detect `Ctrl`+click (the Must-Have multi-sort gesture). Additive, backward-compatible.

**Should-Have (RD-05 §Should) — all included per AR #4:**
- Custom comparator `GridColumn.compare?(a, b)` (RD-05 §Should; AR #13).
- Null ordering `GridColumn.nulls?: 'first' | 'last'` default `last` (RD-05 §Should; AR #13).
- Tri-state header cycle asc → desc → none (RD-05 §Should; AR #5).

### Deferred / out of this plan

- Grouping/aggregation-driven sort and drag-to-reorder sort priority (RD-05 §Won't Have) — unchanged.
- **Snapshot ("committed order") sorting** — the reactive display re-sorts on any data change, so an
  edited sorted-column cell reorders immediately (AR #8=A). A stable snapshot that only re-sorts on a
  sort action is a possible future refinement, not in scope.
- A real windowed/server `setSort` backend — the push-down **seam** is built and unit-tested with a spy
  source; wiring an actual re-querying source stays with RD-11 (RD-05 §Integration Points).

## Plan-local decisions

Only decisions NOT already fixed by RD-05 (the RD owns the rest). Full context in the register.

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Header rendering surface | Own it — from-scratch `SortHeader` + container `Signal<SortKey[]>` | AR #1 |
| String comparator case rule | Case-insensitive `Intl.Collator` (one comparator) | AR #2 |
| Cursor/selection across a re-sort | Re-anchor by `rowKey` | AR #3 |
| Should-Have scope | All three ship here | AR #4 |
| Header-click state machine | Plain=replace/toggle-sole; Ctrl=append/toggle-existing; tri-state adds "none" | AR #5 |
| Cleared-sort behavior | Client restores source order; push-down calls `setSort([])` | AR #6 |
| Push-down mechanism | Separate reactive effect guarded `if (source.setSort)` | AR #7 |
| Re-sort trigger | Pure-derived display (re-sorts on data change) | AR #8 |
| Key cap / digit rendering | No cap; single-digit 1-based position | AR #9 |
| Header indicator geometry | 1 reserved cell single-sort / 2 cells multi-sort; title clips, indicator never | AR #10 |
| File/symbol placement | `sort.ts` + `sort-header.ts`; `SortKey` moves to `sort.ts` | AR #11 |
| `nulls` placement vs direction | Absolute (SQL-style): `'last'` = always bottom, `'first'` = always top, independent of `dir` | AR #13 |
| Mouse modifiers on core `MouseEvent` | Additive **optional** `ctrl?`/`alt?`/`shift?` (Phase 1; required-fields rejected — 109 literal sites) | AR #16 |

## Acceptance Criteria

The RD owns its own acceptance criteria (RD-05 §Acceptance Criteria, AC-1…AC-9); the ST-cases in
[07-testing-strategy.md](07-testing-strategy.md) implement them. Plan-local criteria only:

1. [ ] The ui engine's `SortState`/`sortRows`/`toEngineColumn.compare` path is neither called nor
       modified by the datagrid (AR #1) — verified by absence (no `sortRows`/`SortState` import in the
       new datagrid sort **source** files `grid.ts`/`sort.ts`/`sort-header.ts`) and by the ui suite
       staying green. **Scope the grep to those source files:** the pre-existing
       `test/column.spec.test.ts` legitimately imports `sortRows`/`SortState` to exercise the untouched
       `toEngineColumn` adapter, so a package-wide grep would false-positive.
2. [ ] `SortKey`'s public shape and barrel export are unchanged after moving its definition to `sort.ts`
       (AR #11) — `import type { SortKey } from '@jsvision/datagrid'` still resolves to `{ columnId, dir }`.
3. [ ] No `@jsvision/ui` source change (the datagrid-owns-sort constraint, consistent with the
       feature-wide AR-1 "no ui promotion for datagrid"). The **only** foundation change is Phase 1's
       additive optional mouse modifiers on core `MouseEvent` (AR #16) — nothing else in core/ui changes.
4. [ ] `yarn verify` green, `check:docs` green (new barrel exports carry `@example`), no regressions in
       the RD-01…RD-04 datagrid suites.
