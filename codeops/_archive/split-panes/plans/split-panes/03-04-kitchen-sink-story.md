# Kitchen-Sink Story

> **Document**: 03-04-kitchen-sink-story.md
> **Parent**: [Index](00-index.md)
> **Governs**: `packages/examples/kitchen-sink/stories/split.story.ts` · `stories/index.ts` · `packages/examples/test/kitchen-sink.smoke.spec.test.ts`

## Overview

The showcase story is **non-negotiable** — per the repo's kitchen-sink gate
(`codeops/kitchen-sink-gate.md` + CLAUDE.md), a component is not done until its story exists and
passes the headless smoke test. Split panes is a visual component, so it needs one.

The story contract: add ONE `stories/split.story.ts` exporting a `Story`, plus one line in
`stories/index.ts`. `build(ctx)` returns a `Group` of children positioned within
`ctx.width × ctx.height`; the shell owns all chrome (menu / status / canvas / navigation). A story
never touches the desktop or host.

## Implementation Details

### Story metadata (AR-19)

```ts
export const splitStory: Story = {
  id: 'layout/split',
  category: 'Layout',
  title: 'Split panes',
  blurb: 'SplitView: resizable panes — drag a divider, or focus it (Tab) and use the arrows.',
  // `rd` is deliberately omitted: the field is optional and this plan implements no RD.
  build(ctx: StoryContext) { /* … */ },
};
```

> **Decision per AR-19:** omit the optional `rd` provenance chip. It exists to cite an RD, and this
> plan has none. Note that the smoke test for `containers/tabs` asserts `story!.rd` is truthy — the
> split story's smoke test must **not** copy that assertion (see below).

### What the story shows

The showcase is the selling point, so the story must earn its place: the live component, a visible
bound-state echo, and interaction hints.

- A **nested** split, demonstrating grids-by-composition (AR-17) in one view: a `row` split whose
  second pane is a `col` split — the canonical explorer / editor / terminal layout.
- Each pane holds a `Text` labelling it, so pane boundaries are legible.
- A live echo of `sizes()` beneath, proving the two-way signal binding (the same device
  `slider.story.ts:49` uses for its `#rrggbb` echo).
- A hint line: drag a divider, or Tab to it and use the arrows.
- A `minSize` set high enough to be demonstrable — dragging to the clamp should visibly pin.

```ts
const outer = signal([1, 2]);
const inner = signal([2, 1]);
// row: [explorer | col: [editor / terminal]]
```

### Registration

Explicit — an import plus an array entry in `stories/index.ts`, whose header states the contract:
adding a component to the showcase = write its `*.story.ts` and add it to that array.

### Smoke test

Add one per-component test to `packages/examples/test/kitchen-sink.smoke.spec.test.ts`, following
the established shape (`:81-93`):

```
find STORIES by id 'layout/split'  → registered
assert category === 'Layout'
createRoot → build({ caps, width: 72, height: 16 }) → at(...) → createRenderRoot().mount(view)
assert paintedCells(rr.buffer().rows()) > 0
dispose()
```

**Do not assert `story.rd`** — that assertion is specific to stories that declare a chip, and this
one deliberately does not (AR-19).

The two global tests (registry metadata `:49-57`, unique ids `:59-62`) cover the story
automatically once it is registered.

### `execView` degradation

`StoryContext.execView` is **`undefined` in the headless smoke test**. This story hosts no modal, so
the constraint is satisfied trivially — but do not introduce one.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Story built at a small `ctx.width`/`ctx.height` | Panes clamp at `minSize`; the engine squeezes proportionally rather than overflowing, so the story never paints outside its box | AR-8 |
| Duplicate story id | Caught by the existing global uniqueness test (`:59-62`) | — |

## Testing Requirements

- ST-26 (07-testing-strategy.md): registered, correct id/category, paints ≥1 non-blank cell headlessly.
- No TTY required — the smoke test is the mechanical "the story exists and renders" check.
</content>
