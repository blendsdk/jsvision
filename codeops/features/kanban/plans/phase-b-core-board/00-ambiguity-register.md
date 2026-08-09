# Ambiguity Register: Kanban Phase B Core Board

> **Status**: ✅ GATE PASSED — all 36 items resolved
> **Last Updated**: 2026-08-09 15:43 CEST
> **Planning Target**: `kanban/PLAN-PHASE-B` — remaining independently executable RD-04, RD-05, and RD-06 behavior
> **Context Artifacts**: approved Kanban requirements and ambiguity register, completed Phase A plan and implementation, JSVision UI/Data Grid precedents, technical architecture
> **Modification Set**: this Phase B plan set, Kanban traceability, and the Kanban feature roadmap; later owning RDs and the user-modified portfolio roadmap are context-only
> **Mode**: auto-design
> **Root Invocation ID**: `AD-MAKE-PLAN-PHASE-B-20260804T092600Z`
> **Policy Version**: 1

| # | Category | Ambiguity / Gap | Options Presented | Decision / Authority | Status |
|---|---|---|---|---|---|
| PAR-B01 | Scope | Does Phase B pull later editor, drag, mutation, command, or saved-view systems forward merely because an RD criterion names their integration? | Pull dependencies forward / implement durable Phase B hooks and keep integration criteria open | **User confirmed durable hooks with honest later-phase integration ownership.** | ✅ Resolved |
| PAR-B02 | Scope | What exact requirements form the Phase B planning group? | Remaining RD-04–06 behavior / a smaller visual slice / all interaction work | **User confirmed remaining independently executable RD-04, RD-05, and RD-06 behavior.** | ✅ Resolved |
| PAR-B03 | Scope | Which later behavior is excluded? | Strict phase boundary / opportunistic adjacent implementation | **Strict boundary: RD-07+ implementations remain outside Phase B.** | ✅ Resolved |
| PAR-B04 | Data & state | Who owns authoritative card, workflow, policy, and mutation data? | Board / application / dual authority | **Imported requirement AR-3/AR-42: application authority remains unchanged.** | ✅ Resolved |
| PAR-B05 | Architecture | Does richer presentation replace the Phase A board/viewport split? | Retain one bounded viewport / mounted card-cell view graph | **Delegated: retain `KanbanBoard` as the DSL shell and one exact-cell `KanbanViewport`; add pure bounded models/controllers.** | ✅ Resolved |
| PAR-B06 | Data & state | Who owns ephemeral focus, selection, range anchor, and preferred visual row? | Board-owned / application-controlled / hybrid | **Delegated after challenge and preflight: one board facade owns serialization/intents over exactly one default or mount-factory controller; the board owns/disposes the result.** | ✅ Resolved |
| PAR-B07 | Architecture | How are columns×swimlanes projected across hybrid, separator, band, and rail variants? | One normalized 2-D semantic model / separate variant pipelines | **Delegated: one canonical semantic scene feeds bounded presentation geometry strategies.** | ✅ Resolved |
| PAR-B08 | Integration | How does Enter/double-click/context activation remain durable before dialogs and commands exist? | Temporary callback / durable semantic action bridge / defer all activation | **Delegated after challenge: a final-shaped semantic interaction intent and optional handler are public now; later dialogs/commands adapt to the same core.** | ✅ Resolved |
| PAR-B09 | UX & presentation | How are preset densities and bounded custom presentation represented? | Literal presets plus policy object / arbitrary renderer budgets / fixed presets only | **Delegated: retain three preset names and normalize preset-or-custom input into one immutable bounded presentation budget.** | ✅ Resolved |
| PAR-B10 | Architecture | Do swimlane presentation variants share geometry and differ only through bounded chrome descriptors? | Shared model and geometry / variant-specific layout engines | **Delegated: shared semantic scene and invariants, with thin variant-specific geometry strategies; no duplicate acquisition/state pipeline.** | ✅ Resolved |
| PAR-B11 | Feature boundary | What does checklist editing mean in Phase B? | Inline mutation / open semantic editor action / package dialog now | **User-confirmed boundary: checklist rows are read-only; Phase B emits the durable editor action, RD-10 supplies dialogs.** | ✅ Resolved |
| PAR-B12 | Workflow | How are WIP, DoD, and transition checks implemented before mutation dispatch? | Pure synchronous policy evaluators / component mutation / defer policy | **Delegated: pure snapshot evaluators return allowed/warning/blocked/unavailable; no mutation or authorization.** | ✅ Resolved |
| PAR-B13 | Navigation | How does navigation into a known unloaded range behave? | Bounded cancellable acquisition / immediate fallback / unbounded search | **Delegated: one generation-scoped bounded acquisition retains focus, exposes pending feedback, and ignores late completion after cancellation.** | ✅ Resolved |
| PAR-B14 | Selection | What collection preserves key type, order, and immutable request snapshots? | Ordered immutable key sequence plus membership index / mutable Set / array indices | **Delegated and preflight-refined: a board-owned ordered identity model returns frozen snapshots, keeps numeric/string keys distinct, rejects select-all overflow atomically, and keeps opaque server-selection state separate.** | ✅ Resolved |
| PAR-B15 | Reactivity | How are card-local style/content changes prevented from rebuilding unrelated descriptors? | Complete semantic cache key plus targeted invalidation / full viewport cache clear | **Delegated and preflight-refined: each retained descriptor owns one bounded reactive computation; revisions remain cache inputs and structural changes use bounded region damage.** | ✅ Resolved |
| PAR-B16 | Failure behavior | How do throwing or invalid field, style, grouping, summary, and descriptor callbacks degrade? | Local sanitized fallback / board failure / silent omission | **Imported AR-21/22/38: isolate locally, emit one payload-free observation, preserve neighboring interaction, and enforce bounds.** | ✅ Resolved |
| PAR-B17 | Security | May Phase B callbacks receive host handles, mutate records, or emit raw terminal control data? | Trusted bounded projection context / implicit host access | **Imported AR-22/42: no host handles or mutation authority; validate and sanitize all returned content and roles.** | ✅ Resolved |
| PAR-B18 | Pointer | Which mouse behavior becomes active before drag-and-drop? | Card/header click, double-click, context targeting only / include drag threshold and insertion targets | **User-confirmed and preflight-refined: bounded down/up pending-press state completes click selection; capture, drag threshold, ghost, insertion targets, and autoscroll remain RD-07.** | ✅ Resolved |
| PAR-B19 | Responsive layout | Where may exact cell geometry remain? | One measured viewport leaf / raw rectangles throughout | **Imported requirement AR-41: DSL for board chrome and content relationships; exact clipped geometry only inside the viewport leaf.** | ✅ Resolved |
| PAR-B20 | Public API | Are temporary Phase B-only public exports acceptable? | Durable additive contracts only / temporary exports | **Delegated: no disposable public API; every new export must remain meaningful when later phases integrate.** | ✅ Resolved |
| PAR-B21 | Dependencies | Does Phase B add Forms, Zod, storage, network, or native dependencies? | Add editor dependencies early / remain on current Core-I18n-UI graph | **User-confirmed boundary and AR-42: no new runtime dependency; RD-10 introduces Forms/Zod.** | ✅ Resolved |
| PAR-B22 | i18n/theme | How much package vocabulary and semantic styling ships now? | All Phase B-owned visible states / defer text and roles | **Delegated: add every Phase B-owned visible label/cue/role in all ten catalogs and renew digest-bound reviews; RD-13 retains final matrix ownership.** | ✅ Resolved |
| PAR-B23 | Documentation | Which docs/examples ship in Phase B? | README/JSDoc/architecture only / teaching labs and showcase now | **User-confirmed strict boundary: package and technical docs update now; component course, live labs, kitchen sink, and showcase remain Phase F.** | ✅ Resolved |
| PAR-B24 | Verification | What local gate applies to every implementation phase and final closure? | Package-local behavior gates plus `verify:local` and plugin parity / full root verify each task | **Delegated from project guidance and preflight-refined: focused Kanban gates plus `verify:local`; every mapped task updates/checks plugin output before its auto-commit; CI owns full `yarn verify`. Runtime: execution snapshots are generated exactly when the public transition API cannot target the specification nodes that the execution gate requires.** | ✅ Resolved |
| PAR-B25 | Lifecycle status | May the roadmap mark RD-04–06 Done when later integration criteria remain open? | Honest partial status / whole-RD completion | **User confirmed honest boundary: only criteria fully implemented and verified advance; RD rows remain incomplete until every owning integration criterion is proven.** | ✅ Resolved |
| PAR-B26 | Geometry | How can variable-height descriptors scroll, reveal, and navigate without a logical-card-sized index? | Sparse prefix-height runs / fixed density stride / one height per logical card | **Delegated after challenge: bounded sparse per-cell height/anchor runs with estimates for unloaded spans and stable-key correction.** | ✅ Resolved |
| PAR-B27 | State | Are hidden and collapsed structural entities represented by the same source projection? | Distinct normalized states / remove both before acquisition | **Delegated: hidden omits the entity; collapsed preserves header/count/actions while suppressing its card region and ordinary card cursor retention.** | ✅ Resolved |
| PAR-B28 | Extension bounds | What does a custom swimlane chrome budget bound? | Rows only / complete geometry-style-region budget | **Delegated: bound header rows, rail width, semantic roles, text bytes, regions/actions, and one descriptor invocation per visible swimlane revision.** | ✅ Resolved |
| PAR-B29 | Compatibility | How does the existing `identity` getter relate to the new single-owner controller? | Keep as competing live control / migrate to controller seed-and-observation compatibility | **Delegated and preflight-refined: preserve it only as a deprecated default-controller construction seed; source identity publication remains deletion authority, and identity plus custom factory rejects.** | ✅ Resolved |
| PAR-B30 | Public API | Which exact public seam proves that per-card section selection can reorder/omit configured IDs without enlarging view maxima? | Pure bounded selection resolver / renderer-only implicit intersection / numeric per-card overrides | **Runtime delegated after independent challenge: add one pure `resolveKanbanCardPresentationSelection` contract over frozen configured ID universes and the resolved presentation budget; it intersects known IDs, caps field/summary cardinality, and never creates numeric overrides.** | ✅ Resolved |
| PAR-B31 | Public API | What exact adapter, snapshot, composition, style, and cache-testing contracts let the rich-card oracle precede implementation without exposing private machinery? | Final-shaped public snapshot/composition plus testing-only cache harness / infer names in tests / expose production cache internals | **Runtime delegated after independent challenge: define discriminated public field/summary/checklist/style contracts, one detached snapshot boundary, one high-level composer, and a counter-only `@jsvision/kanban/testing` cache harness; retain `presentationRevisionOf` as the sole card revision authority.** | ✅ Resolved |
| PAR-B35 | Geometry | How do the public vertical projector and viewport metrics consume sparse heights without coupling pure projection to mutable index lifetime or breaking Phase A callers? | Bounded immutable projection snapshot / pass the mutable sparse index directly / replace the legacy API | **Runtime delegated after independent challenge: create one bounded immutable, revision-bearing retained-row projection from the sparse index; projector and metrics consume it additively, keep density gaps separate by global logical position, retain the legacy path when absent, and never classify an estimate as a lower bound.** | ✅ Resolved |
| PAR-B36 | Geometry | How can descriptor-local card action regions remain correct when the final scene card rectangle is clipped? | Carry descriptor crop offsets in card geometry / infer an unavailable original origin in the hit map / treat the clipped corner as descriptor origin | **Runtime delegated: add immutable descriptor row/column crop offsets to card geometry and translate action regions before final clipping; this is the minimum correction that preserves exact hit alignment.** | ✅ Resolved |
| PAR-B32 | UX & presentation | Which exact numeric budgets, checklist defaults, degradation order, and export identity define the three named presets? | Modest scan-oriented budgets with dedicated defaults / reuse broad safety ceilings / undocumented literals | **Runtime delegated after independent challenge: publish canonical deeply frozen 6/12/18-row presets with 0/1/1 gaps, modest optional-section budgets, hidden checklist modes, and one complete deterministic degradation order sourced from dedicated centralized defaults.** | ✅ Resolved |
| PAR-B33 | Execution ordering | Which implementation task owns the already-specified selection resolver and first public presentation-policy export? | Produce them with policy normalization / defer public behavior until the final Phase 1 barrel task | **Runtime delegated: task 1.2.2 owns the policy module, bounded selection resolver, error, and first barrel export so its public specification can turn green; task 1.2.12 remains the final aggregate export/i18n closure.** | ✅ Resolved |
| PAR-B37 | Compatibility | How can Phase B add visible vocabulary without changing the immutable exact Phase A catalog contract? | Expand the original catalog / publish a typed Phase B overlay | **Runtime delegated: preserve the exact Phase A catalog and publish a separately typed immutable Phase B overlay; the isolated English service composes both, while authored non-English overlays remain ready for locale integration without changing the ten established catalog symbols.** | ✅ Resolved |
| PAR-B38 | Boundary typing | Should custom degradation candidates be statically restricted even though the public resolver must reject hostile string values at runtime? | Closed section-kind input / string candidates with closed resolved output | **Runtime delegated: accept readonly string candidates at the untrusted policy boundary, validate them against the closed optional-section allowlist, and retain the closed `KanbanCardSectionKind` union on resolved budgets. This permits honest runtime rejection tests without weakening downstream output typing.** | ✅ Resolved |
| PAR-B39 | Minimum geometry | How can mandatory active feedback survive when only the two title/status rows fit? | Reject minimum geometry / compact feedback into the status row | **Quality-loop delegated: at the two-row minimum, append sanitized localized feedback to the mandatory status row and retain the operation marker/cue; at three or more rows, keep the dedicated feedback section. Empty or control-only application labels use the English-safe fallback.** | ✅ Resolved |
| PAR-B40 | Reactive failure | What happens when a retained descriptor's reactive rebuild throws or publishes invalid output? | Dispose immediately / retain the last valid descriptor / publish fallback | **Quality-loop delegated: validate every rebuild against cache-key invariants and the owning render context, retain the last valid descriptor on later failure, emit no rebuild/damage notification for rejected output, and permit a later valid dependency change to recover. Initial invalid output still rejects atomically.** | ✅ Resolved |
| PAR-B34 | Snapshot semantics | Does hidden checklist selection prevent bounded checklist data from being detached into the safe presentation snapshot? | Retain configured safe groups but select/render none / skip checklist acquisition entirely | **Runtime delegated from immutable-oracle evidence: snapshot bounded configured groups once when the adapter provides them; hidden mode keeps resolved checklist IDs empty, so composition and interaction expose no checklist content.** | ✅ Resolved |

## Resolution notes

### PAR-B01–PAR-B03 — confirmed planning boundary

The user explicitly confirmed the recommended Phase B boundary after the completed Phase A plan was
found to be the repository's only executable Kanban plan. Phase B builds the core board rather than a
temporary visual demonstration. It may add durable seams needed by later phases, but it does not claim
that an editor dialog, drag interaction, mutation lifecycle, saved view, or command system exists.

### PAR-B12 — pure workflow evaluation

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal policy-evaluation mechanism within approved WIP/DoD/transition behavior;
  application authorization and product policy remain unchanged.
- **Objective:** Provide immediate honest UI eligibility without mutating application data or coupling
  Phase B to the later async dispatcher lifecycle.
- **Decision:** Snapshot validated counts, revisions, structural identities, and application resolver
  results into pure discriminated `allowed`, `warning`, `blocked`, or `unavailable` evaluations.
- **Evidence:** `KanbanBoardAuthority` already separates capability metadata from application dispatch,
  and source counts preserve exact/lower-bound/unknown quality.
- **Rejected alternatives:** Component mutation violates application authority; deferral prevents RD-05
  states from being meaningfully rendered.
- **Strongest counterargument:** A later dispatcher may repeat some validation.
- **Confidence:** High — synchronous preview and async authorization intentionally serve different
  trust boundaries.
- **Hardening:** Forced review retained the duplicate validation because it prevents stale UI advice
  from becoming authorization.
- **Policy version:** 1.
- **Root invocation ID:** `AD-MAKE-PLAN-PHASE-B-20260804T092600Z`.
- **Reopen triggers:** RD-08 replaces synchronous preview with an authoritative synchronous dispatcher
  result or the source cannot expose honest count quality.

### PAR-B13–PAR-B15 — bounded interaction state

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Navigation acquisition, collection choice, and invalidation algorithms within the
  confirmed focus/selection/reactivity behavior.
- **Objective:** Preserve stable identity and responsive rendering without scanning logical data or
  allowing stale asynchronous work to move focus.
- **Decision:** Use generation-scoped cancellation for navigation acquisition; an ordered immutable
  selection model with type-preserving membership; and complete per-card presentation/cache revisions
  with bounded targeted damage.
- **Evidence:** Phase A already owns generation-cancelled cursors, stable card identities, bounded
  descriptor caching, and viewport damage projection.
- **Rejected alternatives:** Immediate fallback contradicts pending navigation requirements; mutable
  sets leak state; full cache clearing repaints unrelated cards.
- **Strongest counterargument:** Maintaining multiple revision inputs increases cache-key complexity.
- **Confidence:** High — the existing Phase A seams were explicitly built for these extensions.
- **Hardening:** The 10×-scale reframe strengthened the requirement for ordered snapshots and targeted
  invalidation instead of simpler global recomputation.
- **Policy version:** 1.
- **Root invocation ID:** `AD-MAKE-PLAN-PHASE-B-20260804T092600Z`.
- **Reopen triggers:** Source acquisition cannot be correlated to query generation, or measurement shows
  targeted dependency tracking costs more than bounded projection replacement.

### PAR-B05–PAR-B10 — core board architecture

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Component decomposition, state-controller mechanics, normalized projection,
  presentation-policy representation, and additive interaction integration within confirmed Phase B
  behavior. Application authority and later-phase scope are unchanged.
- **Objective:** Deliver a responsive interactive core board without abandoning bounded windowing,
  duplicating variant pipelines, or publishing an API that later phases must replace.
- **Decision:** Retain one DSL-composed board around one exact-cell viewport. Build one canonical 2-D
  semantic scene, pure controllers, and thin bounded geometry strategies. One stable board facade owns
  serialization and intents over exactly one state controller; the board supplies the default and
  advanced applications may inject a mount-time factory whose result the board owns. Normalize the
  three named density presets or a custom policy into an
  immutable budget. Route activation through a durable semantic intent plus optional public handler;
  later dialogs, commands, menus, and events consume the same intent rather than replacing it.
- **Evidence:** The current board owns one viewport and already detaches identity into a board signal;
  source contracts already describe column/swimlane cells; descriptor actions already carry stable
  bounded identities; RD-05 requires presentation variants to preserve identical semantic content.
- **Rejected alternatives:** Mounted card/cell graphs violate bounded topology. Separate variant
  pipelines risk semantic drift. Loose controlled-plus-internal writes create double ownership.
  Temporary callbacks become compatibility debt. Deferring activation would leave approved Phase B
  pointer/keyboard behavior unusable to consumers.
- **Strongest counterargument:** A complete injectable controller and public semantic intent add more
  SDK surface than internal-only state and testing hooks.
- **Confidence:** High overall; medium-high for the public interaction intent naming, which remains
  additive and is protected by packed-consumer tests.
- **Hardening:** The independent challenger converged on the viewport, normalized scene, and normalized
  budgets; it replaced the initial loose hybrid-state direction with a single-owner injected
  controller/facade split and exposed the consumer-observability conflict. The final decision retains a
  public final-shaped scoped intent because the user explicitly approved durable Phase B integration
  hooks. **Challenger: diverged only on public-now versus internal-only intent.**
- **Policy version:** 1.
- **Root invocation ID:** `AD-MAKE-PLAN-PHASE-B-20260804T092600Z`.
- **Reopen triggers:** Descriptor rendering cannot express an approved card section, the normalized
  scene cannot support rail degradation without semantic divergence, or RD-12 proves the intent cannot
  be adapted without a compatibility break.

### PAR-B26–PAR-B29 — challenge-discovered geometry and compatibility

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Sparse geometry data structure, structural-state normalization, extension validation
  budgets, and backward-compatible state-controller migration within approved behavior.
- **Objective:** Make variable-height cards, swimlane rows, collapse semantics, and existing identity
  construction correct at 100,000 logical cards without unbounded allocation.
- **Decision:** Maintain sparse prefix-height runs for retained measurements plus bounded estimates for
  unloaded spans; correct stable anchors when measurements arrive. Hidden entities are absent, while
  collapsed entities keep semantic chrome/counts but suppress card regions and ordinary cursor
  retention. Custom swimlane chrome validates all geometry, style, text, region, action, and invocation
  dimensions. The existing `identity` getter remains only a compatibility seed, source publication owns
  deletion, and one board facade/controller chain owns all live interaction transitions.
- **Evidence:** Phase A currently assumes fixed two/three-row strides in acquisition, content origin,
  reveal, and anchoring even though validated descriptors may reach 32 rows. Its collapsed-column input
  removes card acquisition but the richer source metadata can preserve header identity/counts.
- **Rejected alternatives:** Fixed stride is already inconsistent with the public descriptor contract;
  one height per logical card violates the scale bound; merging hide/collapse contradicts visible
  header behavior; retaining two live identity owners creates stale overwrite races.
- **Strongest counterargument:** Sparse height correction is substantially more complex than delaying
  variable-height cards until all source positions are loaded.
- **Confidence:** High — fixed strides cannot satisfy the approved variable-height and windowed
  behaviors simultaneously.
- **Hardening:** The independent challenger found the fixed-stride defect and collapse mismatch during
  adversarial code inspection; both were absent from the initial candidate set and materially changed
  the plan architecture. **Challenger: converged on the recorded corrections.**
- **Policy version:** 1.
- **Root invocation ID:** `AD-MAKE-PLAN-PHASE-B-20260804T092600Z`.
- **Reopen triggers:** A source supplies exact cumulative offsets safely, or measured correction cannot
  preserve the visible anchor within bounded work.

### PAR-B16–PAR-B24 — inherited safety and integration boundary

These rows import the approved Kanban requirement decisions and the repository's current project
guidance. They do not change product behavior, authority, dependency policy, documentation staging, or
the CI/local verification split. Phase B adds only its own vocabulary and technical documentation.

**PAR-B24 runtime resolution (2026-08-04):** The execution readiness gate required `execution`
snapshots on the six Phase B specification nodes, but the public transition engine rejects those nodes
because that gate accepts only a plan target. Under the active `--auto-design` authority, the only viable
in-scope correction is to generate the exact missing validation entries from current semantic revisions,
without changing any node status, then rerun the plan-target execution gate. Rejected: bypassing the
gate or editing unrelated invalid feature graphs. Confidence is high because the refusal and required
snapshot set are deterministic; reopen if the transition engine gains specification-target execution
snapshot support.

### PAR-B30 — explicit per-card presentation intersection (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Final-shaped public API naming and validation semantics needed to execute an already
  approved per-card presentation behavior; it does not add product behavior or expand scope.
- **Decision:** Add a public pure `resolveKanbanCardPresentationSelection(selection, maximum)` beside
  presentation normalization. `maximum` carries the already-resolved budget plus the configured field,
  summary, and checklist ID universes. Omitted categories retain configured order; explicit categories
  request a reordered subset. Well-formed absent IDs are ignored before truncation, duplicates and
  malformed data reject atomically, hidden checklist mode yields no checklist IDs, and the detached
  result is deeply frozen. The maximum carries the active frozen resolved limits; configured field,
  summary, and checklist universes must respectively fit `cardFields`, `summarySections`, and
  `checklistGroups`, while resolved budget values must fit the same active limits. Fields and summaries
  then cap to their numeric view maxima. Checklist group selection remains independent of
  `checklistPreviewItems`.
- **Rejected:** Renderer-only implicit behavior leaves no public contract oracle and can drift between
  standard/custom paths. Numeric per-card overrides create a second policy authority. Treating preview
  items as a group ceiling conflates independent dimensions.
- **Evidence:** Existing `KanbanFieldId`/`KanbanChecklistId` identities and separate checklist group/item
  limits support the contract without new dependencies or identity kinds.
- **Hardening:** An independent challenger converged on the pure resolver, then a targeted second pass
  found and closed a Major limit-provenance hole by carrying active resolved limits in the maximum.
  The configured checklist universe, rather than the item-preview number, is the honest group bound.
- **Confidence:** High.
- **Reopen triggers:** A later approved card adapter replaces configured section IDs with a different
  durable identity model, or selection gains authority to change numeric presentation budgets.

### PAR-B31 — exact rich-card snapshot and cache-test surface (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Exact type shapes and pure function signatures needed to author already-approved
  rich-card behavior before production; no new product capability or later-phase integration is added.
- **Decision:** Extend the Phase A adapter through a discriminated presentation adapter; publish
  bounded field, summary, checklist, visual-state, and semantic-style data contracts; snapshot them
  once into detached display-safe values; and compose the snapshot through one public high-level
  standard-card function. `presentationRevisionOf` remains the only card revision callback. Summary
  and field formatters receive their unchanged value once. Dates remain opaque until the injected
  formatter. Cache implementation stays private; `@jsvision/kanban/testing` exposes only the final key,
  descriptor operations, frozen counters, and disposal evidence.
- **Cache equality:** Add presentation-policy revision, selection fingerprint, and optional validated
  style revision to the existing descriptor key. Reactive dependency tracking rebuilds unrevisioned
  reads but does not replace deterministic equality inputs.
- **Rejected:** Public cache maps/owners, candidate-section internals, raw unknown values in snapshots,
  duplicate `revisionOf`, child-summary collections, date coercion, and renderer-only implicit tests.
- **Hardening:** An independent challenger produced the minimal packet; a targeted second pass added
  the promised summary formatter, explicit status role, sole-revision compatibility rule, and missing
  cache equality members.
- **Confidence:** Medium-high.
- **Reopen triggers:** Checklist item identities become globally rather than group scoped, or the UI
  scheduler proves that deterministic tests require an explicit testing-only flush operation.

### PAR-B35 — immutable sparse vertical projection (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Additive public geometry mechanism and extent-quality semantics inside the approved
  sparse-height architecture; product behavior, scope, compatibility policy, and later correction
  ownership remain unchanged.
- **Objective:** Give card placement and viewport metrics one bounded, revision-consistent source of
  sparse row and extent evidence without allocating by logical card count.
- **Decision:** Build a frozen projection containing only retained card rows, the logical length,
  aggregate descriptor extent, and the source/cursor/presentation revision tuple. Card heights exclude
  density-owned resting gaps. Consumers add gaps from global logical positions, so sparse windows neither
  omit an interior gap nor invent a trailing one. The public projector accepts this projection
  optionally and retains its legacy stacking path when absent. Metrics consume projections keyed by
  semantic cell address and classify incomplete estimates as `unknown`; only exact complete evidence or
  an independently certified locator bound may report stronger quality.
- **Evidence:** `KanbanSparseHeightIndex` already supplies bounded `rowAt` conversions, total logical
  length, and immutable revision evidence. `projectKanbanVerticalGeometry` is public and currently uses
  retained-array position plus `contentOrigin`, while viewport metrics independently reconstruct rows
  from a density stride. A detached projection removes that duplicated arithmetic and avoids exposing a
  mutable/disposable index during drawing.
- **Rejected alternatives:** Passing the mutable index directly is smaller but weakens projector purity,
  creates lifetime/TOCTOU coupling, and lets metrics and drawing sample different states. Replacing the
  legacy API would violate the additive compatibility boundary.
- **Strongest counterargument:** The snapshot adds another contract and validation boundary; a direct
  narrow index reader would require less code.
- **Confidence:** High — the challenger independently selected the snapshot and identified global gap
  ownership plus revision evidence as necessary invariants.
- **Hardening:** Forced reframing retained the existing API as a compatibility fallback and removed any
  logical-card-sized snapshot design. **Challenger: converged.**
- **Policy version:** 1.
- **Root invocation ID:** `AD-EXEC-PHASE-B-20260809T153100CEST`.
- **Reopen triggers:** The sparse index becomes immutable and revision-atomic by construction, or a
  future source supplies an authoritative cumulative-offset projection that supersedes local rows.

### PAR-B36 — descriptor crop offsets for exact hits (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Internal exact-cell geometry needed to satisfy the approved clipped card-action hit
  behavior; it changes no product behavior, scope, or application authority.
- **Objective:** Translate descriptor-local action rectangles correctly after viewport or sticky-chrome
  clipping without reconstructing geometry from semantic data.
- **Decision:** Carry non-negative `descriptorColumnOffset` and `descriptorRowOffset` values on each
  visible scene card rectangle. Hit projection subtracts those offsets before intersecting the action
  rectangle with the final card rectangle.
- **Evidence:** The existing geometry retained only the already-clipped rectangle, so a hit projector
  could not distinguish descriptor row zero from the first visible row after top clipping.
- **Rejected alternatives:** Reconstructing the original card origin duplicates variant geometry and
  drifts under sticky chrome. Treating the clipped corner as descriptor origin targets the wrong row.
- **Strongest counterargument:** Two fields enlarge a public geometry record used primarily as an
  intermediate projection.
- **Confidence:** High — exact translation is impossible from the prior record, and the offsets are
  computed at the sole clipping boundary.
- **Hardening:** Contrarian review found no smaller correct representation; storing the original full
  rectangle would expose more geometry than consumers need.
- **Policy version:** 1.
- **Root invocation ID:** `AD-EXEC-PHASE-B-20260809T153100CEST`.
- **Reopen triggers:** Card geometry later retains an authoritative unclipped descriptor rectangle from
  which the same offsets can be derived without duplicating state.

### PAR-B32 — exact named presentation presets (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Exact immutable defaults and object-identity mechanics for already-approved named
  presets; no product capability, acceptance criterion, or application authority changes.
- **Objective:** Keep named presets useful and predictable in terminal geometry without presenting
  broad safety ceilings as practical card capacity or invoking unnecessary application getters.
- **Decision:** Centralize fixed preset defaults separately from caller-adjustable safety ceilings.
  Compact uses rows/gap/metadata/labels/summaries `6/0/2/0/0`; comfortable uses `12/1/4/1/1`;
  spacious uses `18/1/6/2/2`. All named presets keep checklist mode hidden and preview count zero;
  explicit custom preview defaults remain application-selected and the documented common value is two.
  The complete first-removed-to-last-removed order is `custom`, `checklist-preview`,
  `checklist-progress`, `summary`, `labels`, `metadata`. Export one frozen
  `KANBAN_PRESENTATION_PRESETS` record, and let preset resolution return its canonical frozen member
  after validating caller-lowered ceilings. Canonical identity is an optimization; revision/value
  equality remains the semantic contract. A partial custom degradation order is completed by appending
  missing optional kinds in the package order.
- **Evidence:** Density row ceilings are already fixed at 6/12/18; approved terminal behavior reserves
  no resting gutter for compact and one row for comfortable/spacious; checklist defaults are hidden;
  preview mode documents two items; broad field/summary resource limits are safety bounds rather than
  usable 80×24 content budgets.
- **Rejected alternatives:** Reusing 64+ field and 16+ summary ceilings creates false UX capacity and
  excess callback work. Unexplained literals or deriving gaps/labels from unrelated limits creates
  hidden coupling. Enabling checklist detail in a named preset conflicts with default-hidden behavior.
  Fresh preset snapshots add allocation without improving safety.
- **Strongest counterargument:** Dedicated fixed-default metadata expands the centralized contract for
  values that are not caller-adjustable limits. The separation is intentional and prevents named
  presets from changing meaning through `KanbanLimitOptions`.
- **Confidence:** High.
- **Hardening:** A blind independent challenger selected the modest budgets, complete order, separate
  fixed-default manifest, public preset record, and canonical identity semantics.
- **Policy version:** 1.
- **Root invocation ID:** `AD-EXEC-PHASE-B-20260804`.
- **Reopen triggers:** Real compact 80×24 composition evidence shows comfortable cards expose too few
  useful cards, or product review explicitly enables checklist progress/preview in a named preset.

### PAR-B33 — presentation producer task and export timing (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Implementation sequencing and additive barrel-export timing inside the confirmed
  Phase 1 public contract; no scope or product behavior changes.
- **Objective:** Verify each task honestly against the immutable public specification rather than
  leaving a completed producer unreachable until an unrelated final aggregation task.
- **Decision:** Task 1.2.2 implements and exports presentation normalization, bounded per-card selection,
  the sanitized presentation error, and named preset record together. Task 1.2.12 still owns the final
  aggregate Phase 1 exports and first-use locale vocabulary.
- **Evidence:** The public specification imports both resolvers and the error from `src/index.ts`; both
  resolvers share the same closed-data validation boundary and live in `presentation-policy.ts`.
- **Rejected alternatives:** Deferring the barrel export leaves task 1.2.2 unverifiable through the
  promised public API. Assigning selection to adapter snapshot work splits one pure policy boundary
  across tasks without a technical seam.
- **Strongest counterargument:** The task touches the barrel and error module earlier than the original
  target list. Those are necessary producer dependencies and remain inside the approved Phase 1
  modification set.
- **Confidence:** High.
- **Hardening:** Repository grounding against the immutable spec suite, public barrel, and task order;
  no second design remained equally viable.
- **Policy version:** 1.
- **Root invocation ID:** `AD-EXEC-PHASE-B-20260804`.
- **Reopen triggers:** The package adopts generated exports or separates presentation selection into a
  different durable public module before this task is implemented.

### PAR-B34 — hidden selection versus safe checklist snapshot (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Internal snapshot/data-flow interpretation within already-approved hidden checklist
  behavior; it changes no visible checklist default, editor authority, or acceptance criterion.
- **Objective:** Satisfy the immutable snapshot oracle while preserving the public guarantee that hidden
  checklist mode emits no checklist rows, regions, or active checklist selection.
- **Decision:** When an adapter supplies checklist data, snapshot its configured, bounded, validated
  groups once even if the current policy resolves `selection.checklistIds` to empty. Composition and
  interaction consume the resolved selection, so hidden mode remains visually and behaviorally hidden.
- **Evidence:** The immutable rich-card oracle requires safe detached checklist items in a spacious
  named-preset snapshot, while the presentation-policy oracle requires hidden mode to resolve no
  checklist IDs. Keeping detached data and active selection separate satisfies both without weakening
  either test.
- **Rejected alternatives:** Changing the immutable oracle is prohibited. Enabling checklist display in
  the spacious preset changes approved default-hidden behavior. Treating snapshotted data as selected
  would contradict the public selection contract.
- **Strongest counterargument:** Hidden cards still pay one bounded checklist callback/snapshot cost when
  applications configure the optional adapter. This is explicit opt-in adapter work and remains bounded;
  applications that need zero acquisition omit `checklistOf`.
- **Confidence:** High.
- **Hardening:** Direct reconciliation of two independent public specification assertions; no second
  compatible behavior remained.
- **Policy version:** 1.
- **Root invocation ID:** `AD-EXEC-PHASE-B-20260804`.
- **Reopen triggers:** The public snapshot contract removes checklist data, or a future lazy checklist
  source replaces the current bounded synchronous adapter.

### PAR-B35 — localized standard-card presentation configuration (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Exact additive factory configuration needed to expose already-approved optional
  `StandardCard` values through the final-shaped presentation adapter; it adds no card fields or new
  rendering behavior.
- **Objective:** Keep the convenience adapter useful without inventing English display labels, treating
  per-card summary content as adapter configuration, or breaking existing no-argument callers.
- **Decision:** Keep `StandardCard` as the application-owned value model completed in Phase A. Extend
  `createStandardKanbanCardAdapter` with optional configuration that enables named common fields in
  canonical order, supplies application-localized labels/priorities/formatters, declares stable summary
  sections whose values are looked up by ID, and optionally supplies per-card selection/style callbacks.
  Checklist groups are projected directly when present. With no configuration the factory remains the
  same mandatory-only adapter, except that optional checklist data is now available to the rich snapshot.
- **Evidence:** `KanbanCardPresentationAdapter` separates configured field/summary descriptors from
  per-card values; `StandardCard.summaries` carries values with stable IDs, while its checklists already
  match the generic checklist shape. The package i18n catalog does not yet own common-field labels, and
  applications must be able to use their own vocabulary.
- **Rejected alternatives:** Hard-coded English labels violate the i18n requirement. Deriving summary
  descriptors from one card makes adapter identity depend on data and cannot describe heterogeneous
  records safely. Ordinal summary slots discard application IDs. Requiring callers to rewrite all
  standard getters as generic descriptors defeats the convenience model.
- **Strongest counterargument:** The configuration surface is larger than a fixed automatic adapter.
  Each option corresponds to an approved field family and keeps localization and formatter authority
  explicit; omitted options perform no optional field work.
- **Confidence:** High.
- **Hardening:** Grounded against the final adapter/snapshot contracts, existing no-argument usages,
  Phase A `StandardCard` shape, and the package locale inventory; the rejected alternatives each violate
  a recorded requirement or an existing compatibility boundary.
- **Policy version:** 1.
- **Root invocation ID:** `AD-EXEC-PHASE-B-20260804`.
- **Reopen triggers:** Standard field labels become package-owned typed locale keys, or presentation
  adapters gain a bounded per-card summary-descriptor callback.

### PAR-B36 — standard checklist editor action identity and label (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Exact identity and localized label injection for the already-approved read-only
  checklist editor action; it does not add an editor, inline mutation, or new application authority.
- **Decision:** Publish the package-owned stable action identity `kanban.card.open-editor`. Checklist
  progress/preview regions reference that single identity and never expose an item-toggle action. Add an
  optional `openEditorLabel` to the composition context; mounted localized callers supply it, while
  direct pure composition retains a bounded English fallback for compatibility with the already-authored
  immutable specification.
- **Evidence:** Descriptor action regions require a validated dotted extension identity and a non-empty
  safe label, but the approved composition context previously carried neither an i18n service nor action
  vocabulary. The action is a semantic bridge to later RD-10 dialogs, not an application mutation.
- **Rejected alternatives:** Per-item actions contradict the read-only card requirement. An anonymous
  region cannot pass descriptor validation or dispatch a durable intent. A mandatory new label breaks
  immutable direct-composer callers. Hard-coding English as the only path violates i18n.
- **Strongest counterargument:** The `kanban` dotted namespace is represented by the existing extension-ID
  type rather than a separate package-action type. The constant keeps one canonical value; a future
  descriptor action-kind split can preserve that value while strengthening the type.
- **Confidence:** High.
- **Hardening:** Grounded against descriptor validation, the immutable composer call shape, the package
  locale boundary, and the explicit no-inline-edit requirement; no compatible label authority existed.
- **Policy version:** 1.
- **Root invocation ID:** `AD-EXEC-PHASE-B-20260804`.
- **Reopen triggers:** Descriptor actions gain a distinct package-owned identity type or composition
  receives a required typed i18n projection.

### PAR-B38 — Phase 2 workflow vocabulary ownership (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Exact additive locale-key selection for already-approved workflow and structural
  surfaces; it does not add behavior, application authority, or a new localization mechanism.
- **Decision:** Add typed Phase B overlay messages for filtered-empty and collapsed state, clear-filter
  action, definition-of-done, the package-owned WIP minimum/maximum/unavailable codes, the package-owned
  transition-resolver failure, and the package-created unavailable-swimlane fallback. Keep ordinary
  swimlane labels, disambiguators, summaries, custom action labels, and custom transition labels
  application-owned and application-localized.
- **Evidence:** The structural resolver introduces filtered/collapsed state and clear-filter action;
  the workflow evaluators introduce three fixed WIP codes and one fixed resolver-failure code. Grouping
  policy already requires application-supplied labels, while transition results explicitly accept an
  application label.
- **Rejected alternatives:** Deferring these fixed package messages violates first-use vocabulary
  ownership. Adding default labels for application-owned groups or custom outcomes would override the
  approved generic data and localization boundary.
- **Strongest counterargument:** Definition-of-done text is supplied by the application, but its compact
  heading is package chrome and therefore still requires package localization.
- **Confidence:** High.
- **Hardening:** Grounded against the exported structure/workflow result codes, grouping policy label
  requirements, transition label contract, and the typed Phase B overlay compatibility decision.
- **Policy version:** 1.
- **Root invocation ID:** `AD-EXEC-PHASE-B-20260804`.
- **Reopen triggers:** A future phase introduces another package-owned visible workflow code or moves
  group-label ownership into the package.

### PAR-B39 — Phase 2 quality-loop grouping and cache remediation (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Exact technical correction of independently confirmed Phase 2 Major defects; the
  changes preserve the approved grouping, responsive presentation, bounded-resource, and callback
  isolation contracts without expanding product scope.
- **Decision:** Extend eager grouping adapters with optional semantic `unassignedSwimlaneId` and
  `resolverFallbackSwimlaneId`. When grouping is active, missing and valid-unmapped values use the
  configured unassigned group, while thrown or malformed resolver output uses the configured fallback
  and emits a redacted observation; absence of a required configured target fails publication safely.
  Validate pure grouping resolver IDs before membership classification. Key custom presentation cache
  entries by every normalized output-affecting input and evict FIFO at the central
  `retainedDescriptors.safe` ceiling. Treat a throwing hover scheduler as a rejected begin operation,
  restore idle, and suppress the host exception.
- **Evidence:** Independent Phase 2 correctness and risk review reproduced missing eager membership,
  malformed-ID misclassification, stale geometry reuse, unbounded cache growth, and a stuck waiting
  lease with raw scheduler-error propagation.
- **Rejected alternatives:** Mapping resolver failures to unassigned erases the approved distinction
  between missing data and failed code. Clearing the entire custom cache on each call defeats valid
  same-input reuse. Propagating scheduler exceptions violates the payload-free component boundary.
- **Strongest counterargument:** Optional eager fallback IDs permit a source adapter that is valid until
  its callback first fails. Failing that publication is safer and backward-compatible; applications
  requiring local recovery configure the explicit declared fallback swimlane.
- **Confidence:** High.
- **Hardening:** Two independent reviewers reproduced the cache defect; the risk auditor independently
  reproduced scheduler leakage, and the correctness reviewer traced both grouping failures through
  source acquisition. Each fix receives focused regression coverage and one independent re-review.
- **Policy version:** 1.
- **Root invocation ID:** `AD-EXEC-PHASE-B-20260804`.
- **Reopen triggers:** Grouping policy becomes directly available to the eager source, cache ownership
  moves to the scene layer, or scheduler failures gain a public diagnostic state.

### PAR-B40 — Ungrouped canonical scene geometry (runtime)

- **Authority:** AI — delegated by the active `--auto-design` execution mode.
- **Eligibility:** Exact internal geometry representation for the already-approved backwards-compatible
  ungrouped board; it adds no grouping semantics, application authority, or visible chrome.
- **Decision:** Represent an ungrouped board as one implicit chrome-free geometry row over sparse cells
  whose addresses omit `swimlaneId`. Do not synthesize a public swimlane identity or header. Use the
  resolved presentation policy's card gap for both grouped and ungrouped stacking.
- **Evidence:** The canonical scene correctly permits zero swimlanes and cells with an omitted
  `swimlaneId`, while the initial geometry implementation iterated only explicit swimlanes and therefore
  could not project the required Phase A-compatible board.
- **Rejected alternatives:** A reserved public swimlane ID can collide with application identity and
  leaks a false semantic group. Keeping a second legacy projector would violate the approved single
  canonical scene/drawing pipeline and make hit/damage behavior diverge.
- **Strongest counterargument:** An implicit row adds a small geometry branch. Keeping it chrome-free and
  keyed only by omitted `swimlaneId` preserves the public semantic model while sharing all later card
  geometry, hit, and damage stages.
- **Confidence:** High.
- **Hardening:** Grounded against scene-model optional addresses, scene-builder validation, Phase A
  compatibility, and the one-canonical-scene requirement.
- **Policy version:** 1.
- **Root invocation ID:** `AD-EXEC-PHASE-B-20260809`.
- **Reopen triggers:** The semantic scene gains an explicit package-owned ungrouped row node or zero-row
  scenes receive a different public geometry contract.

## Systematic discovery scan

| Category | Result |
|---|---|
| Feature gaps | Phase boundary and later integration hooks are explicit in PAR-B01–03, PAR-B08, PAR-B11, and PAR-B18. |
| Behavioral gaps | Workflow, async navigation, selection, activation, cancellation, and degradation are covered by PAR-B08 and PAR-B12–18. |
| Scope ambiguities | Strict RD-04–06 independent behavior and later-phase exclusions are fixed by PAR-B01–03 and PAR-B25. |
| Technical unknowns | Viewport, interaction ownership, swimlane projection, action bridge, custom presentation, sparse heights, collapse, and extension budgets are resolved in PAR-B05–10 and PAR-B26–29. |
| Edge cases | Unknown counts, unloaded ranges, stale completion, invalid callbacks, key-type collisions, and bounded geometry are resolved. |
| Integration points | Source, dispatcher, future dialogs/commands/drag, i18n/theme, plugin, and docs boundaries are explicit. |
| Data & state | Application authority, ephemeral state, stable identities, revisioning, and ordered selection are covered. |
| Security & compliance | Local SDK threat boundaries, sanitization, bounded callbacks, and payload-free diagnostics are inherited and retained. |
| Non-functional gaps | Scale, bounded work, responsive geometry, lifecycle cancellation, and verification gates are fixed. |
| UX & presentation | Densities, swimlane variants, card degradation, cues, and pointer boundary are covered; technical representation remains under challenge. |
| Stakeholder conflicts | Application authority and package-owned UX remain separated; no new permission or persistence claim is introduced. |
| Naming & terminology | Public `column`, `swimlane`, `card`, and `cell` terminology remains canonical; plan slug is `phase-b-core-board`. |

## Gate result

All imported, user-confirmed, and delegated decisions are resolved with no silent deferrals. The
systematic twelve-category scan and independent complex-decision challenge are complete. The Phase B
plan documents may now be authored; any newly discovered semantic choice must reopen this register.
