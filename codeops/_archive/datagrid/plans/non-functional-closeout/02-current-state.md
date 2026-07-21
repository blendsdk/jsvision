# Current State — non-functional-closeout

> **CodeOps Skills Version**: 3.9.0

All citations verified against the working tree during Zero-Ambiguity gating.

## Reusable core patterns (the templates this plan mirrors)

| Concern | Core file | What it gives us |
|---------|-----------|------------------|
| Emulator harness | `packages/core/test/golden-screen-helpers.ts` | `makeTerm(cols,rows)` (`:34`), `feed(term,data)` (`:39`), `readCell(term,col,row): GoldenCell` (`:68`), `reverseState(term,col,row): boolean` (`:89`). Uses `@xterm/headless` default import (`:14`), `new Terminal({cols,rows,allowProposedApi:true})` (`:35`). |
| Depth matrix | `packages/core/test/golden-screen.spec.test.ts` | `optsFor(depth, override)` (`:28`), `COLOR_CONTRACT` per depth (`:38-46`), `for (const depth of DEPTHS)` (`:51`). Inline code-derived oracles, no snapshot files. |
| a11y degradation | `packages/core/test/a11y-golden.spec.test.ts` | NO_COLOR→mono path + inverse-distinguishable focus (`:25-49`); ASCII fallback via `glyphs:{boxDrawing:false}` → `┌→+`/`─→-`/`│→|` (`:52-69`). |
| Bytes ∝ damage | `packages/core/test/render-bytes-damage.spec.test.ts` | Ratio oracle: unchanged→0 bytes (`:27-30`); single-cell diff `>0 && < full/10` (`:32-42`). |
| Perf bench | `packages/core/bench/frame-bench.mjs` | `median(xs)` (`:82`), `p95(xs)` (`:95`), `measureComposeDiff(w,h,iters)` (`:131` — **hardwired to core's synthetic 200×50 frame**, not reusable for a grid), `perfBudgetMode(env): 'assert'|'log'` (`:144`, logs under `CI`/`TUI_SKIP_PERF`). Main-guarded (`:184`) so import runs no CLI. |
| Perf spec | `packages/core/test/perf-budget.spec.test.ts` | The 16 ms budget pattern + `perfBudgetMode` skip-guard (`:33-40`); imports from `../bench/frame-bench.mjs` (`:24`). |

`@xterm/headless@^6.0.0` is a **devDependency** in `packages/core/package.json:57` (and web/docs-site);
it is already in `yarn.lock:1829`. It is **not** in datagrid (AR-5 adds it).

## Datagrid today

- **Tests**: `packages/datagrid/vitest.config.ts` — `unit` project `include: ['test/**/*.{spec,impl}.test.ts']`
  (`:13-16`), `e2e` project `*.e2e.test.ts` single-fork (`:21-26`). No setup files. → new specs are
  `*.spec.test.ts` in `unit` (AR-8).
- **Headless mount** (the smoke-test path we reuse): `test/kitchen-sink.smoke.spec.test.ts` mounts a
  story via `createRenderRoot({width,height},{caps})` + `rr.mount(view)` inside `createRoot`, and
  reads back `rr.buffer().rows()` (`Cell[][]`); `rr.serialize()` gives the damage-diff escape bytes.
  Caps come from `resolveCapabilities({env,platform}).profile`, with `override` for `colorDepth`/`glyphs`.
- **Package**: `packages/datagrid/package.json` — `version 0.2.0`, `private: true`, `files:
  ["dist","README.md","CHANGELOG.md","LICENSE"]` (`:41-46`), deps are workspace-only (`@jsvision/core`,
  `@jsvision/ui`), devDeps `@types/node` + `vitest` (`:59-62`). No `@xterm/headless`.
- **CHANGELOG**: `packages/datagrid/CHANGELOG.md` exists (Keep-a-Changelog, `[Unreleased]`) — created
  during the RD-14 re-preflight. Governance task updates it (AR-12).
- **Fixtures / column models to reuse**: `test/fixtures/windowed-source.ts` (eager) and
  `async-windowed-source.ts` (paged 100k). For a deterministic 60×22 bench use an **eager** source
  (AR-6/AR-7); the 4-column model in `test/kitchen-sink/stories/data-at-scale.story.ts:42-54`
  (`id`/`name`/`city`/`balance`) or the 5-column `columns-layout.story.ts:36-49` is the base.

## The two role/callback facts that shape this plan

- **Grid theme roles already exist and are byte-frozen** at all four depths:
  `gridCursor`/`gridDirty`/`gridSelectedRow`/`gridInvalid`, frozen by
  `packages/datagrid/test/grid-theme.spec.test.ts`. So the golden-screen tests validate the
  **emulator round-trip** of already-correct roles — expected mostly green, but the round-trip may
  surface real gaps the byte-freeze can't (e.g. a role that downsamples wrong on a live emulator).
- **Callback guards are asymmetric today** (AR-9):
  - Guarded: custom **renderer** `cell-draw.ts:120-125` (erase + `⚠`); **export**-path formatter
    `grid.ts:1002-1006` (→ `String(v)`).
  - **Unguarded**: **on-screen** formatter `column.ts:247` (`c.format(v,row)`); custom **comparator**
    `sort.ts:63` (`col.compare(va,vb)`). These are what Phase 3 guards.
