# Execution Plan: Kanban Phase C Modern Interaction

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-08-11 23:31 CEST
> **Progress**: 61/124 tasks (49%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement the reusable UI capture-loss prerequisite, complete semantic request/placement/eligibility
contracts, one board operation coordinator, flagship card and structural drag, bounded visual overlays,
keyboard/programmatic parity, native/browser host evidence, and synchronized public documentation. Every
mutation remains application-authoritative and every implementation phase follows specification tests →
red → implementation → green → implementation tests/hardening (AR-C01–C20).

**🚨 Update this document after EACH completed task.**

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | UI pointer-capture lease | 14 |
| 2 | Request, placement, and eligibility contracts | 17 |
| 3 | Operation lifecycle and publication | 20 |
| 4 | Card drag, targets, and autoscroll | 20 |
| 5 | Overlay projection, rendering, and damage | 16 |
| 6 | Structural drag, parity, and board integration | 17 |
| 7 | Host evidence, i18n, docs, plugin, and closure | 20 |

**Total: 124 tasks across 7 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for progress. Every
> task line appears exactly once. The executing agent MUST:
>
> 1. On implementation, mark the task `[~]` with `⏳ (implemented: YYYY-MM-DD HH:MM)`.
> 2. On verification pass, promote it to `[x]` with `✅ (completed: YYYY-MM-DD HH:MM)`.
> 3. Update the Progress header and Last Updated stamp after every task. Only `[x]` counts complete.
> 4. Resume at the first `[~]`, otherwise the first `[ ]`, scanning top-to-bottom.
> 5. On blocker, mark `[!]` and append `Blocked: <short reason>` on the same line.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'`. A spec test is an immutable oracle: if it fails after
> implementation, fix production code, never weaken the requirement-derived expectation without explicit
> authority.

## Phase 1: UI pointer-capture lease

> **Phase baseline tree**: `6ccbae33f8f9a387df2755f1606a93657e9aeec6`
> **Scope mode**: strict
> **Confirmed scope baseline**: RD-07/RD-08 Phase C plus the approved backward-compatible UI pointer-capture prerequisite.
> **Expected modification set**: `packages/ui/src/event/{types,event-loop,dispatch}.ts`,
> `packages/ui/src/view/{types,view,render-root}.ts`, `packages/ui/src/index.ts`, focused files under
> `packages/ui/test/`, this execution plan, and generated plugin/API/skill outputs reported by the
> repository impact tooling.

### Step 1.1: Specification tests

**Reference**: 03-01 §UI capture lease/Loss sources · ST-C-CAP-01..04 · AR-C03
**Objective**: Freeze same-frame capture-loss, reentrancy, compatibility, and cleanup behavior before
changing the shared UI event loop.

- [x] 1.1.1 `[spec-author]` Write generation/replacement/stale-release specification cases — `packages/ui/test/pointer-capture-lease.spec.test.ts` ✅ (completed: 2026-08-11 10:44)
- [x] 1.1.2 `[spec-author]` Add modal/immediate target-or-ancestor subtree unmount without later input/decoded-focus/explicit-host-loss/direct-stop/direct-dispose precedence and throwing/reentrant callback cases — `packages/ui/test/pointer-capture-lease.spec.test.ts` ✅ (completed: 2026-08-11 10:46)
- [x] 1.1.3 `[spec-author]` Add legacy set/release/has-capture compatibility cases using real Slider/ScrollBar/Desktop/Input fixtures — `packages/ui/test/pointer-capture-lease.spec.test.ts` ✅ (completed: 2026-08-11 10:49)
- [x] 1.1.4 Run the focused capture specification and record the expected red cases; justify only legacy assertions that already pass — `packages/ui/test/pointer-capture-lease.spec.test.ts` ✅ (completed: 2026-08-11 10:50)
  - Red evidence: 12 lease/loss cases fail because the additive acquisition/loss APIs are absent; 4
    legacy Slider, ScrollBar, Input, and Desktop cases pass because they intentionally freeze the
    existing set/release/query behavior.

### Step 1.2: Implementation

**Reference**: 03-01 §Public contracts/Internal transition/Compatibility · AR-C03/C20
**Objective**: Add one reusable exception-contained capture lease without breaking existing controls.

- [x] 1.2.1 Add documented public loss-reason, handler, and lease contracts plus EventLoop/DispatchEvent acquisition and host-loss seams — `packages/ui/src/event/types.ts`, `packages/ui/src/view/types.ts` ✅ (completed: 2026-08-11 10:56)
- [x] 1.2.2 Replace the nullable target with generation/callback capture state and one internal lose/replace transition — `packages/ui/src/event/event-loop.ts` ✅ (completed: 2026-08-11 11:00)
- [x] 1.2.3 Add one permanent View/RenderRoot subtree-unmount notification, make root unmount/remount converge through `View.unmount()`, and route target/ancestor loss before user/scope cleanup through the central transition without per-capture registrations — `packages/ui/src/view/view.ts`, `packages/ui/src/view/types.ts`, `packages/ui/src/view/render-root.ts`, `packages/ui/src/event/event-loop.ts` ✅ (completed: 2026-08-11 11:04)
- [x] 1.2.4 Route explicit release, replacement, modal begin/end, decoded `focus: false`, explicit host-loss ingress, and private stop-with-reason/direct-dispose precedence through the central transition — `packages/ui/src/event/event-loop.ts` ✅ (completed: 2026-08-11 11:09)
- [x] 1.2.5 Expose per-dispatch acquisition while preserving the existing capture trio and routing short-circuit — `packages/ui/src/event/dispatch.ts`, `packages/ui/src/event/event-loop.ts` ✅ (completed: 2026-08-11 11:11)
- [x] 1.2.6 Document the new public APIs with safe examples and update UI public exports if required — `packages/ui/src/event/types.ts`, `packages/ui/src/view/types.ts`, `packages/ui/src/index.ts` ✅ (completed: 2026-08-11 11:14)
- [x] 1.2.7 Run the focused capture specification and existing UI drag suites; make all specification cases green without changing their expectations ✅ (completed: 2026-08-11 11:15)
  - Gate evidence: 27 focused UI files / 170 tests passed unchanged; UI typecheck and
    `yarn verify:local` passed.

### Step 1.3: Implementation tests and hardening

**Reference**: 03-01 §Error Handling/Testing Requirements · AR-C03/C18/C20
**Objective**: Prove internal ordering, regressions, and package compatibility.

- [x] 1.3.1 Add implementation tests for generation rollover/exhaustion, callback reentrancy ordering, duplicate loss, anonymous legacy leases, and repeated capture/release bounded unmount-hook retention — `packages/ui/test/pointer-capture-lease.impl.test.ts` ✅ (completed: 2026-08-11 11:18)
- [x] 1.3.2 Add root remount/unmount, ancestor subtree, leak/disposal, and host-ingress integration coverage with real mounted views — `packages/ui/test/pointer-capture-lease.impl.test.ts`, `packages/ui/test/app-shell.lifecycle.spec.test.ts` ✅ (completed: 2026-08-11 11:21)
- [x] 1.3.3 Run UI typecheck, focused capture/control tests, mapped plugin-impact review/update/check, and `yarn verify:local` ✅ (completed: 2026-08-11 11:23)
  - Gate evidence: UI typecheck; 32 focused files / 201 tests; plugin update/check; and
    `yarn verify:local` all passed.

**Deliverables**: additive UI lease API; all capture-loss sources converge; existing controls unchanged;
no retained view/callback after teardown.

**Verify**: `yarn workspace @jsvision/ui typecheck`; focused UI Vitest capture/control suites;
`yarn plugin:update`; `yarn plugin:check`; `yarn verify:local`

**Quality review**: [PASS](08-phase-1-quality-review.md) — five accepted Major findings and one
Minor documentation finding were corrected; the single fix-scoped re-review closed all findings
with no new or reopened Critical/Major issue.

## Phase 2: Request, placement, and eligibility contracts

> **Phase baseline tree**: `ce42d01f30d26519cebaae15e1a31a0b2b844509`
> **Scope mode**: strict
> **Confirmed scope baseline**: RD-08 Phase C request, semantic placement, eligibility, and operation-ID contracts while preserving legacy extension compatibility and application authority.
> **Expected modification set**: `packages/kanban/src/contract/{request,request-validation,authority}.ts`,
> `packages/kanban/src/operation/{placement,eligibility,operation-id}.ts`,
> `packages/kanban/src/source/placement.ts`, `packages/kanban/src/index.ts`, focused files under
> `packages/kanban/test/`, this execution plan, and generated plugin/API/skill outputs reported by the
> repository impact tooling.

### Step 2.1: Specification tests

**Reference**: 03-02 · ST-C-REQ-01..12 · AR-C05/C06/C10/C11/C14/C20
**Objective**: Freeze the public union, semantic placement, exact validation, eligibility, and operation-ID
contracts before production expansion.

- [x] 2.1.1 `[spec-author]` Write exact standard proposal/internal-envelope/new-extension and legacy-extension-overload plus semantic move cases — `packages/kanban/test/requests-placement.spec.test.ts` ✅ (completed: 2026-08-11 11:56)
- [x] 2.1.2 `[spec-author]` Add complete/unknown edge, anchor/token, sorted/filtered, no-op, WIP/DoD/transition, warning, and stale-revision eligibility cases — `packages/kanban/test/requests-placement.spec.test.ts` ✅ (completed: 2026-08-11 12:00)
- [x] 2.1.3 `[spec-author]` Add duplicate ID/selection, partial atomic result, hostile getter/proxy/thenable, bounds, controls, and token-redaction cases — `packages/kanban/test/security/phase-c-boundaries.spec.test.ts` ✅ (completed: 2026-08-11 12:02)
- [x] 2.1.4 Run focused request/security specifications and record expected red behavior ✅ (completed: 2026-08-11 12:03)
  - Red evidence: both focused files collected successfully and all 24 specification cases failed
    because the standard proposal/envelope, eligibility, and operation-ID registry APIs are absent;
    no requirement case passed accidentally through an unrelated legacy implementation.

### Step 2.2: Implementation

**Reference**: 03-02 §Standard request union/Semantic move/Synchronous eligibility/Operation ID · AR-C06/C10/C11/C14
**Objective**: Produce detached final-shaped request and placement authority for every Phase C producer.

- [x] 2.2.1 Define caller-facing standard proposals, coordinator-owned dispatch envelopes, generic card variants, and move snapshots while retaining validated legacy extension envelope adoption — `packages/kanban/src/contract/request.ts` ✅ (completed: 2026-08-11 12:06)
- [x] 2.2.2 Add column/swimlane and saved-view standard variants while retaining extension compatibility — `packages/kanban/src/contract/request.ts` ✅ (completed: 2026-08-11 12:08)
- [x] 2.2.3 Extract exact request/result validation from the existing authority helper into variant-focused modules below the public boundary — `packages/kanban/src/contract/request-validation.ts`, `packages/kanban/src/contract/authority.ts` ✅ (completed: 2026-08-11 12:13)
- [x] 2.2.4 Implement semantic move/source snapshot validation and current placement/token checks without numeric authority — `packages/kanban/src/operation/placement.ts`, `packages/kanban/src/source/placement.ts` ✅ (completed: 2026-08-11 12:16)
- [x] 2.2.5 Implement eligibility result/reason contracts and structural/revision/capability/selection pipeline stages — `packages/kanban/src/operation/eligibility.ts` ✅ (completed: 2026-08-11 12:20)
- [x] 2.2.6 Integrate sorted/filtered placement, transition, WIP, DoD, and semantic no-op stages through existing pure workflow helpers — `packages/kanban/src/operation/eligibility.ts` ✅ (completed: 2026-08-11 12:22)
- [x] 2.2.7 Add validated injected/default operation-ID factory with active/retained collision protection primitives — `packages/kanban/src/operation/operation-id.ts` ✅ (completed: 2026-08-11 12:25)
- [x] 2.2.8 Export/document new contracts and examples only after their specification cases exist — `packages/kanban/src/index.ts`, `packages/kanban/src/contract/*.ts`, `packages/kanban/src/operation/*.ts` ✅ (completed: 2026-08-11 12:32)
- [x] 2.2.9 Run focused request/placement/eligibility/security specifications and make them green ✅ (completed: 2026-08-11 12:33)
  - Gate evidence: 4 focused request, security, authority, and placement files / 48 tests passed;
    `yarn verify:local` passed.

### Step 2.3: Implementation tests and hardening

**Reference**: 03-02 §Error Handling/Testing Requirements · AR-C13/C18/C20
**Objective**: Close internal edge cases, compatibility, and package boundaries.

- [x] 2.3.1 Add implementation tests for discriminator validators, subject identity encoding, factory wrap/exhaustion, and first-terminal eligibility ordering — `packages/kanban/test/requests-placement.impl.test.ts` ✅ (completed: 2026-08-11 12:35)
- [x] 2.3.2 Expand dedicated security tests for descriptor traps, Promise subclasses/cross-realm values, excessive semantic data, controls, and safe failures — `packages/kanban/test/security/phase-c-boundaries.spec.test.ts` ✅ (completed: 2026-08-11 12:37)
- [x] 2.3.3 Extend public API and packed-consumer compile/runtime tests for old extension and new standard request contracts — `packages/kanban/test/public-api.spec.test.ts`, `packages/kanban/test/package-consumer-contract.spec.test.ts` ✅ (completed: 2026-08-11 12:39)
- [x] 2.3.4 Run Kanban build/typecheck/focused tests/check:deps/check:docs, mapped plugin-impact review/update/check, and `yarn verify:local` ✅ (completed: 2026-08-11 12:41)
  - Gate evidence: Kanban build/typecheck; 7 focused files / 73 tests; `check:deps`;
    `check:docs`; plugin update/check; and `yarn verify:local` all passed.

**Deliverables**: final-shaped standard request union; semantic move placement; shared pure eligibility;
validated operation IDs; old extension consumers remain valid.

**Verify**: Kanban build/typecheck; focused request/placement/security/package suites; `check:deps`;
`check:docs`; plugin update/check; `yarn verify:local`

**Quality review**: [PASS](09-phase-2-quality-review.md) — independent general and
security reviews found no Critical issues. All original Major/Minor findings and the re-review's compound
source-evidence bound were corrected without expanding Phase C scope.

## Phase 3: Operation lifecycle and publication

> **Phase baseline tree**: `5d03509cf7e6d21ad8aaed867ac57426beb237fb`
> **Scope mode**: strict
> **Confirmed scope baseline**: RD-08 Phase C operation lifecycle, confirmation, publication,
> concurrency, cancellation, observation, and undo contracts built on the verified Phase 2 request authority.
> **Expected modification set**: `packages/kanban/src/operation/**`,
> `packages/kanban/src/contract/{request,authority,observation,limits}.ts`,
> `packages/kanban/src/board/{board-authority,kanban-board}.ts`, `packages/kanban/src/index.ts`, focused files
> under `packages/kanban/test/`, this execution plan, and generated plugin/API/skill outputs reported by
> repository impact tooling.

### Step 3.1: Specification tests

**Reference**: 03-03 · ST-C-REQ-13; ST-C-OP-01..12 · AR-C04/C05/C12–C14/C20
**Objective**: Freeze exactly-once dispatch, state transitions, conflicts, publication, undo, redaction, and
late-work behavior before introducing the coordinator.

- [x] 3.1.1 `[spec-author]` Write proposed/pending/accepted/committed/rejected/cancelled/superseded transition cases — `packages/kanban/test/operation-lifecycle.spec.test.ts` ✅ (completed: 2026-08-11 13:06)
- [x] 3.1.2 `[spec-author]` Add expectation matching/contradiction/deletion, accepted-without-expectation, exact correlated reconciliation, and atomic handoff cases — `packages/kanban/test/operation-lifecycle.spec.test.ts` ✅ (completed: 2026-08-11 13:07)
- [x] 3.1.3 `[spec-author]` Add affected-entity concurrency, pending/retained limits, abort/disposal/late settlement, and fresh undo cases — `packages/kanban/test/operation-lifecycle.spec.test.ts` ✅ (completed: 2026-08-11 13:10)
- [x] 3.1.4 `[spec-author]` Add editor/configuration/saved-view/context-menu producer-contract fixtures proving one coordinator/dispatcher and zero source mutation — `packages/kanban/test/operation-lifecycle.spec.test.ts` ✅ (completed: 2026-08-11 13:11)
- [x] 3.1.5 `[spec-author]` Add lifecycle observation redaction plus hostile/reentrant/late dispatcher, confirmer, and inverse-builder settlement cases — `packages/kanban/test/security/phase-c-boundaries.spec.test.ts`, `packages/kanban/test/operation-lifecycle.spec.test.ts` ✅ (completed: 2026-08-11 13:13)
- [x] 3.1.6 Run focused lifecycle/security specifications and record expected red behavior ✅ (completed: 2026-08-11 13:14)
  - Red evidence: 14 lifecycle and 6 new hostile-boundary cases failed because board-owned
    subscribe/snapshot/cancel/undo, confirmation, observation, and publication lifecycle behavior is absent;
    all 21 pre-existing Phase 2 security cases remained green.

### Step 3.2: Implementation

**Reference**: 03-03 §Lifecycle/Coordinator/Conflicts/Publication/Undo · AR-C04/C12–C14
**Objective**: Make one board-level coordinator authoritative for all request metadata and projections.

- [x] 3.2.1 Define immutable operation subject/state/projection/snapshot contracts and validators — `packages/kanban/src/operation/types.ts` ✅ (completed: 2026-08-11 13:17)
- [x] 3.2.2 Add `retainedUndoDescriptors` to resolved limits and implement bounded active/retained ID/undo registries, affected-subject conflicts, generations, deterministic whole-entry FIFO eviction, and subscriptions — `packages/kanban/src/contract/limits.ts`, `packages/kanban/src/operation/coordinator.ts`, `packages/kanban/src/operation/subjects.ts` ✅ (completed: 2026-08-11 15:31)
- [x] 3.2.3 Implement synchronous proposal admission and pending projection publication before asynchronous dispatch — `packages/kanban/src/operation/coordinator.ts` ✅ (completed: 2026-08-11 15:39)
- [x] 3.2.4 Define/export exact frozen confirmer/inverse contexts, callback/result/undo-descriptor types, accepted-result keys, and implement coordinator-owned pre-dispatch confirmation with native-Promise handling, reservation, reentrancy guards, and post-settlement revalidation — `packages/kanban/src/contract/request.ts`, `packages/kanban/src/operation/types.ts`, `packages/kanban/src/operation/coordinator.ts`, `packages/kanban/src/operation/confirmation.ts` ✅ (completed: 2026-08-11 15:50)
- [x] 3.2.5 Integrate exact dispatcher settlement and pending→accepted/rejected/cancelled/superseded transitions — `packages/kanban/src/operation/coordinator.ts`, `packages/kanban/src/contract/authority.ts` ✅ (completed: 2026-08-11 15:54)
- [x] 3.2.6 Implement expectation-bound and exact operation-correlated publication reconciliation, contradiction/deletion handling, and affected-lock release without a universal inferred matcher — `packages/kanban/src/operation/coordinator.ts`, `packages/kanban/src/operation/publication.ts` ✅ (completed: 2026-08-11 16:18)
- [x] 3.2.7 Implement operation cancellation, disposal, and late-continuation generation checks — `packages/kanban/src/operation/coordinator.ts` ✅ (completed: 2026-08-11 16:21)
- [x] 3.2.8 Add exact token/inverse descriptor validation, commit-only bounded retention, FIFO eviction/disposal, and proposal-valued native-Promise settlement whose output re-enters complete fresh-proposal validation/confirmation — `packages/kanban/src/operation/undo.ts`, `packages/kanban/src/operation/coordinator.ts` ✅ (completed: 2026-08-11 16:30)
- [x] 3.2.9 Replace the metadata-only board authority with standard-proposal and validated legacy-extension coordinator adapters while preserving `board.request`/publication compatibility — `packages/kanban/src/board/board-authority.ts`, `packages/kanban/src/board/kanban-board.ts` ✅ (completed: 2026-08-11 16:44)
- [x] 3.2.10 Add payload-free lifecycle observations and safe callback isolation — `packages/kanban/src/contract/observation.ts`, `packages/kanban/src/operation/coordinator.ts` ✅ (completed: 2026-08-11 16:50)
- [x] 3.2.11 Run focused lifecycle/security specifications and make them green ✅ (completed: 2026-08-11 16:51)
  - Gate evidence: 2 focused lifecycle/security specification files and all 41 cases passed.

### Step 3.3: Implementation tests and hardening

**Reference**: 03-03 §Error Handling/Testing Requirements · AR-C13/C18/C20
**Objective**: Prove coordinator internals, resource bounds, and board compatibility.

- [x] 3.3.1 Add coordinator implementation tests for subject keys, subscriber reentrancy/failure, queue ordering, ID eviction, and exact generation checks — `packages/kanban/test/operation-coordinator.impl.test.ts` ✅ (completed: 2026-08-11 16:54)
- [x] 3.3.2 Add board-authority compatibility and request-before/after-mount/dispose tests — `packages/kanban/test/authority.impl.test.ts`, `packages/kanban/test/board-lifecycle.impl.test.ts` ✅ (completed: 2026-08-11 16:58)
- [x] 3.3.3 Run Kanban build/typecheck/focused tests/check:deps/check:docs, mapped plugin-impact update/check, and `yarn verify:local` ✅ (completed: 2026-08-11 17:02)
  - Gate evidence: Kanban build/typecheck; 8 focused files / 114 tests; `check:deps`;
    `check:docs`; plugin update/check; and `yarn verify:local` all passed.

**Quality review**: [PASS](10-phase-3-quality-review.md) — independent general and security reviews
closed eleven distinct Major findings and one Minor; the final gate passed 9 focused files / 128 tests.

**Deliverables**: one semantic coordinator; exactly-once dispatch; honest pending publication; bounded
conflicts/IDs; fresh-request undo; late work inert.

**Verify**: Kanban build/typecheck; focused lifecycle/authority/security suites; deps/docs/plugin gates;
`yarn verify:local`

## Phase 4: Card drag, targets, and autoscroll

### Step 4.1: Specification tests

**Reference**: 03-01 §Kanban pointer input; 03-04 · ST-C-CAP-05..09; ST-C-DRAG-02/03/05..12/14 · AR-C03/C04/C07–C09/C13–C15
**Objective**: Freeze the gesture machine, density-aware drop map, hysteresis, prefetch, autoscroll,
selection, release, and cancellation before enabling render-neutral card drag.

- [x] 4.1.1 `[spec-author]` Write click/threshold/capture-generation/card-set gesture specifications — `packages/kanban/test/pointer-drag.spec.test.ts` ✅ (completed: 2026-08-11 21:18)
  - Red evidence: all 5 gesture cases fail because pointer movement still cancels pending clicks and
    threshold, capture-generation, and dragged-set handoff behavior is not implemented.
- [x] 4.1.2 `[spec-author]` Add gutter/card-half/leading/trailing/post-header/empty/compact drop-map cases — `packages/kanban/test/pointer-drag.spec.test.ts` ✅ (completed: 2026-08-11 21:21)
  - Red evidence: the focused suite cannot collect because the planned pure `interaction/drop-map`
    module does not exist; 4.2.5 owns that implementation.
- [x] 4.1.3 `[spec-author]` Add hysteresis, unknown-edge prefetch, collapsed-hover, and stale geometry/revision cases — `packages/kanban/test/pointer-drag.spec.test.ts` ✅ (completed: 2026-08-11 21:21)
  - Red evidence: target hysteresis and drag-prefetch modules remain absent; collapsed-hover behavior is
    retained as an existing green prerequisite within the otherwise expected-red focused suite.
- [x] 4.1.4 `[spec-author]` Add fake-clock four-edge autoscroll/corner/clamp/small-viewport/recompute cases — `packages/kanban/test/pointer-drag-autoscroll.spec.test.ts` ✅ (completed: 2026-08-11 21:22)
  - Red evidence: the focused suite cannot collect because the planned `interaction/drag-autoscroll`
    module does not exist; 4.2.7 owns its pure zone resolver and timer controller.
- [x] 4.1.5 `[spec-author]` Add valid/invalid/outside/stale release, every cancellation source including decoded focus loss, queued-up suppression, and selected-block proposal semantics — `packages/kanban/test/pointer-drag-release.spec.test.ts` ✅ (completed: 2026-08-11 21:24)
  - Red evidence: the focused suite cannot collect because the planned render-neutral
    `interaction/drag-controller` module does not exist; 4.2.3 and 4.2.9 own the behavior.
- [x] 4.1.6 Run focused pointer-drag specifications and record expected red behavior ✅ (completed: 2026-08-11 21:25)
  - Red gate: all 3 focused suites fail collection only because `drop-map`, `drop-hysteresis`,
    `drag-prefetch`, `drag-autoscroll`, and `drag-controller` are the absent Phase 4 implementation
    modules. Existing collapsed-hover remains the proven prerequisite.

### Step 4.2: Implementation

**Reference**: 03-04 §State machine/Dragged set/Drop map/Hysteresis/Autoscroll/Prefetch · AR-C03/C04/C07–C09/C13/C14
**Objective**: Enable one bounded card gesture that hands exactly one current semantic proposal to the
coordinator.

- [x] 4.2.1 Extract pointer/drag immutable types, generation snapshot, and render-neutral overlay evidence — `packages/kanban/src/interaction/drag-types.ts` ✅ (completed: 2026-08-11 21:26)
- [x] 4.2.2 Extend pending-press routing with coordinates/modifiers, threshold preservation, and click-compatible below-threshold movement — `packages/kanban/src/interaction/pointer-router.ts` ✅ (completed: 2026-08-11 21:30)
- [x] 4.2.3 Implement capture-lease-backed card drag state/cancellation controller — `packages/kanban/src/interaction/drag-controller.ts` ✅ (completed: 2026-08-11 21:34)
- [x] 4.2.4 Implement deterministic single/selected-block resolution and bounded ghost identity metadata — `packages/kanban/src/interaction/drag-selection.ts` ✅ (completed: 2026-08-11 21:37)
- [x] 4.2.5 Implement pure semantic drop-map geometry and target-priority projection separate from action hits — `packages/kanban/src/interaction/drop-map.ts` ✅ (completed: 2026-08-11 22:57)
- [x] 4.2.6 Implement one-cell semantic hysteresis across reflow/scroll geometry generations — `packages/kanban/src/interaction/drop-hysteresis.ts` ✅ (completed: 2026-08-11 23:02)
- [x] 4.2.7 Implement fake-clock-friendly four-edge autoscroll with two speeds, corner steps, clamps, and stop rules — `packages/kanban/src/interaction/drag-autoscroll.ts` ✅ (completed: 2026-08-11 23:04)
- [x] 4.2.8 Integrate bounded unknown-edge prefetch and collapsed-swimlane hover expansion ownership — `packages/kanban/src/interaction/drag-prefetch.ts`, `packages/kanban/src/structure/collapsed-hover.ts` ✅ (completed: 2026-08-11 23:07)
- [x] 4.2.9 Implement atomic valid-release `commitProposal` handoff and no-request invalid cancellation — `packages/kanban/src/interaction/drag-controller.ts`, `packages/kanban/src/operation/coordinator.ts` ✅ (completed: 2026-08-11 23:09)
- [x] 4.2.10 Wire viewport event normalization, post-scroll geometry recomputation, Escape/resize/source/dispose cancellation, and overlay invalidation — `packages/kanban/src/board/viewport-input.ts`, `packages/kanban/src/board/kanban-viewport.ts` ✅ (completed: 2026-08-11 23:20)
- [x] 4.2.11 Run focused card-drag specifications and make them green ✅ (completed: 2026-08-11 23:22)
  - Gate evidence: all 3 focused pointer-drag files / 34 tests passed; Kanban package typecheck passed.

### Step 4.3: Implementation tests and hardening

**Reference**: 03-04 §Error Handling/Testing Requirements · AR-C09/C13/C18/C20
**Objective**: Close pure target, state-machine, timer, and stale-work internals.

- [x] 4.3.1 Add drop-map implementation tests for region ordering, clipping, slot identity, inner bounds, and finite target budgets — `packages/kanban/test/drop-map.impl.test.ts` ✅ (completed: 2026-08-11 23:24)
- [x] 4.3.2 Add controller/timer/prefetch implementation tests for stale generations, duplicate reports, callback failure, abort, and resource cleanup — `packages/kanban/test/drag-controller.impl.test.ts` ✅ (completed: 2026-08-11 23:27)
- [x] 4.3.3 Run Kanban build/typecheck/focused tests, UI pointer-capture lease specification/implementation suites, check:deps/check:docs, plugin update/check, and `yarn verify:local` ✅ (completed: 2026-08-11 23:31)
  - Gate evidence: Kanban build/typecheck; 10 focused files / 111 tests; 4 E2E files / 23 tests;
    6 UI capture/control files / 58 tests; deps/docs/plugin gates; Examples typecheck and Kanban
    showcase smoke 1 file / 8 tests; and `yarn verify:local` all passed.

**Quality review**: [PASS](11-phase-4-quality-review.md) — independent general and security reviews
closed eleven Major reports and three Minor reports; the final gate passed 6 Kanban files / 64 tests,
2 UI files / 36 tests, and the Kanban showcase smoke suite.

**Deliverables**: modern card grab; substantial targets; one-cell hysteresis; live placement recompute;
autoscroll/prefetch/hover; atomic release; comprehensive cancellation.

**Verify**: Kanban build/typecheck and pointer/drop/controller suites; UI capture suite; deps/docs/plugin
gates; `yarn verify:local`

## Phase 5: Overlay projection, rendering, and damage

### Step 5.1: Specification tests

**Reference**: 03-05 · ST-C-DRAG-01/04/16; ST-C-INT-01..03 · AR-C05/C07/C12/C14/C19/C20
**Objective**: Freeze ghost/placeholder/gap/pending visuals, damage, fallbacks, hostile text, and responsive
behavior before drawing them.

- [x] 5.1.1 `[spec-author]` Write overlay composition and same-tick drag→pending handoff specifications — `packages/kanban/test/drag-rendering.spec.test.ts` ✅ (completed: 2026-08-12 00:11)
- [x] 5.1.2 `[spec-author]` Add Unicode/color and ASCII/mono allowed/warning/invalid/unavailable/pending/rejected frame cases — `packages/kanban/test/drag-rendering.spec.test.ts` ✅ (completed: 2026-08-12 00:11)
- [x] 5.1.3 `[spec-author]` Add ghost-only/target-change/cancel/reject/supersede damage and settled-frame equality cases — `packages/kanban/test/drag-rendering.spec.test.ts` ✅ (completed: 2026-08-12 00:11)
- [x] 5.1.4 `[spec-author]` Add direct surface/window resize/maximize/restore/focused-column/minimum and hostile text/wide glyph cases — `packages/kanban/test/drag-rendering.spec.test.ts`, `packages/kanban/test/security/phase-c-boundaries.spec.test.ts` ✅ (completed: 2026-08-12 00:11)
- [x] 5.1.5 Run focused rendering/security specifications and record expected red behavior ✅ (completed: 2026-08-12 00:11)
  - Expected red: both focused specifications stop at module resolution because the planned pure
    `board/overlay-projector.ts` implementation does not exist yet; no production behavior was changed.

### Step 5.2: Implementation

**Reference**: 03-05 §Overlay/Card/Pending/Structural/Damage/Theme/I18n · AR-C04/C05/C12/C16/C19/C20
**Objective**: Project bounded semantic overlays into exact-cell geometry without corrupting authoritative
scene or stale terminal cells.

- [ ] 5.2.1 Extract pure authoritative-scene plus drag/pending overlay composition from the oversized viewport projector — `packages/kanban/src/board/overlay-projector.ts`, `packages/kanban/src/board/viewport-projector.ts`
- [ ] 5.2.2 Implement source placeholders, density-aware active gap, affected-stack reflow, and bounded ghost geometry — `packages/kanban/src/board/overlay-projector.ts`
- [ ] 5.2.3 Implement pending/accepted block projection, conflict-disabled action evidence, and missing-descriptor fallback — `packages/kanban/src/board/operation-projector.ts`, `packages/kanban/src/board/overlay-projector.ts`
- [ ] 5.2.4 Draw ghost/placeholder/gap/target/pending/rejected states using existing theme roles and cell-safe non-color cues — `packages/kanban/src/board/viewport-render.ts`
- [ ] 5.2.5 Extend damage to old/new overlay union, affected stacks, and bounded whole-viewport fallback — `packages/kanban/src/board/viewport-damage.ts`
- [ ] 5.2.6 Add Phase C English overlay message contract/placeholders and consume localized safe reasons — `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/board/viewport-render.ts`
- [ ] 5.2.7 Integrate overlay snapshots/subscriptions into viewport projection while keeping semantic lifecycle board-owned — `packages/kanban/src/board/kanban-viewport.ts`, `packages/kanban/src/board/viewport-interaction.ts`
- [ ] 5.2.8 Run focused rendering/security specifications and make them green

### Step 5.3: Implementation tests and hardening

**Reference**: 03-05 §Error Handling/Testing Requirements · AR-C16/C18–C20
**Objective**: Prove pure composition, damage budgets, responsive drawing, and accessibility fallbacks.

- [ ] 5.3.1 Add overlay implementation tests for partial residency, region caps, semantic joins, structural-ready shapes, and composition failures — `packages/kanban/test/drag-overlay.impl.test.ts`
- [ ] 5.3.2 Add damage and renderer implementation tests for cropped/wide/combining text, ghost overlap, and no stale cells — `packages/kanban/test/viewport.impl.test.ts`, `packages/kanban/test/drag-overlay.impl.test.ts`
- [ ] 5.3.3 Run Kanban build/typecheck/focused tests/E2E, check:deps/check:docs, plugin update/check, and `yarn verify:local`

**Deliverables**: recognizable bounded drag visuals; honest pending/rejected overlays; exact damage;
responsive Unicode/ASCII/color/mono presentation.

**Verify**: Kanban build/typecheck; rendering/overlay/damage/security/E2E suites; deps/docs/plugin gates;
`yarn verify:local`

## Phase 6: Structural drag, parity, and board integration

### Step 6.1: Specification tests

**Reference**: 03-04 §Structural/Parity; 03-06 §Board/Facade/Lifecycle · ST-C-DRAG-13/15; ST-C-INT-05..07 · AR-C02/C04/C14/C15
**Objective**: Freeze column/swimlane equivalence, keyboard/programmatic parity, standalone behavior, public
facade, and lifecycle rollback before final wiring.

- [ ] 6.1.1 `[spec-author]` Add column/explicit-swimlane reorder, derived-capability block, structural autoscroll, and one-request cases — `packages/kanban/test/pointer-drag.spec.test.ts`
- [ ] 6.1.2 `[spec-author]` Add keyboard/programmatic/card/bulk/structure semantic parity and Escape priority cases — `packages/kanban/test/phase-c-integration.spec.test.ts`
- [ ] 6.1.3 `[spec-author]` Add standalone-no-dispatcher, setup-failure-at-each-stage, dispose-twice, late-work, and remount-rejection cases — `packages/kanban/test/phase-c-integration.spec.test.ts`
- [ ] 6.1.4 `[spec-author]` Extend packed public API compatibility for board options, facade methods, request state, and testing separation — `packages/kanban/test/package-consumer-contract.spec.test.ts`
- [ ] 6.1.5 Run focused integration/package specifications and record expected red behavior

### Step 6.2: Implementation

**Reference**: 03-04 §Structural/Parity; 03-06 §Construction/Ownership/Facade · AR-C02/C04/C14–C16
**Objective**: Complete all Phase C producers through one operation lifecycle and cancellation-first mount
ownership.

- [ ] 6.2.1 Add column/swimlane source/target resolver and shared structural ghost/placeholder/insertion overlay — `packages/kanban/src/interaction/structural-drag.ts`, `packages/kanban/src/board/overlay-projector.ts`
- [ ] 6.2.2 Wire structural header threshold/capture/autoscroll/release through the existing drag controller primitives — `packages/kanban/src/interaction/drag-controller.ts`, `packages/kanban/src/board/viewport-input.ts`
- [ ] 6.2.3 Add typed facade methods for card/bulk move, column/swimlane reorder, cancel, and fresh undo/redo — `packages/kanban/src/interaction/facade.ts`, `packages/kanban/src/operation/types.ts`
- [ ] 6.2.4 Route documented Phase C keyboard move subset and layered Escape through facade methods without claiming RD-12 command ownership — `packages/kanban/src/interaction/input-router.ts`, `packages/kanban/src/interaction/intent.ts`
- [ ] 6.2.5 Add board options for operation ID, confirmation, and bounded drag configuration; keep standalone viewport mutation unavailable — `packages/kanban/src/board/kanban-board.ts`, `packages/kanban/src/board/kanban-viewport.ts`
- [ ] 6.2.6 Complete board→viewport operation adapter, subscriptions, inspection evidence, and same-tick handoff invalidation — `packages/kanban/src/board/board-authority.ts`, `packages/kanban/src/board/viewport-interaction.ts`
- [ ] 6.2.7 Implement cancellation-first mount/setup rollback and disposal ordering across input/drag/coordinator/facade/source — `packages/kanban/src/board/kanban-board.ts`, `packages/kanban/src/board/kanban-viewport.ts`
- [ ] 6.2.8 Export/document public facade, board configuration, inspection, and testing contracts — `packages/kanban/src/index.ts`, `packages/kanban/src/testing.ts`
- [ ] 6.2.9 Run focused integration/package specifications and make them green

### Step 6.3: Implementation tests and hardening

**Reference**: 03-06 §Error Handling/Testing Requirements · AR-C13/C16/C18/C20
**Objective**: Close lifecycle, scale, weak ownership, and public compatibility risks.

- [ ] 6.3.1 Add mount/rollback/dispose/leak/reactive-replacement implementation matrix — `packages/kanban/test/phase-c-lifecycle.impl.test.ts`
- [ ] 6.3.2 Add visible/overscan operation/target/projection counters at 5,000 eager and 100,000 logical scale — `packages/kanban/test/phase-c-scale.impl.test.ts`
- [ ] 6.3.3 Run UI/Kanban build/typecheck/focused/unit/E2E/package/deps/docs tests, plugin update/check, and `yarn verify:local`

**Deliverables**: card/column/swimlane pointer operations; keyboard/programmatic parity; stable public
facade; bounded board lifecycle; standalone read behavior preserved.

**Verify**: UI typecheck/capture suite; Kanban build/typecheck/unit/E2E/package/deps/docs; plugin gates;
`yarn verify:local`

## Phase 7: Host evidence, i18n, docs, plugin, and closure

### Step 7.1: Specification tests

**Reference**: 03-05 §I18n; 03-06 §Testing/Hosts/Docs · ST-C-INT-04/08..10 · AR-C17–C20
**Objective**: Freeze honest host parity and complete public-delivery evidence before adding the native
harness and showcase updates.

- [ ] 7.1.1 `[spec-author]` Add test-local semantic pointer-trace/replay expectations and direct-loop/browser-xterm equivalence oracle, intentionally red until public helpers exist — `packages/kanban/test/e2e/phase-c-hosts.e2e.test.ts`
- [ ] 7.1.2 `[spec-author]` Add Unix real-PTY and platform-scoped Windows ConPTY evidence assertions that reject pipe-backed masquerading — `packages/kanban/test/e2e/phase-c-hosts.e2e.test.ts`
- [ ] 7.1.3 `[spec-author]` Add CI contract assertions requiring designated Node 22 Ubuntu/macOS/Windows Kanban host E2E with non-skippable platform evidence — `packages/kanban/test/host-ci-contract.spec.test.ts`
- [ ] 7.1.4 `[spec-author]` Add Phase C locale/catalog/placeholder/review, ordered multiple-overlay generator, and production-vs-testing export/docs/API/plugin assertions — `packages/kanban/test/i18n.spec.test.ts`, `packages/kanban/test/phase-c-integration.spec.test.ts`, `packages/i18n/test/i18n-package-registration.spec.test.ts`
- [ ] 7.1.5 `[spec-author]` Extend the real Examples showcase smoke specification for drag/lifecycle/responsive truthfulness before story changes — `packages/examples/test/kanban-showcase.smoke.spec.test.ts`
- [ ] 7.1.6 Run focused host/i18n/Examples delivery specifications and record expected red behavior; stop before dependency installation if authorization is absent

### Step 7.2: Implementation

**Reference**: 03-06 §Testing subpath/Host verification/Documentation · AR-C17–C20
**Objective**: Produce real transport evidence and synchronize every supported SDK/documentation surface.

- [ ] 7.2.1 With explicit execution-time authorization, add `node-pty@^1.1.0`, `@xterm/headless@^6.0.0`, and workspace `@jsvision/web@1.5.2` as Kanban dev-only dependencies and prove install/package-runtime separation — `packages/kanban/package.json`, `yarn.lock`
- [ ] 7.2.2 Implement deterministic fake-clock, drag-frame/drop-map, dispatcher/lifecycle, and semantic trace testing helpers — `packages/kanban/src/testing/drag-harness.ts`, `packages/kanban/src/testing/operation-harness.ts`, `packages/kanban/src/testing.ts`
- [ ] 7.2.3 Implement real child-host PTY/ConPTY fixture as bounded checked-in `.mjs` with finite input/output, teardown, sanitized semantic result, and honest platform guards — `packages/kanban/test/e2e/fixtures/phase-c-host-child.mjs`, `packages/kanban/test/e2e/phase-c-hosts.e2e.test.ts`
- [ ] 7.2.4 Add the focused Node 22 Ubuntu/macOS/Windows Kanban host-E2E CI matrix; designated runners must execute PTY/ConPTY assertions rather than pass by skip — `.github/workflows/ci.yml`
- [ ] 7.2.5 Add all nine Phase C translated overlays/placeholders, translation factory/aggregator, ordered multi-overlay generator/config consumers, generated locale exports/API index, and digest-bound review entries; retain Phase 5 English ownership and run locale update before checks — `packages/kanban/src/i18n/translations/*.ts`, `packages/kanban/src/i18n/translation.ts`, `packages/kanban/src/i18n/locales.ts`, `packages/kanban/src/locales/*.ts`, `tools/i18n-locale-exports.json`, `scripts/update-i18n-locales.mjs`, `scripts/check-i18n-reviews.mjs`, `packages/docs-site/scripts/gen-api.mjs`, `tools/i18n-translation-reviews.json`
- [ ] 7.2.6 Update package README/CHANGELOG and architecture docs with authoritative request/pending/capture/placement/host behavior — `packages/kanban/README.md`, `packages/kanban/CHANGELOG.md`, `docs/architecture/kanban.md`
- [ ] 7.2.7 Extend `packages/examples/kanban-showcase/**` with real drag, warning/blocked/unavailable, bulk, autoscroll, rejection/confirmation/publication controls, responsive layout, and visible feedback — `packages/examples/kanban-showcase/**`
- [ ] 7.2.8 Run `yarn plugin:update`, inspect mapped UI/Kanban references and generated API/recipe changes, then make `yarn plugin:check` green — `tools/jsvision-skill/**`, generated plugin copy, docs API outputs
- [ ] 7.2.9 Run focused host/i18n/Examples delivery specifications and make them green

### Step 7.3: Implementation tests and hardening

**Reference**: 03-06 §Verification commands · 07 §Verification checklist · AR-C17–C20
**Objective**: Close Phase C with platform-honest, package-complete, criterion-honest evidence.

- [ ] 7.3.1 Update implementation coverage for ordered multi-overlay locale config, generated wrapper/API symbols, and docs index closure — `packages/i18n/test/i18n-package-registration.impl.test.ts`, `packages/docs-site/test/i18n-docs.impl.test.ts`
- [ ] 7.3.2 Run every literal command in 03-06 §Verification commands, confirm designated CI host-matrix coverage, and record each gate without placeholders
- [ ] 7.3.3 Resolve independent phase reviewer/auditor critical/major findings, re-review fixes once, and preserve strict RD-09+ scope
- [ ] 7.3.4 Mark plan-local criteria and RD acceptance evidence only where proven; synchronize the Kanban feature roadmap without claiming later RD-09–15 completion
- [ ] 7.3.5 Run post-completion project analysis/technical-doc integration hooks required by CodeOps and record final clean evidence

**Deliverables**: deterministic public testing kit; browser/real PTY/ConPTY semantic evidence; all locales;
accurate docs/API/plugin; incremental kitchen sink; passed quality gate and criterion-honest roadmap.

**Verify**: every exact command in 03-06 §Verification commands and 07 §Verification checklist, including
an inspected `yarn plugin:update` and `yarn plugin:check`; CI owns full `yarn verify`

## Dependencies

```text
Phase 1 UI capture lease
    ↓
Phase 2 request + placement + eligibility contracts
    ↓
Phase 3 operation lifecycle + publication
    ↓
Phase 4 card gesture + targets + autoscroll
    ↓
Phase 5 overlay projection + rendering + damage
    ↓
Phase 6 structural drag + keyboard/programmatic parity + board lifecycle
    ↓
Phase 7 host/i18n/docs/plugin/release evidence
```

Phase 1 is a shared-framework prerequisite. Phase 2/3 must exist before pointer release can safely dispatch.
Phase 4 remains render-neutral until Phase 5 consumes immutable overlay snapshots. Phase 6 reuses proven
card primitives rather than forking structural behavior. Phase 7 installs test-only native tooling only
after explicit authorization and never substitutes lower-layer pipes for required PTY/ConPTY evidence.

## Success Criteria

Phase C is complete when:

1. Every execution-plan task is verified and all 60 immutable ST-C oracles pass without weakening.
2. Card, atomic selected-card, column, and explicit-swimlane pointer moves provide threshold capture,
   bounded ghost/placeholder/gap, substantial targets, hysteresis, autoscroll, cancellation, and exactly
   one valid release request.
3. Pointer, keyboard, public programmatic, and future producer seams share one semantic eligibility,
   placement, dispatcher, operation, pending, publication, cancellation, and undo architecture.
4. Application source publication alone commits data; accepted requests remain honestly pending and late/
   contradictory outcomes cannot mutate stale state.
5. Public APIs preserve legacy extension requests and UI capture calls, remain bounded/sanitized/payload-
   free, and keep native/testing dependencies out of production/package closure.
6. Unicode/color and ASCII/monochrome, direct/window/browser/Unix PTY/Windows ConPTY, resize/maximize/
   restore, windowed/unknown-edge, scale, lifecycle, docs/i18n/plugin/package evidence is green.
7. No dead code, unsafe cast, leaked record/token/error, unbounded timer/work/listener, stale screen damage,
   or unresolved critical/major quality finding remains.
8. Roadmap and documentation claim only verified Phase C behavior; RD-09–15 remain with their owning phases.
