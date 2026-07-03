# Theme role & packaging: Table / DataGrid

> **Document**: 03-03-theme-packaging.md
> **Parent**: [Index](00-index.md)

## Overview

The single additive cross-package edit (the `tableHeader` core theme role), the `src/table/` barrel +
public re-exports, and the kitchen-sink story + `demo:table`.

## 1. The `tableHeader` theme role (additive, AR-172)

> **GATE-1 note.** Turbo Vision has **no** table/grid class, so there is no `getColor` chain to decode
> here — the header is a documented extension (RD AR-151). Its colour is a **design choice among faithful
> `cpAppColor` bytes**, chosen by the user (AR-172): `0x3F` = bg cyan (`3`) + fg white (`F`) =
> **white-on-cyan**, a bright heading on the list's own cyan field. This is the ONLY new role; the row +
> divider roles (`listNormal/Focused/Selected/Divider`) are reused unchanged.

**`packages/core/src/engine/color/theme.ts`** — add to the `Theme` interface (near the `list*` block,
`:128-146`) and to `defaultTheme` (`:284-287`):

```ts
// interface Theme — after listDivider:
/**
 * DataGrid header row (jsvision-ui RD-16, AR-172). A documented TV-EXTENSION colour — Turbo Vision has
 * no table class, so this is a design choice (not a getColor decode): `0x3F` = white-on-cyan — a bright
 * white heading on the same cyan field as the `cpListViewer` rows (cohesive, distinct from black-on-cyan
 * normal + yellow-on-cyan selected). Additive/non-breaking, the same pattern as AR-97/112/122/139/149.
 */
readonly tableHeader: ThemeRole;

// defaultTheme — after listDivider:
tableHeader: { fg: PALETTE.white, bg: PALETTE.cyan },   // 0x3F (AR-172)
```

- `ThemeRoleName = keyof Theme` (view/types.ts) picks the new role up automatically → `ctx.color('tableHeader')`.
- **AC-10:** exactly ONE new role; `encode()` of it does not throw (asserted in the theme spec test).

## 2. `src/table/` subsystem + re-exports (AR-178, AC-11)

```
packages/ui/src/table/
├── data-grid.ts   DataGrid<T> Group + Column<T>/ColumnWidth/SortState/DataGridOptions types (03-01)
├── grid-rows.ts   GridRows<T> (View) + GridHeader<T> renderer (03-01)
├── columns.ts     measureAutoWidths / apportionColumns / alignCell / sortRows + Column geometry (03-02)
└── index.ts       barrel: re-export DataGrid, Column, ColumnWidth, SortState, DataGridOptions
```

**`packages/ui/src/index.ts`** — add an **explicit named re-export** block (the layout-convention rule,
matching the `tree/`/`list/` blocks):

```ts
export { DataGrid } from './table/index.js';
export type { Column, ColumnWidth, SortState, DataGridOptions } from './table/index.js';
```

- Pure TS, ESM/NodeNext (`.js` specifiers); zero runtime deps → `yarn check:deps` holds (AC-11).
- Each file ≤ 500 lines (AR-178); if `grid-rows.ts` risks the cap, `GridHeader` splits to
  `grid-header.ts` (noted, decide at implement time — same barrel).

## 3. Kitchen-sink story + `demo:table` (AR-161, AC-12)

> **NON-NEGOTIABLE kitchen-sink rule:** a component is not done until its story exists + the smoke test passes.

**Story** — `packages/examples/kitchen-sink/stories/data-grid.story.ts` (+ one line in `stories/index.ts`):

```ts
export const dataGridStory: Story = {
  id: 'data-grid', category: 'Containers', title: 'DataGrid', rd: 'RD-16',
  blurb: 'Multi-column table: sticky header, click-to-sort, fixed/fr/auto widths, H-scroll, zebra.',
  build(ctx) { /* a typed Person[] grid: mixed fixed/fr/auto columns, a sortable numeric column,
                  zebra on, a visible focused-row + selection echo; absolutely positioned in ctx.w×h */ },
};
```

- Must satisfy `test/kitchen-sink.smoke.spec.test.ts`: unique `id`, required metadata, mounts headlessly,
  paints something.

**Demo** — `packages/examples/table-demo/` + a `demo:table` script in `packages/examples/package.json`
(mirroring `demo:tree`/`demo:containers`): a headless dispatch-driven walkthrough, one ASCII frame per
step — **render → navigate rows (↓↓) → sort a column (header click) → horizontal-scroll (→)** — via `tsx`.
A `table-demo.e2e.test.ts` asserts the walkthrough runs (mirrors `tree-demo.e2e`).

## Error Handling

| Error Case | Handling Strategy | AR |
| ---------- | ----------------- | -- |
| `tableHeader` missing from `defaultTheme` | Type error at compile (`Theme` is exhaustive) — caught by `yarn typecheck` | AC-10 |
| Story id collision | Smoke test asserts unique ids | AC-12 |
| Downsample of `0x3F` on a low-colour terminal | `encode()`/`nearest*` handle it (existing core path); theme spec asserts no-throw | AC-10 |

## Testing Requirements

- `table-theme.spec` — `defaultTheme.tableHeader` is `{white, cyan}`; `encode(tableHeader)` no-throw; the
  reused `list*` bytes are unchanged (regression guard).
- `table.packaging.spec` — `DataGrid`/`Column` import from `@jsvision/ui`; `src/table/` files ≤ 500 lines;
  `check:deps` clean (mirrors `containers.packaging.spec`).
- `kitchen-sink.smoke` — the `data-grid` story mounts + paints.
