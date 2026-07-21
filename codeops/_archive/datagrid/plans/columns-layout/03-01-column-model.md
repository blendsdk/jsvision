# 03-01 — Column Model (`column-model.ts`)

> **Parent**: [Index](00-index.md) · **AR**: AR-8, AR-13, AR-4, AR-5

A pure, view-free module — the data-plane twin of `sort.ts`/`filter.ts` (AR-8). It owns the *shape*
of column-layout state and the pure operations over it; the container wraps these in signals (03-04).
No imports from views, no signals here.

## Types

```ts
/** A freeze partition: column ids in each panel, in visible order. */
export interface FreezePartition {
  readonly left: string[];    // left-pinned, in order
  readonly center: string[];  // scrolling, in order
  readonly right: string[];   // right-pinned, in order
}

/** The freeze spec as authored at construction (mutually the three forms of RD-07). */
export interface FreezeSpec {
  readonly freezeLeft?: string[];
  readonly freezeRight?: string[];
  readonly freeze?: number;   // first-N shorthand → left
}

/** Resolved per-column width limits (defaults applied). */
export const DEFAULT_MIN_WIDTH = 3;   // AR-4 — fits an ellipsis + a glyph
export const DEFAULT_AUTOFIT_MAX = 60; // AR-4 — generous but bounded
```

## Pure operations

Each is a pure function (input → new value, no mutation — mirrors `sortRowsMulti`/`filterRows`).

```ts
/**
 * Project the authored column ids into visible order, dropping hidden ones.
 * @param order   The full column order (ids).
 * @param hidden  The hidden id set.
 * @returns visible ids, in order.
 */
export function visibleOrder(order: readonly string[], hidden: ReadonlySet<string>): string[];

/**
 * Partition the VISIBLE ordered ids into left/center/right panels from the freeze spec. Left/right
 * ids keep their relative order; everything else is center. Unknown ids in the spec are ignored.
 * @returns the three ordered id slices.
 */
export function partition(visible: readonly string[], freeze: FreezeSpec): FreezePartition;

/**
 * Move a column within its own panel (reorder). Rejects a move that would cross a panel boundary by
 * returning the order unchanged (RD-07 AR#22). `from`/`to` are indices into the VISIBLE order.
 * @returns the new visible order (or the same array identity's contents when rejected).
 */
export function reorderWithinPanel(
  visible: readonly string[], freeze: FreezeSpec, from: number, to: number,
): string[];

/**
 * Clamp a requested width to the column's [minWidth ?? DEFAULT_MIN, maxWidth ?? +∞]. Used by resize.
 */
export function clampWidth(requested: number, minWidth?: number, maxWidth?: number): number;

/**
 * The set of column ids that are "over-pinned": would make total frozen width ≥ viewport. Returns the
 * ids to drop from freezing (from the innermost freeze edge outward) so the center keeps ≥ 1 cell.
 * The container clamps by moving these to center + emitting one devWarn (AR-9).
 */
export function overPinnedIds(
  partition: FreezePartition, widthOf: (id: string) => number, viewportWidth: number,
): string[];
```

## Behavior notes (spec-bearing)

- **`partition` groups by panel, preserving order** — because reorder is within-panel (RD-07 AR#22),
  the visible order is always naturally grouped `[left…, center…, right…]`. This is what makes the
  **single global `focusedCol`** (AR-6) a contiguous index: panel L owns `[0, |left|)`, center
  `[|left|, |left|+|center|)`, right the tail.
- **`reorderWithinPanel` boundary check** — `from` and `to` must fall in the same panel slice; else
  the order is returned unchanged (AC-2's "rejected; order unchanged"). A drop *onto* the boundary
  index of another panel is a reject, not a clamp.
- **`clampWidth`** floors to `minWidth ?? DEFAULT_MIN_WIDTH`; `maxWidth` caps only when set (an
  interactive resize can exceed the auto-fit default max; the max cap is `maxWidth` if the column
  declares one). Auto-fit uses `maxWidth ?? DEFAULT_AUTOFIT_MAX` (03-03).
- **`overPinnedIds` never empties the center** — it drops freeze from the innermost frozen column(s)
  until `Σ frozen widths + 1 < viewportWidth`, guaranteeing ≥ 1 center cell (AC-6).
- **Unknown ids are dropped, never thrown** — `partition`/`visibleOrder` ignore ids not in `order`;
  the container's API layer (03-04) additionally guards unknown ids against the column map (AC-9).

## Barrel

Export the types + pure functions + the two default constants from `index.ts`. `FreezePartition`,
`FreezeSpec` are public (a bespoke grid can drive them); the pure ops are exported for testability
and reuse, JSDoc'd with `@example` per the docs standard.

## Testing hooks

Spec tests (03-07) lock: `visibleOrder` drops hidden + preserves order; `partition` groups by panel
+ ignores unknown freeze ids; `reorderWithinPanel` moves within panel + rejects cross-boundary;
`clampWidth` floors/caps + default min; `overPinnedIds` keeps ≥ 1 center cell + drops innermost
first. All pure — no view/loop harness needed (fast unit tests, like `sort.spec.test.ts`).
