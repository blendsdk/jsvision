# RD-16: Table / DataGrid — multi-column data grid (TV-extension on `TListViewer`)

> **Document**: RD-16-table.md
> **Status**: Draft
> **Created**: 2026-07-02 (`make_requirements` — RD-12+ high-value-controls set, sibling 3 of 6)
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-11 (Containers/lists — done; the virtual-scroll helpers `list/virtual.ts`, the owned-`ScrollBar` pattern, and the `sorted` computed the DataGrid reuses), RD-02 (Layout engine — done; the integer `solveTrack` apportion that sizes columns), RD-05 (App shell — done; `Desktop`/`Window`/`Dialog` host it), RD-04/RD-03/RD-01 (done), `@jsvision/core` (done; the one additive header theme role lands here; the row/divider roles already exist)
> **Set**: RD-12+ high-value controls (AR-125…AR-129) — sliced by mechanism into 6 sibling RDs; this is **RD-16 (Table/DataGrid)**, the final MVP-phase RD (AR-129). It realizes RD-11's explicitly deferred multi-column surface (AR-104).
> **CodeOps Skills Version**: 3.1.0

---

## Feature Overview

The **tabular data** tier of `@jsvision/ui` — a focusable, virtual-scrolling **`DataGrid<T>`** that renders
rows of typed data across multiple **heterogeneous columns** (each column a different field), with a sticky
header, per-column sizing, click-to-sort, and horizontal scroll.

**GATE-1 fidelity finding (decoded, `tlstview.cpp`).** Turbo Vision has **no** table / grid / spreadsheet
class. Its *only* multi-column mechanism is `TListViewer::numCols`, and the decode shows it is **not** a
spreadsheet: it is a **newspaper-column flow of a single-field list** — `item = j*size.y + i + topItem`
(`tlstview.cpp` `draw`), i.e. the *same* one-field list flowing column-major across N equal-width columns
(what the file-open dialog uses to show filenames in 2 columns). A real **heterogeneous-column** grid
(columns = different fields, a header row, per-column widths, sort) therefore has **no TV counterpart**.

Per the **NON-NEGOTIABLE TV-fidelity directive**, RD-16 is a **documented TV-extension** (AR-151): every
glyph, colour, and geometry that *can* be grounded in `TListViewer` **is** — the virtual-scroll spine, the
`│` (`\xB3`) column divider in `getColor(5)`, the `cpListViewer` row colours (`focused`=`getColor(3)`,
`selected`=`getColor(4)`, normal=`getColor(2)`), `showMarkers`, the `hScrollBar->value` indent, the item
focus/select model — while the **header row + heterogeneous per-column accessors + sort** are the flagged
extension. This is exactly the extension the directive permits ("behavior the original couldn't have may
extend TV, but the visual shapes/sizes/colors must still match"), the same class as reactive binding,
truecolor, and async modality. This is also precisely what RD-11's AR-104 meant when it deferred "a real
table" as "the high-value multi-column surface".

The components in scope:

| Component | TV source / basis | Role |
|-----------|-------------------|------|
| `DataGrid<T>` | `TListViewer` (`tlstview.cpp`) spine + documented extension (AR-151) | A focusable virtual-scroll grid: renders only the rows in view, each row = the columns' `accessor(row)` cells separated by the faithful `│` divider; ↑↓/PgUp/PgDn/Home/End row navigation, a two-way focused index + a select command, a sticky header, click-to-sort, and horizontal scroll. |
| `Column<T>` | *(new, extension)* | The column descriptor — `{ title, accessor: (row: T) => string, width, align?, compare? }`. |
| *(internal)* column helpers | RD-02 `solveTrack` + RD-11 `sorted` | Width apportion (`fixed`/`fr`/`auto`), cell extraction + sanitize, and the sort comparator. |

**Behavior may extend TV** (heterogeneous columns, header, sort, reactive `Signal<T[]>`) but the
**row drawing/geometry/colour must match `TListViewer` exactly** (the `│` divider, the `cpListViewer` row
colours, `showMarkers`, virtual scroll, the `hScrollBar` indent).

---

## Functional Requirements

### Must Have

#### `DataGrid<T>` — multi-column virtual-scroll grid (TV `TListViewer` spine + extension, AR-151…AR-157)
- A focusable `View` that **virtual-scrolls** its rows (renders only the rows visible in the viewport — the
  `TListViewer::draw` `topItem`/`size.y` window) and **reuses the RD-11 virtual-scroll helpers**
  (`list/virtual.ts` `clampIndex`/`keepVisible`) plus **owns a vertical `ScrollBar`** (as `ListView` does)
  and an **owned horizontal `ScrollBar`** for column overflow (AR-156 — TV already wires `hScrollBar` with
  `indent = hScrollBar->value`, `tlstview.cpp` `draw`). It is a **`TListViewer`-derived** concern with its
  own multi-column row renderer, not a `ListView` (AR-160).
- **Data model (AR-157):** rows are a reactive **`Signal<T[]>`** over a generic row type `T`, mirroring
  `ListView<T>`'s `items` model (AR-106); updates re-render the visible window.
- **Columns (AR-152):** `columns: Column<T>[]` where
  `Column<T> = { title: string; accessor: (row: T) => string; width: ColumnWidth; align?: 'left'|'right'|'center'; compare?: (a: T, b: T) => number }`.
  The cell text is `accessor(row)`; it is **sanitized** to the screen like any other cell text (AR-152, the
  injection boundary). The generic keeps the grid type-safe and reactive per field.
- **Column sizing (AR-153):** `ColumnWidth = number | \`${number}fr\` | 'auto'` — a fixed cell count, an
  `fr`-weight share of the leftover width, or `auto` (the widest rendered cell, capped). Widths are
  apportioned with the RD-02 layout engine's **integer `solveTrack`** (already built — the same
  largest-remainder apportion the layout uses), so column edges are integer-correct with no rounding drift.
  When the total exceeds the viewport the **horizontal `ScrollBar`** scrolls the columns (AR-156).
- **Row rendering (faithful, AR-159):** each visible row draws its column cells left-to-right, each cell
  clipped/padded to its apportioned width and aligned per `align`, **separated by the faithful `│`
  (`\xB3`) divider** drawn in the existing decoded **`listDivider`** role (`getColor(5)` of `cpListViewer`,
  shipped by RD-11). The row colour is the existing decoded **`listNormal`/`listFocused`/`listSelected`**
  role per row state (faithful to `TListViewer`'s `getColor(2)/(3)/(4)`); `showMarkers` behaviour is
  preserved. **No new row or divider roles** — the rows *are* `TListViewer` rows.
- **Sticky header (AR-154):** a **non-scrolling header row** above the data draws each column's `title`
  (aligned per `align`), separated by the same `│` divider; it stays fixed while the data virtual-scrolls,
  and scrolls **horizontally** in lockstep with the data columns. The header colour uses a **new additive
  header role** decoded at **plan GATE-1** (a TV heading colour resolved through the `getColor` chain — the
  one extension role, AR-159).
- **Click-to-sort (AR-154/AR-158):** clicking a column header sets a two-way `sort: Signal<{ col: number;
  dir: 'asc'|'desc' } | null>`; the displayed order is a **`computed`** that reuses RD-11's `sorted`
  machinery, sorting by that column with the column's **optional `compare`** (for numeric/typed columns) or,
  by default, a **locale-aware string compare** of `accessor(row)`. A **`▲` (asc) / `▼` (desc)** indicator
  is drawn next to the active column's title. Clicking the active column toggles direction; sort is a
  documented extension (TV has no header sort).
- **Navigation (AR-155, faithful `TListViewer`):** ↑↓ move the focused row ±1, PgUp/PgDn ±viewport,
  Home/End, Ctrl+PgUp/Dn to the ends (`tlstview.cpp` `handleEvent`); the focused row stays visible
  (`focusItem`/`keepVisible`). Left/Right scroll the columns horizontally when they overflow (the H-bar),
  matching TV's `hScrollBar` model.
- **Mouse (AR-155):** a click on a data row focuses it; a **double-click selects** (as Enter); a click on a
  **header** cell sorts by that column. Wheel scrolls rows (±3, as `ListView`).
- **Selection (AR-155/AR-157):** **row-granular single-select** — a two-way `focused: Signal<number>`
  (row index into the sorted view) + a `selected`/`onSelect`/`command` seam; **Enter/double-click emits the
  select command** (mirroring `ListView`/`cmListItemSelected`) and sets `selected`. Cell-granular selection
  is deferred (AR-155).

#### Theme role — one additive faithful header colour (AR-159)
- Add **one** additive header role to core `@jsvision/core` `Theme` + `defaultTheme` — the grid **header**
  colour — decoded through the `getColor` chain at **plan GATE-1** (pinned to an exact attribute byte per
  the fidelity directive). Additive, non-breaking — the same cross-package pattern as the RD-06/07/11/14/15
  control roles (AR-97/112/122/139/149). The **row + divider roles already exist** (`listNormal`/
  `listFocused`/`listSelected`/`listDivider`, RD-11 `theme.ts:222-225`) and are reused unchanged.

#### Kitchen-sink story + headless demo (AR-161)
- Per the **kitchen-sink showcase (NON-NEGOTIABLE)** rule, add a **`DataGrid` story** (a typed multi-column
  table with a header, at least one sortable column, mixed `fixed`/`fr`/`auto` widths, horizontal scroll,
  and a visible focused-row/selection echo) passing the headless smoke test, plus a headless **`demo:table`**
  walkthrough (dispatch-driven, an ASCII frame per step: render → navigate rows → sort a column →
  horizontal-scroll), matching `demo:containers`/`demo:tree`.

### Should Have

- **`DataGrid.sortBy(col, dir)`** convenience method (drive the same `sort` signal programmatically, not
  only via a header click).
- **Column `minWidth?`/`maxWidth?`** clamps on `fr`/`auto` columns (so an `auto` column can't collapse below
  a legible width or dominate the grid).
- **Row striping** (`zebra?: boolean`, default off) — an alternating background using an existing decoded
  list role variant, off by default so the faithful look is the default.

### Won't Have (Out of Scope) — and Deferred (tracked)

**Out of scope (this RD):**
- `Tabs` (RD-17), `ProgressBar`/`Spinner` (RD-18), `Surface` (RD-19), `History`/`ComboBox` (RD-14), `Tree`
  (RD-15) — the other RD-12+ siblings (AR-126).
- The **faithful newspaper-`numCols` list** (a single field flowed column-major across equal columns) — a
  distinct layout from the heterogeneous DataGrid; not what AR-104 deferred (a *real table*). Trackable as a
  later micro-enhancement to `ListView` if a real use case appears (AR-151).
- **In-cell editing** (an editable grid) — TV's list/grid are read-only navigation; an editable grid is a
  separate mechanism.
- **Column reordering / resizing by drag** — the header is a sort control here, not a drag surface.

**Deferred (tracked) — explicit register so nothing is lost (AR-99 convention):**

| Deferred item | From decision | Target | Rationale |
|---------------|---------------|--------|-----------|
| Cell-granular focus/selection (a per-cell cursor) | AR-155 | later (post-set) | `TListViewer` has no cell cursor; row-granular is faithful. A per-cell model is a separable mechanism. |
| Newspaper-flow `numCols` (single-field, column-major) | AR-151 | later (micro-enhancement) | A different layout from the DataGrid; add to `ListView` only if a real use case appears. |
| In-cell editing / editable grid | out-of-scope | later (post-set) | The grid is read-only navigation; editing is a separate mechanism (cf. RD-06/07 `Input`). |
| Column drag-reorder / drag-resize | out-of-scope | later (post-set) | The header is a sort surface; drag interactions are a separable enhancement. |

---

## Technical Requirements

### New subsystem (AR-160)
- One new subsystem dir `packages/ui/src/table/` (dir-per-concern, AR-133/113/148): `data-grid.ts`
  (`DataGrid<T>` + the `Column<T>`/`ColumnWidth` types), `columns.ts` (the width apportion over RD-02
  `solveTrack`, the cell-extract + sanitize, and the sort comparator), one barrel `index.ts`; per-file
  ≤ 500 lines. **Explicit named re-exports** from `src/index.ts` (the layout-convention rule,
  AR-81/AR-102/AR-113).
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`check:deps` holds).

### Cross-package edits (additive only, AR-159)
- `@jsvision/core` `Theme` + `defaultTheme` gain **one** additive header role, decoded from `cpAppColor` at
  plan GATE-1 (exact attribute byte pinned per the fidelity directive). Same additive pattern as
  AR-97/112/122/139/149; no existing role changes. The row/divider roles (`listNormal`/`listFocused`/
  `listSelected`/`listDivider`) are **reused unchanged** (`theme.ts:222-225`).

### Reuse (no new engine primitives)
- **Virtual scroll + bars (RD-11):** the visible-window math reuses `list/virtual.ts`
  (`clampIndex`/`keepVisible`); the vertical + horizontal `ScrollBar`s reuse `scroll/scroll-bar.ts` + its
  `value`↔position wiring (the horizontal bar drives the column `indent`, as TV's `hScrollBar`) — no new
  scroll machinery.
- **Column apportion (RD-02):** the `fixed`/`fr`/`auto` widths are solved with the layout engine's integer
  `solveTrack` (`layout/apportion.ts`) — the same largest-remainder apportion the layout pass uses — no new
  sizing code.
- **Sort (RD-11):** click-to-sort reuses the `sorted` computed model; the per-column `compare` extends it
  with a typed comparator (AR-158).
- **Reactivity/draw (RD-01/RD-03):** RD-01 signals (`Signal<T[]>` rows + `focused`/`selected`/`sort` drive
  re-render/repaint), RD-03 `bind`/`invalidate`, RD-03 `DrawContext` (all writes via `ScreenBuffer` +
  `sanitize`).
- **Focus/commands (RD-04):** the select command routes through the existing command/keymap path; focus is
  the standard `View` focus.

---

## Integration Points

- **Containers (RD-11):** the DataGrid reuses the virtual-scroll helpers, both owned `ScrollBar`s, and the
  `sorted` computed; it is a sibling of `ListView` (its own multi-column renderer, shared scroll + sort
  math). RD-11 is the direct upstream and the surface RD-16 realizes (AR-104).
- **Layout (RD-02):** column-width apportion reuses `solveTrack`; the grid itself fits its container via the
  normal layout pass.
- **App shell (RD-05):** a `DataGrid` mounts in a `Window`/`Dialog`/`Desktop` like any focusable view; no
  overlay/capture needed.
- **Core theme (core):** the one additive header role extends the same `Theme` the frame/menu/status/
  controls/list/outline read; `defaultTheme` stays the single source of truth; the row/divider roles are
  reused unchanged.
- **Kitchen-sink (examples):** the `DataGrid` gets a story; `demo:table` is the headless walkthrough. (When
  the showcase navigator or a data view needs a table, this is the component it uses — future dogfooding.)

---

## Scope Decisions

All decisions trace to the Ambiguity Register (`00-ambiguity-register.md`):

- **AR-151** — a real `DataGrid<T>` as a documented TV-extension on the `TListViewer` virtual-scroll spine (GATE-1: TV has no table class; `numCols` is a newspaper-flow single-field list, not a grid); rows/divider/scroll faithful, header + heterogeneous columns + sort the flagged extension.
- **AR-152** — typed `Column<T>[]` descriptors (`{title, accessor, width, align?, compare?}`) over a `DataGrid<T>` generic; cells sanitized.
- **AR-153** — per-column `fixed | fr | auto` width, apportioned via RD-02 integer `solveTrack`; horizontal scroll on overflow.
- **AR-154** — sticky header row + click-to-sort with a `▲`/`▼` indicator.
- **AR-155** — row-granular single-select (faithful `TListViewer` item-focus); cell-granular deferred.
- **AR-156** — owned horizontal `HScrollBar` (faithful — TV wires it) + owned vertical `ScrollBar`.
- **AR-157** — reactive `Signal<T[]>` rows, mirroring `ListView<T>` (AR-106).
- **AR-158** — click-to-sort reuses RD-11's `sorted` computed; optional per-column `compare`, default locale-aware string compare; `▲`/`▼` indicator.
- **AR-159** — reuse the already-decoded `listNormal`/`listFocused`/`listSelected`/`listDivider` roles for rows + the `│` divider; **one** new additive header role decoded at plan GATE-1.
- **AR-160** — new `src/table/` subsystem, explicit named re-exports.
- **AR-161** — kitchen-sink `DataGrid` story + headless `demo:table`.

> **Traceability:** AR-151…AR-154 are explicit user choices (RD-16 `make_requirements` gate, 2026-07-02);
> AR-155…AR-156 are recommended-and-noted decisions the user did not object to (row-granular + owned
> H-bar, both faithful to `TListViewer`); AR-157…AR-161 are single-dominant / source-determined decisions
> (the AR-106 list model, the RD-11 `sorted` machinery, the fidelity directive's reuse-decoded-roles rule,
> the AR-133 subsystem convention, the AR-98/114 demo pattern) recorded for traceability.

---

## Security Considerations

> RD-16 adds a **multi-column data grid** over the existing in-process TUI. No network, no persistence, no
> new untrusted external surface. The input boundaries are keystroke/mouse → view state and cell text
> (`accessor(row)`) → screen:
- Every cell (`accessor(row)`) and header `title` routes through the RD-03 `DrawContext` → `ScreenBuffer` +
  core `sanitize` boundary — no raw escape sequences from row data reach the terminal (the same canonical
  injection boundary the whole UI uses).
- Row access, the virtual-scroll window, and the `focused` index are **bounds-checked** (`clampIndex`,
  RD-11) — no out-of-range indexing regardless of sort/scroll/row-count changes; `focused` is clamped to the
  current (sorted) row count.
- Column-width apportion is over the **fixed, caller-supplied `columns`** array (bounded); the sort
  comparator runs over the **in-memory bounded** `Signal<T[]>` rows; each cell is width-clipped, so a
  pathological long cell string cannot overflow its column or the viewport.
- `accessor`/`compare` are caller-supplied pure functions invoked only to render/sort; their string output
  is treated as untrusted and sanitized like any other cell text.

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test will encode (TV `tlstview.cpp` is the row-drawing/behavior
oracle; the header/columns/sort ACs encode the documented extension).

- **AC-1** (multi-column virtual scroll) — a `DataGrid<T>` over a `Signal<T[]>` and `Column<T>[]` renders
  only the rows visible in the viewport (not all rows), each row showing every column's `accessor(row)`
  cell; ↑↓ move `focused`, PgDn pages, the focused row stays visible, and the owned vertical `ScrollBar`
  reflects position. *(AR-151/AR-155/AR-157)*
- **AC-2** (faithful row draw) — each data row draws its cells separated by the `│` (`\xB3`) divider in the
  **`listDivider`** role, with the row colour = `listNormal`/`listFocused`/`listSelected` per state (faithful
  `TListViewer` `getColor(2)/(3)/(4)`), asserted against the buffer pre-`serialize`. *(AR-159)*
- **AC-3** (column sizing) — `fixed`, `fr`, and `auto` column widths are apportioned via RD-02 `solveTrack`
  so the column edges are integer-correct and sum to the content width; an `fr` column grows/shrinks with
  the viewport while a `fixed` column does not. *(AR-153)*
- **AC-4** (alignment) — a column's cells and its header render left/right/center aligned per `align` within
  the apportioned width. *(AR-152/AR-153)*
- **AC-5** (sticky header) — a non-scrolling header row of column `title`s draws above the data (same `│`
  divider), stays fixed while rows virtual-scroll vertically, and scrolls horizontally in lockstep with the
  data columns. *(AR-154)*
- **AC-6** (click-to-sort) — clicking a column header sorts the displayed rows by that column (ascending),
  clicking it again toggles to descending, and a `▲`/`▼` indicator marks the active column; numeric columns
  with a `compare` sort numerically, string columns sort locale-aware by default. *(AR-154/AR-158)*
- **AC-7** (horizontal scroll) — when the total column width exceeds the viewport, the owned horizontal
  `ScrollBar` (and ←/→) scroll the columns; the header scrolls with them; off-screen columns are clipped
  (the `hScrollBar->value` indent). *(AR-153/AR-156)*
- **AC-8** (row-granular select + emit) — Enter or double-click sets `selected` and emits the select command
  (mirroring `ListView`/`cmListItemSelected`); `focused` and `selected` are two-way signals a caller can
  bind; there is no cell cursor. *(AR-155/AR-157)*
- **AC-9** (reactive data) — updating the rows `Signal<T[]>` (or the `sort` signal) re-renders the visible
  window and repaints; the focused index is clamped to the new row count. *(AR-157)*
- **AC-10** (theme role) — `defaultTheme` exposes exactly **one** new additive header role (header colour,
  `getColor`-decoded); `encode()` of it does not throw; the row/divider roles are the pre-existing
  `list*`/`listDivider` (unchanged). *(AR-159)*
- **AC-11** (packaging) — the DataGrid lives in `packages/ui/src/table/` with explicit named re-exports from
  `src/index.ts`; `yarn check:deps` passes (zero runtime deps); files ≤ 500 lines. *(AR-160)*
- **AC-12** (story + demo) — the `DataGrid` has a kitchen-sink story passing the headless smoke test;
  `demo:table` runs headless with an ASCII frame per step (render → navigate → sort → horizontal-scroll).
  *(AR-161)*
- **AC-13** (security) — every cell (`accessor`) and header title is sanitized to the screen; row/window/
  focused access is bounds-checked; cells are width-clipped so no cell can overflow its column or the
  viewport. *(security standard)*

---

> **Next step:** run the make_plan skill on RD-16 to produce the implementation plan (spec-first: spec
> oracles RED → implement → GREEN → impl tests), **reading the TV source first** per the fidelity directive
> (`TListViewer` — GATE 1 decode of `draw`/`handleEvent`/`focusItem` + the `getColor` chain for the row
> colours and the `│` divider in the `03-NN-*.md` spec, plus the GATE-1 decode of the new header role's
> `getColor` byte, and the two BEFORE/AFTER gate tasks in `99-execution-plan.md`); optionally preflight,
> then exec_plan. RD-16 is sibling 3 of the RD-12+ set (AR-126) and the last MVP-phase RD (AR-129); RD-17
> (Tabs) is next in the drafting queue.
