# Component: engine `position:'fill'` mode

> **Feature**: jsvision-ui · **Plan**: layout-dsl · Implements FR-7, FR-8 · AR-1, AR-8, AR-13
> **Files**: `packages/ui/src/layout/types.ts`, `layout.ts`, `measure.ts`

The one non-user-land piece. It makes an overlay child fill its parent's content box **during the
layout pass**, so it re-solves lag-free on resize — closing the gap the prototype could only patch
with a draw-time self-correction (there is no per-view bounds hook — see 02-current-state).

## Semantics (AR-1, AR-8, AR-13)

A child with `position: 'fill'`:

1. **Fills** — its rect is the parent's content box: origin `(content.x, content.y)`, size
   `(content.width, content.height)` (padding honored, exactly like the content origin `placeAbsolute`
   already uses).
2. **Overlaps** — it is removed from the flex flow: it reserves **no** main-axis space and never
   shifts flow siblings (joins the existing `position !== 'flow'` non-flow set).
3. **Invisible to intrinsic size** — excluded from the parent's `naturalSize` (an `auto` parent sizes
   to its flowing content, not to a fill overlay).
4. **Recurses** — its own subtree lays out within that content-box rect.
5. **Ignores `justify`/`align`** — being outside the flow, neither positions it (AR-13).
6. Paint order is unchanged (child array order); z-order is the caller's concern.

Multiple `fill` children in one container all resolve to the same content-box rect → they overlap,
back-to-front. This is what lets `stack()` layer several fills lag-free.

## Changes

### `types.ts`

- Extend the union: `position?: 'flow' | 'absolute' | 'fill'` (`LayoutProps` and `ResolvedProps`).
- `normalizeProps`: `'fill'` needs no `rect` (unlike `'absolute'`); `rect` stays `undefined` for it.
- Update the `position` JSDoc to describe `'fill'` for consumers (no CodeOps IDs).

### `layout.ts`

- The flow filter becomes "flow = not absolute **and not fill**" (one predicate, reused for
  `solveMainSizes` / `mainAxisOffsets` / the placement loop).
- In the placement loop, a `'fill'` child is placed at the content-box rect
  `{ x: content.x, y: content.y, width: content.width, height: content.height }` and recursed —
  a 3-line sibling to `placeAbsolute` (or `placeAbsolute` generalized to take the rect).

### `measure.ts`

- `naturalSize`'s flow filter (`:50`) excludes `'fill'` as well as `'absolute'`, so a fill overlay
  never inflates an `auto` parent's intrinsic size.

## Non-goals

- No edge/corner anchoring (corners still self-correct in the DSL — AR-2). `'fill'` is *only* the
  full-content-box case.
- No change to `'flow'`/`'absolute'` behavior; existing layout tests must stay green unchanged.

## Risks

- **Spec regression surface.** Existing layout spec oracles (sizing/align/tree/packaging) must all
  still pass — `'fill'` is additive. The green run after the engine change is the guard.
- The `align`/`justify` interaction is defined as "no effect" (AR-13); the oracle pins it so a future
  change can't silently start honoring them.
