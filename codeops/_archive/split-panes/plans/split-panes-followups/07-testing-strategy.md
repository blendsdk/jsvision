# Testing Strategy

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **Verify**: `CI=1 yarn verify` *(AR-9)*

Specification-first: the `*.spec.test.ts` cases below are the immutable oracles (a failing spec test
means the implementation is wrong). They are qualified `(followups)` to distinguish them from the
parent `split-panes` plan's `ST-1…ST-31` in the same package. New files only — the shipped
`split.spec.test.ts` oracle is not touched (AR-11).

## Test files

| File | Kind | Package |
|------|------|---------|
| `packages/ui/test/split-grabmark.spec.test.ts` | spec (oracle) | ui — item 1 |
| `packages/ui/test/split-grabmark.impl.test.ts` | impl | ui — item 1 |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` | spec (append ST-5) | examples — item 2 |
| `packages/examples/test/split-story.impl.test.ts` | impl | examples — item 1 story wiring |

Item 3 (amiga-clock) has **no** test — typecheck + manual only (AR-8).

## Grab-mark detection helper

**Reuse the shipped `makeSplit` mount harness** (`split.spec.test.ts:67-81`): `createEventLoop` +
`loop.mount(root)`, and — the load-bearing detail — give the split an explicit rect
(`split.layout = { position: 'absolute', rect: { x: 0, y: 0, width, height } }`) so it fills the
viewport. A root view mounted with no rect (or `position:'fill'`) collapses to `{0,0}` and paints
nothing, so a bare `new SplitView(...)` would show no `▓` even when the code is correct. The reactive
flip (ST-3) repaints via the render root's own `createRoot` scope — no extra owner wrapper needed.

Then scan the loop's buffer for the grab mark:

```ts
const hasGrabMark = (loop) =>
  loop.renderRoot.buffer().rows().some((row) => row.some((c) => c.char === '▓'));
```

Mount size: 20×8 (row) — a `row` split at 20×8, sized by the rect above, gives two panes + a 1-cell
splitter whose midpoint row `floor(8/2)` paints the `▓`.

## Specification Test Cases

| ID | Requirement | Setup | Input | Expected |
|----|-------------|-------|-------|----------|
| **ST-1 (followups)** | F1 | `new SplitView({ direction:'row', children:[Group,Group], sizes: signal([1,1]) })` (no `grabMark`), mount 20×8, flush | — | `hasGrabMark` is **true** (default `true`) |
| **ST-2 (followups)** | F3 | same, but `grabMark: false` | — | `hasGrabMark` is **false**; a `│` line is still painted |
| **ST-3 (followups)** | F2, F4 | default split mounted (mark present) | `split.grabMark.set(false)` → flush; then `.set(true)` → flush | after `false`: `hasGrabMark` **false**; after `true`: `hasGrabMark` **true** (reactive repaint) |
| **ST-4 (followups)** | F1, F2 | build two: one `grabMark:false`, one omitted | read `.grabMark.peek()` | `false` for the first, `true` for the omitted (seeded from the option) |
| **ST-5 (followups)** | F7–F9 | the `layout/split-scroll` story, built + mounted headlessly (72×16, the smoke harness) | — | registered, `category === 'Layout'`, paints; the painted text matches `/Item 0/` (the `ListBox` rendered inside the pane) |

## Implementation Test Cases (internals/edges)

| ID | Focus | Setup | Expected |
|----|-------|-------|----------|
| **ST-6 (followups)** | col direction | `direction:'col'` split, `grabMark` default then `false` | `▓` present (at `floor(width/2)`, row 0 of the `─` splitter) then absent |
| **ST-7 (followups)** | multiple splitters | 3 children ⇒ 2 splitters | `grabMark` true ⇒ ≥ 2 `▓` cells; `false` ⇒ 0 |
| **ST-8 (followups)** | story `g` wiring (F5) | build `splitStory.build(ctx)`; collect `SplitView` instances in the subtree; record each `grabMark.peek()` | calling the root's `onEvent` with a synthetic `{ event:{ type:'key', key:'g' }, handled:false }` flips every collected `grabMark`; a second call flips them back; `ev.handled` is set |

## Red/green expectations

- **ST-1** may pass *before* implementation (today's default already paints `▓`) — it locks the
  default. **ST-2, ST-3, ST-4** are genuinely red until the option + signal + gating land (today
  there is no `grabMark` field to set, so they fail to compile / assert). **ST-5** is red until the
  new story exists. **ST-8** is red until the `g` handler is wired.

## Verification per phase

Each phase ends green under `CI=1 yarn verify` (lint → prettier → turbo typecheck/build/test/
check:docs → check-plugin). After item 1, also:

- `scripts/check-jsdoc.mjs` green **and** a plain `grep` for banned CodeOps IDs across the changed
  `packages/ui/src/split/**` (the scanner has a known coverage gap — verify banned refs with grep,
  not `check:docs` alone).
- `yarn plugin:sync --fix` run and the regenerated API reference committed, so `check-plugin` passes.
- `yarn check:deps` green (no native deps; `@jsvision/core` untouched).
