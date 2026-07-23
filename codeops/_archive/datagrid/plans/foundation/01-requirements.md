# Requirements: Foundation & Grid-Engine Exposure

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-01](../../requirements/RD-01-foundation.md) — the OWNING requirements doc (Must/Should/Won't, the type contracts, and AC-1…AC-10 live there; this file is a delta view only).

## Scope of this plan (delta view)

### In this plan (RD-01 Must + selected Should)

- **Grid-engine promotion** — re-export `GridRows`, `GridHeader`, `apportionColumns`, `alignCell`,
  `sortRows`, `measureAutoWidths`, `stringWidth` (the measure the container feeds `measureAutoWidths`,
  additive beyond AC-2's named set) + the types `Column`/`ColumnWidth`/`ColumnAlign`/`SortState`/`ColumnGeometry`
  from `@jsvision/ui`'s public barrel, each with an `@example`. *(RD-01 Must; AC-2.)*
- **Package scaffold** — `packages/datagrid` (`@jsvision/datagrid`, `private: true`, zero runtime deps) with
  the six turbo scripts, tsconfig(s), a two-project vitest config, and a single public barrel. *(AC-1.)*
- **Column model + adapter** — `GridColumn<T,V>` (value/format/parse) and the `GridColumn → engine Column`
  adapter (`toEngineColumn`: accessor = `format∘value` / `String(value)`, comparator synthesized from
  `value`). Plus a per-column `column<T,V>()` authoring helper (Should). *(AC-3.)*
- **Data source** — the `GridDataSource<T>` interface + the in-memory `fromRows` source (Should item folded
  in — the contract block names it). *(AC-4.)*
- **Commit sink + primitive** — the `CellCommit`/`OnCommit` contract **and** a tested `commitCell` primitive.
  *(AC-6; the primitive is AR #3 (plan).)*
- **Cell-overlay helper** — `mountCellOverlay(...)` from public `@jsvision/ui` primitives. *(AC-7.)*
- **Minimal read-only container** — `EditableDataGrid<T>` composing header + body over a source via the
  adapter (read-only; the AC-3 render/order proof + the AC-9 story render here). *(AR #1, plan.)*
- **Story + test harness** — the package's vitest unit/e2e projects run; an in-package story registry +
  headless smoke test exist. *(AC-9; home per AR #2, plan.)*
- **Security substrate** — every screen write flows through core `sanitize`; no `eval`/dynamic-require; zero
  native deps. *(AC-8, AC-10.)*

### Deferred / out of this plan

- The cell cursor, in-cell editors, editing keymap, dirty tracking, sorting/filtering UI, columns UI, footer,
  validation — **RD-02…RD-14** (RD-01 §Won't Have). The container ships **read-only**.
- Concrete server/PG `GridDataSource` adapters — Phase B / RD-11. RD-01 ships only the in-memory source + a
  **hand-written windowed test double** used to prove the body is source-agnostic (AC-4).
- Publishing `@jsvision/datagrid` to npm — deferred until `@jsvision/ui` is public (the package is
  `private: true`, hence excluded from lockstep auto-versioning; req PF-007).
- Integrating a datagrid story into the shared `@jsvision/examples` kitchen-sink showcase — a later follow-up
  once datagrid ships user-facing visual components (AR #2, plan).

## Plan-local decisions

Only decisions **not** already fixed by RD-01 / the requirements register. Full text in
[00-ambiguity-register.md](00-ambiguity-register.md).

| Decision | Chosen | AR Ref (plan) |
| -------- | ------ | ------------- |
| RD-01 deliverable shape | Minimal read-only `EditableDataGrid<T>` container | AR #1 |
| Story harness home | In-package registry + local `test/**` smoke test | AR #2 |
| Optional inclusions | per-column `column<T,V>()` + `commitCell` both included | AR #3 |
| Verify command | `yarn verify` (gates) + scoped `yarn workspace …` (inner loop) | AR #4 |
| `src/` module layout | `index` / `column` / `data-source` / `commit` / `overlay` / `grid` | AR #5 |
| Container name | `EditableDataGrid<T>` (README glossary term; read-only until RD-02) | AR #6 |
| Overlay helper name | `mountCellOverlay(host, loop, rect, view) => dispose` | AR #7 |
| `sortRows` promotion | Kept on the ui barrel (additive; AC-2 names it) | AR #8 |

## Acceptance Criteria

The plan's done-criteria are **RD-01's AC-1…AC-10** (owned by
[RD-01 §Acceptance Criteria](../../requirements/RD-01-foundation.md)); every one is realized by a spec case in
[07-testing-strategy.md](07-testing-strategy.md) (ST-1…ST-14). Plan-local additions beyond the RD ACs:

1. [ ] The read-only `EditableDataGrid<T>` renders `format(value)` cells for both an in-memory `fromRows`
   source and a hand-written windowed double via the **same** container code path (extends AC-3/AC-4).
2. [ ] The in-package story smoke test mounts every registered datagrid story headlessly, asserting a
   non-empty paint + required metadata + a unique id (realizes AC-9 in the in-package harness).
3. [ ] `yarn verify` is green across `@jsvision/datagrid` **and** `@jsvision/ui` (the promotion's `check:docs`
   included) with no regression in ui's existing `DataGrid` tests.
