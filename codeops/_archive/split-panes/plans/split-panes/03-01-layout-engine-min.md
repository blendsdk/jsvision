# Layout Engine: minimum-size support

> **Document**: 03-01-layout-engine-min.md
> **Parent**: [Index](00-index.md)
> **Governs**: `packages/ui/src/layout/{apportion,types,layout,measure}.ts`

## Overview

Teach the flex track solver a **minimum**: a flex item may declare a floor it is never solved
below. This is the only shared machinery the split-panes feature adds, and it exists because
`minSize` is unimplementable without it — the engine has no min/max support of any kind today
(02-current-state §Gap 1).

Scope is deliberately minimal (AR-8): **one optional field on two existing exported types**, `fr`
only, no `max`, no `basis`, no `shrink`, and no new exported function. The clamped solver itself
stays module-private, following `layout/pack-row.ts` — a pure `solveTrack` adapter that lives in
`layout/`, is absent from the barrel, and is cross-imported by `menu/builders.ts:12`. `layout/index.ts:15`
states outright that internal helpers stay module-private. (AR-7)

## Architecture

### Current Architecture

`solveTrack(total, items, gap)` (`apportion.ts:99-114`) reserves fixed sizes and gaps, then hands
the remaining `free` to `apportion(free, weights)` (`apportion.ts:43-74`), which distributes it by
largest-remainder so the result sums to `free` exactly. `TrackItem` is `fixed | flex`
(`apportion.ts:18-20`). The `fr`→`TrackItem` bridge is `layout.ts:168-169`.

### Proposed Changes

`TrackItem`'s flex variant and `Size`'s `fr` variant each gain an optional `min`. `solveTrack`
delegates to a new internal `apportionMin` **only when some item actually carries a min**;
otherwise it runs today's `apportion` line untouched.

> **Decision per AR-8:** The no-min fast path is what makes this landable inside a component
> feature. No existing caller can set `min` (the field does not exist), so every current call site
> passes `undefined`, takes the fast path, and produces byte-identical output. The zero-regression
> claim is therefore **mechanical, not argued** — and ST-1 pins it with the current `solveTrack`
> JSDoc example as a regression oracle.

## Implementation Details

### New Types/Interfaces

```ts
// packages/ui/src/layout/apportion.ts
export type TrackItem =
  | { readonly kind: 'fixed'; readonly size: number }
  | { readonly kind: 'flex'; readonly weight: number; readonly min?: number };

// packages/ui/src/layout/types.ts  (Size, line 36-39)
export type Size =
  | { kind: 'fixed'; cells: number }
  | { kind: 'fr'; weight: number; min?: number }
  | { kind: 'auto' };
```

`min` is a non-negative integer cell count. `fixed` items need none (their size *is* their
minimum), and `auto` items are measured, so `min` is meaningless there.

### New Functions/Methods

```ts
/**
 * Distribute `total` cells across weighted shares while honouring per-item minimums.
 * Module-private: `solveTrack` is the only caller.
 */
function apportionMin(total: number, weights: readonly number[], mins: readonly number[]): number[];
```

**Algorithm — pin to fixpoint.**

1. **Normalize.** `m_i = max(0, round(min_i))`. Weights normalize inside `apportion` as today.
2. **Infeasible case** — `Σ m_i >= total`: return `apportion(total, m)`. A proportional squeeze by
   minimum that still sums to `total` **exactly**. Items go below their minimum here because the
   space genuinely does not exist; what they must never do is overflow (see Error Handling).
3. **Fixpoint** — at most `n` passes:
   - `remaining = total − Σ_{pinned} m_i`
   - `solved = apportion(remaining, weights with pinned items zeroed)`
   - pin every unpinned `i` where `solved[i] < m_i`, fixing `size_i = m_i`
   - if nothing was newly pinned: assign each unpinned `size_i = solved[i]` and return.
4. **Termination.** Each pass pins ≥1 item or returns, so it converges in ≤ `n` passes.

**Sum contract — matches `apportion`'s existing one, deliberately.** `apportion` sums to `total`
"when any weight is positive; all zeros otherwise" (`apportion.ts:33-34`, `:50`). `apportionMin`
extends that consistently: the result sums to `total` whenever at least one unpinned item has a
positive weight, and in the infeasible case it always sums to `total`. When **every** item pins —
reachable only when the residual unpinned items all have zero weight — each item receives its `m_i`
and the residue stays unfilled, exactly as an all-zero-weight track leaves `total` unfilled today.
Do **not** "fix" this by distributing the residue: that would make a zero-weight flex item grow,
contradicting the current contract.

> **Why the last item cannot wrongly pin.** In the feasible branch (`Σ m_i < total`), suppose every
> other item is pinned and item `j` (weight > 0) is alone. It receives all of
> `remaining_j = total − Σ_{pinned} m_k`, and it would pin only if `remaining_j < m_j`, i.e.
> `total < Σ_all m`, contradicting feasibility. So a positive-weight item is never starved below its
> minimum when the minimums are collectively satisfiable.

### Integration Points

| File | Change |
| ---- | ------ |
| `apportion.ts:18-20` | Add `min?` to the `flex` variant of `TrackItem`. |
| `apportion.ts` (new, private) | `apportionMin` per the algorithm above. |
| `apportion.ts:110-111` | Fast path: compute `hasMin = items.some(it => it.kind === 'flex' && it.min !== undefined && it.min > 0)`. If `!hasMin`, run today's `apportion(free, weights)` line unchanged; else `apportionMin(free, weights, mins)`. |
| `types.ts:38` | Add `min?` to the `fr` variant of `Size`. |
| `types.ts:168-169` | `normalizeSize` clamps it: `{ kind: 'fr', weight: Math.max(0, size.weight), min: size.min === undefined ? undefined : toCells(size.min) }` — `toCells` already floors to a non-negative integer, matching how `fixed` cells are normalized at `:166`. |
| `layout.ts:168-169` | Bridge passes it through: `return { kind: 'flex', weight: size.weight, min: size.min }`. |
| `measure.ts:82-84` | An `fr` item currently contributes `main: 0` to natural size; it must contribute `main: size.min ?? 0`. |

**`justify` needs no change.** `layout.ts:193` already computes
`free = Math.max(0, contentMain - used)` from the *solved* sizes, so a binding minimum simply
consumes space before `justify` distributes what is left.

**`measure.ts` rationale.** An `fr` item contributes 0 to natural size today because a flex item's
size comes from leftover space, and in a shrink-to-fit container there is none. A *minimum* is
different: it is space the item will take regardless. CSS agrees — `flex-basis: 0; min-width: 20px`
measures 20 in a shrink-to-fit container. This is additive: `min` is `undefined` for every existing
caller, so `size.min ?? 0` is `0`, exactly as now.

## Code Examples

### Example 1: a minimum that binds

```ts
// A 20-cell row, two equal panes, the first never below 15.
solveTrack(20, [
  { kind: 'flex', weight: 1, min: 15 },
  { kind: 'flex', weight: 1 },
]); // → [15, 5]   (sums to exactly 20)
```

### Example 2: the infeasible case squeezes, it does not overflow

```ts
// Two panes each wanting 8, but only 10 cells exist.
solveTrack(10, [
  { kind: 'flex', weight: 1, min: 8 },
  { kind: 'flex', weight: 1, min: 8 },
]); // → [5, 5]   (sums to exactly 10 — never [8, 8])
```

### Example 3: the fast path is byte-identical

```ts
// No item carries a min → the current apportion line runs, unchanged.
solveTrack(20, [
  { kind: 'fixed', size: 5 },
  { kind: 'flex', weight: 1 },
  { kind: 'flex', weight: 1 },
]); // → [5, 8, 7]   (the existing JSDoc example at apportion.ts:93-97)
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `Σ min > free` (minimums unsatisfiable) | Proportional squeeze via `apportion(free, mins)`; sums to `free` exactly. **Never** let items overflow: hit-testing reads `bounds`, so an overflowing pane is a wrong click target, not merely a clipped glyph | AR-8 |
| Negative or fractional `min` | `toCells` in `normalizeSize` floors to a non-negative integer, as it already does for `fixed` cells | AR-16 |
| `min` on a `fixed` or `auto` item | Not expressible — the type only permits it on `flex`/`fr`. No runtime check needed | AR-8 |
| `min` larger than the whole track | Falls into the infeasible branch; squeezes, sums exactly | AR-8 |
| Zero-weight flex item carrying a `min` | Receives its `min`; any residue stays unfilled, consistent with `apportion`'s all-zero-weight behavior | AR-8 |
| `min: 0` vs `min: undefined` | Equivalent — both take the fast path and behave as today | AR-8 |

> **Traceability:** every strategy above references the Ambiguity Register entry that resolved it.
> See [`00-ambiguity-register.md`](00-ambiguity-register.md).

## Rejected during hardening — do not resurrect

Using `measure()` as a "tell me my available size before my children are laid out" hook. It appears
to work: `layout.ts:89` `solveMainSizes` → `naturalSize` → `box.measure(available)` runs *before*
`layoutContainer` recurses at `layout.ts:120`, so a side-effecting `measure()` could rewrite weights
and have them honoured in the same pass. Reject it — `available` is the **parent's** content box
(wrong whenever a sibling, gap, or `justify` exists), it fires again for the cross axis when
`align !== 'stretch'`, and it violates the engine's advertised purity contract (`layout.ts:26-27`:
"Pure: mutates neither `root` nor anything reachable from it"), which is pinned by an immutable
oracle in `layout.packaging.spec.test.ts`.

## Testing Requirements

- Specification tests for `apportionMin` / `solveTrack` min behavior: ST-1 … ST-9 (07-testing-strategy.md).
- ST-1 is the **regression oracle** — the existing `solveTrack` JSDoc example must still produce
  `[5, 8, 7]`.
- Implementation tests: fixpoint convergence with multiple simultaneously-binding minimums, tie
  behavior, zero-weight-with-min, `min: 0`/`undefined` equivalence, and `normalizeSize` clamping.
- The whole existing layout suite must stay green — it is the real proof of the fast path.
</content>
