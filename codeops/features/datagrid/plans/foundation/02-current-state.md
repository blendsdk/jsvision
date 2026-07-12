# Current State: Foundation & Grid-Engine Exposure

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

This analysis is grounded in the real code (verified this session + the requirements-set preflight). Every
claim cites a file; where a claim could not be verified it says so.

## Existing Implementation

### What Exists

- **A complete, shipped grid engine — but private.** `@jsvision/ui` ships `DataGrid<T>`, a focusable,
  virtual-scrolling, multi-column table (`packages/ui/src/table/data-grid.ts`). It is built from two internal
  renderers, `GridRows<T>` (the virtual-scroll body) and `GridHeader<T>` (the sticky header), plus a pure,
  view-free math module `columns.ts` (apportionment, `auto`-measure, alignment, single-key sort).
- **The engine is source-`export`ed but off the public barrel.** `packages/ui/src/table/index.ts` re-exports
  **only** `DataGrid` + the column **types**; `GridRows`/`GridHeader`/`apportionColumns`/`alignCell`/
  `sortRows`/`measureAutoWidths` are `export`ed at their source files but never surface on
  `packages/ui/src/index.ts`. So an external package cannot reach them by name today — the Data Studio spike
  had to reach into ui's built `dist/` via a relative path (`packages/spike-data-studio/src/editable-grid.ts`),
  which its own header flags as the finding that motivates this promotion.
- **The engine is subclass/reuse-friendly.** `GridRows` has **zero `private` members**; the state a
  subclass/host needs (`display`/`columns`/`autoWidths`/`indent`/`focused`/`selected`, `topItem`, `geometry()`)
  is `protected`. `GridRowsConfig<T>` (`grid-rows.ts:53`) already accepts **shared** `focused`/`selected`/
  `indent` signals — so multiple panels can share one row cursor by construction (the substrate RD-02's
  container-owned cursor needs, per the requirements-set preflight PF-001).
- **`DataGrid`'s composition is the model for the read-only container.** `data-grid.ts:119-181` builds
  `autoWidths`/`display` computeds from `rows`+`sort`, constructs `GridHeader`+`GridRows` over shared signals,
  and stacks three `fr` bands inside an inner `col` container so the grid's own `layout` stays free.
- **No datagrid package exists.** `packages/datagrid/` is absent; `packages/files/` is the clean clone
  template (a public-package sibling: fixed `"0.2.0"` `@jsvision/*` deps, the six turbo scripts, an 8-line
  tsconfig, a two-project vitest config).
- **The overlay mechanism is proven from public primitives.** The spike's editable grid mounts its editor
  into a sibling absolute overlay `Group` via `overlay.add(view)` + `loop.focusView(view)` + `overlay.remove`
  on close, with `absoluteRect(view)` walking the parent chain — all public `@jsvision/ui` primitives, no
  `openAnchoredPopup` (`packages/spike-data-studio/src/editable-grid.ts`).
- **The showcase harness lives in examples.** The kitchen-sink `STORIES` registry
  (`packages/examples/kitchen-sink/stories/index.ts`, explicit aggregation) and its smoke test
  (`packages/examples/test/kitchen-sink.smoke.spec.test.ts`) are in `@jsvision/examples`.
- **`check:docs` is a real, enforced gate.** `scripts/check-jsdoc.mjs` parses each package barrel, follows
  re-exports, and fails the build if any public **class or function** value lacks an `@example` (types are
  exempt) or any comment carries a banned reference. `turbo.json` fans `check:docs` out per package with no
  registration.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/ui/src/index.ts` | ui public barrel (`:148-149` = `DataGrid` + types) | **Modify** — add value re-exports `GridRows`, `GridHeader`, `apportionColumns`, `alignCell`, `sortRows`, `measureAutoWidths` + config types |
| `packages/ui/src/table/index.ts` | internal table barrel (`DataGrid` + types only) | **Modify** — re-export the engine renderers + `columns.ts` helpers + `GridRowsConfig`/`GridHeaderConfig` |
| `packages/ui/src/table/columns.ts` | pure column math (no `@example` on any helper) | **Modify** — add an `@example` to `apportionColumns`, `alignCell`, `sortRows`, `measureAutoWidths` |
| `packages/ui/src/table/grid-rows.ts` | `GridRows`/`GridHeader` (no `@example`) | **Modify** — add an `@example` to `GridRows` + `GridHeader` |
| `packages/ui/src/controls/measure.ts` | `stringWidth` (internal today, no `@example`) | **Modify** — re-export on the barrel + add an `@example` (the container feeds it to `measureAutoWidths` so it measures what the engine draws) |
| `packages/ui/src/table/data-grid.ts` | `DataGrid` (already has `@example`) | **Unchanged** (regression check only) |
| `packages/files/{package.json,tsconfig.json,vitest.config.ts}` | clone template | **Read-only** reference for the scaffold |
| `packages/spike-data-studio/src/editable-grid.ts` | overlay mechanism reference | **Read-only** reference; the spike package is deleted later |
| `scripts/check-jsdoc.mjs` · `turbo.json` | the docs gate + pipeline | **Read-only** — the promotion must satisfy `check:docs`; turbo auto-fans-out |
| `packages/datagrid/**` | the new package | **Create** (see 03-02…03-06) |

### Code Analysis

- **`Column<T>.accessor` returns a `string`** and `sortRows` orders by that string unless a `compare` is
  supplied (`columns.ts:20-35,190-196`). This is the crux: the datagrid's typed `value` model must be
  **adapted** to the engine's string accessor — the adapter builds `accessor = format∘value` (`String(value)`
  fallback) and synthesizes `compare` from `value`. See 03-03.
- **`GridRowsConfig.display: () => T[]`** is the body's data seam — a reactive array getter. The read-only
  container materializes it from a `GridDataSource<T>` (`Array.from({length}, (_,i) => rowAt(i))`), which is
  cheap for the in-memory source and small windowed test double; windowed placeholder rendering is RD-11.
- **The `@example` gate matches by declared value name.** Once `GridRows` is on the barrel,
  `check-jsdoc.mjs` requires the `export class GridRows` declaration to carry an `@example`; likewise the four
  `columns.ts` functions, plus `stringWidth` in `controls/measure.ts`. That is **7 new `@example`s** in ui —
  the six AC-2 names + the promoted `stringWidth` measure the container feeds to `measureAutoWidths` (so it
  measures exactly what the engine draws; additive beyond AC-2's named set).

## Gaps Identified

### Gap 1: The grid engine is not reachable by name from another package
**Current:** `GridRows`/`GridHeader`/`columns.ts` helpers are internal; only `dist/`-diving reaches them.
**Required:** they are on `@jsvision/ui`'s public barrel, each documented with an `@example`.
**Fix:** add the re-exports to `table/index.ts` + `src/index.ts` and the `@example`s (03-01).

### Gap 2: No column model bridging typed values to the string-accessor engine
**Current:** the engine sorts/renders a string accessor; there is no typed value/format/parse column.
**Required:** `GridColumn<T,V>` + a `toEngineColumn` adapter (accessor = display, comparator = value-aware).
**Fix:** 03-03.

### Gap 3: No source abstraction, commit seam, overlay helper, or container
**Current:** none exist in a datagrid package (there is no package).
**Required:** `GridDataSource<T>` + `fromRows`; `CellCommit`/`OnCommit` + `commitCell`; `mountCellOverlay`; a
read-only `EditableDataGrid<T>`.
**Fix:** 03-04, 03-05.

### Gap 4: No datagrid story/test harness
**Current:** the showcase harness is examples-only.
**Required:** an in-package story registry + headless smoke test (AR #2, plan).
**Fix:** 03-06.

## Dependencies

### Internal
- `@jsvision/core` — `ScreenBuffer`, `sanitize`, `serialize`, the `Theme` model (via ui).
- `@jsvision/ui` — the promoted engine (`GridRows`/`GridHeader`/`columns.ts`), `View`/`Group`, the reactive
  core (`signal`/`computed`/`effect`/`createRoot`/`onCleanup`), `createEventLoop` (for the overlay's
  `focusView`), `Input` (test editors).

### External
- None at runtime (zero-dep; `check:deps` enforces). Dev-only: `vitest`, `@types/node`, `typescript` (hoisted).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Promoting the engine ripples into ui's `check:docs` / bundle-size / API-stability specs | Med | Med | The promotion is additive (no signature change); add the 6 `@example`s in the same phase and run ui's full suite as a regression gate before moving on (Phase 1). |
| The read-only container pulls RD-02 scope forward | Low | Med | Keep it strictly read-only (no cursor/editor/sort UI); bound to header + body over a source via the adapter (AR #1, plan). |
| AC-5 ("missing `rowKey` is a compile error") is not enforceable by runtime tests | Med | Low | Declare `rowKey` required and enforce it with a `// @ts-expect-error` negative type test compiled by a `tsconfig.typecheck.json` that covers `test/` (03-02); this also gives the package test-typechecking hygiene the files template lacks. |
| The windowed test double diverges from the in-memory source's contract | Low | Med | AC-4's **shared** spec runs the identical assertions against both implementations of `GridDataSource<T>` (07 ST-6/ST-7). |
| `sanitize` boundary missed on a custom-render path | Low | High | Route every screen write through the engine's existing sanitizing `DrawContext`/`ScreenBuffer.set`; ST-11 asserts a control-byte cell value produces no raw ESC/BEL in the serialized frame. |
