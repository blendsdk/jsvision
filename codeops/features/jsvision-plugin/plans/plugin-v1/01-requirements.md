# Requirements: jsvision-plugin

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

This is the owning requirements document (the plan implements no upstream RD).

## Feature Overview

A Claude Code plugin, `jsvision-plugin`, that equips Claude to develop jsvision terminal-UI
applications at an expert level: to scaffold a runnable app, assemble it from the ~40 existing
widgets with correct reactivity and layout, avoid the framework's known footguns, run and verify
it, and — when needed — author new custom widgets. The plugin's teaching content is grounded in
**real, smoke-tested code** so it cannot drift from the SDK.

## Functional Requirements

### Must Have

- [ ] **FR-1 Plugin package.** A valid Claude Code plugin at `tools/claude-plugin/` with a
  `.claude-plugin/plugin.json` manifest, distributable via a repo-root `marketplace.json` and
  loadable locally with `claude --plugin-dir` (AR-1, AR-13).
- [ ] **FR-2 Knowledge skill.** A `jsvision` skill (auto-invoked via its `description`, AR-14)
  whose `SKILL.md` gives the mental model + non-negotiables + a router into progressive-disclosure
  reference files: `app-lifecycle`, `reactivity`, `layout`, `component-catalog`, `gotchas`,
  `running-and-testing`, `theming`, `widget-authoring`, and `recipes/` (AR-12).
- [ ] **FR-3 Gotchas encoded.** The `gotchas` reference captures the ~12 real-code footguns
  (missing `measure()`; `bind()` in `onMount`; absolute-position via `at()`; padding double-inset;
  `centered` vs explicit rect; flush after off-tick signal writes; reflow late-added windows; modal
  close must resolve `cancel`; own graphs in `createRoot`; focus `list.rows`; `.js` specifiers;
  custom `View` escape hatch), each with the correct fix.
- [ ] **FR-4 Run/verify discipline.** The `running-and-testing` reference teaches the three run
  modes (Node TTY, headless compose-to-ScreenBuffer, browser `mountApp`) and the headless-verify
  loop (drive synthetic events, assert painted cells), so Claude proves an app works.
- [ ] **FR-5 Scaffolder.** A `jsvision-new-app` skill (manual, AR-14) backed by a deterministic
  Node generator script (AR-8) that creates a complete runnable `packages/<slug>/` — package.json,
  tsconfig, vitest config, `src/main.ts` (TTY guard + `createApplication` + a starter window +
  `run()`), and a smoke test — wired into the yarn workspace.
- [ ] **FR-6 Recipes.** Four verified recipe apps, one per archetype (AR-4): data-driven &
  master-detail; forms/dialogs/wizards; file & text tools; live/dashboard & browser-hosted. Each is
  a **real module in `packages/examples/`** smoke-tested by the existing harness (AR-5), with a
  `recipes/<name>.md` reference that quotes the real module.
- [ ] **FR-7 Widget authoring.** A `widget-authoring` reference plus a real, paint-tested example
  custom widget (subclass `View`; `draw`/`measure`/`onEvent`; the repo's JSDoc + TV-fidelity
  conventions) (AR-3, AR-16).
- [ ] **FR-8 Integrity gate.** A `scripts/check-plugin.mjs`, invoked directly by the root `verify`
  (AR-10), that validates the manifest schema, SKILL/reference link-graph integrity, recipe
  snippet-drift (docs vs real modules), scaffolder-output validity, and **barrel-coverage** — every
  `@jsvision/ui` widget export appears in `component-catalog.md` and vice versa, so a new/changed
  SDK widget turns `yarn verify` red until documented (Tier 0 drift gate, AR-18).

### Should Have

- [ ] **FR-9 Publish-agnostic seam.** The single publish-sensitive line (how a scaffolded app
  declares its `@jsvision/ui` dependency) is isolated in the scaffolder for a one-spot future flip
  (AR-15).
- [ ] **FR-10 Install/usage docs.** A plugin `README.md` covering local `--plugin-dir` use, the
  marketplace install path, and the in-repo app-target model.

### Won't Have (Out of Scope for v1)

- A dedicated `jsvision-builder` subagent (AR-6, named deferral — revisit later).
- Hooks (e.g. SessionStart auto-context) (AR-7).
- Full support for building apps in **external** repos — blocked while `@jsvision/ui`/`/web`/
  `/files` are unpublished (AR-2); the knowledge is publish-agnostic so this can be added later.
- Publishing `@jsvision/ui` itself (a separate SDK milestone).
- The **AI-driven self-update pipeline** (auto-regenerate stale plugin content on SDK change) —
  deferred to the follow-on plan `plugin-self-sync` (AR-19). v1 ships only the deterministic Tier-0
  barrel-coverage gate that pipeline builds on.

## Technical Requirements

### Performance
- The generator script and `check-plugin.mjs` are pure Node (zero runtime deps), fast enough to
  run inside `yarn verify` without materially slowing it.

### Compatibility
- ESM-only; NodeNext `.js` import specifiers in generated code (AR — universally obvious).
- Recipe modules must be SSR/headless-safe where they feed the smoke harness (no hard DOM/`@xterm`
  dependency except the browser recipe's clearly-isolated mount layer), matching the existing
  `defineExample`/kitchen-sink conventions.
- Plugin manifest/skill format targets the current Claude Code plugin schema.

### Security
- **SEC-1** The scaffolder sanitizes the app-name argument to a lowercase slug and rejects `/`,
  `..`, and absolute paths; it never writes outside `packages/<slug>/` (AR-17).
- **SEC-2** No secrets or credentials are embedded or logged; generated apps rely on the SDK's
  existing `sanitize` boundary for runtime terminal input (no new injection surface).

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Expertise breadth | apps-only / apps+widgets | apps + widget authoring | User wants comprehensive coverage | AR-3 |
| App target | in-repo / external / both | in-repo, publish-agnostic | Only friction-free path today | AR-2 |
| Recipe archetypes | any subset | all four | Cover data→utility spectrum | AR-4 |
| Recipe code home | examples / plugin / new pkg | packages/examples | Least plumbing, strongest anti-drift | AR-5 |
| Scaffolder mechanism | prose / script | Node script + skill wrapper | Deterministic + testable | AR-8 |
| Integrity gate placement | turbo task / root script | root `check-plugin.mjs` in verify | Avoids turbo-cache staleness | AR-10 |

> **Traceability:** Every scope decision references the Ambiguity Register entry that resolved it.
> See `00-ambiguity-register.md`.

## Acceptance Criteria

1. [ ] The plugin loads via `claude --plugin-dir tools/claude-plugin`; `claude plugin validate`
   (or the equivalent schema check in `check-plugin.mjs`) passes.
2. [ ] `/jsvision-new-app <name>` produces a `packages/<name>/` that **typechecks and whose smoke
   test passes** with no manual fixup.
3. [ ] All four recipe apps + the example custom widget mount headless and paint (smoke green); the
   forms recipe's `valid()` gate and the live recipe's progress advance behave per their ST-cases.
4. [ ] `scripts/check-plugin.mjs` passes on the real plugin and fails on seeded-broken fixtures
   (bad manifest / dead link / snippet drift / a widget exported but missing from the catalog).
5. [ ] `yarn verify` is green (including the new check-plugin step) with no regressions.
6. [ ] Documentation (plugin README + reference files) is complete; the `gotchas` reference lists
   all ~12 footguns with fixes.
