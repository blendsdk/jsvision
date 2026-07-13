# Testing Strategy: jsvision-plugin

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core logic (generator script, `check-plugin.mjs` checks) | 90% |
| Recipe modules / glue | 65% |
| Knowledge prose (SKILL.md + references) | n/a — validated structurally by `check-plugin.mjs` |

The testable surface is the **code**, not the prose: the scaffolder generator, the recipe modules,
the example widget, and the integrity gate. Prose correctness is enforced structurally (link-graph,
snippet-drift, gotchas-completeness) by `check-plugin.mjs`. Test names state behavior. Tests live in
`packages/examples/test/` (existing vitest `unit`/`e2e` projects), importing the generator and
`check-plugin.mjs` by relative path.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from `01-requirements.md`, the `03-XX` specs, and the Ambiguity Register.
> Immutable oracle: if the implementation disagrees, the implementation is wrong.

### Scaffolder (03-04)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `slugify('My App')` | `'my-app'` (lowercase, spaces→`-`) | FR-5 / AR-17 |
| ST-2 | `buildAppFiles('todo')` key set | contains `packages/todo/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/main.ts`, `test/todo.smoke.test.ts` | FR-5 |
| ST-3 | generated `packages/todo/package.json` | `name:"@jsvision/todo"`, `private:true`, `type:"module"`, `@jsvision/ui` dep produced by `uiDependency()` (workspace form) | FR-5 / AR-15 |
| ST-4 | generated `src/main.ts` | contains the `isTTY` guard, `createApplication(`, `desktop.addWindow(`, and `run()` | FR-5 |
| ST-5 | `buildAppFiles('../evil')`, `'a/b'`, `'/abs'`, `''` | throws before any write; nothing created | SEC-1 / AR-17 |
| ST-6 | write `todo` into a throwaway package dir, then typecheck + run its smoke test | both pass; then dir removed | FR-5 / AC-2 |

### Recipes & example widget (03-03)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-7 | mount the `data-grid` recipe headless; then simulate a header click on a sortable column | paints (`paintedCells > 0`); row order flips to sorted | FR-6 |
| ST-8 | `form-dialog` recipe: set an out-of-range field and emit OK; then correct it and emit OK | first OK is vetoed (dialog stays; focus moves to the invalid field); second resolves the modal to `'ok'` | FR-6 |
| ST-9 | mount the `file-tools` recipe over a temp/virtual `FileSystem`; open a seeded file | paints; file contents shown; no write outside the temp/virtual FS | FR-6 / AR-17 |
| ST-10 | `live-dashboard` recipe: run the tick idiom to completion; mount the browser variant on an `@xterm/headless` terminal | progress advances 0→100 and paints; browser variant mounts without error | FR-6 |
| ST-11 | example custom widget: call `measure(available)`; mount, then update its bound signal | `measure` returns a non-zero size; the update changes the composed buffer (repaint) | FR-7 / AR-16 |

### Integrity gate `check-plugin.mjs` (03-01)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-12 | run every check against the real plugin tree | all pass; exit code 0 | FR-8 |
| ST-13 | fixture: a reference file links to a missing target | fails; exit ≠0; message names the file + dead target | FR-8 / AR-10 |
| ST-14 | fixture: `plugin.json` missing a required field, or `marketplace.json` not referencing the plugin | fails; exit ≠0 | FR-8 / AR-10 |
| ST-15 | fixture: a recipe `.md` **embedded copied block** ≠ its source module region | fails; exit ≠0 (snippet drift) | FR-8 / AR-10 |
| ST-16 | remove one footgun from `gotchas.md` | completeness check fails (all 12 required) | FR-3 / AR-10 |
| ST-18 | fixture: a **class value export** of the `@jsvision/ui` barrel (not in the base-class denylist) is absent from `component-catalog.md` (or a catalog entry names a removed class) | barrel-coverage fails; exit ≠0 naming the class (the real plugin passes — ST-12) | FR-8 / AR-18 / PF-003 |

### Acceptance (end-to-end)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-17 | load via `claude --plugin-dir tools/claude-plugin`; run `/jsvision-new-app sample` | the `jsvision` skill is discoverable; the generated `packages/sample/` typechecks and its smoke test passes | AC-1, AC-2 |

> **⚠️ AUTHORING RULE:** Expectations derive from the specs above, not from imagined
> implementation output.

## Test Categories

### Specification Tests (from ST-cases)

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `packages/examples/test/new-jsvision-app.spec.test.ts` | ST-1…ST-6 | Scaffolder |
| `packages/examples/test/recipes.smoke.spec.test.ts` | ST-7…ST-11 | Recipes + widget |
| `packages/examples/test/check-plugin.spec.test.ts` | ST-12…ST-16, ST-18 | Integrity gate |

### Implementation Tests (edge cases, internals)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/examples/test/new-jsvision-app.impl.test.ts` | Existing-package refusal, unicode/edge names, repeat-collapse, `uiDependency` seam | High |
| `packages/examples/test/recipes-*.e2e.test.ts` | Child-process walkthroughs for the interactive recipes (optional) | Med |

### Integration / E2E

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| Scaffold → build (ST-6) | generate into a throwaway pkg dir → typecheck + smoke → clean up | green |
| Acceptance (ST-17) | `--plugin-dir` load → `/jsvision-new-app sample` → typecheck + smoke | green; skill discoverable |

## Test Data

### Fixtures Needed
- `packages/examples/test/fixtures/plugin-*/` — a good plugin fixture + seeded-broken variants
  (dead link, bad manifest, drifted recipe) for ST-13…ST-16.
- A temp/virtual `FileSystem` seed for the `file-tools` recipe (ST-9).

### Mock Requirements
- Prefer real objects: real `createRenderRoot`/`createEventLoop`, `@xterm/headless` for the browser
  variant, a temp dir (Node) or `createBrowserFileSystem` for files. No mocking of SDK internals.

> **Note (turbo-cache caveat):** the authoritative integrity gate is the direct
> `node scripts/check-plugin.mjs` run inside `yarn verify` (AR-10); the vitest spec tests give
> development-time confidence but a cached `packages/examples` `test` task can lag repo-root
> changes — always trust a fresh `verify` / CI.

## Verification Checklist
- [ ] All ST cases (ST-1…ST-17) defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement / spec doc / AR entry
- [ ] Specification tests written BEFORE implementation
- [ ] Spec tests verified to FAIL before implementation (red phase)
- [ ] All spec tests pass after implementation (green phase)
- [ ] Implementation tests written for edge cases and internals
- [ ] `node scripts/check-plugin.mjs` passes on the real plugin
- [ ] No regressions; `yarn verify` green
