# Execution Plan: jsvision-plugin (plugin-v1)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-11 13:21
> **Progress**: 5/37 tasks (14%)
> **CodeOps Skills Version**: 3.3.2

## Overview

Build the `jsvision-plugin` Claude Code plugin: the plugin shell + manifest, a deterministic
scaffolder, four verified recipe apps + an example custom widget, the `jsvision` knowledge skill,
and the `check-plugin.mjs` integrity gate wired into `yarn verify`. Code phases follow
specification-first ordering; the knowledge phase is prose validated structurally by the gate. The gate includes a
Tier-0 **barrel-coverage** drift check (a new/changed SDK widget turns `yarn verify` red until documented, AR-18);
the AI-driven self-update pipeline is a separate follow-on plan (`plugin-self-sync`, AR-19).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Plugin foundation & manifests | 5 |
| 2 | Scaffolder (generator + skill) | 8 |
| 3 | Recipes + example widget | 10 |
| 4 | Knowledge base (`jsvision` skill) | 7 |
| 5 | Integrity gate, verify wiring & acceptance | 7 |

**Total: 37 tasks across 5 phases** (scope bounded by the task-size criteria; no hour estimates).

> **⚠️ EXECUTION RULE:** the task checkboxes below are the single source of truth for progress.
> On implementation mark `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; on verify-pass promote to
> `[x]` with `(completed: …)`; update the Progress header + Last Updated after every task.
> Timestamps come from `date '+%Y-%m-%d %H:%M'`. Resume at the first `[~]`, else the first `[ ]`.

---

## Phase 1: Plugin foundation & manifests

### Step 1.1: The plugin shell

**Reference**: 03-01 §Implementation Details · AR-1, AR-11, AR-13
**Objective**: A valid, loadable plugin skeleton with manifest, marketplace entry, and README.

- [x] 1.1.1 Create the manifest — `tools/claude-plugin/.claude-plugin/plugin.json` ✅ (completed: 2026-07-11 13:21)
- [x] 1.1.2 Create the marketplace entry (local `source` string) — `.claude-plugin/marketplace.json` (repo root) ✅ (completed: 2026-07-11 13:21)
- [x] 1.1.3 Write the plugin README (install `--plugin-dir` + marketplace path + in-repo app-target model) — `tools/claude-plugin/README.md` ✅ (completed: 2026-07-11 13:21)
- [x] 1.1.4 Create the `skills/` + `templates/` directory skeleton — `tools/claude-plugin/` ✅ (completed: 2026-07-11 13:21)
- [x] 1.1.5 Validate the manifest against the live schema — `claude plugin validate ./tools/claude-plugin` → **✔ Validation passed** ✅ (completed: 2026-07-11 13:21)

**Deliverables**:
- [x] Plugin loads via `claude --plugin-dir tools/claude-plugin` (manifest validated)
- [x] All verification passing (`yarn lint` green; turbo build/test unaffected — files are outside all workspaces)

**Verify**: `yarn verify`

---

## Phase 2: Scaffolder (generator + skill)

### Step 2.1: Specification tests

**Reference**: 07 ST-1…ST-6 · 03-04
**Objective**: Lock the generator's behavior before implementing it.

- [ ] 2.1.1 Write scaffolder spec tests from ST-1…ST-6 — `packages/examples/test/new-jsvision-app.spec.test.ts` (imports the generator by relative path)
- [ ] 2.1.2 Run spec tests — verify they FAIL (red phase)

### Step 2.2: Implementation

**Reference**: 03-04 §Implementation Details · AR-8, AR-15, AR-17
**Objective**: The deterministic generator + its skill wrapper + templates.

- [ ] 2.2.1 Implement the generator (`slugify`, `uiDependency`, pure `buildAppFiles`, fs wrapper with no-overwrite + path-safety) — `tools/claude-plugin/skills/jsvision-new-app/scripts/new-jsvision-app.mjs`
- [ ] 2.2.2 Implement the app-skeleton templates (package.json, tsconfig, vitest.config, main.ts, smoke test) — `tools/claude-plugin/templates/app-skeleton/`
- [ ] 2.2.3 Implement the scaffolder skill wrapper (manual, `argument-hint`) — `tools/claude-plugin/skills/jsvision-new-app/SKILL.md`
- [ ] 2.2.4 Run spec tests — verify they PASS (green phase); fix the implementation (never the test) on mismatch

### Step 2.3: Implementation tests & hardening

**Reference**: 07 §Implementation Tests
- [ ] 2.3.1 Write impl tests (existing-package refusal, unicode/edge names, repeat-collapse, `uiDependency` seam) — `packages/examples/test/new-jsvision-app.impl.test.ts`
- [ ] 2.3.2 Full verification

**Verify**: `yarn verify`

---

## Phase 3: Recipes + example widget

### Step 3.1: Specification tests

**Reference**: 07 ST-7…ST-11 · 03-03
**Objective**: Lock recipe paint + behavior before implementing the modules.

- [ ] 3.1.1 Write recipe smoke + behavior spec tests from ST-7…ST-11 — `packages/examples/test/recipes.smoke.spec.test.ts`
- [ ] 3.1.2 Run spec tests — verify they FAIL (red phase)

### Step 3.2: Implementation

**Reference**: 03-03 §The four recipes / §The example custom widget · AR-4, AR-5, AR-16
**Objective**: The four recipe apps + the example widget as real modules with `#region example`.

- [ ] 3.2.1 Implement the data-driven & master-detail recipe — `packages/examples/recipes/data-grid/`
- [ ] 3.2.2 Implement the forms/dialogs/wizards recipe — `packages/examples/recipes/form-dialog/`
- [ ] 3.2.3 Implement the file & text tools recipe — `packages/examples/recipes/file-tools/`
- [ ] 3.2.4 Implement the live/dashboard recipe (+ browser-hosted variant) — `packages/examples/recipes/live-dashboard/`
- [ ] 3.2.5 Implement the example custom widget — `packages/examples/recipes/custom-widget/`
- [ ] 3.2.6 Run spec tests — verify they PASS (green phase)

### Step 3.3: Implementation tests & hardening

- [ ] 3.3.1 Add optional e2e walkthroughs for the interactive recipes — `packages/examples/test/recipes-*.e2e.test.ts`
- [ ] 3.3.2 Full verification

**Verify**: `yarn verify`

---

## Phase 4: Knowledge base (the `jsvision` skill)

### Step 4.1: Author the skill + references

**Reference**: 03-02 §Architecture · AR-12, AR-14 · (content validated by Phase 5's gate)
**Objective**: The concise router + progressive-disclosure references; recipe pages quote the
Phase-3 modules. (Prose — no spec-test step; integrity is enforced by `check-plugin.mjs` in Phase 5.)

- [ ] 4.1.1 Write the router — `tools/claude-plugin/skills/jsvision/SKILL.md` (mental model + non-negotiables + routing table + auto-invoke `description`)
- [ ] 4.1.2 Write `app-lifecycle.md`, `reactivity.md`, `layout.md` — `…/skills/jsvision/references/`
- [ ] 4.1.3 Write `component-catalog.md`, `theming.md` — `…/references/`
- [ ] 4.1.4 Write `gotchas.md` — all 12 footguns with fixes (FR-3) — `…/references/`
- [ ] 4.1.5 Write `running-and-testing.md` — three run modes + the headless-verify loop (FR-4) — `…/references/`
- [ ] 4.1.6 Write `widget-authoring.md` — subclass `View`; draw/measure/onEvent; conventions; link the example widget (FR-7) — `…/references/`
- [ ] 4.1.7 Write `recipes/index.md` + `recipes/<archetype>.md` embedding a literal, drift-checked copy of the Phase-3 modules' `#region example` blocks — `…/references/recipes/`

**Deliverables**:
- [ ] Every reference link resolves; every recipe page quotes its real module
- [ ] All verification passing

**Verify**: `yarn verify`

---

## Phase 5: Integrity gate, verify wiring & acceptance

### Step 5.1: Specification tests

**Reference**: 07 ST-12…ST-16 · 03-01 §check-plugin.mjs
**Objective**: Lock the gate's behavior with good + seeded-broken fixtures before implementing it.

- [ ] 5.1.1 Create fixtures + write gate spec tests from ST-12…ST-16, ST-18 — `packages/examples/test/check-plugin.spec.test.ts` (+ `test/fixtures/plugin-*/`)
- [ ] 5.1.2 Run spec tests — verify they FAIL (red phase)

### Step 5.2: Implementation

**Reference**: 03-01 §check-plugin.mjs / §Root verify wiring · AR-10, FR-8
- [ ] 5.2.1 Implement the gate (manifest schema · link-graph · snippet-drift · gotchas completeness · **barrel-coverage** vs the `@jsvision/ui` barrel, AR-18), exporting pure check fns — `scripts/check-plugin.mjs`
- [ ] 5.2.2 Run spec tests — verify they PASS (green phase)
- [ ] 5.2.3 Wire `node scripts/check-plugin.mjs` into the root `verify` script — `package.json`

### Step 5.3: Acceptance & hardening

**Reference**: 07 ST-17 · 01 §Acceptance Criteria
- [ ] 5.3.1 Run the acceptance flow: load via `--plugin-dir`, `/jsvision-new-app sample`, confirm the generated app typechecks + smoke passes, then remove the sample (ST-17)
- [ ] 5.3.2 Full verification — `yarn verify` green including the new gate; no regressions

**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (foundation)
    ├─→ Phase 2 (scaffolder)  ─┐
    └─→ Phase 3 (recipes)  ────┤
                               ↓
                          Phase 4 (knowledge — quotes recipes, references scaffolder)
                               ↓
                          Phase 5 (gate + verify wiring + acceptance — needs all prior)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (`yarn verify`, including `scripts/check-plugin.mjs`)
3. ✅ No warnings/errors
4. ✅ No dead code — no unused parameters, functions, or modules
5. ✅ Security hardened — scaffolder name sanitization (SEC-1), no writes outside `packages/<slug>/`, no secrets
6. ✅ Documentation updated — plugin README + all reference files; `gotchas.md` lists all 12 footguns
7. ✅ Acceptance met — the plugin loads, scaffolds a runnable app, and the four recipes + example widget are smoke-green
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
