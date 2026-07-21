# Component: the `view/dsl` builders

> **Feature**: jsvision-ui · **Plan**: layout-dsl · Implements FR-1…FR-6, FR-8, FR-10 · AR-5…AR-13
> **File**: `packages/ui/src/view/dsl.ts` (single file; split only if it nears 500 lines — AR-5)

Sugar over `Group`/`View`/`view.layout`. It builds view instances, so it lives in the **view** layer
(which already depends on `layout/`), not in `layout/` — see AR-5 for the layering rationale. No new
engine surface beyond the `fill` mode (03-02, which stays in `layout/`). Barrel: explicit named
re-exports `view/dsl.ts` → `view/index.ts` → `src/index.ts`. Import `View`/`Group`/`ThemeRoleName`
from the sibling view modules (`./view.js`, `./group.js`, `./types.js`).

## Public surface (AR-12)

Values: `col`, `row`, `stack`, `grow`, `fixed`, `spacer`, `place`, `centered`, `topRight`,
`bottomRight`, `topLeft`. Types: `Flex`, `Placement`. Internal (not exported): `toLayout`, the
`Stack` subclass, the placement `WeakMap`. No standalone `fill(view)` helper (it duplicated
`grow(view)` and collided with the engine `position:'fill'` mode — AR-12); `fill` remains a `Flex`
prop key only.

## `Flex` + `toLayout` (FR-3, AR-6)

```
type Flex = Omit<LayoutProps, 'direction'> & {
  grow?: number; fixed?: number; fill?: boolean; background?: ThemeRoleName;
};
```

`toLayout(f, direction?)`: resolves exactly one `size` — explicit `f.size` wins; else `fixed` → else
`grow` → else `fill:true` → `fr:1`; `background` is pulled out (a Group property, not a layout prop);
`direction` merged when given.

## Containers — `col` / `row` (FR-1)

`container(direction, args)`: build a `Group`, set `layout = toLayout(props, direction)`, set
`background` if present, `add` each child. Arg parsing: if `args[0] instanceof View`, all args are
children (no props); else `[props, …children]`.

## Size shorthands — `grow` / `fixed` (FR-2)

Each mutates `view.layout` (spread-merge, preserving other props) and returns the view. `grow(v,n=1)`
→ `fr:n`; `fixed(v,n)` → `fixed:n`. (`grow(v)` with the default `n=1` is the "take a flex share"
shorthand; there is no separate `fill(v)`.)

## `spacer` (FR-4)

Internal `Empty extends View { draw() {} }`. `spacer(weight=1)` → `fr:weight`;
`spacer({ fixed: n })` → `fixed:n`.

## `stack` + placement (FR-5, FR-6, FR-8, AR-9)

`stack(props?, …layers)` builds an internal `Stack extends Group` (default own size `fr:1`;
`background` honored). For each layer, by its `Placement` tag (from `place`/`centered`/corner helpers,
stored in a module `WeakMap`):

- **fills both axes** (untagged, or `h`/`v` both `'fill'`) → `layout.position = 'fill'` (engine
  lag-free; multiple fills overlap).
- **centered fixed box** (`h==='center' && v==='center'` with `width`+`height`) → `position:'absolute'`,
  `rect:{0,0,w,h}`, `view.centered = true` (engine re-centering, lag-free).
- **corner/edge** (any other placement) → `position:'absolute'` with a computed rect, added to the
  `Stack`'s `tracked` set; `Stack.draw` recomputes those rects from its live `bounds` and calls
  `invalidateLayout()` **only when the recomputed rect differs** from the layer's current
  `view.layout.rect` (compare before invalidating). This convergence guard is load-bearing: the rect
  is a deterministic function of the stack's bounds, so once bounds are stable the recompute matches
  and no further reflow is scheduled — it settles in exactly one extra frame and never spins the
  reflow/draw loop. Fill/centered layers are **not** tracked.

> **Centering caveat.** The engine re-centering used for the centered box (`View.centered`) centers
> against the parent's **full** rect, not its content box — a `stack` with `padding` offsets a
> centered layer by the padding. This matches the existing `Dialog` centering behavior; document it
> on `centered`/`stack` and keep `stack` padding at `0` for a true center.

`Placement = { h?, v?: 'fill'|'start'|'center'|'end'; width?; height? }`. `place(view, placement)`
tags + returns; `centered(v,w,h)` = `{h:'center',v:'center',width:w,height:h}`; `topRight(v,w,h)` =
`{h:'end',v:'start',…}`; `bottomRight` = `{h:'end',v:'end'}`; `topLeft` = `{h:'start',v:'start'}`.

`layerRect(p, W, H)`: per axis — `fill`→`[0, extent]`; else `size = min(want, extent)` at
`start`→0 / `center`→`floor((extent-size)/2)` / `end`→`extent-size`.

## Docs (FR-10)

Every exported symbol: a consumer lead sentence, the gotcha (e.g. corner overlays settle one frame;
`fill`/centered do not), `@param`/`@returns`, and a copy-pasteable `@example`. No CodeOps/TV IDs.

## File-size watch

The user-land proof was ~180 lines; with full JSDoc + `@example`s it will grow. Target ≤ 500; if it
exceeds, split placement (`stack`/`place`/corners) into `view/dsl-stack.ts` behind the same barrel.
