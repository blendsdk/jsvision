# Testing Strategy: Foundation & Grid-Engine Exposure

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core logic (adapter, `commitCell`, `fromRows`, overlay) | 90% |
| Container / glue (`EditableDataGrid`) | 80% |
| Scaffold / harness | 60% (the smoke test IS the coverage) |

- Test names state behavior: `should [expected] when [condition]`.
- Tests live in `packages/datagrid/test/` (unit `*.{spec,impl}.test.ts`, e2e `*.e2e.test.ts`) and, for the
  promotion, one spec in `packages/ui/test/`.
- Real objects over mocks: real `@jsvision/ui` `RenderRoot`/`ScreenBuffer`/`signal`; the only test double is
  the hand-written windowed `GridDataSource` (ST-7) and a structural fake `loop` for the overlay (ST-9).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived from RD-01 (AC-1…AC-10), the `03-XX` specs, and the two registers. Immutable oracle: if the
> implementation disagrees, the implementation is wrong. In-code traceability comments quote behavior in
> **plain language** — never an ST-/AC-/AR- id or a `requirements/` path (repo docs ban, `check-jsdoc.mjs`).

### ui grid-engine promotion (03-01)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `import { GridRows, GridHeader, apportionColumns, alignCell, sortRows, measureAutoWidths, stringWidth } from '@jsvision/ui'` + the types `GridRowsConfig`/`GridHeaderConfig` (and existing `Column`/`ColumnWidth`/`ColumnAlign`/`SortState`/`ColumnGeometry`) | Every value resolves (`typeof === 'function'`); the types are importable (typechecks) | AC-2 / req AR-12 |
| ST-2 | `import { DataGrid } from '@jsvision/ui'` + run ui's existing table suite | `DataGrid` still exported and its tests stay green (promotion is additive, no regression) | AC-2 |

### column model & adapter (03-03)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-3 | `toEngineColumn({ id:'b', title:'B', value:r=>r.balance })` accessor over `{balance:1000}`; then with `format:v=>eur(v)` | No formatter → `"1000"` (`String(value)`); with formatter → `"€ 1.000,00"` | AC-3 / req AR-31 |
| ST-4 | `sortRows([{balance:1000},{balance:9}], [engineCol], {col:0,dir:'asc'})` where `engineCol=toEngineColumn({value:r=>r.balance, format:eur})` | Ordered `9` before `1000` (numeric `value`, NOT the strings `"€ 1.000,00"` < `"€ 9,00"`) | AC-3 / req AR-31 |
| ST-5 | `new EditableDataGrid({ columns })` / `fromRows(sig, {})` — no `rowKey` | TypeScript compile error (a `// @ts-expect-error` line typechecks; removing it fails `tsc`) | AC-5 / req AR-15 |

### data source & commit (03-04)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-6 | `fromRows(signal([a,b,c]), {rowKey})` → `length()`, `rowAt(0/1/2/3)` | `length()===3`; `rowAt(i)===signal()[i]`; `rowAt(3)===undefined` | AC-4 / req AR-14 |
| ST-7 | The SAME assertion suite run against `fromRows(...)` and a hand-written windowed `GridDataSource` double with identical rows | Both produce identical `length`/`rowAt` results and drive the read-only container to the identical rendered buffer | AC-4 / req AR-14 |
| ST-8 | `commitCell({previous:1, next:2, apply, onCommit})` with `onCommit → true`, then `→ false`, then `→ Promise.reject` | `true` → record holds `2`, `{committed:true,value:2}`; `false` and reject → `apply` reverts to `1`, `{committed:false,value:1}` | AC-6 / req AR-16, AR-02 |

### overlay & read-only container (03-05)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-9 | `mountCellOverlay({host, loop:fake, rect:{x:2,y:1,w:6,h:1}, origin:{x:0,y:0}, view})` then call the returned `dispose()` | `view` added to `host` at absolute `{x:2,y:1,w:6,h:1}`; `fake.focusView(view)` called once; after `dispose()` `view` removed AND its reactive root disposed (an `onCleanup` inside the root fires) | AC-7 / req PF-004 |
| ST-10 | Read-only `EditableDataGrid` over `fromRows` with a `balance` column (`format:eur`), mounted into a `RenderRoot`, buffer serialized | The balance cells show the formatted string (`"€ …"`), header shows the title; renders identically from the windowed double (with ST-7) | AC-3 |
| ST-11 | A cell whose `value`/`format` yields `"\x1b[31mX\x07"`, rendered + `serialize`d | The serialized frame contains **no** raw `\x1b` or `\x07` byte from that value (sanitize boundary) | AC-8 / req AR-25, AR-26 |

### story harness (03-06) + packaging/security (03-02)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-12 | The in-package smoke test over `STORIES` | Registry non-empty; every story has `id`/`category`/`title`/`blurb`; ids unique; each story builds + mounts headlessly and `paintedCells > 0` | AC-9 |
| ST-13 | After `yarn workspace @jsvision/datagrid build` | `dist/` contains exactly one entry point (`index.js` + `index.d.ts`), no second entry; `check:deps` reports zero native runtime deps | AC-1, AC-10 |
| ST-14 | Scan `packages/datagrid/src/**/*.ts` | No `eval(`, `new Function(`, or dynamic `require(` occurs in the package source | AC-10 |

> **⚠️ AUTHORING RULE:** Every expectation above is derived from a spec document / AC / AR — none from imagined
> implementation output. Currency rendering (`"€ 1.000,00"`) assumes the `nl-NL` `Intl` locale used in the
> example; the spec asserts the **ordering/formatted-vs-value distinction**, not an exact glyph set, so a test
> pins the locale it constructs.

## Test Categories

### Specification Tests (from ST-cases above) — written BEFORE implementation

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/ui/test/grid-engine-exports.spec.test.ts` | ST-1, ST-2 | ui promotion |
| `packages/datagrid/test/column.spec.test.ts` | ST-3, ST-4 | adapter |
| `packages/datagrid/test/types.spec.test.ts` (+ `// @ts-expect-error`) | ST-5 | required `rowKey` |
| `packages/datagrid/test/data-source.spec.test.ts` | ST-6, ST-7 | source (+ windowed double fixture) |
| `packages/datagrid/test/commit.spec.test.ts` | ST-8 | commit |
| `packages/datagrid/test/overlay.spec.test.ts` | ST-9 | overlay |
| `packages/datagrid/test/grid.spec.test.ts` | ST-10, ST-11 | container + sanitize |
| `packages/datagrid/test/kitchen-sink.smoke.spec.test.ts` | ST-12 | story harness |
| `packages/datagrid/test/security.spec.test.ts` | ST-14 | source scan |
| `packages/datagrid/test/packaging.e2e.test.ts` | ST-13 | build output (e2e; runs after build) |

### Implementation Tests (edge cases, internals) — written AFTER implementation

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `column.impl.test.ts` | `defaultCompare` across number/string/Date/null/mixed; `column` value-inference (typed `format`/`parse` compiles, mismatch is a compile error) | High |
| `data-source.impl.test.ts` | `fromRows` reactivity on `rows.set`; `rowAt` bounds | Med |
| `commit.impl.test.ts` | no-`onCommit` path; late-resolving async commit | Med |
| `overlay.impl.test.ts` | `absoluteRect` parent-chain walk; overlay re-mount | Med |
| `grid.impl.test.ts` | empty-source `<empty>` render; windowed materialization | Med |

### Integration / E2E

| Test | Components | Description |
| ---- | ---------- | ----------- |
| `data-source.spec.test.ts` (shared) | source + container | ST-7: same body path over in-memory + windowed |
| `packaging.e2e.test.ts` | build output | ST-13: single entry point after a real `build` |

## Test Data

### Fixtures Needed
- A small `Person`/`Row` dataset (name + numeric balance) with a `rowKey`.
- A hand-written windowed `GridDataSource<T>` double (`test/fixtures/windowed-source.ts`) over the same rows.
- A control-byte cell value (`"\x1b[31mX\x07"`) for ST-11.

### Mock Requirements
- A structural fake `loop` (`{ focusView(v){…} }`) for ST-9 — no full event loop needed.
- Otherwise real objects (RenderRoot/ScreenBuffer/signal).

## Verification Checklist
- [ ] All ST-1…ST-14 defined with concrete input/output pairs (above)
- [ ] Every ST case traces to an AC / AR entry
- [ ] Spec tests written BEFORE implementation; verified to FAIL (red) first
- [ ] All spec tests pass after implementation (green)
- [ ] Impl tests written for edge cases and internals
- [ ] `yarn verify` green across datagrid + ui (incl. `check:docs`, `check:deps`)
- [ ] No regression in ui's existing `DataGrid`/table tests
- [ ] Coverage meets goals
