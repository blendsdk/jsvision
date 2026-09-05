# Execution Plan: GroupBox

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-05 02:36
> **Progress**: 27/27 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement issue #205 through specification-first runtime, showcase, documentation, and distribution
phases. Every task must pass the minimum-sufficient checkpoint: component-local runtime behavior,
exact registry/tool mappings, no new dependency or generalized infrastructure, and no global
`View`, `Group`, `DrawContext`, layout, or sanitizer change.

**🚨 Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Runtime component and public API | 8 |
| 2 | Kitchen-sink showcase | 6 |
| 3 | Component page and template1 laboratory | 7 |
| 4 | Distribution and completion gates | 6 |

**Total: 27 tasks across 4 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the single source of truth. Mark only the active task `[~]` after
> implementation, then promote it to `[x]` only after its named verification passes. Post-phase
> quality review runs after the final task is `[x]`; it is not part of a task checkbox.

## Phase 1: Runtime Component and Public API

> **Phase baseline tree**: `534c1af04bf39967f3da7747c377a7e479007059`
> **Scope mode**: strict
> **Expected modification set**: `packages/ui/src/group-box/`, `packages/ui/src/index.ts`,
> `packages/ui/test/group-box.*.test.ts`, and this execution-plan progress record.

**Deliverables**: `packages/ui/src/group-box/`, the top-level UI export, and three immutable runtime
specification files; an implementation test is added only if the recorded branch review finds a gap.

**Verify**: `yarn workspace @jsvision/ui typecheck && yarn workspace @jsvision/ui test && yarn workspace @jsvision/ui check:docs`

### Step 1.1: Specification Tests

- [x] 1.1.1 [spec-author] Write rendering, sanitization, reactive, and remount specifications from ST-4–ST-15 and ST-31–ST-32 — `packages/ui/test/group-box.rendering.spec.test.ts` ✅ (completed: 2026-09-05 00:51)
- [x] 1.1.2 [spec-author] Write layout, focus, nesting, shadow, packaging, and documentation specifications from ST-1–ST-3, ST-16–ST-18, ST-25–ST-27, and ST-33 — `packages/ui/test/group-box.layout-focus.spec.test.ts`, `packages/ui/test/group-box.packaging.spec.test.ts` ✅ (completed: 2026-09-05 00:52)
- [x] 1.1.3 Confirm the focused specifications fail because GroupBox is absent — `yarn workspace @jsvision/ui test -- group-box` ✅ (completed: 2026-09-05 00:52 — all three GroupBox specification files failed on the missing module/export)

### Step 1.2: Implementation and Green Phase

- [x] 1.2.1 Implement the documented GroupBox types, private configuration, single-line safe caption painting, initial padding, component-local per-mount binding, and shadow flag — `packages/ui/src/group-box/group-box.ts`, `packages/ui/src/group-box/index.ts` ✅ (completed: 2026-09-05 00:55)
- [x] 1.2.2 Export GroupBox and its types from the package entry point — `packages/ui/src/index.ts` ✅ (completed: 2026-09-05 00:55)
- [x] 1.2.3 Make the immutable runtime specifications green — `yarn workspace @jsvision/ui test -- group-box` ✅ (completed: 2026-09-05 00:55 — 32 tests passed)

### Step 1.3: Implementation Hardening and Verification

- [x] 1.3.1 Review runtime branches after green; add a non-duplicative case only for an uncovered branch, otherwise record that no file is needed — `packages/ui/test/group-box.impl.test.ts` ✅ (completed: 2026-09-05 00:56 — covered the zero-width caption branch)
- [x] 1.3.2 Run the complete Phase 1 verification command ✅ (completed: 2026-09-05 00:57 — typecheck, 2,043 tests, and JSDoc gate passed)

> **Phase 1 quality review**: PASS — independent correctness/maintainability/standards review found
> no issues and confirmed the AR-9 component-only complexity boundary.

## Phase 2: Kitchen-Sink Showcase

> **Phase baseline tree**: `1ce4cab262db15ffd590ff2e43d458a2fd9d15c3`
> **Scope mode**: strict
> **Expected modification set**: `packages/examples/kitchen-sink/stories/group-box.story.ts`,
> `packages/examples/kitchen-sink/stories/index.ts`,
> `packages/examples/test/group-box-showcase*.test.ts`, and this progress record.

**Deliverables**: one registered `containers/group-box` kitchen-sink story and its immutable
specification; an implementation test is added only for a verified story-only branch gap.

**Verify**: `yarn workspace @jsvision/examples typecheck && yarn workspace @jsvision/examples test -- group-box-showcase kitchen-sink.smoke`

### Step 2.1: Specification Tests

- [x] 2.1.1 [spec-author] Write the registered rendering, interaction, focus, and cleanup specification from ST-19–ST-21 — `packages/examples/test/group-box-showcase.spec.test.ts` ✅ (completed: 2026-09-05 01:03)
- [x] 2.1.2 Confirm the focused specification fails because the story is absent — `yarn workspace @jsvision/examples test -- group-box-showcase` ✅ (completed: 2026-09-05 01:03 — all 3 showcase specifications failed on the missing registry entry)

### Step 2.2: Implementation and Green Phase

- [x] 2.2.1 Implement and register the bounded GroupBox story — `packages/examples/kitchen-sink/stories/group-box.story.ts`, `packages/examples/kitchen-sink/stories/index.ts` ✅ (completed: 2026-09-05 01:06)
- [x] 2.2.2 Make the focused specification and existing kitchen-sink smoke suite green — `yarn workspace @jsvision/examples test -- group-box-showcase kitchen-sink.smoke` ✅ (completed: 2026-09-05 01:06 — 76 tests passed)

### Step 2.3: Implementation Hardening and Verification

- [x] 2.3.1 Review story branches after green; add a non-duplicative case only for an uncovered branch, otherwise record that no file is needed — `packages/examples/test/group-box-showcase.impl.test.ts` ✅ (completed: 2026-09-05 01:07 — no file needed)
- [x] 2.3.2 Run the complete Phase 2 verification command ✅ (completed: 2026-09-05 01:11 — typecheck and 76 focused showcase/smoke tests passed; full distribution guard remains scheduled for Phase 4)

> **Phase 2 quality review**: PASS AFTER REMEDIATION — the user approved RV-001 through RV-003;
> focused verification and the single permitted re-review passed. The responsive 54×17 geometry,
> nested-frame protection, and helper documentation remain inside the story/spec files and add no
> abstraction or dependency. See `01-phase-reviews.md`.

## Phase 3: Component Page and Template1 Laboratory

> **Phase baseline tree**: `565b47424147c9f6dd807a26a9c9da026770ba7d`
> **Scope mode**: strict
> **Expected modification set**: `packages/docs-site/examples/containers/group-box.ts`, container
> example registries/contracts, `packages/docs-site/components/containers/group-box.md`, component
> catalog/API mapping, focused docs specifications, resize/catalog inventories, and this progress
> record.

**Deliverables**: one registered `kind: 'app'` template1 laboratory, a complete GroupBox component
page, catalog/API mappings, exact inventory/resize fixtures, and immutable docs specifications.

**Verify**: docs typecheck; every unit test file except the Phase 4 distribution-only `codex-plugin-guide.spec.test.ts`, selected explicitly; the complete DOM suite; and `yarn docs:build` (the complete docs suite runs after Phase 4 plugin synchronization per AR-12)

### Step 3.1: Specification Tests

- [x] 3.1.1 [spec-author] Write the page, real-app geometry, interaction, API, exact-inventory, and resize-policy specifications from ST-22–ST-24, ST-28–ST-30, and ST-34 — `packages/docs-site/test/group-box-component.spec.test.ts`, `packages/docs-site/test/component-catalog.spec.test.ts`, `packages/docs-site/test/contracts/primitive-resize.ts`, `packages/docs-site/test/container-components.spec.test.ts`, `packages/docs-site/test/contracts/containers.ts` ✅ (completed: 2026-09-05 01:24)
- [x] 3.1.2 Confirm focused docs specifications fail because the page/example/catalog entry is absent — `yarn workspace @jsvision/docs-site test:unit -- group-box-component component-catalog primitive-responsive-height-coverage container-components` ✅ (completed: 2026-09-05 01:34 — nine failures identified the absent example, page, catalog row, and resize population)

### Step 3.2: Implementation and Green Phase

- [x] 3.2.1 Implement and register the Classic template1 GroupBox laboratory — `packages/docs-site/examples/containers/group-box.ts`, `packages/docs-site/src/example-registry/containers.ts` ✅ (completed: 2026-09-05 01:40 — docs typecheck and 26 focused laboratory/resize tests passed)
- [x] 3.2.2 Author the complete component page and add catalog/API navigation — `packages/docs-site/components/containers/group-box.md`, `packages/docs-site/components.json`, `packages/docs-site/src/api/api-map.mjs` ✅ (completed: 2026-09-05 01:46 — Markdown formatted, catalog parsed, and diff whitespace check passed)
- [x] 3.2.3 Make all focused documentation specifications green — `yarn workspace @jsvision/docs-site test:unit -- group-box-component component-catalog primitive-responsive-height-coverage container-components` ✅ (completed: 2026-09-05 01:51 — 79 focused tests passed)

### Step 3.3: Implementation Hardening and Verification

- [x] 3.3.1 Review lab/page branches after green; add a non-duplicative case only for an uncovered branch, otherwise record that no file is needed — `packages/docs-site/test/group-box-component.impl.test.ts` ✅ (completed: 2026-09-05 01:52 — no file needed; the action callback, compact state, interaction, resize, maximize, restore, catalog, page, and disposal paths are already covered)
- [x] 3.3.2 Run the complete Phase 3 verification command ✅ (completed: 2026-09-05 02:02 — typecheck, 1,802 non-distribution unit tests, 12 DOM tests, generated API, and VitePress production build passed; complete distribution integrity remains scheduled for Phase 4 per AR-12)

> **Phase 3 quality review**: PASS AFTER REMEDIATION — the user's component-specific/no-
> overengineering approval covered RV-001 and RV-002; focused verification and the single permitted
> re-review passed. See `01-phase-reviews.md`.

## Phase 4: Distribution and Completion Gates

> **Phase baseline tree**: `48973e1ee423045e9c1a665da63ed48856403e95`
> **Scope mode**: strict
> **Expected modification set**: `packages/examples/test/api-reference.spec.test.ts`,
> `packages/examples/test/group-box-distribution*.test.ts`, `scripts/gen-plugin-api.mjs`,
> `tools/jsvision-skill/references/component-catalog.md`, generated
> `plugins/jsvision-plugin/skills/jsvision/` outputs, the UI/examples/docs-site changelogs, and this
> feature's execution/review records.

**Deliverables**: exact plugin API category mapping, immutable distribution artifact checks,
canonical skill guidance, regenerated plugin output, and three `Unreleased` changelog entries.

**Verify**: `yarn workspace @jsvision/examples test -- api-reference group-box-distribution && yarn plugin:check && yarn verify:local`

### Step 4.1: Specification Tests

- [x] 4.1.1 [spec-author] Add API-category, canonical-skill, generated-copy, and changelog specifications from ST-35–ST-37 — `packages/examples/test/api-reference.spec.test.ts`, `packages/examples/test/group-box-distribution.spec.test.ts` ✅ (completed: 2026-09-05 02:10 — formatting and whitespace gates passed)
- [x] 4.1.2 Confirm the focused specifications fail on the missing GroupBox distribution artifacts — `yarn workspace @jsvision/examples test -- api-reference group-box-distribution` ✅ (completed: 2026-09-05 02:13 — seven failures identified the absent category mapping, skill guidance, generated API placement, and Unreleased notes)

### Step 4.2: Implementation and Green Phase

- [x] 4.2.1 Add only the exact `group-box` category mapping, canonical component guidance, generated plugin synchronization, and three `Unreleased` entries — `scripts/gen-plugin-api.mjs`, `tools/jsvision-skill/references/component-catalog.md`, `plugins/jsvision-plugin/skills/jsvision/`, `packages/ui/CHANGELOG.md`, `packages/examples/CHANGELOG.md`, `packages/docs-site/CHANGELOG.md`; run `yarn plugin:update` ✅ (completed: 2026-09-05 02:16 — 18 API pages regenerated; only the expected containers/index artifacts changed)
- [x] 4.2.2 Make the distribution specifications green and confirm generated parity — `yarn workspace @jsvision/examples test -- api-reference group-box-distribution && yarn plugin:check` ✅ (completed: 2026-09-05 02:23 — 14 focused tests and every plugin integrity check passed)

### Step 4.3: Implementation Hardening and Verification

- [x] 4.3.1 Review mapping/artifact branches after green; add a non-duplicative case only for an uncovered branch, otherwise record that no file is needed — `packages/examples/test/group-box-distribution.impl.test.ts` ✅ (completed: 2026-09-05 02:24 — no file needed; exact category, parity, canonical guidance, generated API placement, and all changelog branches are covered)
- [x] 4.3.2 Run the complete final sequence: Phase 1 verify, Phase 2 verify, Phase 3 verify, `yarn plugin:check`, and `yarn verify:local` ✅ (completed: 2026-09-05 02:36 — UI typecheck/2,043 tests/JSDoc; examples typecheck/76 focused tests; docs typecheck/1,810 unit tests/12 DOM tests/build; plugin integrity; attribution; formatting; and 43-file local verification all passed)

> **Phase 4 quality review**: PASS — the independent distribution review found no issues and
> confirmed exact generated parity plus the component-specific/no-overengineering boundary. See
> `01-phase-reviews.md`.

## Dependencies

```text
Phase 1 runtime contract and public API
    ↓
Phase 2 kitchen-sink showcase
    ↓
Phase 3 component page and template1 laboratory
    ↓
Phase 4 plugin, changelogs, and final gates
```

## Success Criteria

1. All 27 tasks are verified in order.
2. Every ST case passes without weakening an existing specification.
3. The public API contains exactly the issue-approved class and types.
4. Runtime behavior stays inside `GroupBox`; no global lifecycle, drawing, layout, or sanitizer code changes.
5. No new dependency, generalized abstraction, test framework, or unrelated refactor is introduced.
6. Runtime, kitchen-sink, docs, generated API, canonical skill, plugin, and changelogs agree.
7. Focused workspace checks, `yarn docs:build`, `yarn plugin:check`, and `yarn verify:local` pass.
