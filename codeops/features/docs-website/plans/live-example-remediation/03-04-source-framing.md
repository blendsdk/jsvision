# 03-04 — Workstream D: Source framing (build()-first)

> Bug #2 · AR-4, AR-9 · Phase 4 (AR-7 order).

## Problem

Each example page embeds the whole module via `<<< @/examples/…`, which leads with a large JSDoc
header + imports + data before `build()`. Reproduced live: a reader scrolls through a JSDoc block,
three import lines, an `interface`, a 12-row array, and an `at()` helper before reaching the
composition — "can't make heads or tails of what it's showing."

## Design (AR-4)

Show the **composition body by default**, with the **full module behind a toggle**.

### Region markers in each example module

Add a VS Code region around the composition body — from just after the imports to EOF — in every
example module (`packages/docs-site/examples/**/*.ts`):
```
import { … } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
// #region example
interface Person { … }        // (data/helpers that build() needs stay in the region — coherent)
export default defineExample({ title, blurb, build: (ctx) => { … } });
// #endregion example
```
The region drops only the top JSDoc header + the import lines (the noise the user flagged) and keeps
a coherent, runnable-looking body. The region is extracted by VitePress from the **real compiled
module**, so it is still exactly the running code — a subset, not a paraphrase (AR-9).

### Page change (each `components/**/*.md` + `apps/desktop.md`)

Replace the single whole-file embed with:
```
## Source

The composition running above — the exact `build()` from the module:

<<< @/examples/<cat>/<name>.ts#example{ts}

::: details Full module (imports, JSDoc, data)
<<< @/examples/<cat>/<name>.ts
:::
```
The `#example` region embed is the default view; the full module (incl. JSDoc + imports) sits in a
collapsible `::: details` block. **Build-time verification point:** confirm the VitePress snippet
plugin processes `<<<` inside a `::: details` container in the built output; if it does not, fall
back to a `### Full module` sub-section with the full `<<<` below the fold (still directive-based).
The `check-docs-build.mjs` gate asserts the built HTML actually contains both snippets.

## Drift oracle update (AR-9 — supersedes RD-03's whole-file-only convention)

RD-03's snippet-drift test (`test/*` ST-3) asserted a whole-file `<<<` + no pasted `defineExample(`
block. Update it to assert, for every example page:
- the `#example` region embed via `<<< @/<sourcePath>#example` is present, AND
- the full-file embed via `<<< @/<sourcePath>` is present (the details block),
- and still **no pasted `defineExample(` inside a fenced ts block** (no drift-prone copies).

Add a module test asserting every example module contains a matching `// #region example` /
`// #endregion example` pair (so the region embed always resolves — a missing region would silently
embed nothing).

`packages/docs-site/scripts/check-docs-build.mjs` — its LIVE-EXAMPLES guard (source embed +
`<PlayExample>` mount) is extended to require both the region embed and the full-module details in
the built output.

## Coverage

Deterministic: the updated drift oracle + the region-pair module test (both headless, in
`yarn verify`). The rendered look (default shows build(), details collapses the full module) is a
one-line item on the manual checklist (07 §Manual).
