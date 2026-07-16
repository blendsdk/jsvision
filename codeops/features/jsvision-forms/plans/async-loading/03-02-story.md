# 03-02 — Kitchen-sink Load Story

> **Document**: 03-02-story.md
> **Parent**: [Index](00-index.md)
> **Covers**: the `forms/load` showcase story + its smoke oracle (AR-53 / AR-PL5 / RD-07 AC #13).

## Goal

A live "edit an existing record" demo: a form that **loads** a simulated record, shows the
`loading()` swap, then demonstrates **load → edit → `dirty()` → `reset()`-to-loaded**. It mirrors
`forms-async.story.ts` in structure (a `Group` of absolutely-positioned children within
`ctx.width × ctx.height`; the shell owns all chrome). New file
`packages/examples/kitchen-sink/stories/forms-load.story.ts`, registered with one import + one entry
in `stories/index.ts`.

## Story metadata

```ts
export const formsLoadStory: Story = {
  id: 'forms/load',
  category: 'Forms',
  title: 'Async loading + baseline rebase',
  rd: 'RD-07',
  blurb: 'form.load(loader): a simulated fetch, the Loading… swap, then load → edit → dirty → reset-to-loaded.',
  build(ctx) { /* … */ },
};
```

## Behaviour to demonstrate

- **A simulated fetch.** A `loadRecord(signal)` helper resolves a raw record after a short
  `sleep(ms, signal)` (the abortable helper from `forms-async.story.ts:21`, reused/copied) — no
  network, works on any TTY.
- **The `loading()` swap.** A `Show`-style swap (or a `Text` that reads `form.loading()`) paints
  `Loading…` while in flight and the fields once loaded. A "Load record" `Button`
  (`disabled: () => form.loading()`) triggers `void form.load(loadRecord)`.
- **load → edit → dirty → reset.** After load, a live echo shows `dirty: <bool>`; editing a bound
  `Input` flips it `true`; a "Reset" `Button` calls `form.reset()` and the field returns to the
  **loaded** value (not the blank `initial`). A `loaded · dirty` state echo makes the rebase visible.
- **Interaction hint.** An always-painted hint line (as in the async story) that also guarantees the
  literal demonstration strings paint under a headless mount for the smoke oracle.

The story only reads the public surface (`load`, `loading`, `field().value`, `dirty`, `reset`,
`bindField`) — no store internals, no desktop/host access.

## Smoke oracle — ST-LS1 (in `kitchen-sink.smoke.spec.test.ts`)

Mirrors ST-AS1: build + mount `forms/load` headlessly and assert the buffer contains a stable marker
string the story always paints (e.g. the hint line, or the `Load record` label). The generic smoke
loop already checks unique id + required metadata + "paints something"; ST-LS1 pins the specific
story is present and renders. No TTY needed.

## Notes

- The story `build` runs in a fresh scope the shell owns; the simulated `load` is fire-and-forget
  (`void form.load(...)`). Because a story is not `dispose()`d mid-run by the smoke test, keep the
  simulated fetch short and abort-safe (the `sleep` helper rejects on abort).
- Styling reuses shipped roles (a muted `Text` for `Loading…`, the default button chrome) — no core
  change (RD-07 layering).
