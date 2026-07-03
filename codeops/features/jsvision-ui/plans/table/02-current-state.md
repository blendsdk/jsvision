# Current State: Table / DataGrid

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

Every primitive the DataGrid needs is already shipped and verified. The grid is pure **composition** of
existing parts + one additive theme role — no new engine seams.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/ui/src/list/list-view.ts` | The `ListView<T> extends Group = ListRows(fr) + vbar(1)` idiom | **Read-only reference** — DataGrid mirrors its shape |
| `packages/ui/src/list/list-rows.ts` | `ListRows<T> extends View` — virtual-scroll renderer, nav/mouse/select, `sorted`/type-ahead, `<empty>` | **Read-only reference** — `GridRows` is its multi-column analog |
| `packages/ui/src/tree/tree.ts` | `Tree<T> extends Group` — the second instance of the idiom (renderer + owned bar) | **Read-only reference** |
| `packages/ui/src/list/virtual.ts` | Pure `clampIndex`/`keepVisible` (TV `focusItem`/`focusItemNum`) | **Reuse unchanged** |
| `packages/ui/src/scroll/scroll-bar.ts` | `ScrollBar` — V/H orientation, two-way `value`, `setRange(min,max,pageStep)`, thumb-drag via capture | **Reuse unchanged** (own two: V + H) |
| `packages/ui/src/layout/apportion.ts` | `solveTrack(total, items, gap)` — integer `fixed\|flex` apportion; `TrackItem` has **no `auto`** (`:17-19`) | **Reuse** — `auto` pre-measured to `fixed` first (AR-173) |
| `packages/core/src/engine/color/theme.ts` | `Theme` interface + `defaultTheme`; `list*`/`listDivider`, `staticText` roles all present | **Additive edit** — add `tableHeader` (AR-172) |
| `packages/ui/src/index.ts` | Single public entry, explicit named re-exports | **Additive edit** — re-export `table/` |
| `packages/ui/src/view/index.ts` | `View`/`Group`/`DrawContext`/`ThemeRoleName` | **Reuse unchanged** |
| `packages/ui/src/reactive/index.ts` | `signal`/`computed` | **Reuse unchanged** |

### Code Analysis (verified this session)

- **The idiom** — both `ListView` (`list-view.ts:43-82`) and `Tree` (`tree.ts:50-113`) are
  `class X extends Group` laid out `direction:'row'` with `rows.layout = {size:{kind:'fr',weight:1}}` and
  `bar.layout = {size:{kind:'fixed',cells:1}}`, sharing the `focused` signal with the bar (`bar.value ===
  focused`) and setting `rows.bar = bar` so the renderer re-limits the bar each draw via `setRange`. The
  DataGrid extends this to **two axes**: a vertical `[header 1][body fr][hbar 1]` column whose `body` is a
  `[GridRows fr | vbar 1]` row (AR-174).
- **Virtual-scroll renderer** — `ListRows.draw` (`list-rows.ts:171-214`): `bar.setRange(0, range-1,
  rows-1)`, `topItem = keepVisible(focused, topItem, rows, range)`, then per visible row blank in its role
  colour + draw text at column 1; `<empty>` at (1,0) when `range===0`; role priority **focused > selected
  > normal** (`:201-208`). `GridRows` reuses this exact spine, extended to N columns + a divider + H-indent.
- **`solveTrack`** — `apportion.ts:74-89`: fixed items keep their size even when their sum exceeds `total`
  (`free = max(0, total - fixedSum - gap)`), flex splits the leftover. So calling `solveTrack(viewportWidth,
  items)` where `auto`/`fixed` cols are `{kind:'fixed'}` and `fr` cols are `{kind:'flex'}` yields: `fr`
  fills the viewport (no overflow), or (all fixed/auto) columns keep natural width and **overflow** → the
  content width exceeds the viewport → H-scroll engages. Matches AR-153/AR-156.
- **`ScrollBar`** already supports horizontal (`orientation:'horizontal'`, `scroll-bar.ts:78,107`) with a
  two-way `value` and `setRange` — the H-bar drives `indent` exactly as `ListView`'s vbar drives `focused`.

### TV source (GATE-1, verified against `/home/gevik/workdir/github/tvision/source/tvision/tlstview.cpp`)

- **Palette** `cpListViewer = "\x1A\x1A\x1B\x1C\x1D"` (`:29`) → `getColor(1/2)`=normal, `(3)`=focused,
  `(4)`=selected, `(5)`=divider. Already decoded into `listNormal/Focused/Selected/Divider` (`theme.ts:128-146`).
- **`draw`** (`:76-152`): row colour chosen by `(sfSelected|sfActive)` + `focused==item`; `indent =
  hScrollBar->value` (`:99-102`); per cell `moveChar(curCol,' ',color,colWidth)` then
  `moveStr(curCol+1,text,color,colWidth,indent)`; **divider** `moveChar(curCol+colWidth-1,'\xB3',getColor(5),1)`
  (`:130`); `emptyText` at `(curCol+1)` when `i==0&&j==0&&item>=range` (`:127-128`).
- **`handleEvent`** (`:213-320`): Space → `selectItem(focused)` (`:282-286`); ↑↓ ±1; PgUp/PgDn
  `±size.y*numCols`; Home=`topItem`; End=`topItem+size.y*numCols-1`; Ctrl+PgUp=`0`; Ctrl+PgDn=`range-1`;
  ←/→ only when `numCols>1`. **Row-per-item grid ⇒ `numCols≡1` ⇒ `±viewportRows` is the faithful paging**
  (AR-182). `meDoubleClick` → `selectItem` (`:274-276`) — **not portable** (no click-count in our model, AR-177).
- **`focusItem`** (`:159-173`) / **`focusItemNum`** (`:175-186`) → already ported into `virtual.ts`.

## Gaps Identified

### Gap 1: No `auto` column-width kind
**Current:** `TrackItem` is `fixed | flex` only (`apportion.ts:17-19`).
**Required:** an `auto` column sized to its widest cell.
**Fix:** `columns.ts` **pre-measures** each `auto` column (widest `stringWidth(accessor(row))` over all
current rows, clamped by `maxWidth`) into a `{kind:'fixed'}` item, then calls `solveTrack` (AR-173).

### Gap 2: No table header role
**Current:** `theme.ts` has `list*` + `staticText` but no header role.
**Required:** one header colour distinct from the rows.
**Fix:** additive `tableHeader` role, white-on-cyan `0x3F` (AR-172).

### Gap 3: No mouse double-click
**Current:** `MouseEvent.kind = down|up|move|drag` (`events.ts:30`); no click-count.
**Required:** RD AC-8 wanted double-click select.
**Fix:** mirror `ListRows` — single-click focus+select, Enter/Space emit; double-click deferred (AR-177).

### Gap 4: The existing `sorted` computed is single-field/ascending only
**Current:** `list-rows.ts:111-116` `displayItems` sorts ascending by `getText` — a boolean toggle.
**Required:** per-column, asc/desc, optional typed `compare`.
**Fix:** `columns.ts` provides a **new** `{col,dir}` comparator (the *pattern* is reused, not the code) (AR-158).

## Dependencies

### Internal
- RD-11 (`list/virtual.ts`, `scroll/scroll-bar.ts`, the sorted-display pattern) — **Done**.
- RD-02 (`layout/apportion.ts` `solveTrack`) — **Done**.
- RD-03 (`View`/`Group`/`DrawContext`), RD-01 (`signal`/`computed`), RD-04 (focus/commands) — **Done**.
- RD-05 (`Window`/`Dialog`/`Desktop` hosts) — **Done**.
- `@jsvision/core` (`sanitize`, `Theme`, `ScreenBuffer`, `encode`) — **Done**.

### External
- None (zero runtime deps).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| `grid-rows.ts` exceeds 500 lines (renderer + header + nav + mouse + sort-indicator + H-indent) | Med | Med | Push width apportion, `auto` pre-measure, cell-extract, and the comparator into `columns.ts`; keep `grid-rows.ts` to draw + event routing (AR-178) |
| H-scroll `indent` + per-column absolute-x math drifts vs. the sticky header | Med | Med | Header and rows share ONE column-geometry function in `columns.ts` (single source of `[x, width]` per column); spec test asserts header and row divider columns line up (ST) |
| `auto` re-measure churns on every data change with large row sets | Low | Low | Measurement runs only on the `rows` signal change (a `computed`), not per frame (AR-173); documented O(rows) |
| Fidelity drift (divider/colour) vs. `TListViewer` | Low | High | GATE-1 BEFORE-decode + GATE-2 AFTER-diff tasks in `99-execution-plan.md`; row/divider bytes pinned in the ST oracle |
