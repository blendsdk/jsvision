# Current State: jsvision-plugin

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

There is **no plugin scaffolding** in the repo today (no `.claude-plugin/`, no `skills/`, no
`marketplace.json`). What exists is a mature SDK plus a wealth of verified teaching assets the
plugin will distill and reference rather than duplicate.

**The SDK surface a plugin must teach (verified this session):**

- `@jsvision/ui` (`packages/ui/src/index.ts`) — the single-import widget framework: re-exports the
  reactive core, a declarative layout DSL (`col`/`row`/`stack`/`centered`/`at`-style placement via
  `LayoutProps`), the app shell (`createApplication`, `Desktop`, `Window`, `MenuBar`,
  `StatusLine`), ~40 widgets (controls, `Dialog` + `messageBox`/`confirm`/`inputBox`, `ListView`/
  `ListBox`, `DataGrid<T>`, `Tree`, `TabView`, `ProgressBar`/`Spinner`, `Calendar`/`DatePicker`,
  `ColorPicker`, `Editor`, dropdowns, `Surface`), and a curated handful of `@jsvision/core`
  essentials (`resolveCapabilities`, `createKeymap`, `Attr`).
- Entry points: `createApplication(opts)` → `app.desktop.addWindow(win)` → `await app.run()`
  (`packages/ui/src/app/application.ts`, `run.ts`); `mountApp(...)` for the browser
  (`packages/web/src/mount.ts`); `caps: 'auto'` default; `requireTty` default true;
  `app.onCommand(name, fn)`; `Commands.quit/tile/cascade/...`.
- Reactivity: `signal`/`computed`/`effect`/`batch`/`untrack`/`createRoot`/`Show`/`For`; views bind
  via `view.bind(reader, apply, {relayout})` **in `onMount`, not the constructor**
  (`packages/ui/src/view/view.ts`).

**Verified teaching assets to reuse / point at (never duplicate):**

- `packages/examples/tvision-demo/` — the flagship real-TTY app (zero-config caps, single-package
  imports, `app.onCommand`, `messageBox`).
- `packages/examples/kitchen-sink/` — Storybook-for-TUI: the `Story` contract + `kitchen-sink.smoke.spec`.
- `packages/docs-site/examples/` — the `defineExample({title,blurb,build})` modules (SSR/headless-safe),
  quoted into docs via the `<<< @/…#region` idiom — the model for the plugin's recipe quoting.
- `@example`-enforced JSDoc on every public symbol (`scripts/check-jsdoc.mjs`).

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/ui/src/index.ts` | Public API barrel | Read-only source for the component catalog |
| `packages/ui/src/app/application.ts`, `run.ts` | App lifecycle | Read-only source for `app-lifecycle.md` |
| `packages/examples/` (kitchen-sink, `*-demo`, `test/`) | Existing smoke/e2e harness | Add `recipes/**` modules + tests here (AR-5) |
| `packages/docs-site/examples/` + `src/demo-shell.ts` | `defineExample` + quoting idiom | Pattern reference for recipe modules + `<<<` quoting |
| root `package.json` | `verify` script | Add the `node scripts/check-plugin.mjs` step (AR-10) |
| `scripts/check-jsdoc.mjs`, `gate.mjs` | Existing governance scripts | Pattern reference for `check-plugin.mjs` |
| `codeops/00-roadmap.md` | Portfolio roadmap | Add the feature row (Phase 5 sync) |

### Code Analysis

The docs-site shares the anti-drift *goal* but via a different mechanism: it runs examples **live**
through a client Play component, and its snippet-drift test (`packages/docs-site/test/snippet-drift.spec.test.ts`)
actually *forbids* pasted source — there is **no** `<<< #region` transclusion in the repo, and a skill
file has no build step to expand one anyway (PF-002). So the plugin instead **embeds a literal fenced
code block copied from each recipe module's comment-delimited region**, and `check-plugin.mjs` fails if
the embedded block ≠ the source region (AR-5, AR-10). The
existing `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (mount headless → `paintedCells > 0`)
is the smoke pattern the recipe tests reuse; `*-demo.e2e.test.ts` (spawn under `tsx`, assert
stdout) is the e2e pattern for interactive walkthroughs.

## Gaps Identified

### Gap 1: No agent-facing app-authoring knowledge
**Current Behavior:** Expertise is implicit in scattered example code + JSDoc; the "build an app"
guide is a placeholder. **Required Behavior:** A skill that routes an agent to concise, correct,
progressive-disclosure knowledge (lifecycle, reactivity, layout, catalog, gotchas, verify loop).
**Fix Required:** FR-2, FR-3, FR-4 (03-02).

### Gap 2: No deterministic way to start a runnable app
**Current Behavior:** A new app is hand-assembled (package.json, tsconfig, vitest, main.ts, TTY
guard, workspace wiring) — error-prone and repeated. **Required Behavior:** One command emits a
complete, verified skeleton. **Fix Required:** FR-5 (03-04).

### Gap 3: Teaching examples risk drift
**Current Behavior:** Any hand-written app snippet in docs can rot against the SDK. **Required
Behavior:** Taught code == running, smoke-tested code. **Fix Required:** FR-6 + FR-8 (03-03, 03-01).

## Dependencies

### Internal Dependencies
- `@jsvision/ui` (+ `/core`, `/web`, `/files`) resolve via yarn workspaces (built dist for
  cross-package tests — rebuild before isolated runs; full `yarn verify` handles it via turbo).
- The existing `packages/examples` vitest `unit`/`e2e` projects and smoke/e2e helpers.

### External Dependencies
- The Claude Code plugin runtime (manifest/skill schema); `claude plugin validate` if available.
- No new npm runtime deps (the `check:deps` guard forbids native deps in public packages; the
  plugin's own scripts stay zero-dep).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Plugin-format details (frontmatter fields, manifest keys) differ from what was researched | Med | Med | Validate against the live schema (`claude plugin validate`) during Phase 1; keep manifest minimal (name/description/version) and rely on default dir conventions |
| Knowledge drifts from the SDK over time | Med | High | Recipes are real smoke-tested modules; snippet-drift + link-integrity gate in `check-plugin.mjs`; plugin versioned in-repo so it evolves with the SDK |
| Recipe smoke tests flaky/heavy in `packages/examples` | Low | Med | Reuse the proven headless mount → `paintedCells > 0` pattern; keep e2e child-process specs bounded (existing 15 s guard) |
| Turbo cache false-passes a governance check | Med | Med | Run `check-plugin.mjs` **directly** from `verify`, not through a cached turbo task (AR-10) |
| Scaffolder output pollutes the workspace during tests | Low | Med | Generator unit-tested as a pure file-map function; integration test writes to a throwaway package dir and cleans up (AR-8, AR-17) |
