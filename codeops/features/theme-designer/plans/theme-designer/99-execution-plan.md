# Execution Plan: Theme Designer

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-09 01:00
> **Progress**: 34/40 tasks (85%)
> **CodeOps Skills Version**: 3.3.2

## Overview

Build the standalone `@jsvision/theme-designer` app and the reusable `Slider` it needs, spec-first. Phase 1
delivers the framework `Slider` (+ shared track math + core roles). Phase 2 scaffolds the package and the
pure `DesignerModel`. Phase 3 builds the 3-pane TUI, inspector, preview, and file I/O. Phase 4 integrates
the walkthrough e2e, retires the old live demo, and wires CI/docs.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | `Slider` widget + shared track math + core roles & exports | 14 |
| 2 | Package scaffold + pure `DesignerModel` | 9 |
| 3 | The designer app (view · inspector · preview · file I/O) | 11 |
| 4 | Integration, e2e, `demo:themes` retire, CI & docs | 6 |

**Total: 40 tasks across 4 phases.**

> **⚠️ EXECUTION RULE:** the task checkboxes below are the single source of truth for progress. Mark `[~]`
> with a timestamp on implementation, promote to `[x]` only after its verify passes, and update the Progress
> header after every task. Resume at the first `[~]` then the first `[ ]`. Timestamps via `date '+%Y-%m-%d %H:%M'`.
> Specification-first: spec tests → red → implement → green → impl tests → verify.

---

## Phase 1: `Slider` widget + shared track math + core roles

### Step 1.1: Spec tests (RED)

**Reference**: [03-01](03-01-slider-widget.md) · [07](07-testing-strategy.md) ST-1…ST-11 · AR-3/8/9/17/18

- [x] 1.1.1 Spec tests for the pure track math — `packages/ui/test/track.spec.test.ts` (ST-1…ST-4) — 2026-07-08 23:56
- [x] 1.1.2 Spec tests for `Slider` render + interaction (both orientations, keyboard, drag, wheel) — `packages/ui/test/slider.spec.test.ts` (ST-5…ST-9) — 2026-07-08 23:56
- [x] 1.1.3 Spec test freezing `sliderTrack`/`sliderThumb` `defaultTheme` bytes — `packages/core/test/slider-theme.spec.test.ts` (ST-11); + a ScrollBar value↔thumb regression assertion (ST-10) — 2026-07-08 23:56
- [x] 1.1.4 Verify RED: the new spec tests fail (no impl yet) — 2026-07-08 23:56

### Step 1.2: Implementation (GREEN)

**Reference**: [03-01](03-01-slider-widget.md) · AR-9/18

- [x] 1.2.1 Add `sliderTrack` + `sliderThumb` to the `Theme` interface + `defaultTheme` + `monochromeTheme` — `packages/core/src/engine/color/theme.ts`, `presets.ts` — 2026-07-09 00:04
- [x] 1.2.2 Map the 2 new roles in `rolesFromAliases` (derive from `border`/`accent`) — `packages/core/src/engine/color/roles.ts` — 2026-07-09 00:04
- [x] 1.2.2b Additive core exports the model needs (no behavior change): export `aliasesFromSeeds` (`create-theme.ts`), re-export `rgb256` (`palette.ts` → `color/index.ts` → `engine/index.ts`), and expose the 5 derived presets' seed sets as data (`PRESET_SEEDS`, `presets.ts`) — with `@example` JSDoc on each new public symbol — 2026-07-09 00:04
- [x] 1.2.3 Create the pure shared helper (`clampValue`/`valueToOffset`/`offsetToValue`/`stepValue`) — `packages/ui/src/controls/track.ts` — 2026-07-09 00:04
- [x] 1.2.4 Refactor `ScrollBar` to consume `track.ts` (public behavior unchanged) — `packages/ui/src/scroll/scroll-bar.ts` — 2026-07-09 00:04
- [x] 1.2.5 Implement `Slider` (both orientations, keyboard/mouse/drag/wheel, `onInput`/`onChange`, groove+thumb) with `@example` JSDoc — `packages/ui/src/controls/slider.ts`; export from `packages/ui/src/index.ts` — 2026-07-09 00:04
- [x] 1.2.6 Verify GREEN: spec tests pass; ScrollBar's existing suite + `defaultTheme` byte-freeze/golden/a11y suites still green (core 688 ✓, ui 1443 ✓) — 2026-07-09 00:04

### Step 1.3: Impl tests & story

- [x] 1.3.1 Impl tests: degenerate range, non-integer value, vertical drag, capture release, `measure()` — `packages/ui/test/{track,slider}.impl.test.ts` — 2026-07-09 00:09
- [x] 1.3.2 Kitchen-sink `controls/slider` story + registry line — `packages/examples/kitchen-sink/stories/slider.story.ts`, `stories/index.ts` (ST-30) — 2026-07-09 00:09
- [x] 1.3.3 Verify: `yarn verify` + `yarn lint` + ui/core `typecheck` + `check:docs` green (14/14 turbo tasks; smoke 49 ✓) — 2026-07-09 00:09

**Verify**: `yarn verify` (+ `yarn lint`, per-package `typecheck`)

---

## Phase 2: Package scaffold + pure `DesignerModel`

### Step 2.1: Scaffold + spec tests (RED)

**Reference**: [03-02](03-02-designer-model.md) · [03-04](03-04-packaging.md) · [07](07-testing-strategy.md) ST-12…ST-22 · AR-10/11/23

- [x] 2.1.1 Scaffold `packages/theme-designer/` — `package.json` (private, deps core+ui+files), `tsconfig.json`, `vitest.config.ts`, `README.md` (03-04) — 2026-07-09 00:38
- [x] 2.1.2 Spec tests for `DesignerModel` — derive, role override + last-wins, clear, preset (derived→derive mode / literal→roles mode), contrast, depth, serialize round-trip, import valid/invalid, dirty, roles→derive transition-is-visible — `packages/theme-designer/test/model.spec.test.ts` (ST-12…ST-21, ST-31) — 2026-07-09 00:38
- [x] 2.1.3 Spec tests for the `#rrggbb` hex validator — `packages/theme-designer/test/hex-validator.spec.test.ts` (ST-22) — 2026-07-09 00:38
- [x] 2.1.4 Verify RED — 2026-07-09 00:38

### Step 2.2: Implementation (GREEN)

**Reference**: [03-02](03-02-designer-model.md)

- [x] 2.2.1 `hex-validator.ts` (`#rrggbb`/`#rgb` well-formed `Validator`) — `packages/theme-designer/src/model/hex-validator.ts` — 2026-07-09 00:38
- [x] 2.2.2 `DesignerModel` — two-mode state (`roleSnapshot` null⇒derive / non-null⇒roles), `theme()` derivation (derive: `createTheme({...seeds, overrides: aliasOverrides, roleOverrides})`; roles: `applyRoleOverrides(roleSnapshot, roleOverrides)`), roles→derive transition on first alias/seed edit, `resolvedAliases`, own `PresetName` registry + preset mapping, `contrastRows`, `depthSamples` (uses `rgb256`), export/import/dirty — `packages/theme-designer/src/model/` — 2026-07-09 00:38
- [x] 2.2.3 Verify GREEN — 2026-07-09 00:38

### Step 2.3: Impl tests & hardening

- [x] 2.3.1 Impl tests: roles↔derive transitions (`roleSnapshot` lifecycle, user role edits surviving), light/dark derivation, preset↔dirty edges, `resolvedAliases` in both modes — `packages/theme-designer/test/model.impl.test.ts` — 2026-07-09 00:38
- [x] 2.3.2 Verify: `yarn verify` picks up the new package; `sync-versions --check` still green (private skipped) — 2026-07-09 00:38

**Verify**: `yarn verify` (+ `yarn workspace @jsvision/theme-designer typecheck`)

---

## Phase 3: The designer app (view · inspector · preview · file I/O)

### Step 3.1: Spec tests (RED)

**Reference**: [03-03](03-03-designer-app.md) · [07](07-testing-strategy.md) ST-24…ST-29 · AR-5/12/13/14/15/20/21/24

- [x] 3.1.1 App-core spec tests on a headless `Application` (injected input/output, `requireTty:false`): select→picker (ST-24), slider edit→setTheme (ST-25), dirty guard (ST-26), open/cancel via a fake FileDialog/FileSystem (ST-27), save (ST-28), invalid import→error+unchanged (ST-29) — `packages/theme-designer/test/app.spec.test.ts` — 2026-07-09 01:00
- [x] 3.1.2 Verify RED — 2026-07-09 01:00

### Step 3.2: Implementation (GREEN)

**Reference**: [03-03](03-03-designer-app.md)

- [x] 3.2.1 `gallery.ts` — the curated live-preview widget scene (AR-5) — `packages/theme-designer/src/view/gallery.ts` — 2026-07-09 01:00
- [x] 3.2.2 `preview-panel.ts` — hosts the gallery; repaints on `model.theme()` via `setTheme`; honors preview depth — `packages/theme-designer/src/view/preview-panel.ts` — 2026-07-09 01:00
- [x] 3.2.3 `roles-panel.ts` — 16 aliases + Advanced-roles list; selects the edit target (AR-13) — `packages/theme-designer/src/view/roles-panel.ts` — 2026-07-09 01:00
- [x] 3.2.4 `inspector-panel.ts` — R/G/B `Slider`s + hex `Input` + `ColorSwatch` (synced, loop-guarded), contrast rows, depth **sample strip** (display-only via `depthSamples`; no gallery re-render, PF-004) — `packages/theme-designer/src/view/inspector-panel.ts` — 2026-07-09 01:00
- [x] 3.2.5 `host/file-io.ts` — open/save via `@jsvision/files` **`openFile(host,{save})`** + read/write; import error→`errorBox`/`messageBox`; `markSaved` (AR-4/20/21, PF-007) — `packages/theme-designer/src/host/file-io.ts` — 2026-07-09 01:00
- [x] 3.2.6 `app.ts` — compose menu bar + 3-pane workspace + status line; wire commands (presets/reset/open/save/quit/depth) + the dirty-guard `confirm` (AR-12/24) — `packages/theme-designer/src/app.ts` — 2026-07-09 01:00
- [x] 3.2.7 Verify GREEN — 2026-07-09 01:00

### Step 3.3: Impl tests & hardening

- [x] 3.3.1 Impl tests: menu/command wiring, depth toggle re-renders preview, save-error path — `packages/theme-designer/test/app.impl.test.ts` — 2026-07-09 01:00
- [x] 3.3.2 Verify: `yarn verify` + ui/core/theme-designer `typecheck` + lint green — 2026-07-09 01:00

**Verify**: `yarn verify` (+ per-package `typecheck`)

---

## Phase 4: Integration, e2e, `demo:themes` retire, CI & docs

### Step 4.1: Entrypoint + walkthrough e2e (spec-first)

**Reference**: [03-03](03-03-designer-app.md) · [03-04](03-04-packaging.md) · ST-23 · AR-6/11/22

- [ ] 4.1.1 Walkthrough e2e spec (piped renders a non-empty frame per step) — `packages/theme-designer/test/walkthrough.e2e.test.ts` (ST-23); verify RED
- [ ] 4.1.2 `main.ts` (TTY split) + `host/walkthrough.ts` (narrated frames) — `packages/theme-designer/src/main.ts`, `src/host/walkthrough.ts`; verify GREEN
- [ ] 4.1.3 Retire the `demo:themes` live-TTY branch (keep the headless walkthrough + its e2e) — `packages/examples/themes-demo/main.ts` (AR-6)

### Step 4.2: Wiring & docs

- [ ] 4.2.1 CI: add `yarn workspace @jsvision/theme-designer test:e2e` to the POSIX e2e block — `.github/workflows/ci.yml`; add the root convenience passthrough script — root `package.json`
- [ ] 4.2.2 Docs: `CHANGELOG.md` `[Unreleased]` (Slider + roles + app); update the `demo:themes` description in `CLAUDE.md`; new package `README.md`
- [ ] 4.2.3 Full gate: `yarn verify` + `yarn lint` + per-package `typecheck` + `check:docs` + `yarn workspace @jsvision/theme-designer test:e2e` + examples e2e (walkthrough-only `demo:themes`) all green

**Verify**: `yarn verify` (+ `yarn lint`, per-package `typecheck`, `test:e2e` for theme-designer & examples)

---

## Dependencies

```
Phase 1 (Slider + roles)   ← foundation; unblocks the inspector's R/G/B sliders
    ↓
Phase 2 (package + model)  ← pure logic the view binds to
    ↓
Phase 3 (app view/shell)   ← uses Slider (P1) + model (P2)
    ↓
Phase 4 (e2e, retire, CI)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed.
2. ✅ `yarn verify` + `yarn lint` + per-package `typecheck` + `check:docs` passing; new-package `test:e2e` in CI.
3. ✅ No warnings/errors.
4. ✅ No dead code.
5. ✅ Security hardened — hex validator + `parseTheme` (JSON-only) + sanitized filenames; core stays pure.
6. ✅ Docs updated (CHANGELOG, README, CLAUDE.md demo line).
7. ✅ `Slider` carries an `@example`; no banned refs in `packages/*/src`.
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill).
