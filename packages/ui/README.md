# @jsvision/ui

The **retro-desktop widget framework** of [jsvision](https://github.com/blendsdk/jsvision) — a **retained widget tree** with **fine-grained signal reactivity** (the "disciplined hybrid" model), built on the [`@jsvision/core`](https://www.npmjs.com/package/@jsvision/core) engine.

> **Status: pre-release (0.x).** The framework spans the reactive core, the layout engine, the view/group spine, the event loop, the app shell, and ~40 controls (windows, menus, dialogs, lists, tables, tabs, trees, and more). The public API may still change before 1.0 — pin an exact version.

## Public entry point

Everything is re-exported from the single entry point (`src/index.ts`):

```ts
import { VERSION } from '@jsvision/ui';
```
