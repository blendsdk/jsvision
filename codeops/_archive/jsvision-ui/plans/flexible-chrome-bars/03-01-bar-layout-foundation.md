# 03-01 — Shared Bar-Layout Foundation

> Implements F-1. Decisions: AR-6, AR-7. References current state 02 § "Layout DSL".

## Goal

Replace the two hand-rolled left-pack loops (`itemBoxes()`, `layoutTitles()`) with the RD-02 layout
engine's **1-D flex solve**, so both bars gain right-alignment + flexible gaps from one algorithm and
the default (no-spacer) geometry stays byte-identical (AR-7).

## Two entry points, one algorithm

The status line and the menu bar sit at different levels, so they consume the engine differently:

- **Status line** — its items are real child views in a `row()` `Group`. The engine already lays out a
  row of children with `fixed`/`fr` sizes and honours `spacer()` (an `fr` `Empty` view). **No new
  packing code** is needed here — the status line simply becomes a `row`-direction group whose children
  carry `fixed`/`fr` sizes (03-02).
- **Menu bar** — its titles stay **data** nodes (`MenuItem`), not views (AR-1). So it needs a pure
  function that packs fixed-width title buttons plus flexible `menuSpacer` weights into a known bar
  width. That function reuses the engine's 1-D apportion primitive.

## The shared helper — `packRow`

Add a small pure helper (internal; not barrel-exported) that both `layoutTitles` (03-03) and any future
data-driven bar can call. It wraps the existing `solveTrack`/largest-remainder apportion from
`packages/ui/src/layout/apportion.ts` — it does not re-implement apportionment.

```ts
/** A segment to place along the bar: a fixed-width button, or a flexible spacer with an fr weight. */
type RowSegment =
  | { kind: 'fixed'; width: number }
  | { kind: 'flex'; weight: number };

/** The resolved integer x + width of each segment, packed left-to-right across `total` cells. */
interface RowSlot { x: number; width: number }

/**
 * Pack `segments` across `total` cells: fixed segments keep their width; flex segments split the
 * leftover (largest-remainder, integer-correct). With no flex segment and `total` at least the fixed
 * sum, this is identical to a plain left-pack from x=0 — so a bar with no spacer is byte-unchanged.
 */
function packRow(segments: RowSegment[], total: number, startX = 0): RowSlot[];
```

### Behavior contract (AR-7 — the byte-identical guarantee)

- **No flex segment** (the default bar): `packRow` places fixed segments abutting from `startX`, exactly
  like the current loops. `layoutTitles([...])` with no `menuSpacer` and the status `row` with no
  `spacer()` produce the current pixel columns.
- **Flex present**: leftover `total − Σfixed` is apportioned across flex weights (largest-remainder, so
  columns are integers and sum exactly). A single trailing `spacer()`/`menuSpacer()` pushes the
  following segments hard against the right edge.
- **Overflow** (fixed sum > total): flex segments collapse to width 0 and fixed segments keep their
  natural widths (may extend past the edge — the engine's documented overflow rule); never negative.

## Why reuse, not reinvent

`apportion.ts` is the de-risked engine spike (largest-remainder apportion + `solveTrack`) already
covered by the layout suite. `packRow` is a thin adapter (a dozen lines) so the menu bar shares the
engine's proven integer packing rather than growing a second one. The status line needs no adapter — it
uses `row()` directly.

## Files

- `packages/ui/src/menu/builders.ts` — `packRow` lives here (next to `layoutTitles`, its only caller
  today) **or** in a new `packages/ui/src/layout/pack-row.ts` if it grows; start co-located to avoid a
  premature module. Internal only.
- No barrel/export changes for the foundation itself (it is an implementation detail of the two bars).

## Verification

The foundation has **no user-facing oracle of its own** — it is validated through the status-line and
menu-bar oracles (07). Its integer-packing edge cases (empty, all-fixed, one flex, multi-flex, overflow)
get **impl** unit tests in `pack-row` (07 § Impl tests).
