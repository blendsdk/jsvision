# Requirements — layout-dsl

> **Feature**: jsvision-ui · **Plan**: layout-dsl
> **Source**: [DX-ASSESSMENT.md](../../../../../DX-ASSESSMENT.md) Proposal 8 + dimensions 11 & 14

## Problem

Composition is fully imperative: `new X()`, `parent.add(child)`, then mutate `.layout`
(DX-ASSESSMENT §A). `{ size: { kind: 'fr', weight: 1 } }` is spelled out 38× across the repo, and
overlay/window placement is raw pixel math. There is no declarative authoring path.

## Functional requirements

- **FR-1 — Linear containers.** `col(props?, …children)` and `row(props?, …children)` build a
  `Group` with `direction` set and children added, in one expression. First-arg may be omitted when
  it is a child (variadic children only). (AR-12)
- **FR-2 — Size shorthands.** `grow(view, n = 1)` → `size:{kind:'fr',weight:n}`; `fixed(view, n)` →
  `size:{kind:'fixed',cells:n}`. Each mutates `view.layout` and returns the view for chaining. (No
  standalone `fill(view)` helper — `grow(view)` covers it, and `fill` as a bare verb collides with
  the engine `position:'fill'` overlay mode; `fill` survives only as a container prop, FR-3. AR-12)
- **FR-3 — Shorthand props.** Container props accept `{ grow, fixed, fill, background, …LayoutProps }`;
  `grow`/`fixed`/`fill` normalize to the `size` token, `background` sets the group's background role.
  An explicit `size` wins over the shorthands. (AR-6)
- **FR-4 — Spacer.** `spacer(weight = 1)` is a flexible empty view; `spacer({ fixed: n })` is a hard
  n-cell gap. (AR-7)
- **FR-5 — Overlay container.** `stack(props?, …layers)` builds a z-overlay: layers share one box,
  painted back-to-front. A bare (untagged) layer fills; tagged layers are placed. Defaults to filling
  its own parent. (AR-9)
- **FR-6 — Placement helpers.** `place(view, placement)` tags an overlay layer; `centered(view, w, h)`,
  `topRight(view, w, h)`, `bottomRight(view, w, h)`, `topLeft(view, w, h)` are conveniences over it.
  Placement is `{ h?, v?: 'fill'|'start'|'center'|'end'; width?; height? }`. (AR-3, AR-12)
- **FR-7 — Engine `fill` mode.** Add `position: 'fill'` to the layout engine: the child receives the
  parent's full content box, overlaps siblings, reserves no flow space, is excluded from the parent's
  intrinsic size, and recurses into its subtree at that size. (AR-1, AR-8, AR-13)
- **FR-8 — Lag-free overlays.** In `stack()`, fill layers use `position:'fill'` (lag-free, multiple
  fills overlap); centered fixed boxes use `position:'absolute'` + the existing `View.centered`
  re-centering (lag-free); corner/edge layers use `position:'absolute'` self-corrected on draw (a
  documented one-frame settle). (AR-2, AR-9)
- **FR-9 — Resize correctness.** The whole DSL output re-solves on viewport resize *and* on a
  parent-container resize (a dragged/zoomed window), with no per-container resize code. (Verified: the
  reflow re-solves from the live tree — see 02-current-state.)
- **FR-10 — Docs + exports.** Every public export carries a consumer lead sentence + `@example`
  (check-jsdoc enforced); explicit named re-exports from `view/index.ts` → `src/index.ts`;
  NodeNext `.js` specifiers. (AR-5, AR-10)
- **FR-11 — Kitchen-sink.** One `layout/dsl` story showcasing `col`/`row`/`stack`/`grow`/`fixed`/
  `spacer` + the headless smoke test. (AR-11)

## Out of scope

- Migrating the 38 existing `fr`-token call sites (AR-4) — a separate follow-up.
- Edge/corner *lag-free* anchoring in the engine (only `fill` is added now; corners self-correct).
- A JSX/pragma layer or a general render-function/component model (a larger, separate direction).
- Grid layout, `wrap`, or any new flex capability beyond what the engine already offers.

## Success criteria

`yarn verify` + `yarn lint` green; every FR met with a passing spec oracle; the engine `fill` oracle
passes; the kitchen-sink story renders + smoke-passes; `check:docs` clean; zero changes to existing
public API behavior.
