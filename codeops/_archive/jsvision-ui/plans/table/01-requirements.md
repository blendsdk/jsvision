# Requirements: Table / DataGrid

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-16](../../requirements/RD-16-table.md)

## Feature Overview

A focusable, virtual-scrolling **`DataGrid<T>`** rendering rows of typed data across multiple
heterogeneous columns, with a sticky header, per-column sizing, click-to-sort, horizontal scroll, and
row-granular single-selection. Faithful to Turbo Vision `TListViewer` for the row spine (virtual scroll,
`│` divider, `cpListViewer` row colours, `hScrollBar` indent); the header + heterogeneous columns + sort
are the documented extension (RD AR-151).

## Functional Requirements

### Must Have

- [ ] **`DataGrid<T>` `Group`** composing a focusable `GridRows` renderer (a `View`), a non-scrolling
      sticky header, and **owned vertical + horizontal `ScrollBar`s** — the shipped `ListView`/`Tree`
      idiom (RD Must-Have; AR-174, AR-178).
- [ ] **Reactive data model** — `rows: Signal<T[]>`; updates re-render the visible window (AC-9; AR-157).
- [ ] **Typed columns** — `columns: Column<T>[]`, `Column<T> = { title; accessor: (row:T)=>string; width;
      align?; compare?; minWidth?; maxWidth? }`; each cell = `accessor(row)`, **sanitized** to screen (AC-4/AC-13; AR-152).
- [ ] **Column sizing** — `ColumnWidth = number | \`${number}fr\` | 'auto'`, apportioned via RD-02 integer
      `solveTrack`; `auto` is **pre-measured** to a `fixed` track item (widest cell over all current rows,
      `maxWidth`-or-uncapped, recompute on data change) before apportioning (AC-3; AR-153, AR-173).
- [ ] **Faithful row draw** — cells left-to-right, each clipped/padded to its width and aligned per
      `align`, separated by the `│` (`\xB3`) divider in the `listDivider` role; row colour =
      `listNormal`/`listFocused`/`listSelected` per state (faithful `TListViewer` `getColor(2)/(3)/(4)`);
      no markers (colour-first). (AC-2; AR-159, AR-179).
- [ ] **Sticky header** — a non-scrolling header row of column `title`s (aligned per `align`, same `│`
      divider) in the new `tableHeader` role; fixed vertically, scrolls **horizontally in lockstep** with
      the data columns (AC-5; AR-154, AR-172, AR-174).
- [ ] **Click-to-sort** — a header click sets `sort: Signal<{col; dir:'asc'|'desc'}|null>`; the display is
      a `computed` reordering (RD-11 sorted-**pattern**, a *new* `{col,dir}` comparator using the column's
      optional `compare`, else locale-aware string compare of `accessor(row)`); a `▲`/`▼` indicator marks
      the active column; clicking the active column toggles direction (AC-6; AR-154, AR-158, AR-180).
- [ ] **Navigation (faithful `TListViewer`)** — ↑↓ ±1, PgUp/PgDn ±viewportRows, Home/End (window),
      Ctrl+PgUp/Dn (list ends), ←/→ H-scroll on overflow, wheel ±3; focused row stays visible (AC-1; AR-155, AR-182).
- [ ] **Horizontal scroll** — when total column width exceeds the viewport, the owned horizontal
      `ScrollBar` (+ ←/→) scroll the columns via the `indent` offset; header scrolls with them; off-screen
      columns clipped (AC-7; AR-153, AR-156).
- [ ] **Row-granular single-select** — two-way `focused: Signal<number>` (**positional** index into the
      sorted view) + `selected`/`onSelect`/`command`; a single click focuses+selects (no emit),
      **Enter/Space** selects + emits the command; double-click deferred; `focused` clamped on data/sort
      change (AC-8/AC-9; AR-155, AR-157, AR-177).
- [ ] **Empty state** — with `rows = []`, the header draws normally and the data area shows `<empty>`; no
      crash/out-of-range with zero rows or zero columns (AC-14).
- [ ] **One additive core theme role** — `tableHeader` (white-on-cyan `0x3F`) in `Theme` + `defaultTheme`;
      row/divider roles reused unchanged (AC-10; AR-159, AR-172).
- [ ] **Kitchen-sink story + `demo:table`** — a `DataGrid` story passing the headless smoke test + a
      headless walkthrough (render → navigate → sort → H-scroll) (AC-12; AR-161).

### Should Have

- [ ] **`DataGrid.sortBy(col, dir)`** — drive the `sort` signal programmatically (AR-175).
- [ ] **Column `minWidth?`/`maxWidth?`** clamps on `fr`/`auto` columns (AR-175; the `auto` cap, AR-173).
- [ ] **Row striping** — `zebra?: boolean` (default off); odd rows reuse `staticText` (`0x70`), even rows
      `listNormal` (`0x30`); no new role (AR-175, AR-176).

### Won't Have (Out of Scope)

- Cell-granular focus/selection (per-cell cursor) — deferred (RD AR-155).
- The faithful newspaper-`numCols` list — a distinct layout, tracked (RD AR-151).
- In-cell editing / editable grid — separate mechanism (RD out-of-scope).
- Column drag-reorder / drag-resize — the header is a sort surface only (RD out-of-scope).
- **Mouse double-click as a distinct gesture** — infeasible with the current core input model; deferred
  and tracked (AR-177).

## Technical Requirements

### Performance
- Virtual scroll: only the visible window is drawn per frame (never all rows). `auto` measurement is
  O(rows) but runs only on a `rows`-signal change, not per frame (AR-173).

### Compatibility
- Pure TS, ESM/NodeNext (`.js` specifiers), **zero runtime deps** (`yarn check:deps` holds).
- Additive-only cross-package surface: one new core theme role; no existing role/signature changes.

### Security
- Every cell (`accessor(row)`) and header `title` routes through the RD-03 `DrawContext` → `ScreenBuffer`
  + core `sanitize` (the canonical injection boundary) — no raw escape sequences reach the terminal.
- Row/window/`focused`/`indent` access is **bounds-checked** (`clampIndex`, `keepVisible`); each cell is
  width-clipped so no cell overflows its column or the viewport (AC-13).

## Scope Decisions

| Decision              | Options Considered                              | Chosen                                   | Rationale | AR |
| --------------------- | ----------------------------------------------- | ---------------------------------------- | --------- | -- |
| Header colour         | `0x3F` white-on-cyan / `0x70` grey / `0x7F`      | New `tableHeader` role `0x3F`            | Bright heading cohesive with the cyan grid field | AR-172 |
| `auto` measurement    | all rows / all rows+cap40 / visible window       | All rows, `maxWidth`-or-uncapped         | Predictable, no scroll jitter            | AR-173 |
| Grid layout           | header-over-data+vbar-in-body / vbar full-height | `[header 1][body fr][hbar 1]`            | Header scrolls H / fixed V; clean corner | AR-174 |
| Should-Have scope     | any subset                                       | All three                                | User chose full scope                    | AR-175 |
| Zebra colour          | `staticText 0x70` / new role / `listDivider`     | Reuse `staticText 0x70`                  | Readable stripes, no new role            | AR-176 |
| Mouse select          | mirror ListRows / keyboard-only / new primitive  | Mirror `ListRows`                        | Feasible today, sibling-consistent       | AR-177 |
| File split            | pattern-based                                    | `data-grid`/`grid-rows`/`columns`/`index`| ≤500 lines, `ListView`/`Tree` shape      | AR-178 |
| Divider placement     | per-column / between-columns                     | Per-column right edge (faithful)         | `tlstview.cpp:130`                       | AR-179 |

> **Traceability:** every decision references its Ambiguity Register entry (this plan's
> `00-ambiguity-register.md`, AR-172…AR-182, continuing the feature register AR-151…AR-171).

## Acceptance Criteria

Mirrors RD-16 AC-1…AC-14, with AC-8 updated per AR-177 (mouse: single-click focus+select, Enter/Space
emit, double-click deferred). See [07-testing-strategy.md](07-testing-strategy.md) for the ST oracles.

1. [ ] AC-1 multi-column virtual scroll + ↑↓/PgDn nav + owned vbar reflects position
2. [ ] AC-2 faithful row draw (`│` divider `listDivider`; row colour per state)
3. [ ] AC-3 column sizing (`fixed`/`fr` via `solveTrack`; `auto` pre-measured; integer-correct)
4. [ ] AC-4 alignment (left/right/center per `align`, cells + header)
5. [ ] AC-5 sticky header (fixed V, scrolls H in lockstep)
6. [ ] AC-6 click-to-sort (asc→desc toggle, `▲`/`▼`, numeric `compare` vs locale string)
7. [ ] AC-7 horizontal scroll (H-bar + ←/→, header follows, clipped)
8. [ ] AC-8 select+emit (click focus+select, Enter/Space emit; `focused` positional; no cell cursor)
9. [ ] AC-9 reactive data (rows/sort change re-renders; `focused` clamped)
10. [ ] AC-10 one new `tableHeader` role; `encode()` no throw; row/divider roles unchanged
11. [ ] AC-11 packaging (`src/table/` explicit re-exports; `check:deps` passes; ≤500 lines)
12. [ ] AC-12 story (smoke passes) + `demo:table` headless
13. [ ] AC-13 security (sanitize + bounds-check + width-clip)
14. [ ] AC-14 empty state (`<empty>` placeholder; zero-row/zero-column safe)
15. [ ] All `yarn verify` passing; no regressions
