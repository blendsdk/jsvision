# Execution plan: Kanban Phase A Foundation

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-08-04 07:37 CEST
> **Progress**: 48/64 tasks (75%)
> **CodeOps Artifact Schema**: 1

## Overview

Build the public contract before data implementations, data before presentation, and presentation
before the mounted board. Close distribution/docs/i18n/plugin integration only after the declarations
and behavior are stable. Every phase follows specification tests → explicit red evidence → production
implementation → green specification tests → implementation/property tests → focused verification.

**Update this document immediately whenever a task changes state.** Mark the active task `[~]` with a
timestamp, and mark `[x]` only after its stated verification. Resume the first `[~]`, otherwise the
first `[ ]`. Preserve unrelated worktree changes and record the actual phase baseline before edits.

## Implementation phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Package, contracts, and application authority | 12 |
| 2 | Query sessions, sparse cursors, and eager/windowed sources | 12 |
| 3 | Cards, descriptors, themes, and locale modules | 12 |
| 4 | Responsive viewport and board integration | 15 |
| 5 | Distribution, docs, official i18n, and plugin closure | 13 |
|  | **Total** | **64** |

## Phase 1: Package, contracts, and application authority

> **Phase baseline tree**: ccd3dbe5bccfd17ffc2df86e7cb0486d19a6a875
>
> **Scope mode**: strict — execute only the confirmed Phase A product scope and the expected
> modification set below; optional additions remain out of scope.
>
> **Expected modification set**: Kanban package/test scaffolding; contract and request modules; public
> barrels; package metadata/configuration
>
> **Reference**: 03-01; RD01-AC05, AC07–09, AC11–13, AC15; PAR-09, PAR-12, PAR-14, PAR-17–PAR-20

- [x] 1.1.1 `[spec-author]` Add immutable public contract/type specifications for ST-R01-05/07 and ST-R01-12/13: authority seam, identity distinction, terminology, and raw request/capability behavior without constructing mounted components — `packages/kanban/test/public-api.spec.test.ts`, `packages/kanban/test/fixtures/consumer-types.ts` ✅ (completed: 2026-08-04 00:16)
- [x] 1.1.2 `[spec-author]` Add immutable contract/security specifications for ST-R01-08/15, ST-A-CONTRACT-SECURITY-01, and PAR-19/20: IDs, limits, semantic JSON, sanitized errors/observations, and N/A host/server boundaries — `packages/kanban/test/contracts.spec.test.ts`, `packages/kanban/test/security-boundary.spec.test.ts` ✅ (completed: 2026-08-04 00:24)
- [x] 1.1.3 `[spec-author]` Add immutable package-boundary specifications for ST-R01-09/11 and ST-A-PACKAGE-METADATA-01: production/testing separation, private-path rejection, import separation, dependency metadata, and scripts — `packages/kanban/test/package-boundary.spec.test.ts` ✅ (completed: 2026-08-04 00:28)
- [x] 1.1.4 `[spec-author]` Add the immutable ST-A-PACKAGE-CONSUMER-01 contract-only packed-consumer oracle and minimal isolated fixture before package metadata exists; it imports one main-entry contract symbol but no testing helper, mounted Board/Viewport, or locale symbol — `packages/kanban/test/package-consumer-contract.spec.test.ts`, `packages/kanban/test/fixtures/packed-consumer/{package,tsconfig}.json`, `packages/kanban/test/fixtures/packed-consumer/index.ts` ✅ (completed: 2026-08-04 00:35)
- [x] 1.1.5 Run Phase 1 specifications directly from the root test runner and record expected red failures caused only by the absent package/public symbols and tarball ✅ (completed: 2026-08-04 00:38)
  - Red evidence: root Vitest exited 1 with 5/5 files red: three suites could not import the absent
    `src/index.js`; six package-boundary assertions found only the absent `package.json`/`src` tree;
    and the isolated consumer could not pack the absent package. No implemented behavior failed.
- [x] 1.2.1 Create publishable package metadata, exact export map/scripts/dependencies, license, and initial changelog — `packages/kanban/package.json`, `packages/kanban/LICENSE`, `packages/kanban/CHANGELOG.md` ✅ (completed: 2026-08-04 00:40)
- [x] 1.2.2 Add NodeNext build/typecheck and unit/E2E Vitest project configuration consistent with specialist packages — `packages/kanban/tsconfig.json`, `packages/kanban/tsconfig.typecheck.json`, `packages/kanban/vitest.config.ts` ✅ (completed: 2026-08-04 00:43)
- [x] 1.2.3 Add main/testing barrels and module directories while preserving production/testing graph isolation — `packages/kanban/src/index.ts`, `packages/kanban/src/testing.ts` ✅ (completed: 2026-08-04 00:45)
- [x] 1.2.4 Implement documented identity validators/factories, revision equality, and the full immutable limits manifest/class selection — `packages/kanban/src/contract/{identity,limits,revision}.ts` ✅ (completed: 2026-08-04 00:49)
- [x] 1.2.5 Implement typed error hierarchy, bounded observation buffer/safe redaction, and bounded sorted deep-frozen semantic JSON/query snapshots with derived fingerprints — `packages/kanban/src/contract/{error,observation,semantic-query}.ts` ✅ (completed: 2026-08-04 00:56)
- [x] 1.2.6 Implement public namespaced request/result/dispatcher/capability contracts and publication-only reconciliation metadata; accepted/contradictory results never mutate application records — `packages/kanban/src/contract/{request,capability,authority}.ts` ✅ (completed: 2026-08-04 01:04)
- [x] 1.3.1 Add implementation/property tests for boundary arithmetic, snapshot detachment/key order, hostile prototypes/accessors, observation eviction/redaction, dispatcher failure, and idempotent reconciliation; make every Phase 1-owned contract/package/packed-consumer spec green while leaving mounted component oracles to Phase 4; run Kanban typecheck/build/docs checks, `yarn verify:local`, and the phase reviewer/auditor loop — `packages/kanban/test/{contracts,authority}.impl.test.ts` ✅ (completed: 2026-08-04 01:32)

**Phase 1 deliverable:** A type-safe publishable shell and independently testable public authority/
validation contracts. No mounted board behavior is claimed.

## Phase 2: Query sessions, sparse cursors, and eager/windowed sources

> **Phase baseline tree**: f66f28f2f88c067222f90659d26930a1ecdddffd
>
> **Expected modification set**: Source/session/cursor contracts and validation; generation coordinator;
> eager source; deterministic testing sources; focused source tests
>
> **Reference**: 03-02, 03-03; all RD-02 criteria; RD01-AC07; PAR-10–PAR-11, PAR-14, PAR-19–PAR-22

- [x] 2.1.1 `[spec-author]` Add immutable query/session specifications for ST-R02-05, ST-R02-08/09, ST-R02-14, and ST-R02-16/17: query changes, states/count quality, bounded identity location, cancellation, stale suppression, atomicity, and safe observations — `packages/kanban/test/query-session.spec.test.ts` ✅ (completed: 2026-08-04 01:54)
- [x] 2.1.2 `[spec-author]` Add immutable cursor specifications for ST-R02-04/06, ST-R02-10–12/15, and ST-A-SOURCE-LIFECYCLE-01: ranges, unloaded/scoped-error states, placement, disposal, and identity changes — `packages/kanban/test/cursor.spec.test.ts` ✅ (completed: 2026-08-04 02:05)
- [x] 2.1.3 `[spec-author]` Add immutable eager/windowed scale specifications for ST-R02-01 and ST-A-SOURCE-SCALE-01: exact 5,000-card semantics and pure-source 100,000-logical-card visible/overscan-only reads — `packages/kanban/test/eager-source.spec.test.ts`, `packages/kanban/test/windowed-source.spec.test.ts` ✅ (completed: 2026-08-04 02:15)
- [x] 2.1.4 Run all Phase 2 specifications and record the expected red failures before source production modules exist — 4 files/15 tests red only for approved absent Phase 2 source/testing symbols; typecheck reports the same absent symbols ✅ (completed: 2026-08-04 02:24)
- [x] 2.2.1 Implement documented source/query-session/cursor interfaces, the optional revision-bound locator contract, source/cell state, and honest count-quality unions — `packages/kanban/src/source/{types,states,counts}.ts` ✅ (completed: 2026-08-04 02:32)
- [x] 2.2.2 Implement collision-safe cell addresses, identity-change and placement unions/token checks, and source-publication boundary validation — `packages/kanban/src/source/{address,placement,validation}.ts` ✅ (completed: 2026-08-04 02:42)
- [x] 2.2.3 Implement the private generation-owned session coordinator, explicit visible/overscan/prefetch retention owners, bounded load scheduler, and generation-before-abort disposal order — `packages/kanban/src/source/{session-coordinator,load-scheduler}.ts` ✅ (completed: 2026-08-04 02:53)
- [x] 2.2.4 Implement cursor range normalization/coalescing, revision-scoped placement validation, stale continuation suppression, scoped retry/error handling, and idempotent cleanup — `packages/kanban/src/source/{cursor-coordinator,range-set}.ts` ✅ (completed: 2026-08-04 03:03)
- [x] 2.2.5 Implement the reactive eager source transaction with validation, stable ordering, exact counts, per-cell indexes, placement, and last-valid publication retention — `packages/kanban/src/source/{eager-source,eager-index}.ts` ✅ (completed: 2026-08-04 03:18)
- [x] 2.2.6 Implement documented deterministic eager/windowed/revision/deferred/instrumentation helpers in the testing entry without production imports reaching them — `packages/kanban/src/testing/{eager-fixture,windowed-fixture,instrumentation}.ts` ✅ (completed: 2026-08-04 03:31)
- [x] 2.3.1 Add implementation/property tests for stable sorting, duplicate/unknown IDs, range arithmetic, scheduler concurrency, cursor retention transitions, disposal ordering, late results, exact/unknown counts, and payload redaction — `packages/kanban/test/{source-lifecycle,eager-index}.impl.test.ts` ✅ (completed: 2026-08-04 03:36)
- [x] 2.3.2 Confirm every Phase 2 specification green; run Kanban build/typecheck/unit/dependency/JSDoc checks, deterministic scale instrumentation, `yarn verify:local`, `yarn plugin:check`, and the phase reviewer/auditor loop ✅ (completed: 2026-08-04 03:54)

**Phase 2 deliverable:** One authoritative read contract for eager and windowed sources with bounded,
cancellable, sparse lifecycle and deterministic consumer testing fixtures.

## Phase 3: Cards, descriptors, themes, and locale modules

> **Phase baseline tree**: 8283fb238251e97b6f01549ec9f158197ca98618
>
> **Expected modification set**: Card/descriptor/renderer/theme/catalog modules and focused tests; ten
> locale modules exist but official registry/review changes remain atomic in Phase 5
>
> **Reference**: 03-04; RD04-AC01–02; RD01-AC14; PAR-13–PAR-15, PAR-23–PAR-24

- [x] 3.1.1 `[spec-author]` Add immutable ST-A-CARD-01/02 and ST-R01-14 card specifications for application records, stable identity, title/status/focus at widths 18–32, safe fallback, and deferred-section absence — `packages/kanban/test/cards.spec.test.ts` ✅ (completed: 2026-08-04 04:13)
- [x] 3.1.2 `[spec-author]` Add immutable ST-A-DESCRIPTOR-SAFETY-01 descriptor/theme/catalog specifications for bounded rows/regions, safe text/roles, local failure isolation, role/catalog parity, fallback, side-effect-free imports, and monochrome cues — `packages/kanban/test/{descriptor,theme,i18n}.spec.test.ts` ✅ (completed: 2026-08-04 04:38)
  - Red evidence: 3 files/19 tests fail only because the approved Phase 3 descriptor/theme/catalog
    symbols and authored locale assembly do not exist; typecheck reports only those same absent exports.
- [x] 3.1.3 Run Phase 3 specifications and record expected red failures before card/theme/catalog implementations ✅ (completed: 2026-08-04 04:41)
  - Red evidence: all 4 Phase 3 files and 37 tests fail only for the approved absent card adapter,
    renderer/descriptor, semantic theme, English catalog, and authored locale assembly symbols.
- [x] 3.2.1 Implement documented generic adapter and complete `StandardCard` convenience/checklist/summary data types without imposing them on generic records — `packages/kanban/src/card/{adapter,standard-card}.ts` ✅ (completed: 2026-08-04 04:46)
- [x] 3.2.2 Implement the bounded formatter context and adapter-boundary value validation without a runtime schema or Forms dependency — `packages/kanban/src/card/formatting.ts`, `packages/kanban/src/card/adapter.ts` ✅ (completed: 2026-08-04 04:50)
- [x] 3.2.3 Implement inert theme-token declarations required by descriptors; implement bounded descriptor/renderer contracts and validation plus the Phase A standard/fallback renderer with sanitized cell-correct title/status/non-color focus — `packages/kanban/src/card/{theme,descriptor,renderer,standard-renderer}.ts` ✅ (completed: 2026-08-04 05:00)
- [x] 3.2.4 Implement exhaustive package-local theme roles, immutable theme creation/mapping, safe Phase A fallbacks, revision projection, and basic color-depth/monochrome handling — `packages/kanban/src/card/{theme,theme-resolver}.ts` ✅ (completed: 2026-08-04 05:06)
- [x] 3.2.5 Implement the typed Phase A catalog schema, English fallback vocabulary, and composition helpers in generator-compatible authored source — `packages/kanban/src/i18n/catalog.ts` ✅ (completed: 2026-08-04 05:09)
- [x] 3.2.6 Implement Dutch, German, and French typed Phase A catalogs — `packages/kanban/src/i18n/translations/{nl,de,fr}.ts` ✅ (completed: 2026-08-04 05:12)
- [x] 3.2.7 Implement Spanish, Italian, and Portuguese typed Phase A catalogs — `packages/kanban/src/i18n/translations/{es,it,pt-PT}.ts` ✅ (completed: 2026-08-04 05:15)
- [x] 3.2.8 Implement Polish, Romanian, and Swedish catalogs and assemble all ten side-effect-free values for generated wrappers — `packages/kanban/src/i18n/translations/{pl,ro,sv}.ts`, `packages/kanban/src/i18n/locales.ts` ✅ (completed: 2026-08-04 05:18)
- [x] 3.3.1 Add implementation/property tests for descriptor geometry, display-cell clipping/wide glyphs, hostile fields, throwing adapters/renderers, role validation, catalog parity, and fallback determinism; correct the dependency-aware packed-consumer fixture exposed by Phase 3 public types; make Phase 3 specs green; run Kanban build/typecheck/unit/JSDoc checks, `yarn verify:local`, `yarn plugin:check`, and phase reviewer/auditor loop — `packages/kanban/test/{descriptor,theme,i18n}.impl.test.ts`, `packages/kanban/test/{package-consumer-contract.spec.test.ts,fixtures/packed-consumer/tsconfig.json}` ✅ (completed: 2026-08-04 05:50)

**Phase 3 deliverable:** Durable presentation/theme/i18n contracts and the deliberately small basic
card renderer required by the Phase A slice.

## Phase 4: Responsive viewport and board integration

> **Phase baseline tree**: d6893e1fe2a1bdd10c2acc3725579362be0dbe29
>
> **Expected modification set**: Pure layout/projection modules; descriptor cache; identity projection;
> viewport/board components; real headless E2E and implementation tests
>
> **Reference**: 03-05; all RD-03 criteria; RD01-AC01, AC03–04, AC06; RD02 integration; RD05-AC01/18;
> PAR-12–PAR-14, PAR-21–PAR-23

- [x] 4.1.1 `[spec-author]` Add immutable ST-R03-01/02, ST-R03-05–07, ST-R03-11/12, and ST-A-LAYOUT-01 width/vertical-layout specifications — `packages/kanban/test/layout.spec.test.ts` ✅ (completed: 2026-08-04 06:03)
- [x] 4.1.2 `[spec-author]` Add immutable ST-R01-01/03/04/06, ST-R02-02/03/07/13, ST-R03-08/10/14/15, ST-A-COLUMN-01/02, and ST-A-VIEWPORT-LIFECYCLE-01 viewport/board specifications; ST-R01-01 uses an isolated NodeNext fixture and invokes consumer `tsc` before Board implementation — `packages/kanban/test/{viewport,board}.spec.test.ts`, `packages/kanban/test/fixtures/consumer-board-types/{package,tsconfig}.json`, `packages/kanban/test/fixtures/consumer-board-types/index.ts` ✅ (completed: 2026-08-04 06:14)
- [x] 4.1.3 `[spec-author]` Add real headless ST-R03-03/04/09/13 E2E specifications for hosting, resize/maximize/restore, reactive i18n replacement, long locale/wide glyphs, monochrome, reorder/removal, and clipping — `packages/kanban/test/e2e/board-hosting.e2e.test.ts` ✅ (completed: 2026-08-04 06:22)
- [x] 4.1.4 Run Phase 4 specifications/E2E and record expected red failures before layout/UI production changes ✅ (completed: 2026-08-04 06:24)
  - Red evidence: the combined unit oracle executes 28 cases with 27 red and the raw-placement guard
    already green; the four real-host E2E cases are red. Every failure is caused only by the absent
    approved pure-layout functions/types and `KanbanViewport`/`KanbanBoard` constructors/inspection
    declarations; the isolated NodeNext consumer fails for the same absent public surface.
- [x] 4.2.1 Implement pure validated monotone tiered width solver, focused-column navigator model, and immutable viewport metrics/hit-damage types — `packages/kanban/src/layout/{width-solver,metrics,hit-map}.ts` ✅ (completed: 2026-08-04 06:31)
- [x] 4.2.2 Implement vertical card/header/gap projection plus scroll extents and stable card/column anchors — `packages/kanban/src/layout/{vertical-projector,scroll-model}.ts` ✅ (completed: 2026-08-04 06:38)
- [x] 4.2.3 Implement bounded viewport-local descriptor cache with complete semantic key, owned reactive scopes, targeted invalidation, visible/overscan eviction, and disposal-before-cursor ordering — `packages/kanban/src/board/descriptor-cache.ts` ✅ (completed: 2026-08-04 06:43)
- [x] 4.2.4 Implement the standalone viewport's single-coordinator lifecycle and bounded session/cursor acquisition, including locator cancellation and stale-generation suppression — `packages/kanban/src/board/{kanban-viewport,viewport-source}.ts` ✅ (completed: 2026-08-04 06:58 CEST)
- [x] 4.2.5 Implement clipped descriptor projection, sticky workflow headers, and loading/partial/empty/error state drawing — `packages/kanban/src/board/{viewport-projector,viewport-render}.ts` ✅ (completed: 2026-08-04 07:06 CEST)
- [x] 4.2.6 Implement two-axis wheel/imperative scrolling, revision-bound `revealCard`, immutable metrics, and stable resize anchors — `packages/kanban/src/board/{viewport-scroll,viewport-metrics}.ts` ✅ (completed: 2026-08-04 07:14 CEST)
- [x] 4.2.7 Implement bounded damage maps, a non-actionable inspection-geometry snapshot, and the Phase A pointer map with no card/action/insertion targets — `packages/kanban/src/board/{viewport-damage,viewport-inspection}.ts` ✅ (completed: 2026-08-04 07:21 CEST)
- [x] 4.2.8 Implement the responsive `KanbanBoard<TCard>` DSL shell and reactive query/density/theme/i18n/capability/identity bindings with one-reflow invalidation — `packages/kanban/src/board/{kanban-board,board-bindings}.ts` ✅ (completed: 2026-08-04 07:37 CEST)
- [ ] 4.2.9 Implement board request-publication coordination, one-viewport composition/delegation, public request/viewport delegators, and idempotent disposal without a second read coordinator — `packages/kanban/src/board/{board-state,board-authority}.ts`
- [ ] 4.2.10 Add the sanctioned-exception/absolute-placement guard and implementation/property tests for solver ties, cache eviction, damage/reflow, lifecycle, and out-of-clip safety — `packages/kanban/test/{layout,viewport,board-lifecycle}.impl.test.ts`
- [ ] 4.3.1 Confirm every Phase 4 spec/E2E green; run Kanban build/typecheck/unit/E2E/dependency/JSDoc checks, deterministic 5,000/100,000 instrumentation, `yarn verify:local`, `yarn plugin:check`, and phase reviewer/auditor loop

**Phase 4 deliverable:** Responsive read-only board/viewport behavior, bounded projection, basic cards,
zero/populated columns, scrolling, equal host behavior, and identity-preserving resize.

## Phase 5: Distribution, docs, official i18n, and plugin closure

> **Expected modification set**: Packed-consumer and integration specs; package docs; technical docs;
> package/API/i18n/plugin inventories; review manifest; canonical skill and generated plugin
>
> **Reference**: 03-06; RD01-AC02, AC10; PAR-15–PAR-18, PAR-24

- [ ] 5.1.1 `[spec-author]` Extend immutable docs package/install/API inventory specifications for Kanban before registry changes — `packages/docs-site/test/{install-and-packages-guide,api-barrel-exports}.spec.test.ts`, `packages/examples/test/api-reference.spec.test.ts`
- [ ] 5.1.2 `[spec-author]` Add the immutable complete ST-R01-02/10 tarball oracle for main/testing plus all ten locale runtime/type entry points and extend official locale registration/digest-review specifications before wrapper/registry changes — `packages/kanban/test/package-consumer.spec.test.ts`, `packages/i18n/test/i18n-package-registration.spec.test.ts`, `tools/jsvision-skill/test/i18n-plugin.spec.test.ts`
- [ ] 5.1.3 `[spec-author]` Extend immutable canonical API/source-impact/generated-parity specifications before plugin changes — `packages/examples/test/api-reference.spec.test.ts`, `tools/jsvision-skill/test/i18n-plugin.spec.test.ts`
- [ ] 5.1.4 Run Phase 5 distribution/docs/i18n/plugin specifications and record expected red failures before registry/documentation changes
- [ ] 5.2.1 Complete package README/changelog/public examples and rerun the already-green Phase 1 contract-only packed-consumer oracle against the complete Phase A package; run dependency, native-dependency, main/testing tarball runtime/type, and JSDoc checks — `packages/kanban/{README,CHANGELOG}.md`, `packages/kanban/test/package-consumer-contract.spec.test.ts`, `packages/kanban/test/fixtures/packed-consumer/{package,tsconfig}.json`, `packages/kanban/test/fixtures/packed-consumer/index.ts`
- [ ] 5.2.2 Add Kanban to the official locale registry and add disclosed current digest-bound review evidence for all nine non-English Phase A catalogs — `tools/i18n-locale-exports.json`, `tools/i18n-translation-reviews.json`
- [ ] 5.2.3 Run locale generation/check plus literal and translation-review checks; inspect generator-owned `packages/kanban/src/locales/*.ts` wrappers, make the complete ST-R01-02 tarball runtime/type/export-map oracle green, and preserve the atomic official-catalog invariant — `packages/kanban/test/package-consumer.spec.test.ts`
- [ ] 5.2.4 Add Kanban to docs API/package/install inventories and auxiliary locale API generation without adding a placeholder component page/live example — `packages/docs-site/src/api/packages.mjs`, `packages/docs-site/scripts/gen-api.mjs`, `packages/docs-site/test/{install-and-packages-guide,api-barrel-exports}.spec.test.ts`, `packages/examples/test/api-reference.spec.test.ts`
- [ ] 5.2.5 Generate Kanban API pages and run focused docs typecheck/tests/build; inspect `packages/docs-site/api/kanban/`, generated locale auxiliary entries, and affected navigation links
- [ ] 5.2.6 Update `docs/architecture/kanban.md`, `docs/index.md`, and `docs/decisions/index.md` for ownership, package topology, session/cursor lifecycle, bounded viewport, and honest Phase A/later-phase boundaries; validate links/diagrams
- [ ] 5.2.7 Update canonical JSVision skill Kanban API/discovery guidance and source-impact mapping — `tools/jsvision-skill/SKILL.md`, `tools/jsvision-skill/references/{architecture,component-catalog}.md`, `tools/jsvision-skill/references/api/index.md`, `tools/jsvision-plugin-impact.json`; before editing, record and include only additional canonical paths emitted by the checked-in impact map
- [ ] 5.2.8 Run `yarn plugin:update`; inspect/include `tools/jsvision-skill/references/api/kanban.md`, the source-impact snapshot, synchronized recipes, and `plugins/jsvision-plugin/skills/jsvision/`; make `packages/examples/test/api-reference.spec.test.ts` and `tools/jsvision-skill/test/i18n-plugin.spec.test.ts` green
- [ ] 5.3.1 Run the full agreed local gate: Kanban build/typecheck/unit/E2E/deps/JSDoc and packed consumer; affected docs/i18n/inventory tests and docs build; `yarn verify:local`; `yarn plugin:check`; final focused rerun; resolve reviewer/auditor critical/major findings; synchronize plan/traceability/roadmaps without claiming RD-04/RD-05 or RD-13–15 complete

**Phase 5 deliverable:** A locally verified, discoverable, publishable Phase A package with current
official locale evidence and plugin/API parity, while teaching labs/kitchen sink/showcase remain Phase F.

## Dependencies

```text
Phase 1 public contracts
    ↓
Phase 2 source lifecycle
    ↓
Phase 3 descriptors/theme/catalogs
    ↓
Phase 4 mounted responsive board
    ↓
Phase 5 distribution and documentation closure
```

## Success criteria

1. All 64 tasks are completed in specification-first order with recorded red and green evidence.
2. All 51 Phase A criteria in `07-testing-strategy.md` pass without weakening immutable specifications.
3. Every phase has no unresolved critical or major reviewer/auditor finding.
4. The local gate in PAR-18 passes, including plugin and digest-bound translation review integrity.
5. The roadmap advances RD-01–RD-03 to plan-created/preflight-ready ownership while RD-04/RD-05 remain
   incomplete with only their named Phase A slice linked.
6. No unrelated pre-existing worktree change is overwritten, staged, committed, or cleaned up by this
   plan.
