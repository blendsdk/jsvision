# @jsvision/ui

The Turbo Vision-style **widget framework** of [jsvision](https://github.com/blendsdk/jsvision) — a **retained widget tree** with **fine-grained signal reactivity** (the "disciplined hybrid" model), built on the [`@jsvision/core`](../tui-core) engine.

> **Status: scaffold.** This package is an empty skeleton wired into the monorepo (build, typecheck, tests, the `@jsvision/core` dependency). Subsystems land here per the component map in [`plans/tui-ui/01-component-map.md`](../../plans/tui-ui/01-component-map.md): the reactive core, the layout engine, the view/group spine, then the widgets. It is marked `private` until the first release.

## Public entry point

Everything is re-exported from the single entry point (`src/index.ts`):

```ts
import { VERSION } from '@jsvision/ui';
```
