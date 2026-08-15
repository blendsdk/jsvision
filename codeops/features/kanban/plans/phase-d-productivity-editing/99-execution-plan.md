# Execution Plan: Kanban Phase D Productivity and Editing

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-08-15 03:51 CEST
> **Progress**: 79/125 tasks (63%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-09–RD-12 in dependency order without rewriting the viewport or adding a second data
authority. Every phase follows specification tests → red → implementation → green → implementation
tests/hardening → focused/full local verification. Scope is strict; later hardening/course/release work
remains in Phases E–F.

**🚨 Update this document after EACH completed task.**

## Implementation phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | View state, registries, and projection | 15 |
| 2 | Saved-view codec, migrations, and store integration | 14 |
| 3 | Generic/standard editor schema and session core | 14 |
| 4 | Responsive card dialogs and board editor integration | 13 |
| 5 | Programmatic and dialog board configuration | 14 |
| 6 | Actions, keymaps, capabilities, and read-only mode | 16 |
| 7 | Ordered events and application-owned history | 13 |
| 8 | Board composition, i18n, and showcase integration | 14 |
| 9 | Documentation, plugin parity, quality, and acceptance | 12 |

**Total: 125 tasks across 9 phases.**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the single progress authority. On implementation mark only that task
> `[~]` with `⏳ (implemented: YYYY-MM-DD HH:MM)` before verification. Promote it to `[x]` with
> `✅ (completed: YYYY-MM-DD HH:MM)` only after its verify passes. Update this header's progress and
> timestamp after every task. Resume the first `[~]`, otherwise the first `[ ]`. A blocker is `[!]`
> with `Blocked: <reason>`. Timestamps come from `date '+%Y-%m-%d %H:%M'`.
>
> Before every commit containing a path mapped by `tools/jsvision-plugin-impact.json`, review the
> impact, run `yarn plugin:update`, inspect generated references, run `yarn plugin:check`, and include
> generated changes in that same commit. Build Kanban immediately before every packed-consumer or
> Examples check that resolves package `dist` exports.

## Phase 1: View state, registries, and projection

> **Phase baseline tree**: `255ab1bfbc757111cedfe9b7c902e36a64994bf1`
> **Scope mode**: strict
> **Confirmed scope baseline**: RD-09 view pipeline/controller/chrome only; no saved codec, editor,
> configuration, or full action/event surfaces.
> **Expected modification set**: view modules; source query types/validation/eager/remote/windowed adapters and transactional session coordinator; small board bindings; focused tests; barrel; this plan.
> **Lenses**: performance, api-surface, security, concurrency

### Step 1.1: Specification tests

**Reference**: 03-01 §Public model–Failure handling · ST-DV-01…DV-16 · AR-D03/D12/D13/D17/D18/D22

- [x] 1.1.1 `[spec-author]` Add transition, legacy `KanbanSortField.compare` compatibility, additive comparators, mixed-key ties, clear-sort, facet ownership, and `cardPresentation` preservation — `packages/kanban/test/view-state.spec.test.ts` ✅ (completed: 2026-08-14 12:22)
- [x] 1.1.2 `[spec-author]` Add draft-versus-committed debounce, cancellation, filtered-empty, counts, focus, and disposal oracles — `packages/kanban/test/view-state.spec.test.ts` ✅ (completed: 2026-08-14 12:25)
- [x] 1.1.3 `[spec-author]` Add responsive standard view-bar and keyboard/mouse reachability oracles — `packages/kanban/test/view-chrome.spec.test.ts` ✅ (completed: 2026-08-14 12:27)
- [x] 1.1.4 `[spec-author]` Add hostile evaluator and controller→binder→viewport→session prepare/commit/abort invisibility/rollback oracles — `packages/kanban/test/security/view-input.spec.test.ts` ✅ (completed: 2026-08-14 12:29)
- [x] 1.1.5 Run the focused specifications and record expected red failures ✅ (completed: 2026-08-14 12:30)

**Red evidence (2026-08-14 12:29 CEST):** focused Vitest run executed 16 cases: the legacy
single-comparator compatibility oracle passed; 15 expected Phase D cases failed because the controller,
registry, chrome, additive comparator query, and transactional binding behavior are not implemented.

### Step 1.2: Implementation

**Reference**: 03-01 §Public model–Standard chrome · AR-D03/D07/D12

- [x] 1.2.1 Implement bounded view types plus multi-comparator registration/default contract and backward-compatible query identity — view/source types and validation ✅ (completed: 2026-08-14 12:39)
- [x] 1.2.2 Implement immutable projection, resolved comparator ID, and integers-before-code-point-strings tie order across eager/remote/windowed contracts ✅ (completed: 2026-08-14 12:44)
- [x] 1.2.3 Implement generation-safe draft-to-committed debounced search scheduler — `packages/kanban/src/view/scheduler.ts`, `controller.ts` ✅ (completed: 2026-08-14 12:47)
- [x] 1.2.4 Implement controller subscriptions, atomic publication, clear, replace, and disposal — `packages/kanban/src/view/controller.ts`, `summary.ts` ✅ (completed: 2026-08-14 12:52)
- [x] 1.2.5 Implement view bar plus all-or-nothing controller facet→legacy-channel composer and type-tagged composite revision — view bar/board binding ✅ (completed: 2026-08-14 13:08)
- [x] 1.2.6 Export/document view APIs while preserving query-getter construction — `packages/kanban/src/index.ts`, `packages/kanban/src/board/kanban-board.ts` ✅ (completed: 2026-08-14 13:18)
- [x] 1.2.7 Implement controller/binder/viewport/session prepare-commit-abort handshake through candidate first publication, atomic observer-visible activation, and rollback — controller, board binding, viewport, source coordinator ✅ (completed: 2026-08-14 13:42)
- [x] 1.2.8 Run focused specifications and make them green ✅ (completed: 2026-08-14 13:43)

### Step 1.3: Implementation tests and hardening

- [x] 1.3.1 Add controller/registry/scheduler boundary and allocation tests — `packages/kanban/test/view-state.impl.test.ts` ✅ (completed: 2026-08-14 13:46)
- [x] 1.3.2 Run focused Kanban typecheck/tests and `yarn verify:local` ✅ (completed: 2026-08-14 13:47)

**Verify**: focused `view-state`/`view-chrome`/security tests; `yarn workspace @jsvision/kanban typecheck`; `yarn verify:local`

**Phase quality follow-up (2026-08-14 14:28 CEST):** independent correctness, security, and
performance/concurrency/API review found eight unique Major issues and no Critical issues. All eight
accepted corrections are implemented. The single permitted fix-scoped re-review found three further
Major callback/prospective-state gaps; all three are corrected with red-then-green coverage. Focused
verification is green and the Phase 2 quality entry gate is complete. Evidence is recorded in
`08-phase-1-quality-review.md`.

## Phase 2: Saved-view codec, migrations, and store integration

> **Phase baseline tree**: `0a0571f0a3c6a066040cd3a7368e149ea5434232`
> **Scope mode**: strict
> **Confirmed scope baseline**: RD-09 durable v1 view artifacts and existing saved-view request variants.
> **Expected modification set**: `packages/kanban/src/view/saved-view-*.ts`, limits/errors/requests where proven, focused tests/fixtures, barrel, and this plan.
> **Lenses**: security, api-surface, performance

### Step 2.1: Specification tests

**Reference**: 03-02 §Version-1 envelope–Failure handling · ST-DS-01…DS-20 · AR-D04/D13/D19

- [x] 2.1.1 `[spec-author]` Add capture exclusions, Unicode canonical equality, idempotence, raw-provenance/invalidation, and extension round-trip oracles — `packages/kanban/test/saved-view.spec.test.ts` ✅ (completed: 2026-08-14 14:34)
- [x] 2.1.2 `[spec-author]` Add malformed/oversized/hostile/version/atomic-failure oracles — `packages/kanban/test/security/saved-view-input.spec.test.ts` ✅ (completed: 2026-08-14 14:36)
- [x] 2.1.3 `[spec-author]` Add sequential migration, explicit missing-ID policy, new-ID, and remote-query oracles — `packages/kanban/test/saved-view-migration.spec.test.ts` ✅ (completed: 2026-08-14 14:38)
- [x] 2.1.4 `[spec-author]` Add pure capture/apply versus store-request ownership oracles — `packages/kanban/test/saved-view-store.spec.test.ts` ✅ (completed: 2026-08-14 14:40)
- [x] 2.1.5 Run the focused specifications and record expected red failures ✅ (completed: 2026-08-14 14:41)

**Red evidence (2026-08-14 14:41 CEST):** focused Vitest executed 16 saved-view cases across
capture/canonicalization/provenance, hostile input, migration/reconciliation, and store ownership. All
16 failed for the intended absent Phase 2 APIs (`parse`, `serialize`, `capture`, `migrate`, `reconcile`,
`apply`, and the store helper); no fixture, import-transform, or harness failure masked the missing behavior.

### Step 2.2: Implementation

- [x] 2.2.1 Define v1 raw/resolved/provenance envelope, per-reference missing policy, and diagnostics — `packages/kanban/src/view/saved-view-types.ts`, `packages/kanban/src/contract/error.ts` ✅ (completed: 2026-08-14 14:46)
- [x] 2.2.2 Add classified saved-view/registry/migration limits — `packages/kanban/src/contract/limits.ts`, `packages/kanban/src/view/saved-view-limits.ts` ✅ (completed: 2026-08-14 14:52)
- [x] 2.2.3 Implement exact parser, detached snapshots, and shared Unicode code-point canonical serializer — `packages/kanban/src/view/saved-view-codec.ts`, existing semantic encoder ✅ (completed: 2026-08-14 14:56)
- [x] 2.2.4 Implement bounded sequential package/application migrations — `packages/kanban/src/view/saved-view-migration.ts`, `saved-view-codec.ts` ✅ (completed: 2026-08-14 14:59)
- [x] 2.2.5 Implement deterministic registry/data/capability reconciliation with exact missing policy and facet provenance — `packages/kanban/src/view/saved-view-reconcile.ts`, `registry.ts` ✅ (completed: 2026-08-14 15:05)
- [x] 2.2.6 Implement provenance-aware capture/apply/invalidation and authority-backed save/rename/delete helpers — `packages/kanban/src/view/saved-view-store.ts`, `controller.ts` ✅ (completed: 2026-08-14 15:10)
- [x] 2.2.7 Export/document saved-view APIs and make focused specifications green — `packages/kanban/src/index.ts` ✅ (completed: 2026-08-14 16:41)

### Step 2.3: Implementation tests and hardening

- [x] 2.3.1 Add deterministic property/fuzz, migration failure, proxy/accessor, and allocation tests — `packages/kanban/test/saved-view-codec.impl.test.ts`, `saved-view-migration.impl.test.ts` ✅ (completed: 2026-08-14 16:46)
- [x] 2.3.2 Run focused Kanban build/typecheck/tests/check:deps/check:docs and `yarn verify:local` ✅ (completed: 2026-08-14 16:57)

**Verify**: focused saved-view/security/property suites; Kanban build/typecheck/deps/docs; `yarn verify:local`

**Quality gate**: [Phase 2 quality review](09-phase-2-quality-review.md) — complete; all initial and
fix-scoped Major findings corrected with zero Critical findings.

## Phase 3: Generic/standard editor schema and session core

> **Phase baseline tree**: `3fb1d2ab3d93ce3ef553e58edd78ed3c43bf1c12`
> **Scope mode**: strict
> **Confirmed scope baseline**: RD-10 schema, draft, validation, stale, and exclusivity core; no dialog composition yet.
> **Expected modification set**: Kanban manifest/lockfile; editor schema/session/coordinator/standard adapter; application record resolver contracts; exact dependency and packed-consumer fixtures; focused tests; barrel; this plan.
> **Lenses**: api-surface, security, concurrency

### Step 3.1: Specification tests

**Reference**: 03-03 §Generic schema–Editor lifecycle · ST-DE-01…DE-10/15…DE-27 · AR-D05/D06/D21

- [x] 3.1.1 `[spec-author]` Add field-kind, invalid schema graph/bounds, typed adapter, configured-field, checklist-ID, and custom-control oracles — `packages/kanban/test/editor-schema.spec.test.ts` ✅ (completed: 2026-08-14 17:28)
- [x] 3.1.2 `[spec-author]` Add resolver, draft isolation, abort generations, first-error focus, exact request, resubmit, stale/reload/contradictory publication, and cleanup oracles — `packages/kanban/test/editor-session.spec.test.ts` ✅ (completed: 2026-08-14 17:39)
- [x] 3.1.3 `[spec-author]` Add identity exclusivity, view mode, authoritative publication, and hostile-value oracles — `packages/kanban/test/security/editor-boundary.spec.test.ts` ✅ (completed: 2026-08-14 17:42)
- [x] 3.1.4 `[spec-author]` Add exact dependency and built packed-consumer oracles for generic-only, missing peer, and Zod 4 standard adapter — package-boundary and consumer-contract specs ✅ (completed: 2026-08-14 17:45)
- [x] 3.1.5 Run the focused specifications and record expected red failures ✅ (completed: 2026-08-14 17:48)

**Red evidence (2026-08-14 17:48 CEST):** Kanban built successfully, then the focused editor schema,
session, security-boundary, dependency, and packed-consumer run executed 23 cases. Eighteen expected
Phase 3 cases failed: all 15 editor cases require the absent schema/session/coordinator/standard-adapter
APIs; the dependency oracle requires Forms plus the Zod peer/dev topology; and both packed consumers
require the absent generic/standard editor declarations and runtime. Five unchanged package-boundary
cases passed. No import-transform, matcher, fixture, or command failure masked the missing behavior.

### Step 3.2: Implementation

- [x] 3.2.1 Add Forms/Zod dependency topology and update exact boundary/isolated consumer fixtures using authorized workspace install flow — manifest, lockfile, package specs ✅ (completed: 2026-08-14 17:51)
- [x] 3.2.2 Implement Zod-free generic schema/field/section/control contracts — `packages/kanban/src/editor/types.ts`, `schema.ts` ✅ (completed: 2026-08-14 17:57)
- [x] 3.2.3 Implement bounded editor/control registries and callback isolation — `packages/kanban/src/editor/registry.ts`, `schema.ts` ✅ (completed: 2026-08-14 18:01)
- [x] 3.2.4 Implement disposable draft session, abort generations, first-error focus, exact request state, stale/reload policy, and cancellation — `packages/kanban/src/editor/session.ts`, `types.ts` ✅ (completed: 2026-08-14 18:19)
- [x] 3.2.5 Implement application-owned record/revision resolver, identity coordinator, and authoritative/contradictory publication reconciliation — `packages/kanban/src/editor/coordinator.ts`, `session.ts` ✅ (completed: 2026-08-14 18:28)
- [x] 3.2.6 Implement standard field/checklist schema and Forms/Zod adapter isolated from generic types — `packages/kanban/src/editor/standard-schema.ts`, `standard-adapter.ts` ✅ (completed: 2026-08-14 18:39)
- [x] 3.2.7 Export/document editor core APIs and make focused specifications green — `packages/kanban/src/index.ts` ✅ (completed: 2026-08-14 18:51)

### Step 3.3: Implementation tests and hardening

- [x] 3.3.1 Add session generation, callback failure, registry bounds, draft-copy, and consumer-type implementation tests — `packages/kanban/test/editor-session.impl.test.ts`, `editor-schema.impl.test.ts` ✅ (completed: 2026-08-14 18:56)
- [x] 3.3.2 Build Kanban, then run packed-consumer plus focused Forms/Kanban typecheck/tests/deps/docs and `yarn verify:local` ✅ (completed: 2026-08-14 18:58)

**Verify**: Kanban build before packed-consumer; focused editor/package/security suites; Forms/Kanban typechecks/tests/deps/docs; `yarn verify:local`

**Quality gate**: [Phase 3 quality review](10-phase-3-quality-review.md) — complete; zero Critical findings,
all in-scope Major findings corrected under auto-design, and the single fix-scoped re-review closed.

## Phase 4: Responsive card dialogs and board editor integration

> **Phase baseline tree**: `9b1f2452cf2b10edb13c1e96def5089c315a2678`
> **Scope mode**: strict
> **Confirmed scope baseline**: RD-10 create/view/edit dialogs, result-only/custom/inspector integration, responsive lifecycle.
> **Expected modification set**: `src/editor/{controls,dialog,confirmation,inspector}.ts`, board editor binding, i18n message additions, focused/e2e tests, barrel, and this plan.
> **Lenses**: api-surface, security, concurrency

### Step 4.1: Specification tests

**Reference**: 03-03 §Dialogs and inspector–Failure handling · ST-DE-03…DE-27 · AR-D06/D07/D21

- [x] 4.1.1 `[spec-author]` Add create/view/edit, cancel, submit, rejection, dirty-close, and result-only dialog oracles — `packages/kanban/test/editor-dialog.spec.test.ts` ✅ (completed: 2026-08-14 19:55)
- [x] 4.1.2 `[spec-author]` Add resize/maximize/restore, scroll reachability, focus/draft preservation, and narrow-mode oracles — `packages/kanban/test/e2e/editor-dialog.e2e.test.ts` ✅ (completed: 2026-08-14 19:57)
- [x] 4.1.3 `[spec-author]` Add custom replacement, inspector sharing, stale reload, and deleted-card oracles — `packages/kanban/test/editor-integration.spec.test.ts` ✅ (completed: 2026-08-14 20:00)
- [x] 4.1.4 Run the focused specifications and record expected red failures ✅ (completed: 2026-08-14 20:02)

**Red evidence**: 13/13 new specifications fail only at the absent public dialog/inspector invokers:
10 unit oracles across `editor-dialog`/`editor-integration` and 3 responsive E2E oracles. Valid
schema construction and test-host setup complete before each missing-function failure; no matcher,
fixture, transform, or unrelated runtime failure masks the required behavior.

### Step 4.2: Implementation

- [x] 4.2.1 Implement standard control factories/bindings for every field kind — `packages/kanban/src/editor/controls.ts`, `standard-adapter.ts` ✅ (completed: 2026-08-14 20:14)
- [x] 4.2.2 Implement DSL-first scrollable responsive dialog shell and measured actions — `packages/kanban/src/editor/dialog.ts`, `controls.ts` ✅ (completed: 2026-08-14 20:20)
- [x] 4.2.3 Implement create/view/edit/result-only modes and pending/rejection field mapping — `packages/kanban/src/editor/dialog.ts`, `session.ts` ✅ (completed: 2026-08-14 20:36)
- [x] 4.2.4 Implement dirty/destructive confirmations and stale Reload/Cancel/application-policy actions — `packages/kanban/src/editor/confirmation.ts`, `dialog.ts` ✅ (completed: 2026-08-14 20:41)
- [x] 4.2.5 Implement custom editor replacement and application-owned modeless inspector contract — `packages/kanban/src/editor/inspector.ts`, `coordinator.ts` ✅ (completed: 2026-08-14 20:47)
- [x] 4.2.6 Bind board open/checklist actions through the application record resolver, editor coordinator, and existing authority — board editor binding and board ✅ (completed: 2026-08-14 20:56)
- [x] 4.2.7 Export/document dialogs and make focused specifications green — `packages/kanban/src/index.ts` ✅ (completed: 2026-08-14 20:59)

### Step 4.3: Implementation tests and hardening

- [x] 4.3.1 Add modal cleanup, async seal, focus identity, custom-control failure, and leak tests — `packages/kanban/test/editor-dialog.impl.test.ts` ✅ (completed: 2026-08-14 21:04)
- [x] 4.3.2 Run focused UI/Forms/Kanban typecheck/tests/E2E/docs and `yarn verify:local` ✅ (completed: 2026-08-14 21:13)

**Verify**: focused editor dialog/E2E suites; affected UI/Forms/Kanban gates; `yarn verify:local`

**Quality gate**: [Phase 4 quality review](11-phase-4-quality-review.md) — PASS; zero Critical findings,
all in-scope Major findings and the one permitted re-review's residuals fixed, no waiver.

## Phase 5: Programmatic and dialog board configuration

> **Phase baseline tree**: `39e5c755b3321251ccc758f1c96c96620eaafc6a`
> **Scope mode**: strict
> **Confirmed scope baseline**: RD-11 builders/dialogs/deletion/reorder plus RD-09 view-only personalization distinction.
> **Expected modification set**: `src/configuration/*.ts`, focused board/action/structure bindings, i18n, tests, barrel, and this plan.
> **Lenses**: security, api-surface, concurrency

### Step 5.1: Specification tests

**Reference**: 03-04 §Programmatic builders–Focus/access · ST-DC-01…DC-17 · AR-D06–D08

- [x] 5.1.1 `[spec-author]` Add pure builder/name/identity/view-versus-structure oracles — `packages/kanban/test/configuration.spec.test.ts` ✅ (completed: 2026-08-14 22:36)
- [x] 5.1.2 `[spec-author]` Add delete confirmation, non-empty/unknown, atomic policy, no-cascade, and capability oracles — `packages/kanban/test/configuration-delete.spec.test.ts` ✅ (completed: 2026-08-14 22:38)
- [x] 5.1.3 `[spec-author]` Add dialog cancel/reject/stale/focus/resize plus keyboard/button/pointer reorder parity oracles; defer DC-15 command assertion — `packages/kanban/test/e2e/configuration-dialog.e2e.test.ts` ✅ (completed: 2026-08-14 22:39)
- [x] 5.1.4 `[spec-author]` Add hostile name/DoD/application-field diagnostics oracles — `packages/kanban/test/security/configuration-input.spec.test.ts` ✅ (completed: 2026-08-14 22:42)
- [x] 5.1.5 Run the focused specifications and record expected red failures ✅ (completed: 2026-08-14 22:43)

**Red evidence**: all 17 unit/security and 4 E2E configuration specifications fail at the absent
public configuration snapshot, normalization, builder, evaluator, and dialog APIs. Fixtures and hosts
initialize successfully; no unrelated runtime, matcher, or transform failure masks the required behavior.

### Step 5.2: Implementation

- [x] 5.2.1 Implement configuration types and exact validation using sanitized/trimmed NFKC plus fixed `en-US` lowercase collision keys — configuration types/validation ✅ (completed: 2026-08-14 22:46)
- [x] 5.2.2 Implement pure column/swimlane add/update/reorder/delete builders — `packages/kanban/src/configuration/builders.ts`, `validation.ts` ✅ (completed: 2026-08-14 22:49)
- [x] 5.2.3 Implement non-empty/unknown delete policy and confirmation result builders — `packages/kanban/src/configuration/deletion.ts`, `builders.ts` ✅ (completed: 2026-08-14 22:54)
- [x] 5.2.4 Implement shared configuration session and stale/rejection lifecycle — `packages/kanban/src/configuration/session.ts`, `types.ts` ✅ (completed: 2026-08-14 22:59)
- [x] 5.2.5 Implement responsive column and swimlane/grouping dialogs — `packages/kanban/src/configuration/column-dialog.ts`, `swimlane-dialog.ts` ✅ (completed: 2026-08-14 23:05)
- [x] 5.2.6 Implement delete/reassign/archive/custom dialog flow and focus reconciliation — `packages/kanban/src/configuration/delete-dialog.ts`, `packages/kanban/src/board/board-configuration-binding.ts` ✅ (completed: 2026-08-14 23:08)
- [x] 5.2.7 Export/document configuration APIs and make focused specifications green — `packages/kanban/src/index.ts` ✅ (completed: 2026-08-14 23:10)

### Step 5.3: Implementation tests and hardening

- [x] 5.3.1 Add builder exact-shape, normalization, callback failure, stale, and disposal tests — `packages/kanban/test/configuration-builders.impl.test.ts`, `configuration-dialog.impl.test.ts` ✅ (completed: 2026-08-14 23:14)
- [x] 5.3.2 Run focused Kanban/UI/Forms build/typecheck/tests/E2E/docs and `yarn verify:local` ✅ (completed: 2026-08-14 23:20)

**Closure evidence**: focused configuration unit/security/implementation specifications pass 33/33 and
rendered configuration E2E specifications pass 7/7. The full Kanban functional matrix passes 961 behavior
tests; its timing benchmark passes in the required isolated run after exceeding its budget only under the
full 118-file worker load. Kanban E2E passes 36 with 2 intentional skips. Kanban build/typecheck/docs/dependency
gates, plugin integrity, and `yarn verify:local` pass.

**Verify**: focused configuration/security/E2E suites; affected package gates; `yarn verify:local`

**Quality gate**: [Phase 5 quality review](12-phase-5-quality-review.md) — PASS; zero Critical findings,
all initial and fix-scoped Major findings corrected under auto-design, no waiver.

## Phase 6: Actions, keymaps, capabilities, and read-only mode

> **Phase baseline tree**: `5b138c4b3`
> **Scope mode**: strict
> **Confirmed scope baseline**: RD-12 action inventory/keymap/capability/read-only/router/help, consuming completed Phase D producers.
> **Expected modification set**: additive Core input/keymap and Web DOM keyboard/pointer adapters; Kanban command modules and small interaction/board adapters; i18n; host/security tests; barrels/docs/plugin references; this plan.
> **Lenses**: api-surface, security, performance

### Step 6.1: Specification tests

**Reference**: 03-05 §Action registry–Routing · ST-DA-01…DA-13 · AR-D09/D13

- [x] 6.1.1 `[spec-author]` Add action inventory, origin parity, outcome, custom-action, and disposal oracles — `packages/kanban/test/actions-capabilities.spec.test.ts` ✅ (completed: 2026-08-15 00:26)
- [x] 6.1.2 `[spec-author]` Add key conflict/override/runtime-help/default-key oracles — `packages/kanban/test/action-keymap.spec.test.ts` ✅ (completed: 2026-08-15 00:31)
- [x] 6.1.3 `[spec-author]` Add disabled/hidden/throw/read-only hit-target and authorization-boundary oracles — `packages/kanban/test/security/action-capability.spec.test.ts` ✅ (completed: 2026-08-15 00:36)
- [x] 6.1.4 `[spec-author]` Add Primary/Meta compatibility and DOM pointer mapping/capture/coordinate/fallback/SGR-dedupe oracles — Core `test/input-primary.spec.test.ts`, Web `test/dom-pointer-input.spec.test.ts`, Kanban host E2E ✅ (completed: 2026-08-15 00:45)
- [x] 6.1.5 Run the focused specifications and record expected red failures ✅ (completed: 2026-08-15 00:49)

**Red evidence**: the action inventory/router, keymap, capability/read-only, Web DOM adapter, and
Kanban host specifications fail at their absent public APIs (20 expected failures). Core's legacy
compatibility assertion passes while its three semantic Primary/Meta assertions fail at the existing
three-modifier grammar. Fixtures import and execute without unrelated transform or harness failures.

### Step 6.2: Implementation

- [x] 6.2.1 Implement additive Core semantic Primary/Meta event normalization and keymap grammar with source-compatible literals — Core input events/keymap and public tests ✅ (completed: 2026-08-15 00:54)
- [x] 6.2.2 Implement Web pre-xterm DOM keyboard/pointer adapter, cell mapping, capture, fallback, and matching-SGR dedupe — Web host/mount and fixtures ✅ (completed: 2026-08-15 01:00)
- [x] 6.2.3 Define stable action/capability/outcome/context contracts and package inventory — `packages/kanban/src/command/types.ts`, `actions.ts` ✅ (completed: 2026-08-15 01:07)
- [x] 6.2.4 Implement bounded action registry and namespaced extension validation — `packages/kanban/src/command/registry.ts`, `actions.ts` ✅ (completed: 2026-08-15 01:16)
- [x] 6.2.5 Implement conflict-validating semantic-Primary keymap/defaults and atomic replacement — `packages/kanban/src/command/keymap.ts`, `defaults.ts` ✅ (completed: 2026-08-15 01:25)
- [x] 6.2.6 Implement pure capability provider containment and read-only preset — `packages/kanban/src/command/capability.ts`, `types.ts` ✅ (completed: 2026-08-15 01:31)
- [x] 6.2.7 Implement one headless action router with typed same-action recursion rejection and a bounded board-binding seam — command router and action input adapter; concrete board ownership remains Phase 8 task 8.2.1 ✅ (completed: 2026-08-15 01:43)
- [x] 6.2.8 Implement i18n-driven help/status resolution and pointer/action adapters without private mutation paths — command help and input adapter; complete message overlays and mounted input remain Phase 8 tasks 8.2.1–8.2.3 ✅ (completed: 2026-08-15 01:54)
- [x] 6.2.9 Export/document actions and make phase-local specifications green; defer DA-09 event assertions to Phase 7 — Kanban barrel ✅ (completed: 2026-08-15 02:07)

### Step 6.3: Implementation tests and hardening

- [x] 6.3.1 Add router bounds/failures, Primary dedupe, and replacement tests — Kanban `action-registry.impl.test.ts`/`action-router.impl.test.ts`, Core `input-primary.impl.test.ts`, Web `dom-pointer-input.impl.test.ts` ✅ (completed: 2026-08-15 02:10)
- [x] 6.3.2 Run focused Core/Web/UI/Kanban typecheck/tests/E2E/docs and `yarn verify:local` ✅ (completed: 2026-08-15 02:15)

**Verify**: focused actions/keymap/security/host suites; affected package gates; `yarn verify:local`

## Phase 7: Ordered events and application-owned history

> **Phase baseline tree**: `45f5b0643`
> **Scope mode**: strict
> **Confirmed scope baseline**: RD-12 normalized events/observation separation/history integration only.
> **Expected modification set**: `src/event/*.ts`, operation/board/interaction publication hooks, focused tests, i18n, barrel, and this plan.
> **Lenses**: concurrency, security, api-surface, performance

### Step 7.1: Specification tests

**Reference**: 03-06 §Event model–History · ST-DH-01…DH-10 · AR-D10/D11/D13

- [x] 7.1.1 `[spec-author]` Add lifecycle ordering/terminal outcome/observable-state/key-identity oracles — `packages/kanban/test/events-history.spec.test.ts` ✅ (completed: 2026-08-15 01:45)
- [x] 7.1.2 `[spec-author]` Add subscriber failure/redaction/observation-separation/reentrancy oracles — `packages/kanban/test/security/event-boundary.spec.test.ts` ✅ (completed: 2026-08-15 01:47)
- [x] 7.1.3 `[spec-author]` Add undo/redo availability/fresh-request/rejection/no-snapshot oracles — `packages/kanban/test/history.spec.test.ts` ✅ (completed: 2026-08-15 01:49)
- [x] 7.1.4 `[spec-author]` Add dispose/late-settlement/custom-action event lifecycle oracles — `packages/kanban/test/event-lifecycle.spec.test.ts` ✅ (completed: 2026-08-15 01:51)
- [x] 7.1.5 Run the focused specifications and record expected red failures ✅ (completed: 2026-08-15 01:52)

**Red evidence**: all 15 Phase 7 event/history specifications fail only at the absent
`createKanbanEventHub` and `createKanbanHistoryBinding` public APIs. The four fixtures transform and
execute without unrelated import, harness, or existing-suite failures.

### Step 7.2: Implementation

- [x] 7.2.1 Define bounded event union/subscriber/history contracts and exact validation — `packages/kanban/src/event/types.ts`, `validation.ts` ✅ (completed: 2026-08-15 01:56)
- [x] 7.2.2 Implement breadth-first event queue with default 256/max 4096, dequeue sequence, typed overflow, isolation, and disposal — event hub ✅ (completed: 2026-08-15 02:00)
- [x] 7.2.3 Derive request events from authority snapshots/publication without a second lifecycle — `packages/kanban/src/event/operation-events.ts`, `packages/kanban/src/board/board-authority.ts` ✅ (completed: 2026-08-15 02:03)
- [x] 7.2.4 Publish focus/selection/view/action/source events after public state and keep observations separate — `packages/kanban/src/event/publisher.ts`, action router, and board ✅ (completed: 2026-08-15 02:08)
- [x] 7.2.5 Implement application-owned history availability and fresh request integration — `packages/kanban/src/event/history.ts`, `packages/kanban/src/command/router.ts` ✅ (completed: 2026-08-15 02:12)
- [x] 7.2.6 Export/document event/history APIs and make focused specifications plus deferred DA-09 lifecycle assertions green — Kanban barrel and README ✅ (completed: 2026-08-15 02:15)

### Step 7.3: Implementation tests and hardening

- [x] 7.3.1 Add event queue/bounds/clock/subscriber/disposal and history generation implementation tests — `packages/kanban/test/event-hub.impl.test.ts`, `history.impl.test.ts` ✅ (completed: 2026-08-15 02:18)
- [x] 7.3.2 Run focused Kanban build/typecheck/tests/E2E/security/docs and `yarn verify:local` ✅ (completed: 2026-08-15 02:14)

**Green evidence**: Kanban build and typecheck pass; 128 functional files with 1,008 tests pass;
the isolated performance specification passes; all 37 runnable E2E tests pass with 2 documented
skips; package documentation/dependency checks, plugin synchronization/integrity, and
`yarn verify:local` pass. Hardening also guarantees disposal settles builders that ignore
cancellation and preserves read-only pointer hiding before history-availability presentation.

**Verify**: focused event/history/security/lifecycle suites; Kanban package gates; `yarn verify:local`

## Phase 8: Board composition, i18n, and showcase integration

> **Phase baseline tree**: `a1fef1577`
> **Scope mode**: strict
> **Confirmed scope baseline**: Integrate completed Phase D surfaces, messages/themes, permanent examples, and performance regressions without claiming RD-13/RD-15 completion.
> **Expected modification set**: small board binders/composition, Kanban i18n/locales/theme, testing helpers, necessary eager-source hot-path correction, examples/showcases and tests, package manifest/scripts if required, and this plan.
> **Lenses**: performance, api-surface, concurrency

### Step 8.1: Specification tests

**Reference**: 03-07 §Board composition–Examples · ST-DI-01…DI-05 · AR-D02/D07/D12/D14

- [x] 8.1.1 `[spec-author]` Add board construction/facet precedence/legacy compatibility/`cardPresentation` preservation/disposal, board/query-context matching, producer-origin parity, read-only hit-target, and deferred DC-15 route oracles — `packages/kanban/test/phase-d-integration.spec.test.ts` ✅ (completed: 2026-08-15 02:32)
- [x] 8.1.2 `[spec-author]` Add 80×24/narrow/resize/maximize/restore dialog/chrome, action reachability, localized labels, and no-clipping oracles — `packages/kanban/test/e2e/phase-d-productivity.e2e.test.ts` ✅ (completed: 2026-08-15 02:34)
- [x] 8.1.3 `[spec-author]` Add 2,000-card/8-column/4-swimlane/10-filter deterministic count budgets plus 20-warmup/200-iteration median ≤16 ms oracle — `packages/kanban/test/phase-d-performance.spec.test.ts` ✅ (completed: 2026-08-15 02:35)
- [x] 8.1.4 `[spec-author]` Add kitchen-sink and GitHub showcase typecheck/import/behavior smoke oracles — `packages/examples/test/kanban-phase-d.spec.test.ts`, `github-project-kanban-app.spec.test.ts` ✅ (completed: 2026-08-15 02:37)
- [x] 8.1.5 Run the focused specifications and record expected red failures ✅ (completed: 2026-08-15 02:38)

**Red evidence**: the complete Phase 8 set has 15 expected failures: 9 Kanban integration,
performance, and mounted-productivity cases fail only at the absent board-owned action surface or
performance harness; 5 story cases fail only because the four permanent Phase D stories are not yet
registered; and 1 GitHub showcase case fails only at the absent local view/save/edit controls. The
other 8 focused GitHub showcase behaviors remain green.

### Step 8.2: Implementation

- [x] 8.2.1 Compose optional binders, board-owned action routing for every origin, contextual activate-as-open/drop dispatch, read-only hit-target policy, and one controller-precedence effective view getter layer around one viewport — board productivity binding and board ✅ (completed: 2026-08-15 02:55)
- [x] 8.2.2 Add complete Phase D English message contract and typed catalog overlays without raw action-ID fallbacks in mounted UI — `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/locales/en.ts` ✅ (completed: 2026-08-15 03:02)
- [x] 8.2.3 Synchronize all nine non-English locale modules with reviewed English fallback and accelerator manifests — `packages/kanban/src/locales/*.ts` ✅ (completed: 2026-08-15 03:07)
- [x] 8.2.4 Add only required semantic theme roles/fallbacks and non-color/ASCII cues — `packages/kanban/src/card/theme.ts`, `theme-resolver.ts` ✅ (completed: 2026-08-15 03:13)
- [x] 8.2.5 Add public testing fixtures for view/editor/config/action/event deterministic workflows — `packages/kanban/src/testing/phase-d-harness.ts`, `packages/kanban/src/testing.ts` ✅ (completed: 2026-08-15 03:26)
- [x] 8.2.6 Add four permanent Phase D stories and responsive shell integration — `packages/examples/kanban-showcase/stories/{productivity,editing,configuration,actions-history}.story.ts` ✅ (completed: 2026-08-15 03:38)
- [x] 8.2.7 Upgrade GitHub showcase with local-only views/edit play, theme/status color, and unchanged drag authority — `packages/examples/github-project-kanban/shell.ts`, `local-board.ts` ✅ (completed: 2026-08-15 03:43)
- [x] 8.2.8 Build Kanban, then run focused integration/Examples specifications and make them green ✅ (completed: 2026-08-15 03:45)

### Step 8.3: Implementation tests and hardening

- [x] 8.3.1 Add board binding teardown/replacement/reflow and example story lifecycle tests — `packages/kanban/test/phase-d-lifecycle.impl.test.ts`, `packages/examples/test/kanban-phase-d.impl.test.ts` ✅ (completed: 2026-08-15 03:51)

**Green evidence**: A fresh Kanban build precedes all example consumption. Eight focused Kanban
composition, performance, and lifecycle tests pass; three mounted productivity E2E tests pass; and
the focused Examples matrix passes 50 integration/showcase tests plus two replacement-lifecycle
tests. Typecheck, dependency, documentation, plugin synchronization/integrity, and `verify:local`
gates pass. Replacing a story or imported GitHub snapshot disposes the prior board action graph;
controller changes stop reflowing a disposed board; and board disposal aborts editor acquisition.

**Verify**: Kanban build immediately before focused Examples typecheck/unit/E2E/import-smoke; focused Kanban integration/performance/E2E; `yarn verify:local`

## Phase 9: Documentation, plugin parity, quality, and acceptance

> **Phase baseline tree**: _(record at execution start)_
> **Scope mode**: strict
> **Confirmed scope baseline**: Phase D public support and acceptance only; no final component course or release claim.
> **Expected modification set**: public JSDoc/source cleanup, Kanban README, technical architecture, examples evidence, generated plugin outputs, plan/roadmap/review evidence, and necessary test fixes.
> **Lenses**: security, performance, api-surface, concurrency

### Step 9.1: Specification and contract closure

**Reference**: 03-07 §Documentation–Phase closure · ST-DI-03…DI-06 · AR-D14–D16

- [ ] 9.1.1 `[spec-author]` Complete public API/export/JSDoc/exact dependency plus built generic/missing-peer/Zod-4 consumer oracles — public API, boundary, and consumer specs
- [ ] 9.1.2 `[spec-author]` Complete plugin-impact/docs/example typecheck/import contract oracles — `packages/kanban/test/package-boundary.spec.test.ts`, `packages/examples/test/kanban-phase-d.spec.test.ts`
- [ ] 9.1.3 Run focused closure specifications and record any expected red contract gaps

### Step 9.2: Documentation and generated integration

- [ ] 9.2.1 Complete junior-readable public JSDoc/examples and remove leaked planning references from changed source — `packages/kanban/src/**/*.ts`
- [ ] 9.2.2 Update package README construction, view/edit/config/action/event/history usage and current boundary — `packages/kanban/README.md`
- [ ] 9.2.3 Update system/Kanban/API/data/security technical architecture for Phase D — `docs/index.md`, `docs/architecture/kanban.md`, `docs/architecture/api-design.md`
- [ ] 9.2.4 Complete architecture data/security updates and validate links — `docs/architecture/data-model.md`, `docs/architecture/security.md`
- [ ] 9.2.5 Repeat aggregate plugin impact/update/inspection/check and prove each earlier mapped commit carried synchronized generated outputs — generated skill/plugin outputs
- [ ] 9.2.6 Make all closure specifications green and run documentation-standard self-check

### Step 9.3: Complete verification and acceptance

- [ ] 9.3.1 Run every exact automated command in 03-07 §Phase closure matrix with captured output
- [ ] 9.3.2 Run native terminal manual matrix for responsive typing, dialogs, themes, repeat drag/drop, Window resize, cleanup, and GitHub showcase; record evidence
- [ ] 9.3.3 Resolve independent correctness/security/performance/API/concurrency review critical/major findings, verify fixes, and perform the one allowed re-review

**Verify**: complete 03-07 matrix, `yarn plugin:check`, `yarn verify:local`, and accepted native matrix

## Dependencies

```text
Phase 1 View state
  ↓
Phase 2 Saved views
  ↓
Phase 3 Editor core → Phase 4 Editor dialogs
  ↓                    ↓
Phase 5 Configuration dialogs
  ↓
Phase 6 Actions/capabilities
  ↓
Phase 7 Events/history
  ↓
Phase 8 Board/examples integration
  ↓
Phase 9 Delivery/acceptance
```

## Success criteria

1. All 125 tasks are `[x]` after their own verification.
2. Every ST-DV/DS/DE/DC/DA/DH/DI oracle passes without weakening specification expectations.
3. All mutations use the existing board authority and application records remain application-owned.
4. Search, dialogs, scrolling, commands, events, and repeated drag/drop remain responsive and freeze-free.
5. Saved views and all Phase D inputs are bounded, inert, migration-safe, atomic, and redacted.
6. Public APIs, locales, examples, architecture, package output, and plugin references agree.
7. The complete local phase matrix and native acceptance pass; CI owns final full repository verify.
8. The roadmap advances only RD-09–RD-12; RD-13–RD-15 remain with Phases E–F.
