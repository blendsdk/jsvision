# Current State — the code RD-02 subclasses & edits

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Grounded analysis of the real code RD-02 builds on. Every claim cites `file:line` as of this plan's authoring.
RD-02 is **additive**: it subclasses a public engine, consumes RD-01 contracts, and adds two core theme roles.

## The engine to subclass — `@jsvision/ui` `GridRows<T>`

`packages/ui/src/table/grid-rows.ts` — **already public** (barrel-exported by RD-01,
`packages/ui/src/table/index.ts` + `packages/ui/src/index.ts`). The subclass approach is viable because the
fields and hooks `EditableGridRows` needs are `protected`, not `private`:

- **Protected state** (`grid-rows.ts:95-105`): `display: () => T[]`, `columns: Column<T>[]`,
  `autoWidths`, `indent`, `focused`, `selected: Signal<number>`, `zebra`, and `topItem` (the first visible row).
  A subclass reads all of these directly.
- **Protected geometry** (`grid-rows.ts:160` `geometry(width): ColumnGeometry`) — returns `{ widths[], starts[],
  totalWidth }` (`columns.ts:41`). The focused **cell** rect is derivable: `x = starts[c] − indent`,
  `w = widths[c]`, `y = focused − topItem`, `h = 1`. This is exactly what the overpaint + the overlay mount need.
- **Overridable hooks**: `draw(ctx)` (`:184`) and `onEvent(ev)` (`:244`) are `override`-able public methods;
  `handleKey(inner, ev): boolean` (`:272`) and `focusBy`/`focusTo`/`indentBy`/`select`/`activate` (`:311-341`)
  are `protected`.
- **The base keymap RD-02 must reassign** (`handleKey`, `:272-308`): `←`/`→` → `indentBy(±1)` (horizontal
  scroll); `Home`/`End` → `focusTo(topItem)` / `focusTo(topItem+rows−1)` (first/last **visible row**, `Ctrl`
  ignored); base first/last-**row** is on `Ctrl+PgUp`/`Ctrl+PgDn` (`:281-288`). `↑`/`↓`/`PgUp`/`PgDn`/`Enter`/
  `Space` stay. So `EditableGridRows.onEvent` intercepts `←`/`→`/`Home`/`End`/`Ctrl+Home`/`Ctrl+End`/`Tab`/`F2`/
  `Enter`/printable and **returns before `super.onEvent`**; it falls through for `↑`/`↓`/`PgUp`/`PgDn`/
  `Ctrl+PgUp`/`Ctrl+PgDn`.
- **Row focus indicator** (`:205,216-226`): the base paints the focused **row** in `listFocused` when
  `this.state.focused` (the `View` active flag). RD-02 overpaints the focused **cell** on top, in `gridCursor`.

**Already-public helpers RD-02 reuses** (no promotion needed): `alignCell(text, width, align, measure)`
(`columns.ts:179`) to render an overpainted cell; `apportionColumns`/`ColumnGeometry`/`stringWidth` (all on the
barrel per the RD-01 promotion). Confirmed in `packages/ui/src/table/index.ts`.

## RD-01 datagrid contracts RD-02 consumes

- **`GridColumn<T, V>`** (`packages/datagrid/src/column.ts:20`): `{ id, title, value:(row)=>V, format?,
  parse?, width?, align? }`. `value` is a **getter only** — there is **no write path** today. `column<T,V>()`
  (`:64`) infers `V` from `value` and erases it to `GridColumn<T>` on return. **RD-02 adds `set?: (row, value:
  V) => void`** here and an `isEditable(col)` predicate (`parse` && `set`).
- **`toEngineColumn`** (`:80`): builds the engine `Column` (string `accessor` = `format(value)` or
  `String(value)`, value-aware `compare`). Unchanged by RD-02 (the editor round-trip is a separate path).
- **`commitCell`** (`packages/datagrid/src/commit.ts:58`): `{ row, columnId, rowKey, previous, next, apply,
  onCommit }` → `{ committed, value }`. It writes via `apply(row, columnId, next)` **first**, awaits `onCommit`,
  and reverts via `apply(row, columnId, previous)` on `false`/reject (`:68-80`). RD-02's commit passes
  `apply: (row, _col, v) => column.set!(row, v)`. A rejected `onCommit` is already swallowed to a veto (`:74`).
- **`OnCommit<T>`** (`commit.ts:32`): `(change: CellCommit<T>) => boolean | Promise<boolean>`. RD-02 threads
  this from `EditableDataGridOptions.onCommit` down to the editing controller. RD-12 layers validation on the
  same seam.
- **`mountCellOverlay`** (`packages/datagrid/src/overlay.ts:69`): `{ host: Group, loop: { focusView }, rect,
  origin, view } => dispose`. It absolutely-places `view` at `origin + rect`, `host.add`s it, `loop.focusView`es
  it, and returns a `dispose()` that removes it and disposes its `createRoot` scope (`:84-91`). `absoluteRect(view)`
  (`:33`) sums `bounds.x/y` up the parent chain. **RD-02's editor mount is exactly this call** — fed
  `host = grid.overlay`, `origin = absoluteRect(grid.rows)`, `rect =` the focused-cell rect, and
  `loop = { focusView: (v) => ev.focusView(v) }` (AR #13).
- **`GridDataSource<T>` / `fromRows`** (`packages/datagrid/src/data-source.ts:41,75`): `fromRows` is backed by a
  caller `Signal<T[]>`; `rowAt`/`length` read the signal. **Reactivity gap**: `column.set` mutates a row object
  in place (same reference), so a signal read of `rows()` returns an array of unchanged references — the
  container's `display` `derived` won't re-run. RD-02 closes this with a container-owned `version` signal (AR #5).

## The container to grow — `EditableDataGrid<T>`

`packages/datagrid/src/grid.ts` (read-only today):
- Already **owns** `indent`/`focused`/`selected` signals (`:95-98`) and a fixed-`null` `sort` (`:98`). RD-02
  **adds `focusedCol: Signal<number>`** and keeps ownership at the container (AR #4). These are injected into the
  body renderer.
- Constructs a single `GridRows` as `this.rows` (`:101-109`). **RD-02 swaps this for `EditableGridRows`** (same
  config + the injected `focusedCol` + the editing wiring).
- Has an absolute overlay host `this.overlay` (`position: 'fill'`, `:149-150`) — **already the mount host** the
  RD-01 overlay helper documents. RD-02's editor mounts into it.
- Builds `display`/`autoWidths` via `this.derived(...)` (`:92-93`). RD-02 folds a `version()` read into `display`
  (AR #5).
- Uses a sort-suppressed `ReadonlyGridHeader` (`:28-32`, `:100`) — unchanged by RD-02 (sorting is RD-05).

`EditableDataGridOptions<T>` (`:18-25`) currently `{ columns, source, zebra? }`. **RD-02 adds `onCommit?:
OnCommit<T>`**; `EditableDataGrid` **adds `isDirty(rowKey, columnId): boolean`** + row/grid rollups.

## The editor to mount — `@jsvision/ui` `Input`

`packages/ui/src/controls/input.ts`: `new Input({ value: Signal<string>, maxLength?, validator? })`
(`InputOptions`, `:31-38`). **Verified commit-key behavior** (`input.ts:250`): `onEvent` does
`if (inner.key === 'enter' || inner.key === 'tab') return;` — it leaves Enter/Tab **unhandled** (no
`ev.handled = true`), and Esc is not consumed by `handleKey`. So mounted inside an editor-host `Group`, those
three keys **bubble up the focus chain** to the host's `onEvent` (the loop's "focus-chain bubble clamped to
scopeRoot"), which runs commit/advance/cancel. Printables/arrows/Backspace/clipboard chords are consumed by the
`Input` (AR #7). This is the mechanism that makes the RD-02 lifecycle work with an off-the-shelf `Input`.

## The focus seam — `getFocused` (for AC-1)

Both the loop (`packages/ui/src/event/event-loop.ts:247` `getFocused(): View | null`) and the dispatch envelope
(`packages/ui/src/view/types.ts:163` `getFocused?: () => View | null`) expose it, so AC-1's
"`getFocused() === editor`" is directly testable and the controller can assert the editor is focused.

## Core theme — where the two roles land, and the inventory tripwire

`packages/core/src/engine/color/theme.ts`: `ThemeRole { fg, bg, hotkey? }` (`:15`); 80 roles today. Precedents
for the new roles: `calendarCursor: { fg: black, bg: white }` (`:337`, the filled-reverse cell cursor) and
`colorMarker: { fg: black, bg: lightGray }` (`:340`, a forced-contrast marker). **RD-02 adds** `gridCursor`
(filled-reverse, modeled on `calendarCursor`) and `gridDirty` (the `•` marker color) — exact bytes pinned in
[03-01](03-01-additive-surface.md).

**Integration tripwire (must-handle):** several theme specs assert the full `defaultTheme` role inventory with a
sanctioned `LATER_ADDITIVE_ROLES` allowlist — `packages/ui/test/tabs-theme.spec.test.ts:120-140` (and the same
pattern in `editor-theme`, `feedback-theme`, `date-theme`, `color-theme` specs). The in-code comment states
extending the allowlist for a legitimately-added later role **does not weaken** the guarantee (every existing
byte stays asserted). So Phase 1 must **add `'gridCursor'`, `'gridDirty'` to each such allowlist** (a sanctioned,
additive edit — **not** an oracle change; every prior tier did this) and **own the byte-for-byte guard in a
datagrid-side `grid-theme.spec.test.ts`** (mirroring how `table-theme.spec`/`feedback-theme.spec`/`color-theme.spec`
each own their roles' bytes). The core `theme-roles.spec.test.ts` uses a scoped `RD11_ROLE_SLOTS` subset
(`:35-59`), not a full enumeration, so it is unaffected. The full `yarn verify` run in Phase 1 surfaces any other
tripwire.

## Summary of edits RD-02 makes

| File | Edit |
| --- | --- |
| `packages/core/src/engine/color/theme.ts` | +`gridCursor`, +`gridDirty` roles (+ JSDoc) |
| `packages/ui/test/{tabs,editor,feedback,date,color}-theme.spec.test.ts` | +2 names to each `LATER_ADDITIVE_ROLES` allowlist |
| `packages/datagrid/src/column.ts` | +`set?`, +`isEditable(col)` |
| `packages/datagrid/src/cell-editor.ts` | **new** — `createCellEditor` + default text-`Input` host |
| `packages/datagrid/src/editable-grid-rows.ts` | **new** — `EditableGridRows<T>` (cursor, keymap, overpaint) |
| `packages/datagrid/src/editing.ts` | **new** — edit-lifecycle state machine + dirty registry |
| `packages/datagrid/src/grid.ts` | container owns `focusedCol` + `version`; `EditableGridRows`; `onCommit`/`isDirty` |
| `packages/datagrid/src/index.ts` | re-export the new public symbols |
| `packages/datagrid/test/**` | new spec/impl suites + `grid-theme.spec` + the editable story |
