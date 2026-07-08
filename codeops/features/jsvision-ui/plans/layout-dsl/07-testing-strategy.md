# Testing Strategy — layout-dsl

> **Feature**: jsvision-ui · **Plan**: layout-dsl
> Tests live in `packages/ui/test/` only. `*.spec.test.ts` = immutable oracles (runtime/behavioral —
> the UI tsconfig excludes `test/` and vitest does not type-check, AR-10). Real `View`/`RenderRoot`
> over fixed caps; read `view.bounds` after a `flush()` / read the composed buffer.

## Test files

- `layout.fill.spec.test.ts` / `.impl.test.ts` — the engine `position:'fill'` mode.
- `layout-dsl.spec.test.ts` / `.impl.test.ts` — builders (col/row/grow/fixed/fill/spacer).
- `layout-dsl-stack.spec.test.ts` / `.impl.test.ts` — stack + placement overlays.
- `layout-dsl.packaging.spec.test.ts` — exports + banned-ID grep.
- Kitchen-sink: a `layout/dsl` story covered by the existing `kitchen-sink.smoke.spec.test.ts`.

## Specification test cases (immutable oracles)

### Engine `fill` (→ 03-02, FR-7/8)

- **ST-1** — A `position:'fill'` child of a container with `padding:2`, viewport `20×10`, gets
  `bounds = { x:2, y:2, width:16, height:6 }` (the content box). (AR-1, AR-8)
- **ST-2** — A `fill` child reserves no flow space: in `row` with one flow child `grow` + one `fill`
  child, the flow child fills the whole content width (identical to the fill child being absent). (AR-8)
- **ST-3** — A `fill` child is excluded from intrinsic size: an `auto` container with a `fixed:5` flow
  child and a `fill` child measures its main extent to `5` (flow only). (AR-8)
- **ST-4** — `fill` ignores `justify`/`align`: in a container with `justify:'center'`, a `fill` child
  still originates at the content-box origin and fills it. (AR-13)
- **ST-5** — Two `fill` children resolve to the same content-box rect (they overlap). (AR-9)

### Builders (→ 03-01, FR-1…FR-4)

- **ST-6** — `col(a, b)` → a `Group` with `layout.direction === 'col'`, `children === [a, b]`
  (order preserved). `row(a)` → `direction === 'row'`. (FR-1)
- **ST-7** — `grow(v, 2)` sets `v.layout.size` to `{kind:'fr',weight:2}`; `grow(v)` (default) →
  `{kind:'fr',weight:1}`; `fixed(v, 7)` → `{kind:'fixed',cells:7}`; each returns `v`. (FR-2)
- **ST-8** — `col({ fixed: 20 })` sets the group's own `size` to `fixed:20`; `col({ grow: 3 })` →
  `fr:3`; `col({ fill: true })` → `fr:1`; `col({ size:{kind:'fixed',cells:9}, grow: 5 })` keeps
  `fixed:9` (explicit `size` wins). (FR-3, AR-6)
- **ST-9** — `col({ background: 'desktop' })` sets `group.background === 'desktop'`. (FR-3)
- **ST-10** — In `row` at width 30 with `[ fixed(A,6), spacer(), fixed(B,6) ]`, `B.bounds.x === 24`
  (spacer pushes B to the right edge); `spacer({ fixed: 4 })` between them instead makes the gap
  exactly 4 cells. (FR-4)

### Stack + placement (→ 03-01, FR-5/6/8)

- **ST-11** — `stack(base)` at `40×12`: `base` (untagged fill) gets `bounds` = the stack content box
  `{0,0,40,12}`. (FR-5)
- **ST-12** — `centered(box, 20, 6)` in a `40×12` stack: `box.bounds` is centered
  (`x===10, y===3`); after `resize(30×10)` it is re-centered (`x===5, y===2`) in a **single** flush
  (lag-free — no settle loop). (FR-8, AR-9)
- **ST-13** — `topRight(badge, 4, 1)` in a `40×12` stack: after settling, `badge.bounds.x === 36,
  y === 0`; after `resize(30×12)` it re-pins to `x === 26` (settle loop permitted). **Convergence:**
  once settled, a further `flush()` with no size change produces **no** bounds change and schedules
  **no** further reflow (the change-gated corner recompute — the loop terminates). (FR-6, AR-2)
- **ST-14** — A `stack` fill layer is correct after **one** flush following a resize (distinguishes
  the lag-free fill path from the self-correcting corner path). (FR-8)

### Resize correctness (→ FR-9)

- **ST-15** — `col([ fixed(sidebar,20), grow(main) ])` at `60×16`: `main.bounds.width === 40`. After
  `resize(40×16)`: `main.bounds.width === 20`. After mutating `sidebar` to `fixed:10` +
  `invalidateLayout()`: `main.bounds.width === 30` (re-solves on a parent-container change, no
  viewport event). (FR-9)

### Packaging / docs (→ FR-10/11)

- **ST-16** — The package barrel (`src/index.ts`) re-exports `col`, `row`, `stack`, `grow`, `fixed`,
  `spacer`, `place`, `centered`, `topRight`, `bottomRight`, `topLeft`, `Flex`, `Placement` (and does
  **not** export a standalone `fill`); and `packages/ui/src/view/dsl.ts` contains **no** banned
  CodeOps/TV IDs (grep). (FR-10)
- **ST-17** — The `layout/dsl` kitchen-sink story mounts headlessly, paints a non-empty frame, has a
  unique id + required metadata (covered by `kitchen-sink.smoke.spec.test.ts`). (FR-11)

## Implementation tests (edge cases, written after green)

Fill with zero-size content box (padding ≥ size → `{…,0,0}`, no throw); `spacer(0)`; a stack with
only absolute layers (no flow) sizes by its own `fr`; `place` overriding a re-tagged view; corner
layer clamped when `width > stack width`; the `Flex` precedence matrix; a `fill` inside a `fill`
(nested overlays).

## Verification

`yarn verify` runs the whole gate in one command — `yarn lint && turbo run typecheck build test
check:docs` (eslint + prettier, per-package `tsc --noEmit`, build, vitest engine/builder/packaging
suites, and the `@example`/banned-ID check). No separate manual steps. The existing `layout.*`,
`view.*`, and `kitchen-sink.smoke` suites must stay green (the engine `fill` change is additive).
