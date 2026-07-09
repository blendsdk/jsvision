# 03-01 — Example Contract & Registry

Owner of: the `defineExample` contract, the hand-authored registry, the parity + snippet-drift tests.

## The contract (AR-14)

```ts
// packages/docs-site/examples/_contract.ts
import type { Application, View } from '@jsvision/ui';

/** What an example's build() receives. */
export interface ExampleContext {
  readonly width: number;
  readonly height: number;
}

/** An example is placement-agnostic: it knows its title/blurb and how to build itself. */
export interface ExampleDefinition {
  readonly title: string;
  readonly blurb: string;
  /** Compose the demo. Returns an Application (full app) or a bare View (single component). */
  build(ctx: ExampleContext): Application | View;
}

/** Identity helper — returns its argument, giving inference + a single documented shape. */
export function defineExample(def: ExampleDefinition): ExampleDefinition {
  return def;
}
```

- The module's **default export** is a `defineExample({...})`. It composes with `@jsvision/ui` and is
  **SSR/headless-safe**: no `@xterm/*` import and no DOM globals (`document`/`window`) — that is the
  Play component's job. The one sanctioned cross-package exception is `@jsvision/web`'s **pure**
  in-memory `createBrowserFileSystem` (zero `node:`/DOM, runs headlessly), used by `files/file-dialog`
  to seed a virtual tree; the impure `@jsvision/web` host surface (`createBrowserHost`/`mountApp`/
  `attachKeyReclaim`/`setClipboard`) stays out of example modules.
- `build(ctx)` may return a `View` (single-component demo) or an `Application` (a full app). DemoShell
  (03-02) normalizes both into the `Application` that `mountApp` needs.

## The registry (AR-5)

```ts
// packages/docs-site/examples/index.ts  (hand-authored — one entry per example)
export interface ExampleEntry {
  readonly id: string;          // 'controls/button' — unique; also the deep-link key + menu id
  readonly category: string;    // 'controls'
  readonly chrome: 'minimal' | 'full';   // which DemoShell mode (AR-7)
  readonly sourcePath: string;  // 'examples/controls/button.ts' — for the <<< embed + parity test
  load(): Promise<{ default: import('./_contract.js').ExampleDefinition }>; // lazy import (code-split)
}

export const EXAMPLES: readonly ExampleEntry[] = [
  { id: 'controls/button', category: 'controls', chrome: 'minimal',
    sourcePath: 'examples/controls/button.ts', load: () => import('./controls/button.js') },
  // …one line per example (AR-20 list) …
];
```

- `id` is unique and stable (deep-link + menu command name). `load()` is a dynamic import so each
  example is a separate chunk (never in the initial page bundle — supports AR-10 client-only + perf).
- The registry is the single source of `id`/`category`/`chrome`/`sourcePath`; the module owns only
  `title`/`blurb`/`build` (AR-14).

## Parity test (AR-5) — no orphan example files

- Enumerate `examples/**/*.ts` (excluding `_contract.ts` and `index.ts`); assert each has exactly one
  `EXAMPLES` entry whose `sourcePath` matches, and vice-versa (no registry entry without a file).
- Assert every entry: unique `id`, non-empty `title`/`blurb` (metadata hygiene, AC-6). → ST-1.

## Snippet embed & drift (AR-6) — whole-file convention

- **Convention (enforced):** every example page embeds its source with a **whole-file** VitePress
  region import — `<<< @/examples/<category>/<name>.ts` — **no line-ranges, no `#region` markers**.
  Because the whole file is embedded, the shown block is provably the entire running module; the light
  check below is then sufficient (no bounds can drift).
- **Directive-check test:** for every `EXAMPLES` entry, assert the corresponding page contains the exact
  `<<< @/<sourcePath>` directive and that `<sourcePath>` resolves to a real file; assert **no** example
  page contains a hand-pasted fenced code block duplicating example source (guards against a copy
  slipping in). → ST-3.
- **Deferral:** if an example ever needs a region marker, add a rendered-vs-source byte-compare for
  those pages only (see the register's deferrals). Not needed for the 8 seed examples.

## Files

```
packages/docs-site/examples/
  _contract.ts            defineExample + types
  index.ts                EXAMPLES registry (hand-authored)
  controls/button.ts      … (03-05)
  …
```

## Tests (see 07)
- ST-1 registry parity + metadata hygiene.
- ST-3 snippet directive + whole-file + no-pasted-block.
