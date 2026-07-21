# 03-01 — Always-Visible Funnel (`SortHeader`)

> **Document**: 03-01-funnel.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-1, FR-2, FR-5 · **Refs**: AR-3, AR-6, AR-7, AR-8, AR-11

Make the funnel a permanent, filterability-gated affordance instead of a filtered-only indicator.
All changes are in `packages/datagrid/src/sort-header.ts`; the header already redraws on
`filterModel()` change so state flips repaint for free (`02 §funnel`).

## Filterability input

The header must know which columns are filterable (AR-8). Thread a `filterable: boolean[]` (parallel
to this header's own `columnIds` slice, derived from `col.filterable !== false`) into `SortHeader`
config — mirroring how `columnIds` is already threaded — so both draw and hit-test consult it without
re-reading column objects per cell. A non-filterable column behaves exactly as a column does today with
no funnel.

- **Optionality + default (preflight PF-004):** `SortHeaderConfig.filterable` is **optional**; when
  omitted it defaults to **all columns filterable** (every entry `true`). This mirrors today's
  behavior (every column is filterable) and means the existing direct-construction call sites in
  `sort-header.spec.test.ts` / `sort-header.impl.test.ts` keep compiling and passing (no existing test
  asserts funnel *absence* except the replaced ST-19). `grid-panels.ts` always passes the real slice.
- **Per-panel derivation (preflight PF-005):** because columns are sliced per panel in
  `grid-panels.ts` (`sliceCols`/`sliceTyped`), derive each header's `filterable[]` from that panel's own
  `ids` against `columnMap` (a `filterableOf(id)` helper on the deps is the clean seam) — a single
  container-level array "parallel to columnIds" is ambiguous, since the quick-filter band is built over
  `fullVisible` while headers use per-panel `ids`.

> **Preflight PF-009 — this is a global visual change.** Because `filterable` defaults `true`, the
> muted `▽` now appears on **every** grid in the codebase (all datagrid-showcase stories, the
> kitchen-sink, docs examples), not only the three filtering demos. This is intended (AR-1/AR-3) and
> **non-breaking**: the funnel reserve is a title-clip only (it adjusts the `alignCell` width, not
> `geom.widths`), so column geometry, frozen-band widths, and quick-filter positions are unchanged, and
> no test asserts funnel absence except the replaced ST-19. Behavioral verification should spot-check a
> title-filled narrow column to confirm the 1-cell-earlier clip reads acceptably.

## Draw states (replaces the `filtered`-gated paint, `sort-header.ts:265,272`)

For each column `c` with `filterable[c] === true`:

- Reserve the funnel cell **whenever the column is filterable** (not only when filtered), so the
  title's clip width becomes `w - (sortReserve + 1)` on every filterable column (FR-5, AR-7). A
  non-filterable column keeps `w - sortReserve` (today's behavior).
- Paint the `▽` glyph in:
  - `ctx.color('listDivider')` — **muted** — when `!filters.has(columnId)` (unfiltered), or
  - `ctx.color('tableHeader')` — **normal/emphasized** — when `filters.has(columnId)` (active).
  Same glyph in both states (AR-6).
- **Narrow-column precedence (FR-5):** keep the existing `w - 1 - sortReserve >= 0` guard — when the
  column is too narrow to hold the funnel alongside the sort arrow, drop the **funnel** first (the
  arrow survives). Unchanged precedence, now applied to the always-on funnel.

## Hit-test (`funnelColumnAt`, `sort-header.ts:451-464`)

- Replace the `isFiltered(k)` gate with `isFilterable(k)` so a click on a filterable column's funnel
  cell routes to the popup **regardless of filter state** (FR-2). The reserve math is unchanged (the
  funnel occupies `sortReserveOf(k)` in from the right edge).
- The call site (`sort-header.ts:350-368`) already checks the funnel before the title/sort hit-test,
  so a funnel click still never also sorts. Opening on an unfiltered column yields a blank popup
  (AR-10) — no header change needed for that.

## What does NOT change

- `sortReserve` (arrow/priority reservation) and the divider paint are untouched.
- The reactive redraw binding (`sort-header.ts:175-178`) already covers muted↔emphasized flips.
- Frozen panels need no special handling — each panel's `SortHeader` gets the same `filterable`
  array and shared filter signal (AR-11).

## JSDoc

Update the `draw` and `funnelColumnAt` doc comments to describe the always-visible, muted/emphasized
funnel and the filterability gate — in plain language, **no** RD/AR/plan IDs in shipped code (project
doc standard). Any public config addition (the `filterable` array is internal; the public surface is
`GridColumn.filterable` in [03-03](03-03-filterable-demos-rd.md)) carries an `@example`.
