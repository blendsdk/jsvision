# 99 — Execution Plan: Live-Example System

> **Implements**: docs-website/RD-03 · **Feature**: docs-website
> **CodeOps Skills Version**: 3.3.2
> **Progress**: 36/40 tasks (90%) · **Last Updated**: 2026-07-10 01:07

Spec-first per phase: **spec tests → red → implement → green → impl tests → verify**. Each phase is a
testable slice. **Verify** = `yarn verify` (AR-21) unless a phase names a faster inner loop.
Commit cadence is chosen at `exec_plan` time (the RD-02 run used per-phase + push).

Marks are two-stage: `[ ]` → `[~]` (implemented, unverified) → `[x]` (verified).

---

## Phase 0 — docs-site becomes a verify participant (scaffolding)
Ref: 03-06 · AR-2/4, C1/C2.

- [x] 0.1 Add docs-site dev-deps (`vitest`, `@jsvision/core`/`ui`/`web`/`files`, `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-webgl`, `@xterm/headless`) + `test`/`typecheck` scripts; keep `vp:build` unchanged. ✅ (completed: 2026-07-09 23:27)
- [x] 0.2 Add `packages/docs-site/vitest.config.ts` (unit project, Windows-safe timeout) + `tsconfig.json` `include` = `examples/**` + `src/**` (DemoShell/PlayController/site-meta) — Vue SFC excluded. ✅ (completed: 2026-07-09 23:27)
- [x] 0.3 Confirm turbo ordering (C1): the existing `test: dependsOn ["build","^build"]` + the Phase-0.1 workspace deps already build `core`/`ui`/`web`/`files` before `docs-site#test` (no no-op `build` script — keeps C2); add a placeholder `examples/index.ts` (empty `EXAMPLES`) + one trivial example so the harness has something to iterate. ✅ (completed: 2026-07-09 23:27 — placeholder = empty `EXAMPLES` + a `plumbing.impl.test.ts` dist-freshness guard; a standalone trivial example module is deferred to the contract phase to avoid a parity-test orphan)
- [x] 0.4 Verify: from a clean `dist/`, `yarn verify` runs `docs-site#typecheck` + `docs-site#test` green and they resolve fresh built dist (guards cross-package staleness). ✅ (completed: 2026-07-09 23:27 — verify exit 0, 22/22 turbo tasks; `docs-site:typecheck` green, `docs-site:test` 2 passed)

**Verify**: `yarn verify`

---

## Phase 1 — Example contract, registry & snippet-drift
Ref: 03-01 · AR-5/6/14.

- [x] 1.1 Spec: write ST-1 (registry parity + metadata hygiene) and ST-3 (whole-file `<<<` directive + no pasted block) — run red. ✅ (completed: 2026-07-09 23:37 — red confirmed: ST-1 failed on the missing `_contract.js`; ST-3 vacuous at 0 examples by design)
- [x] 1.2 Implement `examples/_contract.ts` (`defineExample` + `ExampleContext`/`ExampleDefinition`). ✅ (completed: 2026-07-09 23:37)
- [x] 1.3 Implement `examples/index.ts` (`ExampleEntry` + hand-authored `EXAMPLES`) and the parity logic ST-1 targets; green ST-1. ✅ (completed: 2026-07-09 23:37 — `EXAMPLES` empty until seed examples land; parity/hygiene loops engage as entries are added)
- [x] 1.4 Implement the snippet convention + the drift directive-check ST-3 targets (page-text scan); green ST-3. ✅ (completed: 2026-07-09 23:37 — page-agnostic `<<< @/<sourcePath>` scan across all docs `.md`; no-pasted-block guard via `defineExample(` in a fenced ts block)
- [x] 1.5 Impl tests: `load()` returns a `default` `ExampleDefinition`; a static scan asserts no example module imports `@xterm/*` or uses DOM globals (`document`/`window`) — allow-listing `@jsvision/web`'s pure `createBrowserFileSystem`. ✅ (completed: 2026-07-09 23:37 — import-specifier + `@jsvision/web`-binding allow-list + `document.`/`window.` property-access scan)

**Verify**: `yarn verify`

---

## Phase 2 — DemoShell (minimal + full)
Ref: 03-02 · AR-7/8/9/17.

- [x] 2.1 Spec: write ST-4 (minimal centers a component + compact status w/ Theme/Depth/About), ST-5 (full menu bar + View→Theme/Depth + status), ST-9 (live `setTheme` repaint, default Turbo Vision) — run red. ✅ (completed: 2026-07-09 23:58 — red confirmed on missing `demo-shell.js`)
- [x] 2.2 Implement `src/site-meta.ts` (name/links + version injected from root `package.json` via a Vite `define`) + an ambient `declare const __JSVISION_VERSION__: string;` in the tsconfig `include` so `docs-site#typecheck` resolves the define global. ✅ (completed: 2026-07-09 23:58 — `define` added to BOTH the VitePress config and the vitest project (root-only define doesn't reach projects); `src/env.d.ts` holds the ambient decl; site-meta has a `0.0.0` fallback)
- [x] 2.3 Implement `src/demo-shell.ts`: `View|Application` normalization, the shared About/Theme/Depth builder, and the `full` chrome (menu bar + status) — green ST-5, ST-9. ✅ (completed: 2026-07-09 23:58 — View → owned app w/ chrome; Application → wire shared handlers + return as-is (brings own chrome); nested View→Theme/Depth submenus over the 13 presets)
- [x] 2.4 Implement the `minimal` chrome (centered content + compact status line with Theme/Depth/About) — green ST-4. ✅ (completed: 2026-07-09 23:58 — content centered from its intended size; compact Theme(cycle)/Depth(cycle)/About status, no menu bar)
- [x] 2.5 Impl tests: About opens a dialog with name/version/links; Depth item invokes `onDepthChange` (no caps mutation in DemoShell). ✅ (completed: 2026-07-09 23:58 — + `SITE_META.version` == root package.json version)

**Verify**: `yarn verify`

---

## Phase 3 — Play component (controller + client-only Vue)
Ref: 03-03, 03-06 · AR-10/11/15/16, C4.

- [x] 3.1 Spec: write ST-6/ST-7 (open paints first frame + full chrome via `@xterm/headless`), ST-8 (20× no leak), ST-10 (F10 reclaim `defaultPrevented` while focused; not when closed), and the ST-14 error-panel + one-dialog assertions — run red. ✅ (completed: 2026-07-10 00:14 — synthetic `ExampleEntry` fixtures + a counting `@xterm/headless` factory + a hand-mocked keydown target in `test/helpers/play-harness.ts`; seed examples land in Phase 5)
- [x] 3.2 Implement `src/play/play-controller.ts`: lazy `open` (load → DemoShell → `mountApp`), `close` (reverse dispose + null refs), `remount` (shared Reset/size/depth seam), the module-level one-dialog singleton — green ST-6/ST-7/ST-8. ✅ (completed: 2026-07-10 00:14 — local structural `HostElement`/`TerminalLike` (not barrel-exported by web); `ColorDepth` derived from `BrowserCapsOptions`)
- [x] 3.3 Implement the error panel (AR-15) + wire key-reclaim attach/detach around open/close — green ST-10 + ST-14 (error/cap halves). ✅ (completed: 2026-07-10 00:14 — error surfaced via an injectable `onError` seam (the Vue renders the DOM panel); reclaim attaches on open, detaches on close, injectable `reclaimTarget`/`isFocused` for headless tests)
- [x] 3.4 Implement `.vitepress/theme/components/PlayExample.vue` (client-only: dynamic `import()` of xterm + controller in `onMounted`; Play button + focus hint; modal + × + backdrop; **Escape → TUI**, not the modal) and register it via `enhanceApp`. ✅ (completed: 2026-07-10 00:14 — dynamic imports in the Play handler (SSR-safe + code-split); registered globally in `theme/index.ts`; VitePress build green)
- [x] 3.5 Add the `node:fs`/`node:tty` → `@jsvision/web/browser-stubs` alias + `define NODE_ENV` to `.vitepress/config.ts`. ✅ (completed: 2026-07-10 00:14 — under the `vite` block alongside the version define)
- [x] 3.6 CSP-compat check: build a page hosting `<PlayExample>` and assert 0 CSP violations under the existing strict policy (AR-16); if xterm trips it, STOP and raise a new AR before loosening. ✅ (completed: 2026-07-10 00:14 — VitePress build + `check-docs-build.mjs` 13/13 incl. the CSP gate: no `unsafe-eval`, every inline script hashed; xterm bundles as an external `'self'` code-split chunk — no relaxation needed)
- [x] 3.7 Impl tests: `remount` param-merge; double-`close` no-op; singleton closes the prior dialog. ✅ (completed: 2026-07-10 00:14)

**Verify**: `yarn verify` (+ a manual `yarn docs:dev` Play smoke)

---

## Phase 4 — Accessibility, fallback, deep-link & controls
Ref: 03-04, 03-03 · AR-12/13/19.

- [x] 4.1 Spec: write ST-11 (DOM source+blurb+labelled Play), ST-12 (no-keyboard fallback slot+note; missing-asset degrade) — run red. ✅ (completed: 2026-07-10 00:25 — red confirmed: `no-keyboard.js`/`deep-link.js` missing + the ST-11 blurb assertion failed pre-impl; the button + vacuous-page loops passed)
- [x] 4.2 Implement `src/play/no-keyboard.ts` (`isNoKeyboardDevice`) + the fallback slot in `PlayExample.vue` (note + `/screenshots/<id>.gif`, degrade to note+source) — green ST-12. ✅ (completed: 2026-07-10 00:25 — SSR-safe typed `globalThis.matchMedia` probe over `(hover: none) and (pointer: coarse)`; `<img @error>` degrades to note-only, source stays on the page; `fallbackDecision` interactive/screenshot/note-only)
- [x] 4.3 Implement the always-in-DOM a11y region (blurb `<p>`, ARIA-labelled `<button>`, `role="dialog"` focus move/return) — green ST-11. ✅ (completed: 2026-07-10 00:25 — server-rendered blurb `<p>` + `aria-label`led Play button; on open focus moves to the × (not the terminal — no focus trap), on close returns to Play; `role="dialog" aria-modal`)
- [x] 4.4 Implement deep-link (`?example=<id>` → scroll+highlight+open **without auto-focusing**; no-keyboard ⇒ fallback) + the Reset control + the size selector (80×24 / 100×30 via `remount`). ✅ (completed: 2026-07-10 00:25 — `deepLinkTarget` in `onMounted` scrolls+highlights+opens (focus stays on the ×); Reset = `remount({})`, size toggle = `remount({size})`; `MountedApp.dispose()` disposes the terminal so remount never stacks)
- [x] 4.5 Impl tests: deep-link parser (match / unknown no-op / no-keyboard opens no terminal). ✅ (completed: 2026-07-10 00:25 — `deep-link.impl.test.ts`: match / unknown+missing-param no-op / no-keyboard returns null)

**Verify**: `yarn verify`

---

## Phase 5a — Seed examples: prove the mechanism
Ref: 03-05 · AR-18/20, AC-9.

- [x] 5a.1 Spec: write ST-13 (`files/file-dialog` lists the seeded tree + navigates a subdir) and the ST-2 coverage for these two — run red. ✅ (completed: 2026-07-10 00:52 — `paint-smoke.spec` (ST-2), `file-dialog.spec` (ST-13), `security.spec` (ST-14 a/c); red confirmed — empty registry + missing `files/file-dialog` module)
- [x] 5a.2 Implement `examples/controls/button.ts` (minimal) + its page (blurb, `<<<`, `<PlayExample>`, a11y region); register it. ✅ (completed: 2026-07-10 00:55 — `Button` bound to a click-count `signal` + `Text` echo; page `components/controls/button.md` + sidebar entry)
- [x] 5a.3 Implement `examples/files/file-dialog.ts` (full; seeds a virtual tree incl. a raw-`ESC` file for ST-14) + its page; register it — green ST-13 + ST-2 (both). ✅ (completed: 2026-07-10 00:55 — resolves AR-22: `caps` added to `ExampleContext`, `demoApp(ctx,chrome)` exported from demo-shell, play-controller threads caps; example returns an `Application` opening its `FileDialog` via `openFile`/`execView` in `build()`; exports `HOME`/`FILE_TREE`/`seedFs`; page + sidebar)
- [x] 5a.4 Green the remaining ST-14 half (sanitize strips the raw `ESC` in the painted frame; source rendered escaped). ✅ (completed: 2026-07-10 00:55 — ST-14(a) reads `seedFs()` notes.txt (raw ESC content), paints via `Text` through the real path → no control byte; ST-14(c) static: `PlayExample.vue` binds blurb `{{ }}`, no `v-html`)

**Verify**: `yarn verify`

---

## Phase 5b — Seed examples: breadth
Ref: 03-05 · AR-20. (Droppable under time pressure: input / list-box / data-grid / preset-gallery.)

- [x] 5b.1 `controls/input` (minimal) — module + page + registry; paint-smoke green. ✅ (completed: 2026-07-10 01:06 — Input filter/range/picture validators + Label + echo)
- [x] 5b.2 `controls/form-dialog` (full) — module + page + registry; paint-smoke green. ✅ (completed: 2026-07-10 01:06 — modal Dialog: Input(range 0–120) + CheckGroup + RadioGroup + OK/Cancel, opened via demoApp + execView on start)
- [x] 5b.3 `containers/list-box` (minimal) — module + page + registry; paint-smoke green. ✅ (completed: 2026-07-10 01:06 — ListBox over 28 fruits, type-ahead + focused/selected echo)
- [x] 5b.4 `table/data-grid` (full) — module + page + registry; paint-smoke green. ✅ (completed: 2026-07-10 01:06 — DataGrid<Person>: auto/fixed/fr cols, numeric Age sort, zebra, H-scroll)
- [x] 5b.5 `apps/desktop` (full) — re-author from `web-xterm/app.ts` `buildApp`; module + page + registry; paint-smoke green (RD-04 hero). ✅ (completed: 2026-07-10 01:06 — self-contained WM app: ≡/Window menu + status + 2 framed windows + about messageBox; dropped buildBrowserCaps (caps via ctx) + the timer-driven clock (leak-free))
- [x] 5b.6 `theming/preset-gallery` (full) — module + page + registry; paint-smoke green (theme+depth showcase). ✅ (completed: 2026-07-10 01:06 — a panel of app-themed widgets (buttons/input/checks/radios) that repaint on the View→Theme/Depth controls)

**Verify**: `yarn verify`

---

## Phase 6 — Integration & finalize
Ref: 03-06, 01 · C2.

- [ ] 6.1 Wire any docs-build gate additions (drift/CSP) into `scripts/check-docs-build.mjs`'s runner if that is where the site build is validated; confirm `node packages/docs-site/scripts/check-docs-build.mjs` passes with the new pages.
- [ ] 6.2 Update CLAUDE.md's docs-site isolation note (C2) — "participates in test + typecheck".
- [ ] 6.3 Full `yarn verify` from a clean `dist/`; confirm all ST-1…ST-14 green, docs-site test+typecheck in the run, `check:deps` unchanged (docs-site is private/dev-deps only, so it adds no `check:deps` target).
- [ ] 6.4 Roadmap: set docs-website/RD-03 → Done ✅ (feature + portfolio cascade) via the roadmap skill.

**Verify**: `yarn verify` + `node packages/docs-site/scripts/check-docs-build.mjs`

---

## Definition of Done
All 40 tasks `[x]`; ST-1…ST-14 green; `yarn verify` passes with docs-site in test+typecheck; the 8 seed
examples build/paint/register; the flagship `apps/desktop` renders; CLAUDE.md note updated; RD-03 → Done.
