# Absolute Builders: S2 `at()` + S3 `cover()`/`center()` (+ S4)

> **Document**: 03-03-absolute-builders.md
> **Parent**: [Index](00-index.md)
> Module: `packages/ui/src/view/dsl/absolute.ts` (new)

## Overview

Give the DSL one blessed absolute-placement primitive and two single-child overlay primitives, all
in the `grow`/`fixed` shape (set one `.layout` prop, merge-preserving, return the view). These are
the escape hatch for canvases, dialog frames, and TV-faithful geometry — **prefer `col`/`row`;
reach for these only when flex flow can't express the placement.**

## Implementation Details

### `at()` — absolute placement (R2/S2, AR-3)

```ts
export function at<V extends View>(view: V, x: number, y: number, width: number, height: number): V;
export function at<V extends View>(view: V, rect: Rect): V;
export function at<V extends View>(view: V, a: number | Rect, y?: number, width?: number, height?: number): V {
  const rect: Rect = typeof a === 'number'
    ? { x: a, y: y!, width: width!, height: height! }
    : a;
  view.layout = { ...view.layout, position: 'absolute', rect };   // MERGE — preserves direction etc.
  return view;
}
```

- **Merge-preserving** (`{ ...view.layout, … }`) — unlike most hand-rolled `at()`s that replace the
  layout and drop `direction`. This is the concrete correctness win over the copies it replaces.
- **Pure** — never `.add()`s to a parent (AR-3). Composition stays the caller's job (`g.add(at(v,…))`
  or nesting inside `col`/`stack`).
- Positional `(view, x, y, width, height)` matches the ~15 existing hand-rolled helpers so their
  migration (issues #114/#109/#112/#115) is a mechanical import swap; the `(view, rect)` overload
  covers the internal `(view, rect)` sites.

### S4 — an `at()` child inside a container (R3)

No new code: the engine already excludes `position:'absolute'` children from flex flow
(`layout.ts:84`, `placeOutOfFlow`). So `col(a, grow(b), at(overlay, 0,0,W,H))` lays out `a`/`b` in
the column and paints `overlay` absolutely over the content box, reserving no flow space. This plan
**spec-locks** that guarantee (ST-9) and documents it in `at()`'s `@example` — it is the clean
replacement for `application.ts`'s hand-rolled absolute overlay inside the root `col`.

### `cover()` / `center()` — single-child overlays (R4/S3, AR-4)

```ts
/** Cover the parent's content box (out of flow). Standalone — no stack() wrapper. */
export function cover<V extends View>(view: V): V {
  view.layout = { ...view.layout, position: 'fill' };
  return view;
}

/** Center a fixed-size box in the parent, re-centering on resize. Standalone. */
export function center<V extends View>(view: V, width: number, height: number): V {
  view.layout = { ...view.layout, position: 'absolute', rect: { x: 0, y: 0, width, height } };
  view.centered = true;                       // the engine re-centers absolute + centered boxes
  return view;
}
```

- `cover()` mirrors the fill branch `stack()` applies to an untagged layer (`layer.layout.position =
  'fill'`, a pure engine mode with no stack-specific machinery); `center()` mirrors the centered-fixed
  branch (`View.centered = true`, which the engine re-solves lag-free in the reflow pass).
- **Naming (AR-4, revised by preflight PF-001):** the builder is `cover()`, **not** `fill()` — a
  standalone `fill` export is banned by the packaging oracle and would collide with the existing
  `Flex.fill` shorthand (which means `grow: 1`, the opposite). `cover` (position:'fill') is also
  distinct from the existing `centered` (a **stack-layer tag**, only effective inside `stack()`).
  Both `@example`s state the distinctions so the near-homonyms don't mislead (`cover` vs `Flex.fill`;
  `center` vs `centered`).

## Integration Points
- New file `dsl/absolute.ts`; re-exported from `dsl/index.ts`, `view/index.ts`, and the package
  `index.ts` (the only additions to the public surface: `at`, `cover`, `center`).
- `Rect` imported from `../../layout/index.js`; `View` from `../view.js`.

## Code Examples

```ts
import { col, grow, at, cover, center } from '@jsvision/ui';

// Absolute overlay as an out-of-flow child of a column (S4).
const screen = col(header, grow(body), at(toast, 2, 1, 30, 3));

// Cover a window with one child; center a dialog — no stack() needed.
cover(canvasView);
center(confirmDialog, 40, 12);
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Degenerate rect (negative/fractional) | forwarded; engine `normalizeRect`/`toCells` clamps to ≥0 ints (no double-clamp) | AR-3 |
| `at()` called with a partial rect via the numeric overload | TS requires all four numbers on the positional overload; the `Rect` overload requires a full `Rect` | AR-3 |
| `center()`/`cover()` used *as* a stack layer too | harmless — the layout props they set are exactly what `stack()` would apply; `stack()` still overrides via its own tagging path | AR-4 |

> **Traceability:** references AR-3, AR-4. See `00-ambiguity-register.md`.

## Testing Requirements
- Spec: `at()` sets absolute+rect and preserves prior props (merge); `Rect` overload equals the
  positional form; `at()` child is out of flow inside a `col`; `cover()` sets `position:'fill'`;
  `center()` sets absolute rect + `centered`. See ST-7…ST-12 in `07`.
