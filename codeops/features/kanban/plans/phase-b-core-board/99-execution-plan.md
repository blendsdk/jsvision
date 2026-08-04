# Execution Plan: Kanban Phase B Core Board

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-08-04 14:15 CEST
> **Progress**: 6/106 tasks (6%)
> **CodeOps Artifact Schema**: 1
> **Scope Mode**: strict
> **Design Mode**: auto-design authorized for eligible technical decisions
> **Commit Mode**: auto-commit authorized for execution (commit and push after each verified task)

## Overview

Execute the independently deliverable RD-04–06 core board while retaining honest later-phase
integration ownership. The plan extends the Phase A package in dependency order: contracts and rich
cards, structure/workflow, variable-height 2-D geometry, interaction state, mounted input, then package/
documentation/i18n/plugin closure. Each phase follows specification tests → demonstrated red →
implementation → green → implementation tests/hardening → verification.

**🚨 Update this document after EACH implemented and verified task.**

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Presentation contracts and rich cards | 20 |
| 2 | Workflow columns, swimlanes, and policy | 18 |
| 3 | Canonical scene and variable-height geometry | 18 |
| 4 | Focus, navigation, and selection controller | 18 |
| 5 | Mounted keyboard/pointer interaction | 17 |
| 6 | i18n, package, docs, plugin, and closure | 15 |

**Total: 106 tasks across 6 phases.**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the single source of truth. Every task appears exactly once. The
> executor must mark implementation `[~]` with the real timestamp immediately, promote it to `[x]`
> only after its verification passes, update the Progress/Last Updated headers after every task, and
> resume the first `[~]` task before any `[ ]` task. Timestamps come from
> `date '+%Y-%m-%d %H:%M %Z'`.
>
> Before verifying or auto-committing any task that changes a path mapped by
> `tools/jsvision-plugin-impact.json`, review every reported skill reference, run
> `yarn plugin:update`, inspect its diff, and run `yarn plugin:check`; include generated changes in the
> same commit or record that generation was a no-op. Add each typed locale key, all locale entries,
> placeholders, and review evidence in the first task that consumes it rather than deferring vocabulary.

## Phase 1: Presentation contracts and rich cards

> **Phase baseline tree**: `a34f90ce993556107f7140be99d6f6c1d7ff3e4c`
> **Expected modification set**: Phase 1 Kanban source/tests/locales and exports; mapped canonical
> skill/plugin generated output; this plan, Kanban traceability, and the Kanban feature roadmap
> **Scope mode**: strict; the pre-existing `codeops/00-roadmap.md` modification is unrelated user work
> and is excluded from Phase 1 review and commits
> **Lenses**: data/compatibility, bounded custom code, terminal geometry, security

### Step 1.1: Specification tests

**Reference**: 03-01; 03-02; ST-B-PRES-01..03; ST-B-CARD-01..16; PAR-B09/PAR-B11/PAR-B16

- [x] 1.1.1 `[spec-author]` Write immutable presentation-policy public contract specifications — `packages/kanban/test/presentation-policy.spec.test.ts` ✅ (completed: 2026-08-04 13:05 CEST)
- [x] 1.1.2 `[spec-author]` Write the Phase 1-owned pure/cache rich-card/checklist/summary/style and hostile-input assertion slices before production — `packages/kanban/test/cards-rich.spec.test.ts`, `packages/kanban/test/cards-security.spec.test.ts` ✅ (completed: 2026-08-04 13:31 CEST)
- [x] 1.1.3 Run the Phase 1 specification suites and record expected red behavior, separately justifying any already-green Phase A substrate assertion ✅ (completed: 2026-08-04 13:34 CEST)

> **Phase 1 red evidence (2026-08-04 13:33 CEST):** The combined presentation-policy, rich-card,
> and card-security specification command produced the required red state: 3 files and 22 assertions
> failed at the named, not-yet-exported `resolveKanbanPresentation` and
> `createKanbanDescriptorCacheTestHarness` seams. The separate Phase A card, descriptor, and theme
> substrate command passed 3 files and 33 assertions. Those green assertions intentionally prove the
> retained generic title/status adapter, bounded safe-render fallback, descriptor validation, and theme
> foundation; they do not claim the new presentation policy, rich snapshot/composition, or reactive
> cache behavior exists.

### Step 1.2: Implementation and green phase

**Reference**: 03-01 §Public presentation policy/Card adapters; 03-02; PAR-B09/PAR-B15

- [x] 1.2.1 Extend centralized presentation/checklist/summary and `retainedDescriptors` limits, including validated standard/absolute values — `packages/kanban/src/contract/limits.ts`, `packages/kanban/src/card/presentation-policy.ts` ✅ (completed: 2026-08-04 13:42 CEST)
- [x] 1.2.2 Implement centralized fixed preset defaults, preset/custom policy normalization, immutable budgets, bounded per-card selection, sanitized errors, stable fingerprints, and first public exports — `packages/kanban/src/contract/limits.ts`, `packages/kanban/src/contract/error.ts`, `packages/kanban/src/card/presentation-policy.ts`, `packages/kanban/src/index.ts` ✅ (completed: 2026-08-04 14:04 CEST)
- [x] 1.2.3 Add generic field/summary/style/selection adapter contracts and safe snapshots — `packages/kanban/src/card/adapter.ts`, `packages/kanban/src/card/presentation-snapshot.ts` ✅ (completed: 2026-08-04 14:15 CEST)
- [x] 1.2.4 Extend `StandardCard` and its adapter with optional common fields, summaries, and checklist values — `packages/kanban/src/card/standard-card.ts`, `packages/kanban/src/card/adapter.ts` ✅ (completed: 2026-08-04 14:27 CEST)
- [x] 1.2.5 Add bounded checklist group/item and generic summary models with identity validation — `packages/kanban/src/card/checklist.ts`, `packages/kanban/src/card/summary.ts` ✅ (completed: 2026-08-04 14:36 CEST)
- [x] 1.2.6 Extract shared safe display-cell clipping/formatting and injected date behavior — `packages/kanban/src/card/formatting.ts`, `packages/kanban/src/card/text-layout.ts` ✅ (completed: 2026-08-04 14:44 CEST)
- [x] 1.2.7 Implement candidate standard sections and deterministic mandatory/optional degradation — `packages/kanban/src/card/standard-sections.ts`, `packages/kanban/src/card/standard-renderer.ts` ✅ (completed: 2026-08-04 14:49 CEST)
- [ ] 1.2.8 Implement hidden/progress/preview checklist composition, omitted evidence, and read-only editor-action region — `packages/kanban/src/card/checklist-renderer.ts`, `packages/kanban/src/card/standard-sections.ts`
- [ ] 1.2.9 Implement semantic style resolution and complete non-color cue precedence — `packages/kanban/src/card/style-resolver.ts`, `packages/kanban/src/card/standard-renderer.ts`
- [ ] 1.2.10 Extend descriptor validation for Phase B section/action/state invariants without weakening existing bounds — `packages/kanban/src/card/descriptor.ts`
- [ ] 1.2.11 Make renderer/presentation selection and revisions first-class cache inputs and add one owned reactive computation per retained descriptor; keep mounted rich selection disabled until Phase 3 geometry — `packages/kanban/src/board/descriptor-cache.ts`
- [ ] 1.2.12 Add stable focus/snapshot/pending/feedback/server-selection/focused-detail types and neutral defaults needed by scene construction, export the durable Phase 1 API with complete JSDoc/examples, and add first-use typed locale vocabulary — `packages/kanban/src/interaction/types.ts`, `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts`, `packages/kanban/src/index.ts`
- [ ] 1.2.13 Run the Phase 1-owned ST-B-PRES and pure/cache ST-B-CARD assertion slices from 07 and make every assertion authored so far green

### Step 1.3: Implementation tests and hardening

**Reference**: 07 §Implementation tests/Scale and security; PAR-B16/PAR-B17

- [ ] 1.3.1 Add normalization/fingerprint/immutability/boundary implementation tests — `packages/kanban/test/presentation-policy.impl.test.ts`
- [ ] 1.3.2 Add composition/degradation/callback-isolation property tests — `packages/kanban/test/standard-card-rich.impl.test.ts`
- [ ] 1.3.3 Add implementation-level hostile-field/descriptor/theme-role branch coverage without payload leakage — `packages/kanban/test/standard-card-rich.impl.test.ts`
- [ ] 1.3.4 Run Phase 1 build/typecheck/unit/JSDoc and `yarn verify:local`; resolve quality-loop critical/major findings

**Verify**: `yarn workspace @jsvision/kanban build && yarn workspace @jsvision/kanban typecheck && yarn workspace @jsvision/kanban test && yarn workspace @jsvision/kanban check:docs && yarn verify:local`

## Phase 2: Workflow columns, swimlanes, and policy

> **Phase baseline tree**: recorded by `exec-plan` before the first Phase 2 task
> **Lenses**: application authority, sparse/windowed data, workflow policy, failure isolation

### Step 2.1: Specification tests

**Reference**: 03-03; ST-B-STRUCT-01..21; SPEC-B-HOVER-HOOK; PAR-B12/PAR-B27/PAR-B28

- [ ] 2.1.1 `[spec-author]` Write the Phase 2-owned model/evaluator workflow/visibility/collapse/WIP/transition/state assertion slices — `packages/kanban/test/structure-workflow.spec.test.ts`
- [ ] 2.1.2 `[spec-author]` Add the Phase 2-owned explicit/derived/unassigned grouping and presentation-contract assertion slices to the same suite — `packages/kanban/test/structure-workflow.spec.test.ts`
- [ ] 2.1.3 Run the Phase 2 specification suite and record expected red behavior

### Step 2.2: Implementation and green phase

**Reference**: 03-03; PAR-B07/PAR-B12/PAR-B27/PAR-B28

- [ ] 2.2.1 Add validated column/swimlane visibility, collapse, WIP, DoD, capability, style, presentation, and hover-timing limit contracts — `packages/kanban/src/source/types.ts`, `packages/kanban/src/structure/policy.ts`, `packages/kanban/src/contract/limits.ts`
- [ ] 2.2.2 Implement normalized structure snapshots with distinct hidden/collapsed semantics and stable ID reconciliation — `packages/kanban/src/structure/model.ts`, `packages/kanban/src/structure/policy.ts`
- [ ] 2.2.3 Implement pure WIP evaluation for exact/unknown counts, including immutable informational violation evidence, and advisory/blocking modes — `packages/kanban/src/workflow/wip.ts`
- [ ] 2.2.4 Implement pure DoD/transition evaluation and sanitized resolver failure outcomes — `packages/kanban/src/workflow/transition.ts`, `packages/kanban/src/workflow/definition-of-done.ts`
- [ ] 2.2.5 Add query-owned explicit/derived grouping registry, normalized names/disambiguators, unassigned semantics, and mismatched-policy rejection — `packages/kanban/src/structure/grouping.ts`
- [ ] 2.2.6 Refactor eager indexing to store occupied semantic cells only, synthesize absent empty cells lazily, and expose allocation counters for regression tests — `packages/kanban/src/source/eager-index.ts`, `packages/kanban/src/source/eager-source.ts`
- [ ] 2.2.7 Add optional abort-aware revision/query-generation-bound aggregate row-layout hints plus source/policy/header/count/state validation and local resolver fallback — `packages/kanban/src/source/types.ts`, `packages/kanban/src/source/validation.ts`, `packages/kanban/src/structure/grouping.ts`
- [ ] 2.2.8 Add built-in/custom swimlane chrome descriptors and complete PAR-B28 validation — `packages/kanban/src/structure/swimlane-presentation.ts`
- [ ] 2.2.9 Implement generation-safe collapsed-swimlane hover leases with injected clock/timer and the resolved central timing limit — `packages/kanban/src/structure/collapsed-hover.ts`
- [ ] 2.2.10 Export stable policy/grouping/evaluator/presentation APIs with JSDoc/examples and add first-use typed locale vocabulary — `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts`, `packages/kanban/src/index.ts`
- [ ] 2.2.11 Run the Phase 2-owned model/evaluator ST-B-STRUCT assertion slices from 07 and make every assertion authored so far green

### Step 2.3: Implementation tests and hardening

- [ ] 2.3.1 Add grouping/index/name/visibility/collapse property and failure tests — `packages/kanban/test/workflow-model.impl.test.ts`
- [ ] 2.3.2 Add WIP/DoD/transition boundary and application-authority implementation tests — `packages/kanban/test/workflow-policy.impl.test.ts`
- [ ] 2.3.3 Add fake-clock hover lease, stale generation, cancellation, and disposal tests — `packages/kanban/test/collapsed-hover.impl.test.ts`
- [ ] 2.3.4 Run Phase 2 build/typecheck/unit/dependency/JSDoc and `yarn verify:local`; resolve quality-loop critical/major findings

**Verify**: `yarn workspace @jsvision/kanban build && yarn workspace @jsvision/kanban typecheck && yarn workspace @jsvision/kanban test && yarn workspace @jsvision/kanban check:deps && yarn workspace @jsvision/kanban check:docs && yarn verify:local`

## Phase 3: Canonical scene and variable-height geometry

> **Phase baseline tree**: recorded by `exec-plan` before the first Phase 3 task
> **Lenses**: virtualization, responsive terminal geometry, scale, damage/hit safety

### Step 3.1: Specification tests

**Reference**: 03-04; ST-B-GEO-01..09; SPEC-B-HEIGHT-INDEX; PAR-B26

- [ ] 3.1.1 `[spec-author]` Write immutable canonical-scene/sparse-height/variant/hit/damage plus mounted-card/structure assertion slices owned by Phase 3 — `packages/kanban/test/scene-geometry.spec.test.ts`, `packages/kanban/test/cards-rich.spec.test.ts`, `packages/kanban/test/structure-workflow.spec.test.ts`
- [ ] 3.1.2 Run the Phase 3 specification suite and record expected red behavior

### Step 3.2: Implementation and green phase

**Reference**: 03-04; PAR-B05/PAR-B07/PAR-B10/PAR-B26

- [ ] 3.2.1 Implement bounded sparse prefix-height runs, exact anchors, estimates, and saturated conversions — `packages/kanban/src/layout/sparse-height-index.ts`
- [ ] 3.2.2 Implement measurement correction, revision invalidation, stable-anchor preservation, and bounded eviction — `packages/kanban/src/layout/sparse-height-index.ts`, `packages/kanban/src/board/descriptor-cache.ts`
- [ ] 3.2.3 Build immutable canonical 2-D scene nodes from normalized structure, stable interaction snapshots, and resident cells capped by `retainedDescriptors`, with deterministic partial-state clipping — `packages/kanban/src/board/scene-model.ts`, `packages/kanban/src/board/scene-builder.ts`
- [ ] 3.2.4 Generalize viewport-source retention to visible/overscan semantic cells, consume bounded compatible row-layout hints, and degrade distant no-hint projection honestly — `packages/kanban/src/board/viewport-source.ts`
- [ ] 3.2.5 Implement hybrid/separator/band geometry strategies over the canonical scene — `packages/kanban/src/layout/swimlane-geometry.ts`
- [ ] 3.2.6 Implement rail geometry, sticky label behavior, and deterministic hybrid degradation — `packages/kanban/src/layout/swimlane-rail.ts`, `packages/kanban/src/layout/swimlane-geometry.ts`
- [ ] 3.2.7 Implement custom swimlane chrome geometry within validated budgets — `packages/kanban/src/layout/swimlane-custom.ts`
- [ ] 3.2.8 Replace fixed-stride card stacking/origin/extent assumptions with sparse height projections — `packages/kanban/src/layout/vertical-projector.ts`, `packages/kanban/src/board/viewport-metrics.ts`
- [ ] 3.2.9 Extend clipped closed-scope card/header/state/retry inspection targets and z-order while keeping drag/insertion targets absent — `packages/kanban/src/layout/hit-map.ts`, `packages/kanban/src/board/viewport-inspection.ts`
- [ ] 3.2.10 Rebuild viewport projection/drawing around scene geometry, activate rich/custom renderer selection only now that sparse heights exist, add first-use locale vocabulary, and preserve targeted damage — `packages/kanban/src/board/viewport-projector.ts`, `packages/kanban/src/board/viewport-render.ts`, `packages/kanban/src/board/viewport-damage.ts`, `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts`
- [ ] 3.2.11 Integrate two-pass bounded correction with scroll/reveal/resize anchors and no unbounded reflow loop — `packages/kanban/src/board/kanban-viewport.ts`, `packages/kanban/src/board/viewport-scroll.ts`
- [ ] 3.2.12 Run ST-B-GEO and make every immutable oracle green

### Step 3.3: Implementation tests and hardening

- [ ] 3.3.1 Add sparse-run split/merge/correction/saturation/property tests — `packages/kanban/test/sparse-height-index.impl.test.ts`
- [ ] 3.3.2 Add scene retention/variant/hit/damage implementation tests — `packages/kanban/test/scene-projector.impl.test.ts`
- [ ] 3.3.3 Extend 5,000 eager/100,000 logical mounted scale assertions with the exact limit-derived cursor/range/hint/descriptor/reactive/damage/address/run counters from 07 — `packages/kanban/test/viewport-scale.impl.test.ts`, `packages/kanban/src/testing.ts`
- [ ] 3.3.4 Run Phase 3 build/typecheck/unit/E2E and `yarn verify:local`; resolve quality-loop critical/major findings

**Verify**: `yarn workspace @jsvision/kanban build && yarn workspace @jsvision/kanban typecheck && yarn workspace @jsvision/kanban test && yarn workspace @jsvision/kanban test:e2e && yarn verify:local`

## Phase 4: Focus, navigation, and selection controller

> **Phase baseline tree**: recorded by `exec-plan` before the first Phase 4 task
> **Lenses**: state-machine correctness, async cancellation, selection safety, stable identity

### Step 4.1: Specification tests

**Reference**: 03-01 §Single-owner interaction; 03-05; ST-B-INT-01..16; PAR-B06/PAR-B13/PAR-B14

- [ ] 4.1.1 `[spec-author]` Write the Phase 4-owned controller/programmatic focus/navigation/selection and atomic setup/rollback assertion slices — `packages/kanban/test/interaction.spec.test.ts`, `packages/kanban/test/phase-b-boundary.spec.test.ts`
- [ ] 4.1.2 Run the Phase 4 specification suite and record expected red behavior

### Step 4.2: Implementation and green phase

- [ ] 4.2.1 Complete public transition/result/environment/controller-factory/facade contracts around the stable Phase 1 target/snapshot types — `packages/kanban/src/interaction/types.ts`, `packages/kanban/src/interaction/facade.ts`
- [ ] 4.2.2 Implement ordered type-preserving selection, range, prune, atomic over-limit select-all rejection, opaque server-selection set/clear, and frozen eligible snapshots with session/query generation — `packages/kanban/src/interaction/selection.ts`
- [ ] 4.2.3 Implement pure initial-focus and local-to-global reconciliation — `packages/kanban/src/interaction/reconciliation.ts`
- [ ] 4.2.4 Implement vertical/horizontal/header/home/end/page/focused-column navigation over scene geometry — `packages/kanban/src/interaction/navigation.ts`
- [ ] 4.2.5 Implement generation-scoped bounded acquisition, cancellation, retry feedback, and late-result rejection — `packages/kanban/src/interaction/acquisition.ts`
- [ ] 4.2.6 Implement default/factory controller validation, source→scene/cache→controller rollback registration, atomic fail-closed setup, state transitions, facade serialization, safe rejected-transition settlement, subscriptions, reuse rejection, and disposal — `packages/kanban/src/interaction/controller.ts`, `packages/kanban/src/interaction/facade.ts`, `packages/kanban/src/board/kanban-board.ts`, `packages/kanban/src/board/kanban-viewport.ts`
- [ ] 4.2.7 Implement transient cancellation ownership and layered Escape selection behavior — `packages/kanban/src/interaction/transient.ts`, `packages/kanban/src/interaction/controller.ts`
- [ ] 4.2.8 Replace live legacy identity writes with default-controller seed-only behavior, preserve source deletion authority, and reject identity plus factory — `packages/kanban/src/board/board-bindings.ts`, `packages/kanban/src/board/board-state.ts`
- [ ] 4.2.9 Wire controller snapshot/revision and bounded sanitized focused-detail/help projection into scene cues, reveal, inspection, and conditional chrome — `packages/kanban/src/board/scene-builder.ts`, `packages/kanban/src/board/viewport-inspection.ts`, `packages/kanban/src/board/board-feedback.ts`
- [ ] 4.2.10 Expose the stable board facade before/after mount and a non-owning compatible standalone Viewport adapter — `packages/kanban/src/board/kanban-board.ts`, `packages/kanban/src/board/kanban-viewport.ts`
- [ ] 4.2.11 Export controller factory/facade/contracts with JSDoc/examples, add first-use typed locale vocabulary, and deprecate identity semantics accurately — `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts`, `packages/kanban/src/index.ts`
- [ ] 4.2.12 Run the Phase 4-owned controller/programmatic ST-B-INT assertion slices from 07 and make every assertion authored so far green

### Step 4.3: Implementation tests and hardening

- [ ] 4.3.1 Add transition serialization/revision/subscription/disposal/cancellation implementation tests — `packages/kanban/test/interaction-controller.impl.test.ts`
- [ ] 4.3.2 Add ordered membership/range/prune/snapshot property tests and key collision security cases — `packages/kanban/test/interaction-selection.impl.test.ts`
- [ ] 4.3.3 Add navigation geometry/reconciliation/acquisition edge and fake-async tests — `packages/kanban/test/interaction-navigation.impl.test.ts`
- [ ] 4.3.4 Run Phase 4 build/typecheck/unit/E2E and `yarn verify:local`; resolve quality-loop critical/major findings

**Verify**: `yarn workspace @jsvision/kanban build && yarn workspace @jsvision/kanban typecheck && yarn workspace @jsvision/kanban test && yarn workspace @jsvision/kanban test:e2e && yarn verify:local`

## Phase 5: Mounted keyboard/pointer interaction

> **Phase baseline tree**: recorded by `exec-plan` before the first Phase 5 task
> **Lenses**: modern pointer UX, key/event propagation, responsive hosting, lifecycle

### Step 5.1: Specification tests

**Reference**: 03-06; SPEC-B-ACTION-HOOK; SPEC-B-TRANSIENT-CANCEL; ST-B-INT-05..13; ST-B-X-01..04

- [ ] 5.1.1 `[spec-author]` Add the Phase 5-owned mounted card/structure/keyboard/down-up/double/right-click/intent assertion slices — `packages/kanban/test/cards-rich.spec.test.ts`, `packages/kanban/test/structure-workflow.spec.test.ts`, `packages/kanban/test/interaction.spec.test.ts`
- [ ] 5.1.2 `[spec-author]` Extend Phase B boundary/lifecycle specifications with host, active-input/pending-pointer disposal, deferred-Primary, and deferred-target-absence slices — `packages/kanban/test/phase-b-boundary.spec.test.ts`
- [ ] 5.1.3 Run the Phase 5 specification suites and record expected red behavior

### Step 5.2: Implementation and green phase

- [ ] 5.2.1 Add public immutable open/context/closed-scope action intents and optional handler option; keep cursor retry on its source seam — `packages/kanban/src/interaction/intent.ts`, `packages/kanban/src/board/kanban-board.ts`
- [ ] 5.2.2 Implement the closed deliverable key subset, synchronous facade acceptance/handled propagation, Ctrl equivalents, and programmatic Primary operations while explicitly excluding Meta/Command transport — `packages/kanban/src/interaction/input-router.ts`
- [ ] 5.2.3 Implement bounded pending-press down/up routing for single/Ctrl/double clicks, distinct right-click, state/header/card actions, and cancellation without capture/drag thresholds — `packages/kanban/src/interaction/pointer-router.ts`
- [ ] 5.2.4 Deliver application intents exactly once from the board facade after current committed settlement, wait for authoritative republication, and isolate handler failures — `packages/kanban/src/interaction/intent-router.ts`, `packages/kanban/src/interaction/facade.ts`
- [ ] 5.2.5 Wire viewport events to wheel-first interaction routing without capture/drag/insertion behavior — `packages/kanban/src/board/kanban-viewport.ts`
- [ ] 5.2.6 Make focused-column navigator and application-owned header/state actions use the same facade transitions and scoped intents — `packages/kanban/src/board/board-bindings.ts`, `packages/kanban/src/board/kanban-board.ts`
- [ ] 5.2.7 Add conditional DSL feedback/selection chrome without permanent clutter or raw placement — `packages/kanban/src/board/board-feedback.ts`, `packages/kanban/src/board/kanban-board.ts`
- [ ] 5.2.8 Extend the verified Phase 4 mount transaction with input and pending-pointer registration, then complete cancellation-first disposal ordering — `packages/kanban/src/board/kanban-board.ts`, `packages/kanban/src/board/kanban-viewport.ts`
- [ ] 5.2.9 Export intent/input-facing durable API and testing event harnesses with full JSDoc, plus first-use typed locale vocabulary — `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts`, `packages/kanban/src/index.ts`, `packages/kanban/src/testing.ts`
- [ ] 5.2.10 Run the Phase 5-owned mounted ST-B-CARD/STRUCT/INT and ST-B-X-01..04 assertion slices from 07 and make them green

### Step 5.3: Implementation tests and hardening

- [ ] 5.3.1 Add event normalization/handled/click-count/capability/handler-failure implementation tests — `packages/kanban/test/input-router.impl.test.ts`
- [ ] 5.3.2 Add mount/dispose/leak/late-work/reactive-replacement tests — `packages/kanban/test/phase-b-lifecycle.impl.test.ts`
- [ ] 5.3.3 Implement the exact 12-row base/pairwise real-loop matrix from 07 plus bounded one-axis locale/theme/capability edges — `packages/kanban/test/e2e/core-board.e2e.test.ts`, `packages/kanban/test/e2e/board-hosting.e2e.test.ts`
- [ ] 5.3.4 Run Phase 5 build/typecheck/unit/E2E/JSDoc and `yarn verify:local`; resolve quality-loop critical/major findings

**Verify**: `yarn workspace @jsvision/kanban build && yarn workspace @jsvision/kanban typecheck && yarn workspace @jsvision/kanban test && yarn workspace @jsvision/kanban test:e2e && yarn workspace @jsvision/kanban check:docs && yarn verify:local`

## Phase 6: i18n, package, docs, plugin, and closure

> **Phase baseline tree**: recorded by `exec-plan` before the first Phase 6 task
> **Lenses**: public SDK compatibility, localization, documentation truth, distribution integrity

### Step 6.1: Specification tests

**Reference**: 03-06 §i18n/Public integration/Documentation; ST-B-X-05..07; PAR-B20–24

- [ ] 6.1.1 `[spec-author]` Extend packed consumer, public API, locale review, docs/API, and plugin-impact oracles for the complete Phase B surface — `packages/kanban/test/package-consumer.spec.test.ts`, `packages/examples/test/api-reference.spec.test.ts`, `packages/i18n/test/i18n-package-registration.spec.test.ts`
- [ ] 6.1.2 Run the Phase 6 integration oracles and record expected red/drift behavior before registry/documentation generation changes

### Step 6.2: Implementation and green phase

- [ ] 6.2.1 Reconcile all phase-owned typed English vocabulary and nine authored translations, fill any closure-only terms, and record current digest-bound review evidence — `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts`, `tools/i18n-translation-reviews.json`
- [ ] 6.2.2 Run locale generation/literal/review checks and inspect generated locale wrappers atomically — `packages/kanban/src/locales/*.ts`
- [ ] 6.2.3 Complete public JSDoc/examples, package README, and changelog with honest Phase B/later boundaries — `packages/kanban/src/**/*.ts`, `packages/kanban/README.md`, `packages/kanban/CHANGELOG.md`
- [ ] 6.2.4 Extend offline packed main/testing/ten-locale runtime/type/export/private-path fixtures for Phase B — `packages/kanban/test/fixtures/packed-consumer/index.ts`, `packages/kanban/test/package-consumer.spec.test.ts`
- [ ] 6.2.5 Update Kanban architecture/data-model/API/security docs and decision/index navigation for implemented core-board semantics — `docs/architecture/kanban.md`, `docs/architecture/data-model.md`, `docs/architecture/api-design.md`, `docs/architecture/security.md`, `docs/index.md`
- [ ] 6.2.6 Regenerate/verify Kanban API coverage and docs links/build without adding component labs, kitchen sink, or showcase — `packages/docs-site/api/kanban/`, `packages/docs-site/src/api/packages.mjs`
- [ ] 6.2.7 Review mapped canonical JSVision skill/API/impact references and update authored guidance for Phase B — `tools/jsvision-skill/`, `tools/jsvision-plugin-impact.json`
- [ ] 6.2.8 Run `yarn plugin:update`, inspect generated API/recipe/impact/plugin changes, and make plugin parity green — `plugins/jsvision-plugin/skills/jsvision/`
- [ ] 6.2.9 Run ST-B-X-05..07 package/docs/i18n/plugin oracles and make every immutable oracle green

### Step 6.3: Closure and hardening

- [ ] 6.3.1 Run `yarn workspace @jsvision/kanban build`, `typecheck`, `test`, `test:e2e`, `check:deps`, and `check:docs`, then `yarn workspace @jsvision/kanban vitest run --project unit test/package-consumer.spec.test.ts`
- [ ] 6.3.2 Run the exact i18n/docs/API/plugin commands listed in 07, including the focused examples/i18n specification invocations, then `yarn verify:local`
- [ ] 6.3.3 Resolve final reviewer/auditor critical/major findings, re-review fixes once, and preserve the strict deferred-feature boundary
- [ ] 6.3.4 Synchronize traceability and Kanban feature roadmap criterion-honestly; cascade portfolio only on the integration branch and do not overwrite the existing user modification

**Verify**: every exact command in 6.3.1–6.3.2 and 07 §Verification commands, including an inspected no-diff `yarn plugin:update`

## Dependencies

```text
Phase 1 presentation contracts/cards
    ↓
Phase 2 structure/workflow/swimlanes
    ↓
Phase 3 canonical scene + sparse geometry
    ↓
Phase 4 interaction state/navigation/selection
    ↓
Phase 5 mounted input and semantic intents
    ↓
Phase 6 i18n/distribution/docs/plugin closure
```

Phase 3 must replace fixed-stride geometry before Phase 4 spatial navigation or Phase 5 mounted rich
cards can be considered correct. Later RD-07+ phases depend on the final Phase B scene/controller/intent
seams but are not implementation dependencies of this plan.

## Success Criteria

Phase B is complete when:

1. All 106 tasks are verified and all in-scope ST-B oracles pass without weakening.
2. Cards, workflow columns, optional swimlanes, variable-height scrolling, focus/navigation/selection,
   click activation, i18n/theme states, and surface/window hosting work through public APIs; Command-
   based Primary gestures remain traceably open for RD-12 while programmatic equivalents are available.
3. Visible/overscan/source/callback work satisfies the exact limit-derived counters in 07 at 5,000 eager
   and 100,000 logical scale.
4. Application data, policy, authorization, persistence, and mutation authority remain external.
5. Drag, dialogs, full commands/events, mutation lifecycle, saved views, kitchen sink, and showcase
   remain honestly unimplemented and unadvertised.
6. Public/private package boundaries, ten locales, technical/generated docs, plugin parity, and the
   agreed local verification matrix are green.
7. No dead code, unsafe cast, raw terminal-control path, payload leak, lifecycle leak, or unresolved
   critical/major quality finding remains.
