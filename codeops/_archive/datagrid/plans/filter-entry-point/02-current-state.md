# Current State — Filter Entry Point

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

The seams this plan builds on, all verified in the working tree. Nothing here is invented — each row
cites `file:line`.

## The popup and its single entry point

- `openFilterPopup(columnId, anchor, ev, header)` (`grid.ts:821`) builds the `FilterPopup`, resolves
  the filter type, mounts it over the popup overlay, and forwards `ev` for the focus/popup seam. Its
  **only** caller is `onFunnelClick` (`grid.ts:380`); there is no keyboard or menu route.
- `FilterPopup` accepts `current?` undefined and renders the type's default operator with blank
  operands in that case (`filter-popup.ts` config). So "open on an unfiltered column" already works
  at the popup level — only the *route in* is missing (AR-10).
- `onFunnelClick` is threaded header → panel → container: `SortHeader` config `onFunnelClick`
  (`sort-header.ts:54`) → `grid-panels.ts:236` → `grid.ts:380`.

## The funnel: draw + hit-test, gated on "already filtered"

- **Draw** (`sort-header.ts:246-285`): `const filtered = filters.has(columnId)` (`:265`); the funnel
  glyph is painted only `if (filtered && …)` (`:272`), in the `tableHeader` colour. A sorted column
  reserves 1–2 right-edge cells for the arrow/priority (`sortReserve`, `:198`); the funnel sits one
  cell further left. The title clips into `w - reserve` (`:268-269` — a **title-clip only**; it does
  not change `geom.widths`, so column geometry is untouched).
- **Hit-test** (`funnelColumnAt`, `sort-header.ts:451-464`): returns `-1` unless `isFiltered(k)` is
  true (`:460`), so a click only routes to the popup on an already-filtered column. Checked before the
  title/sort hit-test (`:350-368`) so a funnel click never also sorts.
- The header redraws reactively on `filterModel()` change (`sort-header.ts:175-178`), so a
  muted↔emphasized state flip will repaint for free.
- **Hazard:** the narrow-column precedence ("drop the funnel before the arrow") is already encoded in
  both draw and hit-test via `w - 1 - sortReserve >= 0`; FR-5 must preserve it, now for the
  *always-visible* funnel.

## Filterability: no opt-out today

- `GridColumn` has an optional `filterType?: FilterType` (`column.ts:98`) but **no** filterable flag.
- `resolveFilterType(col, sample)` (`filter.ts:220`) never fails — it returns `col.filterType`, else
  infers `number`/`date`/`text` (default `text`). So **every** column is filterable today; the
  quick-filter row builds one `Input` per column with no skip.
- FR-4 adds `filterable?: boolean` (default true) as the single gate the funnel, the quick-filter
  input, and the `Alt+Down` opener all consult.

## The grid body's key handling (where `Alt+Down` lands)

- `EditableGridRows` handles keys in `onEvent`: `F2`/`Enter` begin edit (`:308`), `F4` begins edit +
  opens the value-help dropdown (`:312`), a printable/`space` begins edit **only when
  `!inner.ctrl && !inner.alt`** (`:318`), and arrows/`Home`/`End`/`Ctrl+Home`/`Ctrl+End` move the
  cursor (`:358-371`). `Alt+Down` on the non-editing body is **not handled by `EditableGridRows`**, so
  it **falls through to `super.onEvent`** (`:283`) and the base `GridRows.handleKey` — whose
  `case 'down'` ignores modifiers (`ui/src/table/grid-rows.ts:278`) — currently **moves the row cursor
  down**. FR-3 therefore *repurposes* Alt+Down: the new handler must run **before `super.onEvent`** and
  consume the key, overriding an existing base binding rather than filling a void. The old row-down
  behavior is undocumented and untested, so repurposing is safe; a plain `Down` (no Alt) still
  row-navigates (a regression guard belongs in the spec, see `07`).
- `Alt+Down` is otherwise synthesized *inside* an open editor to pop a `ComboBox` dropdown
  (`editing.ts:235`) — that path is untouched (it only runs while editing).
- The body already tracks the focused column: `focusedCol` is one global `Signal<number>` shared
  across panels (`editable-grid-rows.ts:89`), with a per-panel column slice. FR-3 opens the popup for
  that focused column.
- The body talks up to the container via config callbacks (`onCommit`, `onCursorEnterPanel`, …,
  `editable-grid-rows.ts:74,166`); FR-3 adds one more: `onOpenFilter?(globalCol, ev)` (AR-9).

## Frozen panels

- Each frozen panel owns its own `SortHeader` bound to the **shared** sort/filter signals
  (`grid-panels.ts:236`; columns-layout AR-11). The always-visible funnel therefore needs no
  panel-specific logic, and `Alt+Down` targets the single global focused column in whichever panel
  holds it (AR-11).

## The requirement + spec that pin the current behavior

- **RD-06** (`requirements/RD-06-filtering.md`): §Feature Overview + §Funnel indicator (line ~34) +
  acceptance #4 (line ~139) require the funnel on *filtered* columns only, while §Condition filters
  (line ~27) says the funnel *opens* the popup. This plan resolves the contradiction (AR-2, §C of the
  register).
- **`ST-19`** (`sort-header.spec.test.ts:287-293`) asserts "nothing filtered → no funnel" — the
  immutable oracle for the old rule. Re-spec'd here because the requirement changes (AR-2).

## The showcase stories

- `packages/examples/datagrid-showcase/stories/filtering/{condition-text,condition-num-date,
  value-list}.story.ts` build via `filter-demo.ts` **without** `quickFilter`, yet their hints say
  "click the funnel ▽" — unreachable today, the visible symptom of #92. FR-6 keeps their quick-filter
  row and rewords the hints once the entry point lands.
