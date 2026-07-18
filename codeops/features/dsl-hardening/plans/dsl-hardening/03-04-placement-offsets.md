# Placement Offsets: S5 offsets + S3 dev-warn

> **Document**: 03-04-placement-offsets.md
> **Parent**: [Index](00-index.md)
> Module: `packages/ui/src/view/dsl/stack.ts`

## Overview

Two small additions to the stack/placement path: a per-axis offset on `Placement` (R6/S5), and a
dev-only warning when a placement tagger is orphaned (R5/S3).

## Implementation Details

### `Placement` offsets (R6/S5, AR-6)

Extend the `Placement` interface and `layerRect()`:

```ts
export interface Placement {
  h?: PlaceAxis;                 // (existing) 'fill' | 'start' | 'center' | 'end'
  v?: PlaceAxis;                 // (existing)
  width?: number;                // (existing)
  height?: number;               // (existing)
  hOffset?: number;              // NEW — cells added to the resolved x (may be negative)
  vOffset?: number;              // NEW — cells added to the resolved y
}
```

`layerRect()` applies the offset after computing the start/center/end position — a positive offset
insets the box **away from its anchored edge** (so `{ v:'end', vOffset:1 }` sits one cell *above* the
bottom, matching the consumer intent) — then clamps to stay within the content box:

```ts
// after: base = start ? 0 : center ? floor((extent-size)/2) : extent-size
const off = axis === 'h' ? (p.hOffset ?? 0) : (p.vOffset ?? 0);
const shifted = mode === 'end' ? base - off : base + off;  // + moves away from the anchored edge
pos = Math.max(0, Math.min(extent - size, shifted));       // keep the box inside the content box
```

- **Direction (AR-15, runtime).** The offset is applied **directionally** — added for `start`/`center`,
  **subtracted** for `end` — so a positive value always insets toward the interior. The original
  snippet used a uniform `pos + off`, which for `end` gave `10 - 2 + 1 = 9` (clamped to 8) and
  contradicted ST-13's `y = 10 - 2 - 1 = 7` and the errorBox "one cell above the bottom" intent. The
  ST oracle is authoritative; the snippet was the mis-derivation and is corrected here.
- Offsets are ignored on a `'fill'` axis (a fill spans the whole extent — nothing to offset).
- Consumer: `errorBox`'s OK button sits one cell above the bottom → `{ v:'end', vOffset:1, … }`
  (the TV-dialog review, GH #115).

### Dev-warn on orphaned taggers (R5/S3, AR-5)

`place()`/`centered()`/`topRight()`/… tag a `WeakMap` that only `stack()` consumes. When a tagged
view is never adopted by a `stack()`, the tag silently does nothing today. Add a **development-only**
warning, routed through the shared `devWarn` helper (`shared/warnings.ts`) — the single sanctioned
`console.*` sink for the non-reactive subsystems, which owns the `NODE_ENV` guard and the
`[jsvision/ui <scope>]` prefix:

```ts
import { devWarn } from '../../shared/warnings.js';

/** Views a stack() has adopted — WeakSet (like `placements`), so it never retains a view. */
const adoptedByStack = new WeakSet<View>();

// in the placement taggers, after setting the tag:
queueMicrotask(() => {
  if (placements.has(view) && !adoptedByStack.has(view)) {
    devWarn('layout', 'place()/centered() on a view not added to a stack() has no effect — ' +
                      'use cover()/center()/at() for a standalone view.');
  }
});
```

- `stack()` records adoption (`adoptedByStack.add(layer)`) as it wires each layer; the microtask
  runs after synchronous composition, so a normal `stack(place(v,…))` never warns.
- **No throw, no production cost** — `devWarn` is silent under `NODE_ENV=production` (and
  tree-shakeably cheap), and `queueMicrotask` is a one-shot check. This is a guidance warning, not a
  behavior change.
- `adoptedByStack` is a **`WeakSet`** (mirroring the existing `placements` `WeakMap`) so it never
  keeps a view alive.

## Integration Points
- Both changes live in `dsl/stack.ts`. `Placement` is exported from there via `dsl/index.ts` (as
  today). No engine change — `layerRect` output already feeds the same absolute-rect path.

## Code Examples

```ts
import { stack, place } from '@jsvision/ui';

// A button pinned one cell above the bottom edge, horizontally centered.
stack(canvas, place(ok, { h: 'center', v: 'end', vOffset: 1, width: 10, height: 2 }));
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Offset pushes the box out of the content box | clamped to `[0, extent-size]` in `layerRect` — never negative, never overflowing | AR-6 |
| Offset on a `'fill'` axis | ignored (fill spans the whole extent) | AR-6 |
| Orphan-tagger warning fires in a test/headless env | guarded by `NODE_ENV !== 'production'`; tests that intentionally tag-without-stack can set the env or assert the warning | AR-5 |

> **Traceability:** references AR-5, AR-6. See `00-ambiguity-register.md`.

## Testing Requirements
- Spec: a `vOffset` shifts the resolved y and clamps at the edge; a `'fill'` axis ignores the
  offset; an orphaned `place()` warns while a `stack()`-adopted one does not. See ST-13…ST-15 in `07`.
