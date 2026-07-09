# 02 — Current State

What exists today, and what each spec builds on. All paths verified at plan time (HEAD `4b40292`).

## docs-site (the host)

- `packages/docs-site/` — VitePress app, **isolated from `yarn verify`**: scripts are `dev` / `vp:build`
  / `preview` only (no `build`/`test`/`typecheck`), so turbo skips it. Deps: `vitepress`, `mermaid`,
  `vitepress-plugin-mermaid`, `js-yaml` (all dev). → RD-03 adds a vitest `test` project + `typecheck`
  (AR-2); `vp:build` stays isolated (C2).
- `.vitepress/config.ts` — `defineConfig` wrapped in `withMermaid()`. Has a **strict meta-CSP** built
  per-build: `script-src 'self' <inline-hashes>`, **no `unsafe-eval`/`unsafe-inline`**, injected via
  `transformHtml` (`config.ts:42-51,169-171`). → the Play component must satisfy this as-is (AR-16).
  This is also where `vite.resolve.alias` for `node:fs`/`node:tty` is added (AR-10).
- `.vitepress/theme/index.ts` — re-exports `DefaultTheme` only; no custom components yet. → RD-03 adds
  the Play component here via `enhanceApp` and registers it globally / uses it in pages.
- Content dirs already exist: `guide/`, `components/`, `apps/`, `api/`, `reference/`. → example pages
  slot into `components/` and `apps/`.
- `scripts/check-docs-build.mjs` — a standalone node build-output gate (not vitest). → RD-03 may add a
  snippet-drift assertion here or in the vitest project (03-01 chooses vitest for speed).

## @jsvision/web (the runtime, shipped RD-02)

- `mountApp({ element, app, caps, term? | createTerminal? })` — wires the loop's frame/caret/clipboard
  sinks to a terminal, starts the host, paints, maps resize, focuses. Never imports `@xterm/xterm`.
- `buildBrowserCaps({ colorDepth? })` — truecolor/UTF-8 profile; `colorDepth` overridable → drives the
  downsample chain (AR-9 re-mount).
- `createBrowserFileSystem({ tree, home })` — in-memory `FileSystem` (14 methods + `sep`), pure-POSIX,
  no `node:fs`. → the `files/file-dialog` example seeds a tree (AR-18, AC-9).
- `attachKeyReclaim(term, { isFocused? })` + `UNRECLAIMABLE_CHORDS` — capture-phase reclaim of F-keys /
  chords while focused. → the Play dialog attaches on open, detaches on close (AR-11, AC-5).
- `@jsvision/web/browser-stubs` — throwing `node:fs`/`node:tty` placeholders; the alias target (AR-10).

## The mounting precedent

- `packages/examples/web-xterm/main.ts` — the reference boot: `new Terminal(...)` + fit + webgl →
  `term.open(mount)` → `mountApp({ element, app, caps, term })` + a resize listener. → the
  PlayController mirrors this (AR-10).
- `packages/examples/web-xterm/vite.config.ts` — the exact alias recipe (`node:fs`/`node:tty` →
  `@jsvision/web/browser-stubs`, `define process.env.NODE_ENV`). → transcribed into the VitePress config.
- `packages/examples/web-xterm/app.ts` `buildApp(viewport)` — composes `createApplication` + `menuBar`
  + `statusLine` (+ windows). → **the DemoShell/full-chrome template** and the re-authored
  `apps/desktop` flagship example (AR-7/20).

## The theme + depth seams (verified)

- `Application.setTheme(theme)` → `loop.setTheme` → `RenderRoot.setTheme(theme)` — hot-swaps colors +
  forces one full recompose (`application.ts:100`, `render-root.ts:312`). → live theme switch, **no new
  primitive** (AR-8).
- `RenderRoot.caps` is `private readonly` (`render-root.ts:238`) — **no** live caps swap. → depth via
  re-mount (AR-9, C3).

## The test precedent

- `packages/examples/test/kitchen-sink.smoke.spec.test.ts` — the paint-smoke precedent: build + mount a
  view + assert `paintedCells(rr.buffer().rows()) > 0` + registry hygiene (unique id / metadata). **No
  xterm.** RD-03's **Tier-1** applies the same idea, but since `demoShell` returns an `Application` it
  reads the app's own render root (`app.loop.renderRoot.buffer()`) rather than a fresh
  `createRenderRoot().mount()` (which takes a `View`). → Tier-1 for all examples (AR-3).
- `packages/examples/vitest.config.ts` — the two-project (`unit` / `e2e`) shape to mirror in docs-site.
- `@xterm/headless` — a real headless `Terminal` (structurally a `TerminalLike`) for the **Tier-2** leak
  test (AR-3/18).

## Gaps RD-03 fills

- No example-module contract, registry, Play component, or DemoShell exists yet.
- docs-site has no test runner or typecheck — added here (AR-2), with turbo ordered so the engine
  packages build first (C1).
