# Kitchen-Sink Showcase Gate — jsvision-ui

> **Status**: Standing convention (project-authored, not a CodeOps skill artifact)
> **Applies to**: every user-facing `@jsvision/ui` component or capability.
> **Canonical law**: the `## Kitchen-sink showcase (NON-NEGOTIABLE)` section of the repo `CLAUDE.md`
> points here; this doc holds the operational detail + the copy-paste plan checklist.

## The principle

We have enough of the framework (RD-01…RD-06 + app shell) to run a full interactive app, so from now
on **every component we implement ships with a live demo** in one growing showcase — a
**Storybook-for-TUI**. It is our live selling point, so it must be **extendable** (adding a demo is
one file) and have **good UX**. Bottom line: **a component is not "done" until its kitchen-sink story
exists and passes the headless smoke test.**

Location: `packages/examples/kitchen-sink/`. Run it: `yarn workspace @jsvision/examples demo:kitchen`.

## Architecture (so the enforcement makes sense)

- **`story.ts`** — the `Story` contract: `{ id, category, title, blurb, rd?, build(ctx) }`.
  `build(ctx)` returns a `Group` whose children are positioned **absolutely** within
  `ctx.width × ctx.height`. Shared helpers: `at(view, x, y, w, h)` and `firstFocusable(view)`.
- **`stories/<x>.story.ts`** — one file per component, exporting its `Story`. **`stories/index.ts`**
  aggregates them into `STORIES` (explicit array, no import side-effects).
- **`shell.ts`** — the **Navigator seam**: builds the `createApplication` desktop, a menu bar
  generated from the registry (categories → stories), a full-screen grey `StoryWindow` canvas that
  swaps to the selected story, and navigation (menu / clickable status items / `Ctrl`+arrows). This
  is the ONLY file that changes when RD-11's `ListView`/`ScrollBar` upgrade the navigator to a
  persistent sidebar — stories stay untouched.
- **`window.ts`** — the grey `StoryWindow` canvas (faithful `TDialog`-style `TFrame`) + `CommandSink`.
- **`main.ts`** — TTY-guarded lifecycle (`demo:kitchen`).
- **`test/kitchen-sink.smoke.spec.test.ts`** — the CI guard: mounts every story headlessly and
  asserts it paints, ids are unique, and metadata is present.

## The story contract (what "add a demo" means)

Adding a component to the showcase = **two edits**:

1. Write `kitchen-sink/stories/<x>.story.ts`:
   ```ts
   import { Group, /* the component */, Text, signal } from '@jsvision/ui';
   import { at } from '../story.js';
   import type { Story, StoryContext } from '../story.js';

   export const xStory: Story = {
     id: 'category/x', category: 'Category', title: 'X', rd: 'RD-NN',
     blurb: 'One line: what this component is / demonstrates.',
     build(ctx: StoryContext) {
       const g = new Group();
       // the live component + a bound-state echo (reactive Text) + interaction hints,
       // all placed with at(view, x, y, width, height) within ctx.width × ctx.height.
       return g;
     },
   };
   ```
2. Register it in `kitchen-sink/stories/index.ts` (import + add to the `STORIES` array, in nav order).

That is the whole extensibility contract — no shell edits, no chrome, no host wiring.

## UX bar (it is the selling point)

- A one-line **blurb** (shown above the canvas), the **live component**, a visible **bound-state
  echo** where it has state, and **interaction hints** (keys / mouse).
- **No clipped text** (size info lines to `ctx.width`), **faithful TV colors**, **keyboard + mouse**
  both working. Focus the first control on open (the shell does this via `firstFocusable`).

## Plan-flow integration (make_plan / exec_plan)

**make_plan**, for every user-facing component, add this task to the plan's `99-execution-plan.md`:

```markdown
- [ ] **Kitchen-sink story for `<X>`** — add `kitchen-sink/stories/<x>.story.ts` (blurb + live
      component + bound-state echo + interaction hints, sized to `ctx.width`) and register it in
      `stories/index.ts`; verify it renders (headless) and passes `test/kitchen-sink.smoke.spec.test.ts`.
```

**exec_plan**:
- Do NOT mark the component's plan `[x]` until its story is registered and the smoke test passes.
- Keep the showcase polished — a clipped/broken story is a failing gate, not a cosmetic nit.

## Scope

- **Visual components** (buttons, inputs, lists, dialogs, menus, …) — a story is **mandatory**.
- **Non-visual capabilities** (reactivity, capability detection, color downsampling, layout math) —
  a story **when it is meaningful to show** (e.g. a reactive-counter demo, a color-depth swatch grid).
