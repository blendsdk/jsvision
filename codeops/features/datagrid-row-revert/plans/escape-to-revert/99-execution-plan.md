# Execution Plan: Data Grid Escape-to-Revert

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-08-04 14:24
> **Progress**: 7/31 tasks (23%)
> **CodeOps Artifact Schema**: 1

## Overview

Execute the bounded row-session journal, atomic rollback transaction, remappable Escape flow, and
consumer-facing documentation/distribution in specification-first order. Every phase is independently
reviewable and keeps implementation behind an observed red oracle.

**🚨 Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Tasks |
|-------|-------|-------|
| 1 | Complete row-recovery behavior | 16 |
| 2 | Showcase and docs-site teaching | 8 |
| 3 | Package, API, skill, and plugin distribution | 7 |

**Total: 31 tasks across 3 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for progress.
> Every task line appears exactly once. The executing agent MUST:
>
> 1. On implementation, mark the task `[~]` with
>    `⏳ (implemented: YYYY-MM-DD HH:MM)`.
> 2. On verification pass, promote it to `[x]` with
>    `✅ (completed: YYYY-MM-DD HH:MM)`.
> 3. Update the Progress header and Last Updated timestamp after every task. Only `[x]` counts as
>    complete.
> 4. Resume with the first `[~]` task, otherwise the first `[ ]` task, scanning top-to-bottom.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'`. Specification expectations are immutable: fix
> implementation failures, never rewrite the oracle to match code.

## Phase 1: Complete Row-Recovery Behavior

**Lenses**: concurrent/async state; compatibility evolution

> **Phase baseline tree**: `d639765bf9dd0c6abb837670a40c5eabcb5eb573`
> **Scope mode**: `strict`
> **Expected modification set**: `packages/datagrid/src/`, `packages/datagrid/test/`,
> `tools/i18n-translation-reviews.json`, this execution plan, and the feature traceability graph.

### Step 1.1: Specification Tests

**Reference**: [07 ST-1–ST-23 and ST-27A](07-testing-strategy.md#-specification-test-cases) ·
[03-01](03-01-row-edit-sessions.md) · [03-02](03-02-rollback-transaction-and-input.md)

- [x] 1.1.1 [spec-author] Write row-session and integration oracles for ST-1–ST-9C, ST-11, ST-16–ST-17, and ST-20 — `packages/datagrid/test/row-revert.spec.test.ts` ✅ (completed: 2026-08-04 14:01)
- [x] 1.1.2 [spec-author] Write transaction, keymap, locale, security, and public source API oracles for ST-10, ST-12–ST-15, ST-18–ST-19, ST-21–ST-23, and ST-27A — `packages/datagrid/test/row-revert-transaction.spec.test.ts`, `packages/datagrid/test/keymap.spec.test.ts`, `packages/datagrid/test/security.spec.test.ts`, `packages/datagrid/test/i18n.spec.test.ts`, existing public API specification gates ✅ (completed: 2026-08-04 14:11)
- [x] 1.1.3 Run ST-1–ST-23 plus ST-27A and record the expected missing-contract failures before implementation (red phase) — `packages/datagrid/test`, public API checks ✅ (completed: 2026-08-04 14:14)

### Step 1.2: Session Foundation

**Reference**: [03-01 § Implementation Details](03-01-row-edit-sessions.md#implementation-details) ·
AR-3, AR-6, AR-7, AR-12

- [x] 1.2.1 Implement the bounded session registry, earliest-value journal, identity checks, attempt tokens, and cleanup — `packages/datagrid/src/row-revert.ts` ✅ (completed: 2026-08-04 14:17)
- [x] 1.2.2 Replace touched-only edit notification with accepted commit details after `commitCell` succeeds — `packages/datagrid/src/editing.ts`, `packages/datagrid/src/editable-grid-rows.ts` ✅ (completed: 2026-08-04 14:19)
- [x] 1.2.3 Add row-gate pass/trap notifications and container session/focus/deletion/disposal wiring — `packages/datagrid/src/validation.ts`, `packages/datagrid/src/grid.ts`, plus the existing `packages/datagrid/src/grid-panels.ts` configuration bridge ✅ (completed: 2026-08-04 14:22)

### Step 1.3: Transaction, Input, and Localization

**Reference**: [03-02 § Implementation Details](03-02-rollback-transaction-and-input.md#implementation-details)

- [x] 1.3.1 Add and document `RowRevertCell`, `RowRevert<T>`, `OnRevertRow<T>`, the grid option, public exports, and the synchronous/deterministic/non-throwing editable-setter precondition — `packages/datagrid/src/commit.ts`, `packages/datagrid/src/column.ts`, `packages/datagrid/src/grid.ts`, `packages/datagrid/src/index.ts` ✅ (completed: 2026-08-04 14:24)
- [ ] 1.3.2 Implement optimistic batch apply, frozen payload delivery, explicit callback/internal/unavailable precedence before `prepare`, best-effort setter-failure recovery, captured-original compensation, attempt-owned dirty/message cleanup, live stale reconciliation, coherent version stages, and disposal-safe settlement — `packages/datagrid/src/row-revert.ts`, `packages/datagrid/src/grid.ts`
- [ ] 1.3.3 Add `revertRow`, default Escape, body eligibility/fallthrough, and pending input/mutation guards — `packages/datagrid/src/keymap.ts`, `packages/datagrid/src/editable-grid-rows.ts`
- [ ] 1.3.4 Add canonical trapped/pending/failure/unavailable catalog keys, placeholder validation, and grid message composition — `packages/datagrid/src/i18n/catalog.ts`, `packages/datagrid/src/validation.ts`
- [ ] 1.3.5 Add reviewed translations for all official Data Grid locales, refresh their digest-bound approvals, and pass locale completeness and review checks — `packages/datagrid/src/i18n/locales.ts`, `tools/i18n-translation-reviews.json`
- [ ] 1.3.6 Run ST-1–ST-23 plus ST-27A and make the complete public behavior/source contract pass without changing the oracle (green phase) — `packages/datagrid/test`, public API checks

### Step 1.4: Implementation Tests and Hardening

**Reference**: [03-01 § Testing Requirements](03-01-row-edit-sessions.md#testing-requirements) ·
[03-02 § Testing Requirements](03-02-rollback-transaction-and-input.md#testing-requirements)

- [ ] 1.4.1 Add controller implementation tests for map order, repeated commits, row identity, invalidation, retry state, presentation ownership, and retained-state bounds — `packages/datagrid/test/row-revert.impl.test.ts`
- [ ] 1.4.2 Add transaction/keymap implementation tests for mutate-then-throw apply recovery, recovery-setter failure, callback serialization, repaint counts, live stale reconciliation, disposal, registry ownership, and keymap cache/merge edges — `packages/datagrid/test/row-revert-transaction.impl.test.ts`, `packages/datagrid/test/keymap.impl.test.ts`
- [ ] 1.4.3 Run existing row-gate, editing, validation, keymap, mutation, reactive-source, master-detail, security, and locale regression suites — `packages/datagrid/test`
- [ ] 1.4.4 Run Data Grid typecheck/tests/JSDoc, locale completeness/review checks, and the normal changed-file gate — `packages/datagrid`, repository root

**Deliverables**: immutable ST-1–ST-23 and ST-27A oracles observed red then green; bounded session
controller; public atomic transaction/source contract; deterministic input and localization;
failure and stale-settlement hardening; focused package gates green.

**Verify**: `yarn workspace @jsvision/datagrid typecheck && yarn workspace @jsvision/datagrid test && yarn workspace @jsvision/datagrid check:docs && yarn i18n:locales:check && yarn i18n:reviews:check && yarn verify:local`

## Phase 2: Showcase and Docs-Site Teaching

**Lenses**: compatibility evolution; concurrent/async user workflows

### Step 2.1: Specification Tests

**Reference**: [07 ST-24–ST-26](07-testing-strategy.md#security-localization-documentation-and-distribution) ·
[03-03](03-03-documentation-and-distribution.md)

- [ ] 2.1.1 [spec-author] Extend showcase, docs-contract, and Template1 layout specification coverage for ST-24–ST-26 — `packages/examples/test/datagrid-showcase.walkthrough.spec.test.ts`, `packages/docs-site/test/contracts/data-grid/interaction.ts`, `packages/docs-site/test/data-grid-docs.resizable-dialog.spec.test.ts`
- [ ] 2.1.2 Run ST-24–ST-26 and record the expected stale-surface failures before implementation (red phase) — `packages/examples`, `packages/docs-site`

### Step 2.2: Implementation

**Reference**: [03-03 § Standalone Data Grid Showcase](03-03-documentation-and-distribution.md#standalone-data-grid-showcase) ·
[03-03 § Docs-Site Validation Laboratory](03-03-documentation-and-distribution.md#docs-site-validation-laboratory)

- [ ] 2.2.1 Upgrade the standalone row-gate story with real success/veto transactions, visible feedback, and keyboard instructions — `packages/examples/datagrid-showcase/stories/validation-lifecycle/row-gate.story.ts`
- [ ] 2.2.2 Extend the existing docs validation lab scenario and probes for trapped, pending, restored, released, and failed states — `packages/docs-site/src/example-fixtures/data-grid/lab.ts`, `packages/docs-site/src/example-fixtures/data-grid/scenario-controller.ts`, `packages/docs-site/test/contracts/data-grid/_shared.ts`
- [ ] 2.2.3 Update validation example metadata and the teaching page with the real Escape/persistence workflow and generated API links — `packages/docs-site/examples/data-grid/validation.ts`, `packages/docs-site/components/data-grid/validation-and-lifecycle.md`
- [ ] 2.2.4 Run ST-24–ST-26 and make the showcase/docs behavior pass without changing the oracle (green phase) — examples and docs-site

### Step 2.3: Implementation Tests and Hardening

**Reference**: [03-03 § Testing Requirements](03-03-documentation-and-distribution.md#testing-requirements)

- [ ] 2.3.1 Add focused implementation/layout assertions for probe wiring, Classic surface, approved maximized startup, restore/maximize reflow, unclipped translated feedback, and non-color cues — `packages/docs-site/test/data-grid-docs.resizable-dialog.spec.test.ts`, focused docs implementation tests
- [ ] 2.3.2 Run examples/docs typechecks and tests, `yarn docs:build`, manual 80×24 acceptance, and the normal changed-file gate — repository root

**Deliverables**: polished standalone and Template1 teaching workflows; verified interaction,
layout, accessibility cues, and manual 80×24 evidence.

**Verify**: `yarn workspace @jsvision/examples typecheck && yarn workspace @jsvision/examples test && yarn workspace @jsvision/docs-site typecheck && yarn workspace @jsvision/docs-site test && yarn docs:build && yarn verify:local`

## Phase 3: Package, API, Skill, and Plugin Distribution

**Lenses**: compatibility evolution

### Step 3.1: Specification Tests

**Reference**: [07 ST-27B–ST-28](07-testing-strategy.md#security-localization-documentation-and-distribution) ·
[03-03](03-03-documentation-and-distribution.md) · AR-11, AR-12, AR-13, AR-14

- [ ] 3.1.1 [spec-author] Extend generated API, source-impact, and plugin specification coverage for ST-27B–ST-28 — existing API/plugin specification gates
- [ ] 3.1.2 Run ST-27B–ST-28 and record the expected stale distribution failures before implementation (red phase) — generated API and plugin checks

### Step 3.2: Implementation

**Reference**: [03-03 § Implementation Details](03-03-documentation-and-distribution.md#implementation-details)

- [ ] 3.2.1 Update package README and changelog with the scoped public behavior and persistence boundary — `packages/datagrid/README.md`, `packages/datagrid/CHANGELOG.md`
- [ ] 3.2.2 Review and update every canonical JSVision skill reference reported by source impact; do not edit the distributed plugin copy — `tools/jsvision-skill/references/`
- [ ] 3.2.3 Run `yarn plugin:update` to regenerate API pages, snippets, impact snapshot, and assembled plugin content — generated docs/plugin files
- [ ] 3.2.4 Run ST-27B–ST-28 and make all generated/distribution specifications pass without changing their expected behavior (green phase) — generated API and plugin checks

### Step 3.3: Final Hardening

- [ ] 3.3.1 Run package/docs regressions, `yarn plugin:check`, and `yarn verify:local`; record final distribution evidence — repository root

**Deliverables**: public/package/generated docs; canonical skill; drift-free plugin; final local
distribution evidence.

**Verify**: `yarn plugin:check && yarn verify:local`

## Dependencies

```text
Phase 1: ST-1–ST-23 + ST-27A red oracle → complete row-recovery behavior → green
    ↓
Phase 2: ST-24–ST-26 red oracle → showcase/docs teaching → green
    ↓
Phase 3: ST-27B–ST-28 red oracle → package/generated distribution → green
```

- Phase 2 depends on Phase 1's final public contract and behavior.
- Phase 3 depends on Phase 1's public API and Phase 2's finalized teaching surfaces.
- Local execution requires installed workspace dependencies; dependency installation needs explicit
  workflow authorization if they remain absent.

## Success Criteria

The feature is complete when:

1. All 31 tasks are verified and every phase-specific oracle observed red before implementation.
2. ST-1–ST-28, including the lettered ST-8/ST-9 lifecycle and ST-27 source/generated cases, pass
   without expectation changes alongside existing Data Grid regressions.
3. Public API, all official locales, showcase, docs-site, canonical skill, generated API, and plugin
   content agree.
4. No stale sessions, late async writes, partial compensation, sensitive logs, unsafe text, or dead
   code remain.
5. Package/docs/plugin gates and `yarn verify:local` pass; CI retains ownership of full `yarn verify`.
6. Manual 80×24 evidence confirms trap → localized hint → Escape → restored row → normal navigation.
7. Post-completion project re-analysis is performed by the execution workflow.
