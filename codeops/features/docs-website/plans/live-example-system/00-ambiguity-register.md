# Ambiguity Register — Live-Example System (docs-website / RD-03)

> **Feature**: docs-website · **Implements**: docs-website/RD-03
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2
> **Status**: ✅ GATE PASSED — all items Resolved, user-confirmed, zero deferred-as-open.

Pre-resolved architecture comes from the `grill-me` session (notes:
`../_draft/grill-notes-live-example-system.md`). Plan-depth hunting across the 12 categories added
AR-14…AR-18. Every row is an explicit user decision.

## Legend
✅ Resolved (user decision) · 🔴 Open (blocks gate) — none remain.

## Register

| # | Category | Item / question | Decision | Status |
|---|----------|-----------------|----------|--------|
| AR-1 | Structure | Where do example modules live? | `packages/docs-site/examples/<category>/<name>.ts`. | ✅ (grill) |
| AR-2 | Dependencies / Build | How does the smoke/drift/leak test gate, given docs-site is isolated from `yarn verify`? | docs-site gains a **vitest `test` project** + a scoped `typecheck` script → joins verify's **test + typecheck** phases; `vp:build` stays isolated from the **build** phase. Dev-deps: `vitest`, `@jsvision/core`/`ui`/`web`/`files`, `@xterm/xterm`+fit/webgl, `@xterm/headless`. | ✅ (grill) |
| AR-3 | Testing | Smoke-test architecture. | **Two-tier.** Tier-1 **paint-smoke** for *every* example via the app's own render root (`app.loop.renderRoot.buffer()`, fixed caps/viewport, no xterm) — asserts a non-empty frame + metadata. Tier-2 **leak-smoke** via `@xterm/headless`+`mountApp` for **one** representative example (20× open/close, no growth). | ✅ (grill) |
| AR-4 | Testing / Scope | Typecheck scope. | The scoped `tsconfig` covers the example modules **+ DemoShell + the PlayController/`mountApp` wiring** (not leaf modules alone). Plain `tsc`; the Vue SFC is left to VitePress build / a later `vue-tsc`. | ✅ (grill + AR-18) |
| AR-5 | Structure | Registry generation. | **Hand-authored** `examples/index.ts` array (one entry per example) + a **parity test** asserting every `examples/**/*.ts` has a registry entry (no orphans). No codegen. | ✅ (grill) |
| AR-6 | Behavior | Snippet-drift guarantee (shown code == running code). | **`<<<` region-import directive check** (assert every example page embeds via `<<<` at a real registry file; no pasted blocks), made **provably sufficient by a whole-file-embed convention** (examples are small single-purpose modules; **no region markers**). Heavier rendered-compare only if a region is ever needed. | ✅ (grill) |
| AR-7 | Architecture | DemoShell home + shape. | One module in `packages/docs-site` (shared by RD-07 apps), with **two chrome modes**: `minimal` (component centered) and `full` (menu bar + status line). Shared About/theme/depth plumbing. | ✅ (grill) |
| AR-8 | Behavior | Live theme switch. | Use the existing `Application.setTheme` (hot-swap, one full recompose) — **no new engine primitive**. Default open theme = Turbo Vision. | ✅ (grill; verified `application.ts:100`, `render-root.ts:312`) |
| AR-9 | Behavior | colorDepth / downsampling control. | **Re-mount** at a new `colorDepth` via `buildBrowserCaps({ colorDepth })` (View → Depth). `RenderRoot.caps` is `readonly` (no live swap), so re-mount reuses the dispose/rebuild lifecycle; state resets on depth change (acceptable for a color demo). | ✅ (grill; verified `render-root.ts:238` readonly) |
| AR-10 | Behavior / Security | Play dialog lifecycle + testability. | Open/dispose logic in a plain-TS **`PlayController`** (Vue SFC wraps it; the Tier-2 leak test drives it directly). **Client-only** (`<ClientOnly>` + dynamic `import()` of xterm — SSR-safe *and* a bundle code-split). **One-dialog singleton** closes any open dialog before opening another. | ✅ (grill + AR-16) |
| AR-11 | Behavior | Dialog close / focus release. | Close via a **× button + backdrop click**; **Escape is passed through to the TUI** (TV apps use Esc). A visible focus hint. | ✅ (grill) |
| AR-12 | Accessibility | Screen-reader / no-JS path. | The example **source + a prose blurb are always in the DOM**, with an ARIA-labelled, keyboard-operable Play control. | ✅ (grill) |
| AR-13 | Accessibility / Scope | No-keyboard fallback vs. RD-09 assets. | RD-03 ships the **feature-detection** (`matchMedia('(hover: none) and (pointer: coarse)')`) **+ a fallback slot** (a "needs a hardware keyboard" note + an `<img>` at a conventional per-example screenshot path). A missing asset degrades to note + source. RD-09 fills the GIFs later. | ✅ (grill) |
| AR-14 | Behavior / Naming | Example-module contract shape. | The module exports `defineExample({ title, blurb, build(ctx) })` (placement-agnostic). The **registry entry** supplies `{ id, category, sourcePath, load() }`. Registry owns ids/placement. | ✅ (this session) |
| AR-15 | Error handling | Runtime failure inside the Play dialog (build()/mount throws in the browser). | Catch and render a **readable error panel inside the dialog** (message + short hint), also logged to console — never a blank/half-painted terminal. | ✅ (this session) |
| AR-16 | Security | Play component vs. RD-01's strict meta-CSP (`script-src 'self'` + inline hashes, no `unsafe-eval`). | **Keep the strict CSP; verify, don't loosen.** The client-only dynamic import is same-origin (`'self'`); xterm uses canvas, not `eval`. Add a **CSP-compat verification task**; escalate for a narrow relaxation only if xterm provably trips it. | ✅ (this session; verified CSP in `.vitepress/config.ts:42-51`) |
| AR-17 | UX / Behavior | Minimal-shell About reachability (AR-5/20 wants About everywhere). | Minimal shell = component centered + a **compact status line** exposing theme-cycle, depth-cycle, and **About** as status items. About stays reachable in every demo without a full menu bar. | ✅ (this session) |
| AR-18 | Testing / Scope | AC-3 leak-test representative example. | **`files/file-dialog`** — the most disposal-heavy (multi-view + virtual FS) and the AC-9 example. | ✅ (this session) |
| AR-19 | Scope | Which Should-Haves land in RD-03. | **All three:** Reset + size selector (80×24 / 100×30) + deep-link. Reset/size share the PlayController re-mount seam. **Deep-link = scroll-to + highlight + open the dialog WITHOUT auto-focusing the terminal** (a11y focus-trap fix). Copy-code is already free (RD-01 Shiki). | ✅ (grill) |
| AR-20 | Scope | Seed example set. | **8, phased.** Mechanism (2): `controls/button` (minimal), `files/file-dialog` (full, AC-9). Breadth (6): `controls/input` (min), `controls/form-dialog` (full), `containers/list-box` (min), `table/data-grid` (full), `apps/desktop` (full, flagship / RD-04 hero, re-authored from web-xterm `buildApp`), `theming/preset-gallery` (full). Droppable under time pressure: input / list-box / data-grid / preset-gallery. | ✅ (grill) |
| AR-21 | Process | Verify command. | `yarn verify` (AGENTS.md: `yarn lint` then `turbo run typecheck build test check:docs`). | ✅ (AGENTS.md) |
| AR-22 | Architecture / Contract | How do `Application`-returning examples (modal-subject `files/file-dialog`, `controls/form-dialog`, and `apps/desktop`) receive **caps** + the demo Theme/Depth/About **chrome**? `ExampleContext` was `{width,height}` only, and `createApplication` takes menu/status **at construction** (`application.ts:38-41`) — no post-construction attach, so DemoShell cannot re-chrome an app it is handed. | **Thread `caps` into `build(ctx)`.** `ExampleContext` gains `readonly caps: CapabilityProfile` (resolves the 03-01 omission that 03-05:42 already implies — *"drop `buildBrowserCaps`; caps come from DemoShell/PlayController"*); `PlayController` passes `def.build({width,height,caps})`. An `Application` example builds a caps-correct, demo-chromed app via an exported **`demoApp(ctx, chrome)`** helper from `demo-shell.ts` (bundles `createApplication` with caps + `demoMenuBar()`/`demoStatusLine()`), then opens its dialog with `openFile`/`loop.execView` **inside `build()`** (real `showError` host). DemoShell's `Application` branch is unchanged (wires the shared handlers). **Rejected:** "DemoShell detects a modal View and opens it" — only half-solves (leaves `apps/desktop` on `caps:'auto'`), special-cases a widget type (03-02:33 forbids), and gives the dialog a no-op `showError`. | ✅ (runtime, this session; user-confirmed) |

## Constraints carried into the specs
- **C1** turbo must build `core`/`ui`/`web`/`files` before `docs-site#test` (cross-package dist dependency). → 03-06.
- **C2** AGENTS.md's "docs-site fully isolated from `yarn verify`" note updates to "isolated from the build/shipped-package phase; participates in test + typecheck." → 03-06 / Phase 6.
- **C3** `RenderRoot.caps` is `readonly` → depth uses re-mount (AR-9).
- **C4** xterm is browser-only → the Play component MUST be client-only or the VitePress SSR build breaks (AR-10).

## Deferrals (owner + revisit trigger — not open gate items)
- ⏸ A **live caps/colorDepth swap primitive** on `@jsvision/ui` · owner: framework/user · revisit: if re-mount's state-reset proves unacceptable, or a later RD needs live downsampling.
- ⏸ The **GIF/screenshot Playwright capture pipeline** · owner: RD-09 · revisit: RD-09 execution fills the fallback slots.
- ⏸ The **full ~40 component examples + per-component page template** · owner: RD-05 · revisit: RD-05 extends this registry/mechanism.
- ⏸ The **whole-file-embeds-only convention** · owner: RD-03 · revisit: if an example legitimately needs a region marker → add the heavier rendered-compare for those.
- ⏸ **Relocate the pure in-memory `FileSystem`** (`createBrowserFileSystem`) into `@jsvision/files` (e.g. `createMemoryFileSystem`, beside `nodeFileSystem`), re-exported by `@jsvision/web` · owner: framework/user · revisit: when the "no browser import" example rule should be restored to full crispness. RD-03 allows the pure `@jsvision/web` FS as a **scoped exception** (preflight PF-003 Option A); this follow-up removes the exception at the cost of a new shipped `@jsvision/files` primitive (JSDoc `@example` + lockstep version), which RD-03 deliberately avoided.
