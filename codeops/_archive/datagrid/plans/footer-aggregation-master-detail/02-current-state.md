# Current State: Footer, Aggregation & Master-Detail

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Grounded from three code-recon passes (2026-07-16). Line numbers are current as of that read.

## Existing Implementation

### What Exists

The grid is a container (`EditableDataGrid<T>`, `grid.ts`) that delegates all band assembly to a pure
`buildGridBody()` in `grid-panels.ts`. That function stacks the horizontal bands into a vertical
`inner` "col" `Group`: **header (1) → [quick-filter (1)] → [freeze-rows band (N)] → body (`fr`) → hbar
(1)**. Per-column geometry is computed by `apportionColumns()` (`@jsvision/ui`
`table/columns.ts:125`), called independently-but-identically by each band, which is what keeps
columns aligned. **There is no footer / aggregate / total code anywhere in the package** — a
repo-wide grep confirms it. This feature is greenfield.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/datagrid/src/grid-panels.ts` (534) | `buildGridBody` band assembly; the `segs` loop; `GridBodyParts`/`GridBodyDeps` | **Add** the footer band (a fixed-height band after `bodyRow`, before the hbar), mirroring the `segs` loop; thread `footer` + aggregate wiring through `deps` |
| `packages/datagrid/src/grid.ts` (**1198** — at the `<1200` guard) | container: private `display` derived (`:364`), private `focused` cursor (`:290`), `selectedKeys()` (`:1104`), band `parts`, `rebuildBody` | **Add** thin: `footer?` option pass-through into `_bodyDeps`; `displayedRows()`/`focusedRow()`/`focusedKey()` accessors. All heavy logic stays in new modules |
| `packages/datagrid/src/data-source.ts` (92) | `GridDataSource<T>` interface; `fromRows` | **Add** optional `complete?(): boolean` to the interface; **add** `fromReactiveRows` (reactive write-through twin of `fromRows`) |
| `packages/datagrid/src/column.ts` (252) | `GridColumn`; `value(row): V` (`:37`); `align` (`:64`); nullable (`:98`) | Read-only — the aggregate fold consumes `value`; nil-guards itself |
| `packages/datagrid/src/index.ts` (135) | barrel | **Add** exports: `aggregate` symbols, `GridFooter`, `FooterBand`, `fromReactiveRows`, `masterDetail` |
| `packages/examples/datagrid-showcase/stories/placeholders.ts` | the RD-09…14 "coming soon" panels | **Remove** the RD-09 entry; **add** a live cluster; re-base count oracles to RD-10…14 |

### Code Analysis (the load-bearing seams)

**Band stacking & the fixed-band trick** — `buildGridBody` builds `inner` (`grid-panels.ts:368`),
adds `headerRow` (`:499`), the body `bodyRow` (the only **`fr`** child, `:372/:526`), the frozen-rows
band between header and body when `freezeRows>0` (`:519-524`), and the bottom scrollbar `botRow`
(`:528`). **A new fixed-height band added between `:526` and `:528` auto-steals height from the `fr`
body and is sticky-at-bottom for free** (it is outside the body's virtual-scroll window). It must
append a `corner()` (`:150`) to square off the vbar gutter, exactly as `freezeRowsRow` does (`:522`).

**Shared column geometry** — each band calls `apportionColumns(cols, autoWidths, width, dividers)`
independently: body `editable-grid-rows.ts:290`, header `sort-header.ts:226`, quick-filter
`quick-filter-row.ts:147`. Draw is `x = geom.starts[c] - indent`, `w = geom.widths[c]`
(`editable-grid-rows.ts:646`), text via `alignCell(text, w, align, stringWidth)` (`:672`). **A footer
aggregate cell reuses the identical call + `alignCell`.** The `dividers`/`compact` flag must match all
bands or it misaligns.

**Frozen/scrolling panels** — the pure model is `column-model.ts` (`partition` → left/center/right,
`:77`). `buildGridBody` turns a partition into `segs` (`:381-399`): left/right fixed with `indent=zero`
(`:380`), center `fr` binding `deps.indent`. Each seg emits one header + one body via `makeHeader`/
`makeBody` (`:459-488`), with `FreezeDivider`s between. **The footer aggregate row iterates the same
`segs`** — one footer sub-view per segment, same `layout` (`segLayout(seg)`), same `indent`.

**The `parts` structure + reactive rebuild** — `GridBodyParts<T> = { inner, panels, headers, center }`
(`:136`). The grid retains `_center`/`_inner`/`_headers` (`:505-508`). `rebuildBody()` (`:569`) re-runs
`buildGridBody` when `partitionKey()` (`:557`) changes (hide/show/reorder/frozen-resize). **A footer
built inside `buildGridBody` is recreated on every rebuild for free.** Live width changes flow via the
reactive `width` getters + `widthTick` (`grid-panels.ts:233-246`, `:78`).

**The reactive fold target** — the displayed rows are `this.display`, a private memoized `derived`
(`grid.ts:334/364`): `materialize(source)` → `filterRows` → `sortRowsMulti`. It re-derives on the
`version` tick (in-place edits, `:365`), on `rows.set` (insert/delete), on sort, and on filter. **No
public accessor returns it today** — only `filteredCount()` (`:722`) and `totalCount()` (`:732`). A
public `displayedRows()` one-liner over it is the aggregate fold target; an aggregate is a `computed`
over it.

**Focus readout** — `selectedKeys()` is public (`grid.ts:1104` → `selection.read()`). **`focusedRow()`
does NOT exist** — the cursor is the private `focused` signal (`:290`), re-anchored by `rowKey` after
sort/filter (`:1061`, `:1081`). RD-09 adds `focusedRow()` (`display()[focused()]`) and `focusedKey()`.

**Reactive scope disposal** — `createRoot((dispose) => …)` (`ui reactive/owner.ts:73`) opens a child
scope and returns a `dispose` callback that tears down depth-first; `onCleanup(cb)` (`:141`) registers
teardown; `computed`/`effect` attach to the current owner. **`masterDetail` wraps the detail wiring in
`createRoot` and releases it from the master's scope** — the `View.derived` idiom (`ui view/view.ts:261`).

**The source seam** — `GridDataSource<T>` (`data-source.ts:22`) requires `rowKey`/`length`/`rowAt`, with
optional `insert?`/`remove?`/`ensureRange?`/`setSort?`/`setFilter?`/`distinct?`. **No `complete?()` and
no `aggregate?()`.** `fromRows(Signal<T[]>)` reads via `rows()` and writes via `rows.set(next)` (never
in-place). `fromReactiveRows` is its reactive-read + delegated-write twin.

**Widget / command / sanitize** — a footer `Button({ command })` calls `ev.emit?.(command)` on
activate (`ui controls/button.ts:229`); the loop populates `ev.emit` → `registry.emit` → a
`CommandEvent` on the dispatch tick (`event-loop.ts:509`, `commands.ts:59`). `Text(content | () =>
string)` (`ui controls/text.ts:120`) is the reactive totals primitive (a getter repaints). The
datagrid already embeds ui widgets as `Group` children (`ValueList`/`FilterPopup`, e.g.
`value-list-popup.ts:134`, `filter-popup.ts:199`). **`sanitize` is auto-applied at `ctx.text`
(`draw-context.ts:108`)** — the footer needs no explicit call.

## Gaps Identified

### Gap 1: No summary band
**Current:** the band stack ends at the body + hbar; totals have nowhere to live.
**Required:** a sticky footer band hosting a column-aligned aggregate row + a widget row.
**Fix:** a new `FooterBand` view + band assembly in `buildGridBody`, driven by a `FooterController`.

### Gap 2: No public displayed-rows / focused-row readouts
**Current:** `display` and `focused` are private; only counts are public.
**Required:** aggregates fold over the displayed rows; master-detail binds to the focused row.
**Fix:** `displayedRows()`, `focusedRow()`, `focusedKey()` accessors (thin — AR-8).

### Gap 3: No reactive write-through source
**Current:** `fromRows` binds a read/write `Signal<T[]>`; a `computed` can't `.set` (no detail CRUD).
**Required:** a detail source that reads reactively and writes back into the master's owned collection.
**Fix:** `fromReactiveRows(read, { rowKey, insert?, remove? })` (AR-4).

### Gap 4: No aggregate/honesty machinery
**Current:** greenfield; no fold, no completeness signal.
**Required:** a pure fold model (edge-safe) + an optional `source.complete?()` honesty predicate.
**Fix:** `aggregate.ts` + the `complete?()` seam (AR-2/AR-6/AR-9).

## Dependencies

### Internal
- RD-01 (`EditableDataGrid`, `GridDataSource`, `fromRows`, `column`), RD-02 (`version`/commit path,
  in-place edit → reactive re-derive), RD-05/06 (`display` = filtered+sorted), RD-07 (`buildGridBody`
  `segs`/pinned panels, `apportionColumns` `dividers`), RD-08 (`selectedKeys()`, the controller
  extraction pattern `GridSelection`/`RowMutations`).
- `@jsvision/ui`: `View`/`Group`/`Text`/`Button`/`spacer`; `apportionColumns`/`alignCell`;
  `signal`/`computed`/`createRoot`/`onCleanup`. `@jsvision/core`: `sanitize` (auto via `ctx.text`).

### External
- None (zero runtime deps; the datagrid never adds native deps).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| `grid.ts` crosses the hard `<1200` guard | Med | High (red build) | All logic in new modules + the `FooterController`; grid.ts gets only thin accessors + a pass-through (AR-10) |
| Footer misaligns across frozen/scrolling panels | Med | Med | Reuse the exact `segs`/`apportionColumns`/`indent`/`dividers` path; a spec oracle pins alignment across a freeze split (ST-16) |
| Aggregate recompute thrash on large sets | Low | Med | The fold is a single `computed` over the already-memoized `display` derived; recomputes only on real dependency change |
| `fromReactiveRows` write-back loops or double-fires | Low | Med | Writers mutate the owned collection + `rows.set` (never an effect that re-reads its own write); spec oracle ST-23..25 |
| Detail scope leaks (not disposed with master) | Low | Med | `masterDetail` owns a `createRoot`; disposal tied to the master's scope; ST-22 asserts teardown |
