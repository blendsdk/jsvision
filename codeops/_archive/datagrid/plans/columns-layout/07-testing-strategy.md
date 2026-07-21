# 07 — Testing Strategy

> **Parent**: [Index](00-index.md) · **CodeOps Skills Version**: 3.7.0

Specification-first: each ST-* below is written from the requirement/AR (never from imagined
implementation) and is locked as a `*.spec.test.ts` **before** the code exists. Impl tests
(`*.impl.test.ts`) cover edges. Verify command: **`yarn verify`** (AR-16).

Test files: `column-model.spec.test.ts` / `.impl.test.ts`, `grid-layout.spec.test.ts`,
`frozen-panels.spec.test.ts`, `resize-reorder.spec.test.ts`, additions to `security.spec.test.ts`,
plus the kitchen-sink + showcase smoke suites.

## Column model — pure (Phase 1)

| ST | Input | Expected |
| -- | ----- | -------- |
| ST-1 | `visibleOrder(['a','b','c'], {b})` | `['a','c']` — hidden dropped, order kept |
| ST-2 | `partition(['a','b','c','d'], {freezeLeft:['a'], freezeRight:['d'], freeze:undefined})` | `{left:['a'], center:['b','c'], right:['d']}`; unknown freeze ids ignored |
| ST-3 | `partition(['a','b','c'], {freeze:2})` | `{left:['a','b'], center:['c'], right:[]}` |
| ST-4 | `reorderWithinPanel(['a','b','c','d'], {freeze:1}, 2, 1)` (center move) | `['a','c','b','d']` |
| ST-5 | `reorderWithinPanel(['a','b','c'], {freeze:1}, 1, 0)` (center→left boundary) | `['a','b','c']` unchanged — cross-boundary rejected (**AC-2**) |
| ST-6 | `clampWidth(1, 4, 20)` / `clampWidth(99, 4, 20)` / `clampWidth(10, undefined, undefined)` | `4` / `20` / `10` (default min 3 when no minWidth) |
| ST-7 | `overPinnedIds` when Σfrozen ≥ viewport | innermost frozen ids until center ≥ 1 cell; `[]` when it fits (**AC-6** data-plane) |

## Container column-state API (Phase 2)

| ST | Input | Expected |
| -- | ----- | -------- |
| ST-8 | `setColumnWidth('name', 99)` with `maxWidth:20` then `columnWidth('name')` | `20` (clamped); unknown id `setColumnWidth('zzz', 10)` is a no-op |
| ST-9 | `setColumnOrder(['b','a'])` on 2-col grid | `columnOrder()` = `['b','a']`; `setColumnOrder(['b','zzz'])` ignored (not a known permutation) |
| ST-10 | `setColumnVisible('dept', false)` | `columnOrder()` omits `dept`; the column isn't laid out; `sortBy('dept')` still orders the data (**AC-3**) |
| ST-11 | `freeze: 2` → `frozen()` | `{left:[id0,id1], right:[]}` |
| ST-12 | `autoFitColumn('name')` over rows whose widest cell = 12, `maxWidth:20` | width ≈ 12 (bounded by 20) (**AC-7** data-plane) |
| ST-13 | column with `minWidth: 8`, adapted via `toEngineColumn`, measured | engine `Column.minWidth === 8`; `measureAutoWidths` floors to ≥ 8 |

## Frozen panels & sticky header (Phase 3)

| ST | Setup | Expected |
| -- | ----- | -------- |
| ST-14 | `freeze: 2`, then scroll center horizontally | left panel (2 cols) does NOT shift; a `│` freeze-divider separates panels (**AC-4**) |
| ST-15 | `freeze: 2`, focused row = 3 | the row highlight spans left + center + right panels (one row cursor) (**AC-4**) |
| ST-16 | `freeze: 2`, scroll body vertically | header row stays fixed; each panel's header columns align to its body columns (**AC-5**) |
| ST-17 | frozen width ≥ viewport | over-pinned ids move to center (center non-blank) + exactly one `devWarn` (**AC-6**) |
| ST-18 | `freeze: 1` (left), cursor at last center col, press `→` | cursor enters the right panel; `←` off first center enters left; `Ctrl+Home`/`Ctrl+End` reach global first/last cell (**AR-2**) |
| ST-19 | no `freeze*` option | exactly one body panel + one header (single-body path preserved) (**AR-5** regression) |

## Resize & reorder gestures (Phase 4–5)

| ST | Gesture | Expected |
| -- | ------- | -------- |
| ST-20 | capture down on a grip, drag +5, up | `columnWidth` grows live by ~5 each move; clamps at the column min; a drag below min stops at min (**AC-1**) |
| ST-21 | double-click a grip | `autoFitColumn` runs → width = widest visible cell bounded by max (**AC-7** gesture) |
| ST-22 | press a title, drag past 1 cell to a same-panel slot, up | `columnOrder` reflects the move; a plain click (no drag) still sorts (**AC-2**) |
| ST-23 | drag a title toward another panel, drop past the boundary | order unchanged (cross-panel drop rejected) (**AC-2**) |

## Frozen rows & density (Phase 6)

| ST | Setup | Expected |
| -- | ----- | -------- |
| ST-24 | `freezeRows: 1`, scroll body | the first row is pinned below the header and stays put; the body's virtual window starts at row 1 (no duplicate row) |
| ST-25 | `density: 'compact'` vs `'normal'` | compact draws no `│` divider and yields wider content cells; header + body stay column-aligned in both modes |

## Security (Phase 2 + Phase 7)

| ST | Input | Expected |
| -- | ----- | -------- |
| ST-26 | unknown `columnId` in `setColumnOrder`/`setColumnWidth`/`setColumnVisible`/`autoFitColumn` | ignored — never enters `columnOrder`/`columnWidths`/`hidden` (**AC-9**) |
| ST-27 | a header/cell text containing control chars, after a reorder + hide | text stays `sanitize`d after any layout change (layout is presentational, RD-04 sanitize path intact) (**AC-9**) |

## Story & showcase (Phase 7)

| ST | Artifact | Expected |
| -- | -------- | -------- |
| ST-28 | `columns-layout.story.ts` kitchen-sink story (frozen cols + resize/reorder + show/hide) | passes `kitchen-sink.smoke.spec.test.ts` — mounts headlessly, paints, unique id + metadata (**AC-8**) |
| ST-29 | datagrid-showcase columns-layout demo cluster (replacing the RD-07 placeholder) | passes the showcase smoke + walkthrough tiers (**AR-3**) |

## Verification per phase

Every phase ends with `yarn verify` (lint + typecheck + build + test + check:docs). Gestures use the
synthetic-captured-mouse harness the `scroll-bar`/`slider` tests use (envelopes carrying `local` +
`setCapture`/`hasCapture`/`releaseCapture` seams). Panel/cursor specs mount an `EditableDataGrid`
through `createEventLoop` + `loop.focusView(grid.rows)` (or the focused panel), as the existing
`grid-*.spec.test.ts` do.
