# Execution Plan: Kanban Phase B Core Board

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-08-10 03:31 CEST
> **Progress**: 98/106 tasks (92%)
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
- [x] 1.2.8 Implement hidden/progress/preview checklist composition, omitted evidence, and read-only editor-action region — `packages/kanban/src/card/checklist-renderer.ts`, `packages/kanban/src/card/standard-sections.ts` ✅ (completed: 2026-08-04 14:58 CEST)
- [x] 1.2.9 Implement semantic style resolution and complete non-color cue precedence — `packages/kanban/src/card/style-resolver.ts`, `packages/kanban/src/card/standard-renderer.ts` ✅ (completed: 2026-08-04 15:04 CEST)
- [x] 1.2.10 Extend descriptor validation for Phase B section/action/state invariants without weakening existing bounds — `packages/kanban/src/card/descriptor.ts` ✅ (completed: 2026-08-04 15:09 CEST)
- [x] 1.2.11 Make renderer/presentation selection and revisions first-class cache inputs and add one owned reactive computation per retained descriptor; keep mounted rich selection disabled until Phase 3 geometry — `packages/kanban/src/board/descriptor-cache.ts` ✅ (completed: 2026-08-04 15:17 CEST)
- [x] 1.2.12 Add stable focus/snapshot/pending/feedback/server-selection/focused-detail types and neutral defaults needed by scene construction, export the durable Phase 1 API with complete JSDoc/examples, and add first-use typed locale vocabulary — `packages/kanban/src/interaction/types.ts`, `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts`, `packages/kanban/src/index.ts` ✅ (completed: 2026-08-04 15:29 CEST)
- [x] 1.2.13 Run the Phase 1-owned ST-B-PRES and pure/cache ST-B-CARD assertion slices from 07 and make every assertion authored so far green ✅ (completed: 2026-08-04 15:30 CEST)

### Step 1.3: Implementation tests and hardening

**Reference**: 07 §Implementation tests/Scale and security; PAR-B16/PAR-B17

- [x] 1.3.1 Add normalization/fingerprint/immutability/boundary implementation tests — `packages/kanban/test/presentation-policy.impl.test.ts` ✅ (completed: 2026-08-04 15:33 CEST)
- [x] 1.3.2 Add composition/degradation/callback-isolation property tests — `packages/kanban/test/standard-card-rich.impl.test.ts` ✅ (completed: 2026-08-04 15:37 CEST)
- [x] 1.3.3 Add implementation-level hostile-field/descriptor/theme-role branch coverage without payload leakage — `packages/kanban/test/standard-card-rich.impl.test.ts` ✅ (completed: 2026-08-04 15:39 CEST)
- [x] 1.3.4 Run Phase 1 build/typecheck/unit/JSDoc and `yarn verify:local`; resolve quality-loop critical/major findings ✅ (completed: 2026-08-04 16:06 CEST)

**Verify**: `yarn workspace @jsvision/kanban build && yarn workspace @jsvision/kanban typecheck && yarn workspace @jsvision/kanban test && yarn workspace @jsvision/kanban check:docs && yarn verify:local`

## Phase 2: Workflow columns, swimlanes, and policy

> **Phase baseline tree**: `c0a52a406`
> **Lenses**: application authority, sparse/windowed data, workflow policy, failure isolation

### Step 2.1: Specification tests

**Reference**: 03-03; ST-B-STRUCT-01..21; SPEC-B-HOVER-HOOK; PAR-B12/PAR-B27/PAR-B28

- [x] 2.1.1 `[spec-author]` Write the Phase 2-owned model/evaluator workflow/visibility/collapse/WIP/transition/state assertion slices — `packages/kanban/test/structure-workflow.spec.test.ts`
- [x] 2.1.2 `[spec-author]` Add the Phase 2-owned explicit/derived/unassigned grouping and presentation-contract assertion slices to the same suite — `packages/kanban/test/structure-workflow.spec.test.ts`
- [x] 2.1.3 Run the Phase 2 specification suite and record expected red behavior

### Step 2.2: Implementation and green phase

**Reference**: 03-03; PAR-B07/PAR-B12/PAR-B27/PAR-B28

- [x] 2.2.1 Add validated column/swimlane visibility, collapse, WIP, DoD, capability, style, presentation, and hover-timing limit contracts — `packages/kanban/src/source/types.ts`, `packages/kanban/src/structure/policy.ts`, `packages/kanban/src/contract/limits.ts`
- [x] 2.2.2 Implement normalized structure snapshots with distinct hidden/collapsed semantics and stable ID reconciliation — `packages/kanban/src/structure/model.ts`, `packages/kanban/src/structure/policy.ts`
- [x] 2.2.3 Implement pure WIP evaluation for exact/unknown counts, including immutable informational violation evidence, and advisory/blocking modes — `packages/kanban/src/workflow/wip.ts`
- [x] 2.2.4 Implement pure DoD/transition evaluation and sanitized resolver failure outcomes — `packages/kanban/src/workflow/transition.ts`, `packages/kanban/src/workflow/definition-of-done.ts`
- [x] 2.2.5 Add query-owned explicit/derived grouping registry, normalized names/disambiguators, unassigned semantics, and mismatched-policy rejection — `packages/kanban/src/structure/grouping.ts`
- [x] 2.2.6 Refactor eager indexing to store occupied semantic cells only, synthesize absent empty cells lazily, and expose allocation counters for regression tests — `packages/kanban/src/source/eager-index.ts`, `packages/kanban/src/source/eager-source.ts`
- [x] 2.2.7 Add optional abort-aware revision/query-generation-bound aggregate row-layout hints plus source/policy/header/count/state validation and local resolver fallback — `packages/kanban/src/source/types.ts`, `packages/kanban/src/source/validation.ts`, `packages/kanban/src/structure/grouping.ts`
- [x] 2.2.8 Add built-in/custom swimlane chrome descriptors and complete PAR-B28 validation — `packages/kanban/src/structure/swimlane-presentation.ts`
- [x] 2.2.9 Implement generation-safe collapsed-swimlane hover leases with injected clock/timer and the resolved central timing limit — `packages/kanban/src/structure/collapsed-hover.ts` ✅ (completed: 2026-08-04 17:10 CEST)
- [x] 2.2.10 Export stable policy/grouping/evaluator/presentation APIs with JSDoc/examples and add first-use typed locale vocabulary — `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts`, `packages/kanban/src/index.ts` ✅ (completed: 2026-08-04 17:23 CEST)
- [x] 2.2.11 Run the Phase 2-owned model/evaluator ST-B-STRUCT assertion slices from 07 and make every assertion authored so far green ✅ (completed: 2026-08-04 17:26 CEST)

### Step 2.3: Implementation tests and hardening

- [x] 2.3.1 Add grouping/index/name/visibility/collapse property and failure tests — `packages/kanban/test/workflow-model.impl.test.ts` ✅ (completed: 2026-08-04 17:30 CEST)
- [x] 2.3.2 Add WIP/DoD/transition boundary and application-authority implementation tests — `packages/kanban/test/workflow-policy.impl.test.ts` ✅ (completed: 2026-08-04 17:34 CEST)
- [x] 2.3.3 Add fake-clock hover lease, stale generation, cancellation, and disposal tests — `packages/kanban/test/collapsed-hover.impl.test.ts` ✅ (completed: 2026-08-04 17:37 CEST)
- [x] 2.3.4 Run Phase 2 build/typecheck/unit/dependency/JSDoc and `yarn verify:local`; resolve quality-loop critical/major findings ✅ (completed: 2026-08-04 17:52 CEST)

**Verify**: `yarn workspace @jsvision/kanban build && yarn workspace @jsvision/kanban typecheck && yarn workspace @jsvision/kanban test && yarn workspace @jsvision/kanban check:deps && yarn workspace @jsvision/kanban check:docs && yarn verify:local`

## Phase 3: Canonical scene and variable-height geometry

> **Phase baseline tree**: `e2b11763e0b0480566eb38588eb34016010e1f29`
> **Expected modification set**: Phase 3 Kanban layout/board source and geometry tests; mapped canonical
> skill/plugin generated output; this execution plan and its ambiguity register
> **Scope mode**: strict
> **Lenses**: virtualization, responsive terminal geometry, scale, damage/hit safety

### Step 3.1: Specification tests

**Reference**: 03-04; ST-B-GEO-01..09; SPEC-B-HEIGHT-INDEX; PAR-B26

- [x] 3.1.1 `[spec-author]` Write immutable canonical-scene/sparse-height/variant/hit/damage plus mounted-card/structure assertion slices owned by Phase 3 — `packages/kanban/test/scene-geometry.spec.test.ts`, `packages/kanban/test/cards-rich.spec.test.ts`, `packages/kanban/test/structure-workflow.spec.test.ts` ✅ (completed: 2026-08-04 18:08 CEST)
- [x] 3.1.2 Run the Phase 3 specification suite and record expected red behavior ✅ (completed: 2026-08-04 18:09 CEST)

> **Phase 3 red evidence (2026-08-04 18:09 CEST):** The combined canonical-scene, rich-card, and
> structure specification command ran 42 assertions: all 28 previously implemented assertions stayed
> green and all 14 Phase 3-owned assertions failed at the intended missing boundaries. Ten scene and
> geometry assertions fail at the absent sparse-height, canonical-scene, window, geometry, hit, and
> damage functions; two mounted rich-card assertions fail because inspection has no integrated rich
> descriptor; and two mounted structure assertions fail because Phase A inspection has no normalized
> structure state or mounted-card-view count. No prior behavior regressed.

### Step 3.2: Implementation and green phase

**Reference**: 03-04; PAR-B05/PAR-B07/PAR-B10/PAR-B26

- [x] 3.2.1 Implement bounded sparse prefix-height runs, exact anchors, estimates, and saturated conversions — `packages/kanban/src/layout/sparse-height-index.ts` ✅ (completed: 2026-08-04 18:15 CEST)
- [x] 3.2.2 Implement measurement correction, revision invalidation, stable-anchor preservation, and bounded eviction — `packages/kanban/src/layout/sparse-height-index.ts`, `packages/kanban/src/board/descriptor-cache.ts` ✅ (completed: 2026-08-04 18:19 CEST)
- [x] 3.2.3 Build immutable canonical 2-D scene nodes from normalized structure, stable interaction snapshots, and resident cells capped by `retainedDescriptors`, with deterministic partial-state clipping — `packages/kanban/src/board/scene-model.ts`, `packages/kanban/src/board/scene-builder.ts` ✅ (completed: 2026-08-04 18:24 CEST)
- [x] 3.2.4 Generalize viewport-source retention to visible/overscan semantic cells, consume bounded compatible row-layout hints, and degrade distant no-hint projection honestly — `packages/kanban/src/board/viewport-source.ts` ✅ (completed: 2026-08-04 18:30 CEST)
- [x] 3.2.5 Implement hybrid/separator/band geometry strategies over the canonical scene — `packages/kanban/src/layout/swimlane-geometry.ts` ✅ (completed: 2026-08-04 18:38 CEST)
- [x] 3.2.6 Implement rail geometry, sticky label behavior, and deterministic hybrid degradation — `packages/kanban/src/layout/swimlane-rail.ts`, `packages/kanban/src/layout/swimlane-geometry.ts` ✅ (completed: 2026-08-04 18:44 CEST)
- [x] 3.2.7 Implement custom swimlane chrome geometry within validated budgets — `packages/kanban/src/layout/swimlane-custom.ts` ✅ (completed: 2026-08-04 18:49 CEST)
- [x] 3.2.8 Replace fixed-stride card stacking/origin/extent assumptions with sparse height projections — `packages/kanban/src/layout/vertical-projector.ts`, `packages/kanban/src/board/viewport-metrics.ts` ✅ (completed: 2026-08-09 15:38 CEST)
- [x] 3.2.9 Extend clipped closed-scope card/header/state/retry inspection targets and z-order while keeping drag/insertion targets absent, carrying the descriptor crop offsets required for exact action hits — `packages/kanban/src/layout/hit-map.ts`, `packages/kanban/src/board/viewport-inspection.ts`, `packages/kanban/src/layout/swimlane-geometry.ts` ✅ (completed: 2026-08-09 15:46 CEST)
- [x] 3.2.10 Rebuild viewport projection/drawing around scene geometry, activate rich/custom renderer selection only now that sparse heights exist, add first-use locale vocabulary, and preserve targeted damage — `packages/kanban/src/board/viewport-projector.ts`, `packages/kanban/src/board/viewport-render.ts`, `packages/kanban/src/board/viewport-damage.ts`, `packages/kanban/src/board/kanban-viewport.ts`, `packages/kanban/src/board/viewport-inspection.ts`, `packages/kanban/src/card/presentation-snapshot.ts`, `packages/kanban/src/card/standard-renderer.ts`, `packages/kanban/src/layout/hit-map.ts`, `packages/kanban/src/layout/swimlane-geometry.ts`, `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translation.ts`, `packages/kanban/src/i18n/translations/*.ts`, `packages/kanban/src/index.ts` ✅ (completed: 2026-08-09 16:04 CEST)
- [x] 3.2.11 Integrate two-pass bounded correction with scroll/reveal/resize anchors and no unbounded reflow loop, retain unchanged card-local descriptor computations across cursor republication, and preserve exact solved column cropping — `packages/kanban/src/board/kanban-viewport.ts`, `packages/kanban/src/board/viewport-scroll.ts`, `packages/kanban/src/board/viewport-projector.ts`, `packages/kanban/src/board/descriptor-cache.ts`, `packages/kanban/src/layout/swimlane-geometry.ts`, `packages/kanban/src/layout/hit-map.ts`, `packages/kanban/test/e2e/board-hosting.e2e.test.ts` ✅ (completed: 2026-08-09 16:16 CEST)
- [x] 3.2.12 Run ST-B-GEO and make every immutable oracle green ✅ (completed: 2026-08-09 16:18 CEST)

> **Phase 3 green evidence (2026-08-09 16:18 CEST):** The exact combined canonical-scene,
> rich-card, and structure specification command passed all 42 immutable assertions across three
> specification files. The complete Kanban unit suite also passed 383 assertions, and the authentic
> hosting E2E suite passed all nine assertions after the bounded scene integration.

### Step 3.3: Implementation tests and hardening

- [x] 3.3.1 Add sparse-run split/merge/correction/saturation/property tests — `packages/kanban/test/sparse-height-index.impl.test.ts` ✅ (completed: 2026-08-09 16:20 CEST)
- [x] 3.3.2 Add scene retention/variant/hit/damage implementation tests — `packages/kanban/test/scene-projector.impl.test.ts` ✅ (completed: 2026-08-09 16:21 CEST)
- [x] 3.3.3 Extend 5,000 eager/100,000 logical mounted scale assertions with the exact limit-derived cursor/range/hint/descriptor/reactive/damage/address/run counters from 07 — `packages/kanban/src/board/kanban-viewport.ts`, `packages/kanban/src/board/viewport-scale-inspection.ts`, `packages/kanban/src/testing.ts`, `packages/kanban/test/viewport-scale.impl.test.ts` ✅ (completed: 2026-08-09 16:26 CEST)
- [x] 3.3.4 Run Phase 3 build/typecheck/unit/E2E and `yarn verify:local`; resolve quality-loop critical/major findings ✅ (completed: 2026-08-09 19:07 CEST)

> **Phase 3 quality loop (2026-08-09):** Build, typecheck, 393 unit assertions, nine authentic E2E
> assertions, plugin parity, and `verify:local` reached green. Independent review found no critical
> findings and eight major findings that must be resolved before this gate can close:
>
> - [x] honor lowered mounted descriptor limits and reactive descriptor repaint ownership;
> - [x] forward every rich-card and structure option through `KanbanBoard`;
> - [x] make descriptor and movement damage cover old/new/displaced geometry safely;
> - [x] preserve a non-actionable mounted descriptor-overflow state;
> - [x] replace grouped fixed-stride windowing with sparse/hinted variable-height row projection;
> - [x] integrate reactive structure policy into mounted visibility, collapse, width, and swimlane presentation;
> - [x] add focused mounted regression coverage for every remediation and re-run reviewer/auditor once.

> **Phase 3 final gate (2026-08-09 19:07 CEST):** Build and typecheck passed; 44 unit files
> passed 400 assertions; the authentic hosting E2E passed nine assertions; public JSDoc,
> dependency inspection, plugin parity, and `yarn verify:local` passed. The independent fix-diff
> reviewer/auditor found no Critical issues; their final stale-axis and collapsed-chrome findings
> were resolved and covered before closure.

**Verify**: `yarn workspace @jsvision/kanban build && yarn workspace @jsvision/kanban typecheck && yarn workspace @jsvision/kanban test && yarn workspace @jsvision/kanban test:e2e && yarn verify:local`

## Phase 4: Focus, navigation, and selection controller

> **Phase baseline tree**: `54ffd6bc61a1d6be7f6dbaddc4c6ab6b13e420d5`
> **Lenses**: state-machine correctness, async cancellation, selection safety, stable identity

### Step 4.1: Specification tests

**Reference**: 03-01 §Single-owner interaction; 03-05; ST-B-INT-01..16; PAR-B06/PAR-B13/PAR-B14

- [x] 4.1.1 `[spec-author]` Write the Phase 4-owned controller/programmatic focus/navigation/selection and atomic setup/rollback assertion slices — `packages/kanban/test/interaction.spec.test.ts`, `packages/kanban/test/phase-b-boundary.spec.test.ts` ✅ (completed: 2026-08-09 19:18 CEST)
- [x] 4.1.2 Run the Phase 4 specification suite and record expected red behavior ✅ (completed: 2026-08-09 19:19 CEST)

> **Phase 4 red evidence (2026-08-09 19:19 CEST):** The two Phase 4 specification files ran
> 20 assertions and all 20 failed at the intended missing interaction seams: the stable board facade,
> controller/factory contracts, programmatic focus/navigation/selection, serialization, and atomic
> rollback. The zero-column initial-focus case also reached the existing source-publication rejection
> that Phase 4 must normalize to board-state focus. No Phase 5 input or intent assertion was included.

### Step 4.2: Implementation and green phase

- [x] 4.2.1 Complete public transition/result/environment/controller-factory/facade contracts around the stable Phase 1 target/snapshot types — `packages/kanban/src/interaction/types.ts`, `packages/kanban/src/interaction/facade.ts` ✅ (completed: 2026-08-09 19:22 CEST)
- [x] 4.2.2 Implement ordered type-preserving selection, range, prune, atomic over-limit select-all rejection, opaque server-selection set/clear, and frozen eligible snapshots with session/query generation — `packages/kanban/src/interaction/selection.ts` ✅ (completed: 2026-08-09 19:29 CEST)
- [x] 4.2.3 Implement pure initial-focus and local-to-global reconciliation — `packages/kanban/src/interaction/reconciliation.ts` ✅ (completed: 2026-08-09 19:35 CEST)
- [x] 4.2.4 Implement vertical/horizontal/header/home/end/page/focused-column navigation over scene geometry — `packages/kanban/src/interaction/navigation.ts` ✅ (completed: 2026-08-09 19:41 CEST)
- [x] 4.2.5 Implement generation-scoped bounded acquisition, cancellation, retry feedback, and late-result rejection — `packages/kanban/src/interaction/acquisition.ts` ✅ (completed: 2026-08-09 19:45 CEST)
- [x] 4.2.6 Implement default/factory controller validation, source→scene/cache→controller rollback registration, atomic fail-closed setup, state transitions, facade serialization, safe rejected-transition settlement, subscriptions, reuse rejection, and disposal — `packages/kanban/src/interaction/controller.ts`, `packages/kanban/src/interaction/facade.ts`, `packages/kanban/src/board/kanban-board.ts`, `packages/kanban/src/board/kanban-viewport.ts` ✅ (completed: 2026-08-09 20:27 CEST)
- [x] 4.2.7 Implement transient cancellation ownership and layered Escape selection behavior — `packages/kanban/src/interaction/transient.ts`, `packages/kanban/src/interaction/controller.ts` ✅ (completed: 2026-08-09 20:33 CEST)
- [x] 4.2.8 Replace live legacy identity writes with default-controller seed-only behavior, preserve source deletion authority, and reject identity plus factory — `packages/kanban/src/board/board-bindings.ts`, `packages/kanban/src/board/board-state.ts` ✅ (completed: 2026-08-09 20:41 CEST)
- [x] 4.2.9 Wire controller snapshot/revision and bounded sanitized focused-detail/help projection into scene cues, reveal, inspection, and conditional chrome — `packages/kanban/src/board/scene-builder.ts`, `packages/kanban/src/board/viewport-inspection.ts`, `packages/kanban/src/board/board-feedback.ts` ✅ (completed: 2026-08-09 21:00 CEST)
- [x] 4.2.10 Expose the stable board facade before/after mount and a non-owning compatible standalone Viewport adapter — `packages/kanban/src/board/kanban-board.ts`, `packages/kanban/src/board/kanban-viewport.ts` ✅ (completed: 2026-08-09 21:21 CEST)
- [x] 4.2.11 Export controller factory/facade/contracts with JSDoc/examples, add first-use typed locale vocabulary, and deprecate identity semantics accurately — `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts`, `packages/kanban/src/index.ts` ✅ (completed: 2026-08-09 21:41 CEST)
- [x] 4.2.12 Run the Phase 4-owned controller/programmatic ST-B-INT assertion slices from 07 and make every assertion authored so far green ✅ (completed: 2026-08-09 21:43 CEST)

### Step 4.3: Implementation tests and hardening

- [x] 4.3.1 Add transition serialization/revision/subscription/disposal/cancellation implementation tests — `packages/kanban/test/interaction-controller.impl.test.ts` ✅ (completed: 2026-08-09 22:07 CEST)
- [x] 4.3.2 Add ordered membership/range/prune/snapshot property tests and key collision security cases — `packages/kanban/test/interaction-selection.impl.test.ts` ✅ (completed: 2026-08-09 22:17 CEST)
- [x] 4.3.3 Add navigation geometry/reconciliation/acquisition edge and fake-async tests — `packages/kanban/test/interaction-navigation.impl.test.ts` ✅ (completed: 2026-08-09 22:24 CEST)
- [x] 4.3.4 Run Phase 4 build/typecheck/unit/E2E and `yarn verify:local`; resolve quality-loop critical/major findings ✅ (completed: 2026-08-09 23:24 CEST)

**Verify**: `yarn workspace @jsvision/kanban build && yarn workspace @jsvision/kanban typecheck && yarn workspace @jsvision/kanban test && yarn workspace @jsvision/kanban test:e2e && yarn verify:local`

> **Phase 4 closure evidence (2026-08-09 23:24 CEST):** Build and typecheck pass; 52 unit
> files pass 459 assertions; the E2E project passes 9 assertions; dependency and JSDoc checks,
> `yarn verify:local`, and plugin parity pass. The independent quality loop reported no critical
> findings. Its initial and single permitted fix-diff reviews found major lifecycle, exact-pruning,
> visible-target, source-reconciliation, and async-ownership gaps; every finding is remediated and
> covered by focused controller, board, viewport, and facade regression tests. The strict-scope minor
> findings remain report-only in `10-phase-4-quality-review.md`.

## Phase 5: Mounted keyboard/pointer interaction

> **Phase baseline tree**: `4aa7199dbf25ff7d19353595b3feaab7c33a8861`
> **Lenses**: modern pointer UX, key/event propagation, responsive hosting, lifecycle

### Step 5.1: Specification tests

**Reference**: 03-06; SPEC-B-ACTION-HOOK; SPEC-B-TRANSIENT-CANCEL; ST-B-INT-05..13; ST-B-X-01..04

- [x] 5.1.1 `[spec-author]` Add the Phase 5-owned mounted card/structure/keyboard/down-up/double/right-click/intent assertion slices — `packages/kanban/test/cards-rich.spec.test.ts`, `packages/kanban/test/structure-workflow.spec.test.ts`, `packages/kanban/test/interaction.spec.test.ts` ✅ (completed: 2026-08-09 23:39 CEST)
- [x] 5.1.2 `[spec-author]` Extend Phase B boundary/lifecycle specifications with host, active-input/pending-pointer disposal, deferred-Primary, and deferred-target-absence slices — `packages/kanban/test/phase-b-boundary.spec.test.ts` ✅ (completed: 2026-08-09 23:45 CEST)
- [x] 5.1.3 Run the Phase 5 specification suites and record expected red behavior ✅ (completed: 2026-08-09 23:48 CEST)

> **Phase 5 expected-red evidence (2026-08-09 23:48 CEST):** The four Phase 5 specification
> files execute 63 assertions: 52 pass and 11 fail only at the intentionally absent mounted-input,
> semantic-intent, header/state-action, host-equivalence, pending-press, Ctrl-Primary, and stale-target
> seams. Existing Phase 1–4 assertions remain green; production implementation has not begun.

### Step 5.2: Implementation and green phase

- [x] 5.2.1 Add public immutable open/context/closed-scope action intents and optional handler option; keep cursor retry on its source seam — `packages/kanban/src/interaction/intent.ts`, `packages/kanban/src/board/kanban-board.ts` ✅ (completed: 2026-08-09 23:52 CEST)
- [x] 5.2.2 Implement the closed deliverable key subset, synchronous facade acceptance/handled propagation, Ctrl equivalents, and programmatic Primary operations while explicitly excluding Meta/Command transport — `packages/kanban/src/interaction/input-router.ts` ✅ (completed: 2026-08-09 23:59 CEST)
- [x] 5.2.3 Implement bounded pending-press down/up routing for single/Ctrl/double clicks, distinct right-click, state/header/card actions, and cancellation without capture/drag thresholds — `packages/kanban/src/interaction/pointer-router.ts` ✅ (completed: 2026-08-10 00:03 CEST)
- [x] 5.2.4 Deliver application intents exactly once from the board facade after current committed settlement, wait for authoritative republication, and isolate handler failures — `packages/kanban/src/interaction/intent-router.ts`, `packages/kanban/src/interaction/facade.ts` ✅ (completed: 2026-08-10 00:13 CEST)
- [x] 5.2.5 Wire viewport events to wheel-first interaction routing without capture/drag/insertion behavior — `packages/kanban/src/board/kanban-viewport.ts` ✅ (completed: 2026-08-10 00:32 CEST)
- [x] 5.2.6 Make focused-column navigator and application-owned header/state actions use the same facade transitions and scoped intents — `packages/kanban/src/board/board-bindings.ts`, `packages/kanban/src/board/kanban-board.ts`, `packages/kanban/src/board/kanban-viewport.ts`, `packages/kanban/src/board/viewport-source.ts`, `packages/kanban/src/board/viewport-projector.ts`, `packages/kanban/src/board/viewport-render.ts`, `packages/kanban/src/interaction/intent.ts`, `packages/kanban/src/interaction/intent-router.ts`, `packages/kanban/src/interaction/facade.ts` ✅ (completed: 2026-08-10 00:53 CEST)
- [x] 5.2.7 Add conditional DSL feedback/selection chrome without permanent clutter or raw placement — `packages/kanban/src/board/board-feedback.ts`, `packages/kanban/src/board/kanban-board.ts`, `packages/kanban/src/board/kanban-viewport.ts`, `packages/kanban/src/board/viewport-interaction.ts`, `packages/kanban/src/card/style-resolver.ts`, `packages/kanban/src/interaction/facade.ts`, `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts` ✅ (completed: 2026-08-10 01:10 CEST)
- [x] 5.2.8 Extend the verified Phase 4 mount transaction with input and pending-pointer registration, then complete cancellation-first disposal ordering — `packages/kanban/src/board/kanban-board.ts`, `packages/kanban/src/board/kanban-viewport.ts`, `packages/kanban/src/board/viewport-interaction.ts` ✅ (completed: 2026-08-10 01:26 CEST)
- [x] 5.2.9 Export intent/input-facing durable API and testing event harnesses with full JSDoc, plus first-use typed locale vocabulary — `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts`, `packages/kanban/src/index.ts`, `packages/kanban/src/testing.ts` ✅ (completed: 2026-08-10 01:34 CEST)
- [x] 5.2.10 Run the Phase 5-owned mounted ST-B-CARD/STRUCT/INT and ST-B-X-01..04 assertion slices from 07 and make them green ✅ (completed: 2026-08-10 01:36 CEST)

### Step 5.3: Implementation tests and hardening

- [x] 5.3.1 Add event normalization/handled/click-count/capability/handler-failure implementation tests — `packages/kanban/test/input-router.impl.test.ts` ✅ (completed: 2026-08-10 01:42 CEST)
- [x] 5.3.2 Add mount/dispose/leak/late-work/reactive-replacement tests — `packages/kanban/test/phase-b-lifecycle.impl.test.ts` ✅ (completed: 2026-08-10 01:49 CEST)
- [x] 5.3.3 Implement the exact 12-row base/pairwise real-loop matrix from 07 plus bounded one-axis locale/theme/capability edges — `packages/kanban/test/e2e/core-board.e2e.test.ts`, `packages/kanban/test/e2e/core-board-edges.e2e.test.ts`, `packages/kanban/test/e2e/board-hosting.e2e.test.ts` ✅ (completed: 2026-08-10 02:01 CEST)
- [x] 5.3.4 Run Phase 5 build/typecheck/unit/E2E/JSDoc and `yarn verify:local`; resolve quality-loop critical/major findings ✅ (completed: 2026-08-10 02:38 CEST)

**Verify**: `yarn workspace @jsvision/kanban build && yarn workspace @jsvision/kanban typecheck && yarn workspace @jsvision/kanban test && yarn workspace @jsvision/kanban test:e2e && yarn workspace @jsvision/kanban check:docs && yarn verify:local`

> **Phase 5 closure evidence (2026-08-10 02:38 CEST):** Build and typecheck pass; 55 unit
> files pass 483 assertions; 4 E2E files pass 23 assertions; dependency and JSDoc checks,
> `yarn verify:local`, and regenerated plugin parity pass. The independent quality loop reported no
> critical findings. Its initial review found major wheel fail-closed, reverse-ownership teardown,
> and exact E2E matrix gaps; all three are remediated and the single permitted fix-diff re-review
> passed without new critical or major findings. The strict-scope file-size minor remains report-only
> in `10-phase-5-quality-review.md`.

## Phase 6: i18n, package, docs, plugin, and closure

> **Phase baseline tree**: `715f7efa5d841cf92f73ae1b13d33f0f841cc2ef`
> **Lenses**: public SDK compatibility, localization, documentation truth, distribution integrity
> **Expected modification set**: Phase 6 package/public-consumer tests and fixtures, Kanban locale
> catalogs/review evidence, package and architecture documentation, generated API coverage, canonical
> JSVision skill references, plugin impact snapshots, and the execution/review artifacts named below.

### Step 6.1: Specification tests

**Reference**: 03-06 §i18n/Public integration/Documentation; ST-B-X-05..07; PAR-B20–24

- [x] 6.1.1 `[spec-author]` Extend packed consumer, public API, locale review, docs/API, and plugin-impact oracles for the complete Phase B surface — `packages/kanban/test/package-consumer.spec.test.ts`, `packages/examples/test/api-reference.spec.test.ts`, `packages/i18n/test/i18n-package-registration.spec.test.ts` ✅ (completed: 2026-08-10 02:46 CEST)
- [x] 6.1.2 Run the Phase 6 integration oracles and record expected red/drift behavior before registry/documentation generation changes ✅ (completed: 2026-08-10 02:50 CEST)

> **Phase 6 expected-red evidence (2026-08-10 02:50 CEST):** The authentic packed consumer
> passes 2 assertions across the expanded main/testing/ten-locale surface and private paths; the i18n
> registration/review suite passes 4 assertions; and the API/integration suite passes 9 of 10
> assertions. Its sole expected failure is ST-B-X-07, which first detects the stale Phase A/read-only
> package README at the missing `Interaction and intents` section. Generated API coverage and plugin
> impact registration are already green. No production, locale, documentation, registry, or generated
> artifact was changed while establishing this red gate.

### Step 6.2: Implementation and green phase

- [x] 6.2.1 Reconcile all phase-owned typed English vocabulary and nine authored translations, fill any closure-only terms, and record current digest-bound review evidence — `packages/kanban/src/i18n/catalog.ts`, `packages/kanban/src/i18n/translations/*.ts`, `tools/i18n-translation-reviews.json` ✅ (completed: 2026-08-10 02:52 CEST)

> **Vocabulary reconciliation evidence (2026-08-10 02:52 CEST):** The typed 22-message Phase B
> English overlay accounts for every package-owned Phase B label and feedback state consumed by the
> implementation. Each of the nine authored translations satisfies that exact map, and the existing
> digest-bound review evidence is current. No closure-only user-visible term was found, so no unused
> vocabulary or translation churn was introduced. Locale entry-point, literal-ownership, and review
> checks all pass.
- [x] 6.2.2 Run locale generation/literal/review checks and inspect generated locale wrappers atomically — `packages/kanban/src/locales/*.ts` ✅ (completed: 2026-08-10 02:57 CEST)

> **Locale integration evidence (2026-08-10 02:57 CEST):** Regeneration leaves all ten public
> locale wrappers deterministic. Their established named symbols now compose the separately validated
> foundation and Phase B overlays into one deeply immutable public catalog, so consumers can translate
> the complete package-owned vocabulary without importing private translation modules. Strict-reference
> validation and interpolation pass for every locale; locale generation, literal ownership, digest
> reviews, plugin parity, focused typecheck/unit coverage, and local verification are green.
- [x] 6.2.3 Complete public JSDoc/examples, package README, and changelog with honest Phase B/later boundaries — `packages/kanban/src/**/*.ts`, `packages/kanban/README.md`, `packages/kanban/CHANGELOG.md` ✅ (completed: 2026-08-10 03:04 CEST)

> **Public documentation evidence (2026-08-10 03:04 CEST):** The package JSDoc gate covers 118
> source files with no banned references or missing public examples. README and changelog now describe
> implemented card presentation, workflow/swimlane structure, sparse scene behavior, focus/selection,
> mounted keyboard and pointer input, the `KanbanInteractionFacade`, semantic application intents, and
> complete locale catalogs. They explicitly retain drag/drop, packaged editors, commands, component
> labs, kitchen sink, and showcase as later boundaries. ST-B-X-07 advances to its expected technical
> architecture failure; the package README assertions are green.
- [x] 6.2.4 Extend offline packed main/testing/ten-locale runtime/type/export/private-path fixtures for Phase B — `packages/kanban/test/fixtures/packed-consumer/index.ts`, `packages/kanban/test/package-consumer.spec.test.ts` ✅ (completed: 2026-08-10 03:09 CEST)

> **Packed-consumer evidence (2026-08-10 03:09 CEST):** Both authentic offline consumers now
> typecheck and execute Phase B root/testing APIs plus all ten explicit locale subpaths. Runtime checks
> prove that every established locale symbol carries foundation and Phase B vocabulary and that an
> unmounted interaction facade fails closed. Exact export-map and representative private Phase B path
> rejection remain enforced. The two packed suites pass 3 assertions from real tarballs.
- [x] 6.2.5 Update Kanban architecture/data-model/API/security docs and decision/index navigation for implemented core-board semantics — `docs/architecture/kanban.md`, `docs/architecture/data-model.md`, `docs/architecture/api-design.md`, `docs/architecture/security.md`, `docs/index.md` ✅ (completed: 2026-08-10 03:31 CEST)

> **Technical architecture evidence (2026-08-10 03:31 CEST):** Architecture, data model, API,
> security, techdocs entry, and ADR navigation now cover the canonical sparse scene,
> `KanbanInteractionFacade`/controller ownership, bounded focus and selection, mounted keyboard and
> pointer routing, semantic intents, failure containment, and cancellation-first teardown. Comparison
> against accepted ADR-006 through ADR-013 found no design-intent divergence and required no new ADR.
> `yarn docs:build` completes successfully; generated API output remains deterministic, with only the
> repository's existing TypeDoc/Rollup warnings.
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
