# 03-06 — Testing Harness & CI Integration

Owner of: the docs-site vitest project (two-tier), the typecheck tsconfig, turbo ordering, the
CSP-compat check, and the AGENTS.md isolation-note update.

## docs-site becomes a verify participant (AR-2, C1, C2)

`packages/docs-site/package.json` gains:
- **deps (dev):** `vitest`, `@jsvision/core`, `@jsvision/ui`, `@jsvision/web`, `@jsvision/files`,
  `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-webgl`, `@xterm/headless`.
- **scripts:** `"test": "vitest run --project unit"`, `"typecheck": "tsc --noEmit -p tsconfig.json"`.
  `vp:build` is unchanged (stays out of the turbo `build` task — C2).

`packages/docs-site/vitest.config.ts` — mirror the examples two-project shape (`unit` glob
`test/**/*.{spec,impl}.test.ts`, a modest `testTimeout` floor for Windows). No `e2e` project needed
(the leak test is a unit test using `@xterm/headless`, no child process).

### turbo ordering (C1) — critical
The paint-smoke + leak test import the **built** `@jsvision/core`/`ui`/`web`/`files`. turbo's `test`
task already declares `dependsOn: ["build", "^build"]`, so `^build` builds a package's **dependencies**
first. Declaring `@jsvision/core`/`ui`/`web`/`files` as docs-site workspace deps (Phase 0.1) therefore
orders their `build` before `docs-site#test` with **no** turbo edit and **no** no-op `build` script —
adding one would needlessly pull docs-site into the `build` task (mild tension with C2). **Validate**
by running `yarn verify` from a clean `dist/` and confirming docs-site tests see fresh dist (guards the
cross-package staleness noted in project memory).

## Two-tier harness (AR-3)

### Tier-1 — paint-smoke (every example)
```
packages/docs-site/test/examples.smoke.spec.test.ts
```
- For each `EXAMPLES` entry: `await load()` → `demoShell({ content: def.build({width,height}), … })`
  returns an `Application` → read its first frame from the app's **own** render root
  (`app.loop.renderRoot.buffer()` — `createApplication` paints the initial frame at mount, so no tick
  is needed) → assert `paintedCells(app.loop.renderRoot.buffer().rows()) > 0`. Fixed caps
  (`resolveCapabilities({env:{},platform:'linux',override:{colorDepth:'truecolor'}}).profile`) + fixed
  viewport — deterministic, **no xterm**. (A fresh `createRenderRoot().mount()` takes a `View`, not an
  `Application`, so it is **not** used here — the Application owns its render root.) Also runs the
  registry parity + metadata hygiene (ST-1/2).

### Tier-2 — leak-smoke (one representative — AR-18)
```
packages/docs-site/test/play-lifecycle.spec.test.ts
```
- Build a `PlayController` for `files/file-dialog` with `createTerminal` returning an `@xterm/headless`
  `Terminal`. Track live terminals via a counting factory. `open`/`close` **20×**; assert the live
  count returns to 0 each cycle and no net growth (AC-3, ST-8). Drives the plain-TS controller directly
  (no Vue/DOM) — the reason the controller is split out (AR-10).

## Typecheck (AR-4)
`packages/docs-site/tsconfig.json` `include`s: `examples/**/*.ts`, `src/**/*.ts` (DemoShell, site-meta,
PlayController, no-keyboard) — i.e. **the example modules + DemoShell + the PlayController/mountApp
wiring** — so an API change to `mountApp`/`setTheme`/`buildBrowserCaps` fails typecheck. The Vue SFC is
excluded (left to VitePress build / later `vue-tsc`).

## CSP compatibility (AR-16)
- A check (extend `scripts/check-docs-build.mjs` or a focused headless assertion) builds a page hosting
  `<PlayExample>` and asserts **0 CSP violations** with the existing strict policy. No `unsafe-eval`,
  no new inline scripts (the Vue component is bundled; its inline hydration, if any, is covered by the
  per-build hash mechanism). If xterm provably needs a narrow relaxation (e.g. injected `<style>`),
  surface it as a new AR before changing the policy.

## Snippet-drift + a11y assertions
- The directive-check drift test (ST-3) and the a11y/fallback tests (ST-11/12) live in the same vitest
  `unit` project (fast, no build of the whole site).

## AGENTS.md note (C2)
Update the docs-site characterization: *"isolated from `yarn verify`'s build/shipped-package phase
(script is `vp:build`), but **participates in the test + typecheck phases** via a vitest project that
headlessly smoke-tests every live example."* Done in Phase 6 (a doc edit, not shipped code).

## Tests summary
ST-1 parity/hygiene · ST-2 paint-smoke all · ST-3 drift · ST-8 leak · plus the CSP-compat build check.
