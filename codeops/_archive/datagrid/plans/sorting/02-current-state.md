# Current State: Sorting

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

Sorting is **deliberately suppressed** in the datagrid today, and much of the value-aware machinery is
already present but unused on the datagrid's own path:

- **The sort model type is forward-declared and barrel-exported.** `SortKey { readonly columnId: string;
  readonly dir: 'asc' | 'desc' }` (`data-source.ts:15-20`), and `GridDataSource.setSort?(keys: SortKey[])`
  is the push-down seam (`data-source.ts:51`). Both are re-exported from the barrel (`index.ts`), placed
  there by RD-01 as forward declarations.
- **Value-aware comparison already exists (for the engine adapter).** `toEngineColumn` synthesizes
  `compare: (a, b) => defaultCompare(c.value(a), c.value(b))` (`column.ts:151`); `defaultCompare`
  (`column.ts:164`) orders numbers numerically, `Date`s chronologically, strings by `localeCompare`, and
  nulls last. This is a **complete** adapter, but the datagrid never runs the engine sort path, so its
  `compare` is unused-for-sort by the datagrid (PF-015).
- **The header is single-column and suppressed.** The exposed `@jsvision/ui` `GridHeader` draws one
  `▲`/`▼` for one `SortState = { col, dir } | null` — a column *index*, one reserved cell, no priority
  digit (`grid-rows.ts:412,426`); its `draw()`/`onEvent()` are monolithic single-key with no `super`
  seam (`grid-rows.ts:412,443`), and its `columnAt` hit-test is module-private/unexported
  (`grid-rows.ts:45`). `EditableDataGrid` wraps it in a `ReadonlyGridHeader` that swallows `onEvent`
  (`grid.ts:37-42`) and hard-wires `signal<SortState>(null)` (`grid.ts:132`).
- **The body renders in source order.** `EditableDataGrid.display` is `derived(() => { this.version();
  return materialize(source); })` (`grid.ts:126-129`) — it never calls `sortRows`. So the engine sort
  path (`sortRows`/`SortState`/`toEngineColumn.compare`) is **dead code for the datagrid**.
- **The shared cursor/geometry signals already exist on the container.** `focused`/`focusedCol`/
  `selected`/`indent`/`version` are container-owned and injected into the body (`grid.ts:105-111`);
  `autoWidths = derived(measureAutoWidths(...))` and `indent` are shared by header and body so their
  geometry never disagrees (`grid.ts:130,138`).
- **A self-drawn override is the established precedent.** `EditableGridRows.draw` is a self-contained
  `View.draw` override (not `super.draw()`) that reuses the shared `apportionColumns`/`alignCell`/
  `stringWidth` geometry to paint per-cell (`editable-grid-rows.ts:279`) — exactly the pattern `SortHeader`
  will follow.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/datagrid/src/sort.ts` | **New.** The sort model + comparator + `sortRowsMulti`. | Create: `SortDir`, `SortKey` (moved here), `sortRowsMulti`, the value comparator. |
| `packages/datagrid/src/sort-header.ts` | **New.** The from-scratch `SortHeader` View. | Create: `draw()` (arrows + priority digits) + `onEvent()` (columnId hit-test → click machine). |
| `packages/datagrid/src/column.ts` | Typed column model. | Add `compare?`/`nulls?` to `GridColumn` (AR #13). `defaultCompare`/`toEngineColumn` unchanged. |
| `packages/datagrid/src/data-source.ts` | The source seam. | Import `SortKey` from `sort.ts`; drop the local declaration (same barrel export). |
| `packages/datagrid/src/grid.ts` | The container. | Unwind `ReadonlyGridHeader` + the null sort signal; add the container `Signal<SortKey[]>`, `applySort` + push-down effect, cursor re-anchor, the sort API; mount `SortHeader`. |
| `packages/datagrid/src/index.ts` | Barrel. | Export `SortDir`, `sortRowsMulti`, `SortHeader`; re-point `SortKey` to `sort.ts`. |

### Code Analysis

The engine header's click logic that `SortHeader.onEvent` replaces (single-key, index-based):

```ts
// grid-rows.ts:452-460 — the shipped single-column toggle we do NOT inherit
const c = columnAt(geom, local.x + indent);
if (c >= 0) {
  const cur = this.sort();
  if (cur !== null && cur.col === c) this.sort.set({ col: c, dir: cur.dir === 'asc' ? 'desc' : 'asc' });
  else this.sort.set({ col: c, dir: 'asc' });
}
```

`SortHeader` needs the same geometry/indent hit-test but resolves the hit to a **`columnId`**, then
applies the multi-key state machine (AR #5) against the container `Signal<SortKey[]>` — which the
single-index `SortState` above cannot express. This mismatch is why owning the header (AR #1=A) beats
subclassing.

## Gaps Identified

### Gap 1: No multi-key sort model or comparator
**Current:** value-aware comparison exists only as the single-key engine adapter (`defaultCompare` via
`toEngineColumn.compare`), which the datagrid never calls.
**Required:** an ordered multi-key `sortRowsMulti(rows, keys, columns)` (RD-05 §Sort model) with a single
comparator honouring `compare`/`nulls` per key and a case-insensitive string collator (AR #2).
**Fix:** new `sort.ts`.

### Gap 2: The header cannot express or render a multi-key, columnId-keyed sort
**Current:** `GridHeader` is single-index, one arrow, suppressed by `ReadonlyGridHeader`.
**Required:** a header that renders arrows + priority digits from `SortKey[]` and drives the click machine.
**Fix:** new `sort-header.ts` + unwinding the suppression in `grid.ts`.

### Gap 3: The container has no sort state, API, or push-down wiring
**Current:** `display` is source-order; the sort signal is hard-wired `null`.
**Required:** a container `Signal<SortKey[]>` as the single source of truth, an `applySort` seam, the
guarded push-down effect (AR #7), the `sortBy`/`addSort`/`clearSort`/`sort` API, and cursor re-anchor by
`rowKey` (AR #3).
**Fix:** `grid.ts`.

## Dependencies

### Internal Dependencies
- `column.ts` — `GridColumn.value`, and the new `compare?`/`nulls?`.
- `@jsvision/ui` — `apportionColumns`, `alignCell`, `stringWidth`, `View`, `signal`, `derived`, the
  `Column`/`DispatchEvent`/`DrawContext`/`Signal` types (all already imported in the datagrid).
- `data-source.ts` — `GridDataSource.setSort`, `rowKey`.

### External Dependencies
- `Intl.Collator` (built-in) — the memoized string collator (AR #2). No new package.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Unwinding `ReadonlyGridHeader` regresses the read-only-source-order guarantee it documented | Low | Med | The header now paints only what the container signal holds; with an empty `SortKey[]` it paints no indicator and `display` is source-order — behaviourally identical to today's suppressed state. A spec test pins "empty sort ⇒ source order, no arrows". |
| Case-insensitive collator diverges from `defaultCompare`'s `localeCompare` (two string rules in the package) | Low | Low | The collator lives only in `sortRowsMulti`; `toEngineColumn.compare` (dead-for-sort) is untouched, so there is no *live* second rule. Documented in `03-01`. |
| Push-down `setSort` fired from the pure `display` computed would loop / double-fire | Low | High | AR #7: `setSort` fires from a **separate** effect guarded `if (source.setSort)`; `display` stays pure. A spec test (ST for AC-4) spies `setSort` and asserts `sortRowsMulti` is *not* run client-side. |
| Re-sort on every `version` bump makes an edited row jump | Med | Low | Accepted (AR #8=A); documented behaviour. Snapshot ordering deferred. |
| Cursor re-anchor recomputes an index each re-sort | Low | Low | Re-anchor by `rowKey` reads the pre-sort focused record's key, then finds it post-sort (O(n) once per sort action, not per frame). |
