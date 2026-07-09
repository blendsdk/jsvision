# 99 — Execution Plan: Live-Example System

> **Implements**: docs-website/RD-03 · **Feature**: docs-website
> **CodeOps Skills Version**: 3.3.2
> **Progress**: 0/40 tasks (0%) · **Last Updated**: 2026-07-09

Spec-first per phase: **spec tests → red → implement → green → impl tests → verify**. Each phase is a
testable slice. **Verify** = `yarn verify` (AR-21) unless a phase names a faster inner loop.
Commit cadence is chosen at `exec_plan` time (the RD-02 run used per-phase + push).

Marks are two-stage: `[ ]` → `[~]` (implemented, unverified) → `[x]` (verified).

---

## Phase 0 — docs-site becomes a verify participant (scaffolding)
Ref: 03-06 · AR-2/4, C1/C2.

- [ ] 0.1 Add docs-site dev-deps (`vitest`, `@jsvision/core`/`ui`/`web`/`files`, `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-webgl`, `@xterm/headless`) + `test`/`typecheck` scripts; keep `vp:build` unchanged.
- [ ] 0.2 Add `packages/docs-site/vitest.config.ts` (unit project, Windows-safe timeout) + `tsconfig.json` `include` = `examples/**` + `src/**` (DemoShell/PlayController/site-meta) — Vue SFC excluded.
- [ ] 0.3 Confirm turbo ordering (C1): the existing `test: dependsOn ["build","^build"]` + the Phase-0.1 workspace deps already build `core`/`ui`/`web`/`files` before `docs-site#test` (no no-op `build` script — keeps C2); add a placeholder `examples/index.ts` (empty `EXAMPLES`) + one trivial example so the harness has something to iterate.
- [ ] 0.4 Verify: from a clean `dist/`, `yarn verify` runs `docs-site#typecheck` + `docs-site#test` green and they resolve fresh built dist (guards cross-package staleness).

**Verify**: `yarn verify`

---

## Phase 1 — Example contract, registry & snippet-drift
Ref: 03-01 · AR-5/6/14.

- [ ] 1.1 Spec: write ST-1 (registry parity + metadata hygiene) and ST-3 (whole-file `<<<` directive + no pasted block) — run red.
- [ ] 1.2 Implement `examples/_contract.ts` (`defineExample` + `ExampleContext`/`ExampleDefinition`).
- [ ] 1.3 Implement `examples/index.ts` (`ExampleEntry` + hand-authored `EXAMPLES`) and the parity logic ST-1 targets; green ST-1.
- [ ] 1.4 Implement the snippet convention + the drift directive-check ST-3 targets (page-text scan); green ST-3.
- [ ] 1.5 Impl tests: `load()` returns a `default` `ExampleDefinition`; a static scan asserts no example module imports `@xterm/*` or uses DOM globals (`document`/`window`) — allow-listing `@jsvision/web`'s pure `createBrowserFileSystem`.

**Verify**: `yarn verify`

---

## Phase 2 — DemoShell (minimal + full)
Ref: 03-02 · AR-7/8/9/17.

- [ ] 2.1 Spec: write ST-4 (minimal centers a component + compact status w/ Theme/Depth/About), ST-5 (full menu bar + View→Theme/Depth + status), ST-9 (live `setTheme` repaint, default Turbo Vision) — run red.
- [ ] 2.2 Implement `src/site-meta.ts` (name/links + version injected from root `package.json` via a Vite `define`) + an ambient `declare const __JSVISION_VERSION__: string;` in the tsconfig `include` so `docs-site#typecheck` resolves the define global.
- [ ] 2.3 Implement `src/demo-shell.ts`: `View|Application` normalization, the shared About/Theme/Depth builder, and the `full` chrome (menu bar + status) — green ST-5, ST-9.
- [ ] 2.4 Implement the `minimal` chrome (centered content + compact status line with Theme/Depth/About) — green ST-4.
- [ ] 2.5 Impl tests: About opens a dialog with name/version/links; Depth item invokes `onDepthChange` (no caps mutation in DemoShell).

**Verify**: `yarn verify`

---

## Phase 3 — Play component (controller + client-only Vue)
Ref: 03-03, 03-06 · AR-10/11/15/16, C4.

- [ ] 3.1 Spec: write ST-6/ST-7 (open paints first frame + full chrome via `@xterm/headless`), ST-8 (20× no leak), ST-10 (F10 reclaim `defaultPrevented` while focused; not when closed), and the ST-14 error-panel + one-dialog assertions — run red.
- [ ] 3.2 Implement `src/play/play-controller.ts`: lazy `open` (load → DemoShell → `mountApp`), `close` (reverse dispose + null refs), `remount` (shared Reset/size/depth seam), the module-level one-dialog singleton — green ST-6/ST-7/ST-8.
- [ ] 3.3 Implement the error panel (AR-15) + wire key-reclaim attach/detach around open/close — green ST-10 + ST-14 (error/cap halves).
- [ ] 3.4 Implement `.vitepress/theme/components/PlayExample.vue` (client-only: dynamic `import()` of xterm + controller in `onMounted`; Play button + focus hint; modal + × + backdrop; **Escape → TUI**, not the modal) and register it via `enhanceApp`.
- [ ] 3.5 Add the `node:fs`/`node:tty` → `@jsvision/web/browser-stubs` alias + `define NODE_ENV` to `.vitepress/config.ts`.
- [ ] 3.6 CSP-compat check: build a page hosting `<PlayExample>` and assert 0 CSP violations under the existing strict policy (AR-16); if xterm trips it, STOP and raise a new AR before loosening.
- [ ] 3.7 Impl tests: `remount` param-merge; double-`close` no-op; singleton closes the prior dialog.

**Verify**: `yarn verify` (+ a manual `yarn docs:dev` Play smoke)

---

## Phase 4 — Accessibility, fallback, deep-link & controls
Ref: 03-04, 03-03 · AR-12/13/19.

- [ ] 4.1 Spec: write ST-11 (DOM source+blurb+labelled Play), ST-12 (no-keyboard fallback slot+note; missing-asset degrade) — run red.
- [ ] 4.2 Implement `src/play/no-keyboard.ts` (`isNoKeyboardDevice`) + the fallback slot in `PlayExample.vue` (note + `/screenshots/<id>.gif`, degrade to note+source) — green ST-12.
- [ ] 4.3 Implement the always-in-DOM a11y region (blurb `<p>`, ARIA-labelled `<button>`, `role="dialog"` focus move/return) — green ST-11.
- [ ] 4.4 Implement deep-link (`?example=<id>` → scroll+highlight+open **without auto-focusing**; no-keyboard ⇒ fallback) + the Reset control + the size selector (80×24 / 100×30 via `remount`).
- [ ] 4.5 Impl tests: deep-link parser (match / unknown no-op / no-keyboard opens no terminal).

**Verify**: `yarn verify`

---

## Phase 5a — Seed examples: prove the mechanism
Ref: 03-05 · AR-18/20, AC-9.

- [ ] 5a.1 Spec: write ST-13 (`files/file-dialog` lists the seeded tree + navigates a subdir) and the ST-2 coverage for these two — run red.
- [ ] 5a.2 Implement `examples/controls/button.ts` (minimal) + its page (blurb, `<<<`, `<PlayExample>`, a11y region); register it.
- [ ] 5a.3 Implement `examples/files/file-dialog.ts` (full; seeds a virtual tree incl. a raw-`ESC` file for ST-14) + its page; register it — green ST-13 + ST-2 (both).
- [ ] 5a.4 Green the remaining ST-14 half (sanitize strips the raw `ESC` in the painted frame; source rendered escaped).

**Verify**: `yarn verify`

---

## Phase 5b — Seed examples: breadth
Ref: 03-05 · AR-20. (Droppable under time pressure: input / list-box / data-grid / preset-gallery.)

- [ ] 5b.1 `controls/input` (minimal) — module + page + registry; paint-smoke green.
- [ ] 5b.2 `controls/form-dialog` (full) — module + page + registry; paint-smoke green.
- [ ] 5b.3 `containers/list-box` (minimal) — module + page + registry; paint-smoke green.
- [ ] 5b.4 `table/data-grid` (full) — module + page + registry; paint-smoke green.
- [ ] 5b.5 `apps/desktop` (full) — re-author from `web-xterm/app.ts` `buildApp`; module + page + registry; paint-smoke green (RD-04 hero).
- [ ] 5b.6 `theming/preset-gallery` (full) — module + page + registry; paint-smoke green (theme+depth showcase).

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
