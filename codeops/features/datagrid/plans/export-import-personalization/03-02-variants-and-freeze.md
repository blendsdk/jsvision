# Variants & Freeze: Export & Layout Variants

> **Document**: 03-02-variants-and-freeze.md
> **Parent**: [Index](00-index.md)

## Overview

`variant.ts` defines the `GridVariant` schema and the pure `buildVariant` / `resolveVariant` functions
that serialize and re-derive a full column layout. Two grid methods delegate to them
(`saveVariant` / `applyVariant`), and a new `setFrozen(left, right)` gives variants (and callers) the
runtime freeze mutation the grid lacks today. Variants are **source-agnostic** — they carry
column/sort/filter *state*, never rows — so they ship in this plan regardless of RD-11
([AR-2](00-ambiguity-register.md)).

## Architecture

### Current Architecture
The layout write surface exists but freeze is construction-only ([02 §Gap 2](02-current-state.md)),
and `setColumnOrder` accepts only a visible permutation ([02 §Gap 3](02-current-state.md)). Sort/filter
setters are public (`grid.ts:823-897`).

### Proposed Changes
1. `freezeSpec` (`private readonly`, `grid.ts:376`) → `private readonly freezeSpecSig = signal<FreezeSpec>(…)`.
   Read it at all three sites: `partitionSig` (`grid.ts:472`), the `rawPartition` region (`grid.ts:699,707`),
   the over-freeze `devWarn` (`grid.ts:709`).
2. Add `setFrozen(left, right)`, `saveVariant(name)`, `applyVariant(variant)` methods.
3. Add `variant.ts` (types + pure logic).

## Implementation Details

### New Types/Interfaces

```ts
// variant.ts
export interface GridVariantColumn {
  readonly id: string;
  readonly width?: number;
  readonly visible: boolean;
}

/** A named, serializable snapshot of a grid's column layout (order = array order). */
export interface GridVariant {
  readonly name: string;
  readonly columns: GridVariantColumn[];                        // full order, hidden interleaved
  readonly freeze: { left: string[]; right: string[] };
  readonly sort: SortKey[];
  readonly filter: Array<{ columnId: string; filter: ColumnFilter }>;
}
```

### New Functions/Methods

```ts
// variant.ts — pure. `snap` is the grid's current layout snapshot.
export function buildVariant(name: string, snap: LayoutSnapshot): GridVariant;
// Resolve a variant against the grid's actual column ids: unknown ids dropped; current-but-unnamed
// columns appended after, keeping their state. Returns the concrete restore instructions.
export function resolveVariant(variant: GridVariant, currentIds: readonly string[]): ResolvedLayout;

// grid.ts — thin delegators.
class EditableDataGrid<T> {
  setFrozen(left: string[], right: string[]): void;
  saveVariant(name: string): GridVariant;
  applyVariant(variant: GridVariant): void;
}
```

### `setFrozen` semantics
Sets `freezeSpecSig` to `{ freezeLeft: left, freezeRight: right }`. `partition` already filters ids to
those actually present/visible (`column-model.ts:61-91` — "ids in the freeze spec not present in
`visible` are ignored"), so unknown ids are ignored. The existing over-pin guard (`overPinnedIds`,
applied lazily once the viewport width is known) and the partition-shape-change rebuild (`grid.ts:677`)
run unchanged — a re-freeze re-pins with no new path. ([AR-3](00-ambiguity-register.md))

### `saveVariant` — read the full state
Gathers, from private state: the **full** order `columnOrderSig()` (hidden included) → `columns[]` with
`visible = !hidden().has(id)` and `width` = an explicit override if one is set (else omitted); `freeze`
= `frozen()`; `sort` = `sort()`; `filter` = `filterModel()` flattened to the array form. Returns
`buildVariant(name, snap)`. ([AR-12](00-ambiguity-register.md))

### `applyVariant` — the fixed restore sequence
`resolveVariant` drops unknown ids and appends current-but-unnamed columns
([AR-13](00-ambiguity-register.md)); then the method applies, **in order** ([AR-14](00-ambiguity-register.md)):

1. **order** — set `columnOrderSig` to the resolved full order (hidden interleaved). *Not* via the
   public `setColumnOrder` (which rejects a non-visible permutation, `grid.ts:969-972`).
2. **visibility** — set `hidden` to the complement of the variant's `visible` ids.
3. **widths** — for each `width`, set the override (clamped via `clampWidth`, as `setColumnWidth` does).
4. **freeze** — `setFrozen(variant.freeze.left, variant.freeze.right)`.
5. **sort** — replace `sortKeys` (and fire `setSort` push-down if the source implements it, matching
   the existing sort-effect pattern).
6. **filter** — replace `filters` (and fire `setFilter` push-down likewise).

### Integration Points
- `setFrozen` reuses `column-model.ts` `partition` / `overPinnedIds` (pure, unchanged).
- Restore reuses the same signals the public setters mutate — so the panels rebuild and repaint through
  the existing effects; no bespoke repaint path.
- Sort/filter restore mirrors the existing push-down effects (a windowed RD-11 source that implements
  `setSort`/`setFilter` still receives them — variants stay source-agnostic).

## Code Examples

### Example 1: round-trip
```ts
grid.setColumnVisible('note', false);
grid.setFrozen(['id'], []);
grid.sortBy('total', 'desc');
const v = grid.saveVariant('compact');   // caller persists v (JSON-serializable)
// … later, on a fresh grid over the same columns:
grid.applyVariant(v);                    // note hidden, id frozen-left, total desc — reproduced
```

### Example 2: unknown id is skipped
```ts
// A variant naming a 'legacy' column the current grid lacks:
grid.applyVariant({ ...v, columns: [...v.columns, { id: 'legacy', visible: true }] });
// 'legacy' is dropped silently; every known column still restores. (RD AC-3)
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Variant names an unknown `columnId` (in `columns`, `freeze`, `sort`, or `filter`) | Skipped, not thrown | [AR-13](00-ambiguity-register.md) |
| Grid has a column the variant omits | Kept at current state, appended after named columns | [AR-13](00-ambiguity-register.md) |
| `setFrozen` over-pins (frozen ≥ viewport) | Existing `overPinnedIds` peels innermost + one `devWarn` (unchanged) | [AR-3](00-ambiguity-register.md) |
| `width` below/above the column's min/max | Clamped via `clampWidth` (as `setColumnWidth`) | [AR-14](00-ambiguity-register.md) |
| Variant restores a filter on a now-hidden column | Applied and retained (a hidden column keeps sort/filter, `grid.ts:1027`); reappears when shown | [AR-13](00-ambiguity-register.md) |

> **Traceability:** every strategy references its AR. See `00-ambiguity-register.md`.

## Testing Requirements
- Unit (pure `variant.ts`): `buildVariant` snapshot shape; `resolveVariant` unknown-drop + unnamed-append;
  restore-order independence. ST-13…ST-17.
- Integration (grid methods): full round-trip reproduces order/width/visibility/freeze/sort/filter;
  `setFrozen` re-pins + over-pin guard; freeze-signal change does not regress RD-07 specs. ST-12,
  ST-18, ST-19.
