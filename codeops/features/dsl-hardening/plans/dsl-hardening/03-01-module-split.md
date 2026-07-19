# Module Split: DSL Hardening

> **Document**: 03-01-module-split.md
> **Parent**: [Index](00-index.md)

## Overview

Refactor the single 442-line `packages/ui/src/view/dsl.ts` into a `dsl/` folder so the S1–S7
additions land in cohesive, sub-500-line modules while the public API stays byte-identical (R8, AR-8).
This is a **pure mechanical move** — no behavior change — done first so later phases edit small files.

## Architecture

### Current Architecture
`view/dsl.ts` holds: `Flex` type · `toLayout`/`container` (private) · `col`/`row`/`grow`/`fixed`/
`spacer` · the `Empty` spacer class · `Placement`/`PlaceAxis` · placement helpers (`place`/`centered`/
`topRight`/`bottomRight`/`topLeft`) · `layerRect`/`isFillAxis`/`resolvePadding` · the `Stack` class ·
`stack`. `view/index.ts` re-exports the public names from `./dsl.js`.

### Proposed Changes
```
packages/ui/src/view/dsl/
  flex.ts      Flex type, toLayout, container, col, row, grow, fixed, spacer, Empty
  stack.ts     Placement, PlaceAxis, placements WeakMap, isFillAxis, layerRect, resolvePadding,
               Stack, stack, place, centered, topRight, bottomRight, topLeft
  absolute.ts  (new) at, cover, center           ← added in 03-03
  index.ts     re-export every public symbol (col/row/grow/fixed/spacer/stack/place/centered/
               topRight/bottomRight/topLeft + at/cover/center) and the Flex/Placement types
```
`view/index.ts` changes its single DSL re-export path from `./dsl.js` to `./dsl/index.js`; the
**names it re-exports are unchanged**. `packages/ui/src/index.ts` likewise re-exports from
`./view/index.js` — only the new names `at`/`cover`/`center` are appended (in 03-03).

## Implementation Details

### Integration Points
- NodeNext import specifiers keep the `.js` extension (e.g. `from './flex.js'`).
- `flex.ts` and `absolute.ts` import `View`/`Group` from `../view.js`/`../group.js` (one `..` deeper).
- `stack.ts` imports `DrawContext`/`ThemeRoleName` types and the layout types as today, adjusted `..`.
- No symbol is renamed; `container`/`toLayout`/`layerRect`/`Empty`/`Stack` stay **module-private**
  (not exported from `index.ts`) exactly as they are non-exported today.

## Code Examples

### Example: barrel re-export (view/dsl/index.ts)
```ts
export { col, row, grow, fixed, spacer } from './flex.js';
export type { Flex } from './flex.js';
export { stack, place, centered, topRight, bottomRight, topLeft } from './stack.js';
export type { Placement } from './stack.js';
export { at, cover, center } from './absolute.js';
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A deep import (`from '.../view/dsl.js'`) exists somewhere and breaks | Grep the monorepo for `view/dsl` deep imports before deleting the old file; there should be none (only the barrel re-exports it). Keep the split name-preserving. | AR-8 |

> **Traceability:** design choice references AR-8. See `00-ambiguity-register.md`.

## Testing Requirements
- No new spec cases: the existing `layout-dsl*.spec.test.ts`, `layout-dsl.packaging.spec.test.ts`,
  `layout-dsl-stack.*` and `view.*` suites are the immutable oracle — they must pass **unchanged**
  before and after the split (the red/green of a refactor phase). Covered by ST-REF in `07`.
