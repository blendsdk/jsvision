# Grid Layout API: Personalization Dialog

> **Document**: 03-01-grid-layout-api.md
> **Parent**: [Index](00-index.md)

## Overview

The data-plane foundation the dialog reads and commits through: a public reactive column-metadata
accessor (`columns()`), the construction-time baseline for Reset (`defaultColumnLayout()`), a width-clear
mutator (`clearColumnWidth()`), and the **corrected `applyVariant` width-restore** so an override can be
*removed*, not only set. All logic is pure and lives in `variant.ts`; `grid.ts` gains only thin
delegators (AR-4). Owns RD-16 AC#5, AC#6, AC#10 and PF-024/PF-028.

## Architecture

### Current Architecture
See [02 §Code Analysis](02-current-state.md): the write surface is complete; there is no `columns()`
read accessor; `applyVariant` (`grid.ts:1187-1192`) + `resolveVariant` (`variant.ts:159`) only ever
*add* width overrides.

### Proposed Changes
1. `variant.ts` — add the `GridColumnInfo` type; a pure `buildColumnInfos(...)`; a pure `defaultLayout(...)`; and `clearWidths` on `ResolvedLayout` (populated by `resolveVariant`).
2. `grid.ts` — thin delegators `columns()`, `defaultColumnLayout()`, `clearColumnWidth()`; correct the `applyVariant` width step to delete-then-set.

## Implementation Details

### New Types/Interfaces (`variant.ts`)

```ts
/** Read-only column metadata for a personalization UI. */
export interface GridColumnInfo {
  readonly id: string;
  readonly title: string;
  readonly visible: boolean;                    // !hidden.has(id)
  readonly frozen: 'left' | 'right' | 'none';   // resolved partition membership (grid.frozen())
  readonly width: number;                       // resolved width in cells (grid.columnWidth(id))
}

// ResolvedLayout gains one field (AR-3):
export interface ResolvedLayout {
  // …existing: order, visibleById, widthById, freeze, sort, filter…
  readonly clearWidths: string[];               // named columns carrying NO width → clear the override
}
```

`GridColumnInfo` is a **type** (barrel `export type` — exempt from the `@example` gate). It co-locates
with `GridVariant` in `variant.ts` (AR-2).

### New Functions/Methods

```ts
// variant.ts — pure. The grid delegators pass their private state in; no reactive reads here.
export function buildColumnInfos(
  order: readonly string[],                     // full order incl. hidden (columnOrderSig())
  hidden: ReadonlySet<string>,
  frozen: { left: readonly string[]; right: readonly string[] },   // RESOLVED partition (grid.frozen())
  widthOf: (id: string) => number,              // grid.columnWidth(id) (resolved)
  titleOf: (id: string) => string,
): GridColumnInfo[];

// The construction-time baseline: every column visible, construction order, no freeze, no overrides.
export function defaultLayout(
  constructionOrder: readonly string[],         // engineCols / columnMap insertion order
  declaredWidthOf: (id: string) => number,      // engineCols[idx].width or the auto/title fallback
  titleOf: (id: string) => string,
): GridColumnInfo[];

// grid.ts — thin delegators on EditableDataGrid<T>.
class EditableDataGrid<T> {
  /** The full column list (all ids, hidden included), in full column order. Reactive. */
  columns(): readonly GridColumnInfo[];
  /** The construction-time column layout (all visible, construction order, no freeze, no width overrides). */
  defaultColumnLayout(): readonly GridColumnInfo[];
  /** Remove a column's explicit width override, returning it to auto/declared width. Unknown id ignored. */
  clearColumnWidth(id: string): void;
}
```

- **`columns()` is reactive** — its body reads `columnOrderSig()`, `hidden()`, `frozen()` (which reads `partitionSig()`), and `resolvedWidth(id)`; reading it inside an effect re-runs on any layout change. `frozen` reports the **resolved** partition — an over-pinned column reports `frozen: 'none'` (PF-028; identical to `grid.frozen()` membership).
- **`defaultColumnLayout()`** delegates to `defaultLayout(...)` fed from the construction-order carriers (`engineCols`/`columnMap`), declared widths via `engineCols[idx].width` (falling back to the auto/title width as `resolvedWidth` does), and `columnMap.get(id).title`. It reads no mutable override/hidden/freeze state — the baseline is *by definition* all-visible / no-freeze / no-override.
  - **Its `GridColumnInfo.width` is display-only (PF-003).** The returned `width` is the *resolved* (auto/declared) width for rendering. The dialog's Reset (and the width-clear path) must translate the baseline to **no override** — i.e. the pending variant column **omits** `width` — so the corrected `applyVariant` *clears* the override. Never copy the resolved `width` number back into `pending.columns[].width` (that would re-establish an override and defeat the clear). Same rule as an empty width field mapping to `width: undefined`, not `Number('')`.
- **`clearColumnWidth(id)`** copies `columnWidths()`, `delete(id)`, sets the signal. Unknown id → the delete is a no-op (no throw). Mirrors `setColumnWidth` (`grid.ts:1081`) minus the clamp/set.

### The corrected `applyVariant` width-restore (grid.ts + variant.ts)

`resolveVariant` additionally returns `clearWidths` = the ids of variant `columns[]` entries that are
*named but carry no `width`*:
```ts
const named = /* variant.columns filtered to known current ids, in variant order */;
const widthById  = new Map(named.filter((c) => c.width !== undefined).map((c) => [c.id, c.width as number]));
const clearWidths = named.filter((c) => c.width === undefined).map((c) => c.id);   // NEW (AR-3)
```
`applyVariant`'s width step (replacing `grid.ts:1187-1192`) becomes delete-then-set:
```ts
const widths = new Map(this.columnWidths());
for (const id of resolved.clearWidths) widths.delete(id);          // NEW — remove overrides the variant omits
for (const [id, width] of resolved.widthById) {
  const col = this.columnMap.get(id);
  if (col !== undefined) widths.set(id, clampWidth(width, col.minWidth, col.maxWidth));
}
this.columnWidths.set(widths);
```
**Scope:** only **named** columns are affected. A column the variant omits entirely (unnamed, appended by
`resolveVariant`) keeps its current override — unchanged RD-13 semantics ([03-02 §restore, RD-13 plan](../export-import-personalization/03-02-variants-and-freeze.md)). Because the dialog's pending
variant names **every** column (full order), OK deterministically sets or clears every override — which is
what makes "clear a width to auto" commit correctly.

### Integration Points
- `columns()`/`defaultColumnLayout()` are pure reads over existing private signals — no new reactive
  primitive, no new signal.
- The `applyVariant` correction reuses the same `columnWidths` signal the public setters mutate, so panels
  rebuild/repaint through the existing effects (no bespoke repaint path).
- `clearColumnWidth` + the correction together are the grid-side halves of the dialog's width editor and
  Reset ([03-03](03-03-personalize-dialog.md)).

## Code Examples

### Example 1: reactive read + width clear
```ts
grid.setColumnWidth('amount', 20);
grid.columnWidth('amount');       // 20
grid.clearColumnWidth('amount');
grid.columnWidth('amount');       // back to auto/declared
grid.columns().find((c) => c.id === 'amount')?.width;   // the resolved auto width
```

### Example 2: the width-restore correction (also the RD-13 regression)
```ts
grid.setColumnWidth('note', 30);
const v = grid.saveVariant('no-note-width');   // 'note' has an override → captured with width 30
grid.clearColumnWidth('note');                 // pending state: no override
const v2 = grid.saveVariant('cleared');        // 'note' captured WITHOUT a width
grid.setColumnWidth('note', 30);               // re-add an override
grid.applyVariant(v2);                          // corrected: 'note' override is CLEARED (was: stale 30 kept)
grid.columnWidth('note');                        // auto/declared, not 30
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `clearColumnWidth` / `columns()` given an unknown id | Ignored / not present; no throw (mirrors `resolvedWidth`'s unknown-id → 0) | AR-2 |
| A variant names a column absent from the grid | Dropped by `resolveVariant` (unchanged RD-13 drop-unknown) — never enters `clearWidths` | RD-16 AC#8 |
| An over-pinned frozen column | `columns()[].frozen` reports the **resolved** `'none'` (matches `grid.frozen()`); a v1 round-trip may narrow the over-pin | PF-028 |
| `applyVariant` width below/above min/max | Clamped via `clampWidth` (as `setColumnWidth`) | RD-16 AC#5 |

> **Traceability:** every strategy references its AR / RD AC. See [00-ambiguity-register.md](00-ambiguity-register.md).

## Testing Requirements
- Pure (`variant.ts`): `buildColumnInfos` shape/order/resolved-freeze; `defaultLayout` all-visible/no-freeze/no-override; `resolveVariant` populates `clearWidths` for named-without-width and leaves unnamed untouched. ST-1, ST-3, ST-4, ST-8.
- Grid methods: `columns()` correctness + reactivity; `clearColumnWidth` round-trip; the `applyVariant` delete-then-set correction; the RD-13 round-trip regression. ST-2, ST-5, ST-6, ST-7.
