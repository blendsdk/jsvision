# Current State — Rows, Records & Selection

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The datagrid ships RD-01…RD-07: a typed `value`/`format`/`parse` column model, a `GridDataSource`
read seam (`fromRows` in-memory), per-cell editing with an `onCommit` veto, sorting, filtering, and
the RD-07 frozen-panel / column-layout machinery. The container (`grid.ts`, **945 lines**) owns the
cursor/scroll/model signals and composes a header + virtual body (`editable-grid-rows.ts`, 627 lines)
through `buildGridBody` (`grid-panels.ts`, 445 lines).

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/datagrid/src/grid.ts` | Container: signals, options, API, reconcile | Replace the vestigial `selected` index with a `selectedKeys` set + anchor + `selectionMode`; add CRUD wrappers (`insertRow`/`deleteRows`/`duplicateRow`) + `assignKey`; wire `checkboxColumn`/`rowNumbers`; null-policy commit path. Watch the 945→~1050 line cap (AR-6). |
| `packages/datagrid/src/editable-grid-rows.ts` | Body: self-contained `draw()`, cursor, editing | Set-membership selection paint (`:480`–`:492`); selection gestures (`Space`/`Ctrl`/`Shift`) in `onEvent`. |
| `packages/datagrid/src/grid-panels.ts` | `buildGridBody` band assembly | Prepend a fixed-width synthetic prefix segment (checkbox + gutter) to the leftmost panel (AR-11). |
| `packages/datagrid/src/data-source.ts` | `GridDataSource` + `fromRows` (65 lines) | Add `RowMutations` (`insert?`/`remove?`) to the interface; `fromRows` splices the signal. |
| `packages/datagrid/src/column.ts` | `GridColumn` + `toEngineColumn` (200 lines) | Add the `null?: { nullable; display? }` field; thread its `display` into rendering. |
| `packages/datagrid/src/format.ts` / commit / cell-editor | Render + commit + editor | Render `null.display` for a null value; empty-editor→null on a nullable column (AR-3). |
| `packages/datagrid/src/index.ts` | Barrel | Export `selection.ts` ops + types, `RowMutations`, new option/API types. |
| `packages/examples/datagrid-showcase/stories/placeholders.ts` + smoke | Showcase roadmap | Replace the RD-08 placeholder with a live cluster; re-base the placeholder-count oracle to RD-09…14. |

### Code Analysis — the seams RD-08 plugs into

**1. The vestigial single-index selection (`grid.ts:233`).**
```ts
private readonly selected = signal(-1);   // engine "chosen row" index — never set to a real value
```
It is injected into the body (`grid.ts:357 selected: this.selected`) and re-anchored by key on
re-sort/re-filter (`grid.ts:886`–`:942`), but nothing ever assigns it a real index, so the re-anchor
only ever recomputes `-1`. RD-08 **replaces** it with a `selectedKeys` set (AR-1/AR-10); the
re-anchor logic is dropped because a key set survives sort/filter with no reconcile.

**2. The body's self-contained `draw()` role logic (`editable-grid-rows.ts:443`, 480–492).**
```ts
const selected = this.selected();              // single index
const isSelectedRow = item === selected;       // ← swap for selectedKeys.has(rowKey(row))
const roleName = isFocusedRow ? … : isSelectedRow ? 'selected-role' : zebra ? … : normal;
```
`isSelectedRow` already flows into `rowOwns` (cellStyle suppression, `:505`) and `CellState.selected`
(`:521`). RD-08 changes exactly the two lines above — **no `@jsvision/ui` change** (AR-1/AR-13). The
base `GridRows.draw()` (`ui/src/table/grid-rows.ts:216`) has no `rowRole()` hook, but the datagrid
body does not call `super.draw()`, so none is needed.

**3. The data source is read-only (`data-source.ts:59`).**
```ts
export function fromRows<T>(rows: Signal<T[]>, opts): GridDataSource<T> {
  return { rowKey: opts.rowKey, length: () => rows().length, rowAt: (i) => rows()[i] };
}
```
No `insert`/`remove`. RD-08 adds `RowMutations` to the interface and has `fromRows` splice `rows`
(AR-4). The container reads `length`/`rowAt` inside a reactive `display` derive (`grid.ts:293`), so a
splice re-derives the display automatically.

**4. The pure-model twin pattern.** `sort.ts` / `filter.ts` / `column-model.ts` are pure functions;
the container wraps them in signals and injects them. `selection.ts` follows the same shape (AR-9).

**5. `buildGridBody` + the left-pinned panel (`grid-panels.ts`).** RD-07 established that
`buildGridBody` assembles header / frozen-rows band / body rows per panel, with the left frozen panel
non-scrolling. The synthetic prefix is a new fixed-width segment on the leftmost panel (AR-11).

## Gaps Identified

### Gap 1: No multi-selection representation
**Current:** a single `selected` index (always `-1`). **Required:** a `ReadonlySet<Key>` + anchor,
paint by membership. **Fix:** `selection.ts` pure ops + container signals + a two-line draw change.

### Gap 2: No row CRUD
**Current:** the source is read-only; the grid cannot add/remove rows. **Required:** insert / delete /
duplicate via a mutation seam. **Fix:** `RowMutations` + `fromRows` splice + grid wrappers + `assignKey`.

### Gap 3: No null representation
**Current:** a value renders via `format(value)`; null vs `''` is indistinguishable. **Required:** a
per-column null policy that renders `null.display` and round-trips null vs `''`. **Fix:** `null?` field
+ render/commit/editor handling.

### Gap 4: No selection checkbox / row-number affordances
**Current:** none. **Required:** an opt-in checkbox column (tri-state header) + row-number gutter,
left-pinned. **Fix:** `synthetic-columns.ts` + a `buildGridBody` prefix segment.

## Dependencies

### Internal
- RD-01 `rowKey` identity (selection + delete-by-key), the `value`/`format`/`parse` column model.
- RD-02 `onCommit` veto (inserted-row edits pass through it) + the cell cursor (coexists with selection).
- RD-04 the paint precedence + `sanitize` boundary + `CellState`.
- RD-07 `buildGridBody` / left-pinned panel / frozen-rows band (the prefix rides on these).

### External
- None (zero runtime deps; pure-JS only).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| `grid.ts` crosses the 700-line guideline (already 945) | High | Med | Extract selection/CRUD wiring to a helper if it passes ~1050 in the same phase (AR-6). |
| Synthetic prefix mis-aligns with frozen columns / frozen-rows band | Med | Med | Reuse `buildGridBody`'s panel geometry; add an impl test asserting header↔body↔band prefix alignment. |
| Selection gestures collide with the base's `Space`=activate / click=select | Med | Med | The body owns `onEvent`; intercept `Space`/`Ctrl`/`Shift` before delegating; plain click keeps cursor semantics. |
| Empty→null trade-off surprises a caller wanting a literal `''` on a nullable column | Low | Low | Documented in the `null?` JSDoc + AR-3; non-nullable columns keep `''`. |
| Re-basing the RD-15 showcase placeholder oracle looks like editing an immutable spec | Low | Low | Legitimate requirement change (RD-08 ships), anticipated by the showcase oracle's own comment — same as RD-07 did for RD-08…14. |
