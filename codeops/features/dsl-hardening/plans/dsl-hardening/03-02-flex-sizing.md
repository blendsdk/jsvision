# Flex Sizing: S1 `size.min` + S7 falsy children

> **Document**: 03-02-flex-sizing.md
> **Parent**: [Index](00-index.md)
> Module: `packages/ui/src/view/dsl/flex.ts`

## Overview

Two additive changes to the flex builders: forward the engine's existing `Size.fr.min` through the
size shorthands (R1/S1), and make the container builders tolerate falsy children (R7/S7).

## Implementation Details

### New Functions/Methods — `grow` / `fixed` with `min` (R1, AR-2)

```ts
/** Options for the fr-producing shorthands. */
interface GrowOptions { min?: number }   // `max` intentionally omitted — no engine support (AR-10)

// Overloads keep the common 2-arg call unchanged:
export function grow<V extends View>(view: V, n?: number): V;
export function grow<V extends View>(view: V, n: number, opts: GrowOptions): V;
export function grow<V extends View>(view: V, n = 1, opts?: GrowOptions): V {
  const size: Size = { kind: 'fr', weight: n, ...(opts?.min !== undefined ? { min: opts.min } : {}) };
  view.layout = { ...view.layout, size };
  return view;
}
```

- `fixed()` is unchanged in behavior (exact cells have no floor); it takes **no** `min`.
- The `col`/`row` `Flex` shorthand gains the object form. `Flex.grow` becomes
  `number | { weight: number; min?: number }`; `toLayout()` resolves it:
  `grow: 3` → `{ fr, weight:3 }`; `grow: { weight:3, min:12 }` → `{ fr, weight:3, min:12 }`.
  `fixed`/`fill` shorthands unchanged. Explicit `size` still wins over the shorthands.
- `min` is forwarded verbatim; the engine's `normalizeSize` already floors a negative `min` to 0 —
  the DSL does **not** re-clamp (single source of truth).

### New Behavior — falsy children (R7, AR-7)

`container()` (and `stack()`, in `dsl/stack.ts`) filter the children before adding:

```ts
const children = raw.filter(
  (c): c is View => c !== null && c !== undefined && c !== false,
);
for (const child of children) group.add(child);
```

- **Both** `container()` (behind `col`/`row`) **and** `stack()` widen their child/layer parameter
  type to accept `View | null | undefined | false` so `col(cond && fixed(x, 1), grow(y))` and
  `stack(cond && layer, canvas)` type-check — a runtime filter without the widened signature would
  still reject the conditional idiom at compile time. The props-object first arg is still detected by
  `first instanceof View` (a `Flex` object is neither a `View` nor falsy).
- Only `null`/`undefined`/`false` are skipped — the conditional-render idiom. Any other value is a
  `View` and is added as today.

## Integration Points
- Both changes are confined to `dsl/flex.ts` (and the falsy filter mirrored in `dsl/stack.ts`'s
  `stack()`), which the 03-01 split creates. No engine edit.

## Code Examples

```ts
// A sidebar that grows but never below 12 cells; main takes the rest.
row(grow(sidebar, 1, { min: 12 }), grow(main, 3));

// Conditional chrome without a manual .add() dance.
col(showMenu && fixed(menuBar, 1), grow(body), showStatus && fixed(statusLine, 1));
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Negative `min` | forwarded as-is; engine `normalizeSize` clamps to 0 (no double-clamp) | AR-2 |
| A child arg that is `0`/`''` (not a View, not the skipped falsy set) | cannot occur — the param type is `View \| null \| undefined \| false`; TS rejects other primitives | AR-7 |
| `min` passed to `fixed()` | not in the signature — TS error; `fixed` is exact by design | AR-2 |

> **Traceability:** references AR-2, AR-7, AR-10. See `00-ambiguity-register.md`.

## Testing Requirements
- Spec: `min` floor reaches the pane token; a below-floor container honors it; the 2-arg `grow` is
  unchanged; falsy children are skipped and real ones kept. See ST-1…ST-6 in `07`.
