# Ambiguity Register: Kanban Phase C Modern Interaction

> **Status**: ✅ GATE PASSED — all 21 items resolved
> **Last Updated**: 2026-08-11 15:50 CEST
> **Root Invocation ID**: `MP-PHASE-C-20260811T0144CEST`
> **Mode**: Auto-design · policy version 1 · strict scope

## Planning boundaries

| Boundary | Authorized value |
|---|---|
| Planning target | Phase C “Modern interaction”: RD-07 pointer drag/drop followed by RD-08 semantic requests, placement, and operation lifecycle |
| Context artifacts | Kanban requirements and preflight; completed Phase A/B plans; current `packages/kanban`, UI event/capture, Core input, Web host, tests, docs, plugin-impact map, and package manifests |
| Modification set | New `phase-c-modern-interaction` plan documents and the Kanban feature roadmap; requirements and implementation source remain read-only during planning |

## Register

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|---|---|---|---|---|
| AR-C01 | Scope | Which approved requirements define Phase C? | RD-07 only / RD-07 then RD-08 / broaden into RD-09–12 | RD-07 then RD-08, exactly matching the accepted requirements roadmap’s Phase C | ✅ Resolved |
| AR-C02 | Scope | How far may Phase C integrate future producers? | Implement only durable Phase C APIs and actual move producers / pull future dialogs, saved views, menus, and history UI forward | Implement pointer, public/programmatic, and keyboard move producers plus the complete dispatcher/lifecycle core; future RD-09–12 producers consume these seams later | ✅ Resolved |
| AR-C03 | Technical · complex | How can capture loss synchronously invalidate a drag? | UI capture lease / generic capture observer plus Kanban lease / polling plus cleanup | Add a generation-bound UI capture lease; decoded focus routes centrally, explicit ingress remains fallback, permanent ViewHost subtree-unmount notification precedes cleanup, and private stop-with-reason preserves stop/dispose precedence | ✅ Resolved |
| AR-C04 | Technical · complex | How should drag and asynchronous mutation state be partitioned? | Pure gesture/projection controllers plus operation coordinator / viewport monolith / independent callback-linked machines | Compose viewport-local gesture/geometry controllers with one board-level semantic operation coordinator | ✅ Resolved |
| AR-C05 | Data & state | What state is authoritative while dragging or awaiting publication? | Mutate source / component overlay / application echo only | Immutable component projection over unchanged authoritative source; expectation-matched publication or exact operation-correlated application reconciliation alone confirms committed state | ✅ Resolved |
| AR-C06 | Integration | Where does eligibility live? | Renderer-specific checks / one pure eligibility pipeline / dispatcher-only validation | One pure synchronous pipeline shared by hover, pointer, keyboard, programmatic, menu/dialog seams, followed by authoritative application validation | ✅ Resolved |
| AR-C07 | UX & geometry | How are substantial TUI targets represented without permanent clutter? | Card-only hits / permanent expanded gaps / density-aware semantic drop map | Use resting comfortable/spacious gutters, card-half fallback, leading/trailing and empty-cell targets; compact expands only the active gap | ✅ Resolved |
| AR-C08 | Behavioral | How is target flicker prevented? | Time debounce / geometry hysteresis / no stabilization | One-cell geometry hysteresis retains the slot until a different semantic owner or crossed inner boundary proves a new target | ✅ Resolved |
| AR-C09 | Behavioral | How is edge autoscroll scheduled and tested? | Animation-frame dependence / deterministic injected clock and scheduler / input-event-only scrolling | A disposable fake-clock-friendly controller ticks every 50 ms, applies slow/fast steps, and recomputes geometry after each successful step | ✅ Resolved |
| AR-C10 | Public API | How are standard and custom mutations represented? | Per-action callbacks / one closed standard union plus namespaced extension / extension-only requests | Use standard caller proposals plus coordinator-owned dispatch envelopes; retain validated namespaced extension proposals and the legacy caller-envelope overload through one dispatcher | ✅ Resolved |
| AR-C11 | Public API | Who creates operation IDs? | Application-only IDs / package-only hidden counter / injectable factory with bounded package default | Board-owned operation coordinator uses a validated injectable factory; the default is process-local monotonic and unique within the bounded retained window | ✅ Resolved |
| AR-C12 | Data & state | How does accepted-but-unpublished work settle? | Treat accepted as committed / time out by default / retain bounded pending projection until publication or application cancellation | Accepted remains pending; auto-reconciliation requires a validated result expectation, otherwise exact operation-correlated application reconciliation/cancellation settles it; no universal matcher or package timeout is invented | ✅ Resolved |
| AR-C13 | Edge cases | How are stale and late outcomes contained? | Promise identity only / generation plus AbortSignal and retained-ID window / global lock | Per-operation generation, live AbortSignal, affected-entity conflict set, bounded active/retained ID registries, and publication revision checks; late work is inert | ✅ Resolved |
| AR-C14 | Behavioral | How are atomic multi-card and structural operations handled? | Partial results / sequential requests / one ordered atomic request | One ordered atomic request and one projection; malformed partial results reject as a whole. Card, column, and swimlane drags share lifecycle primitives | ✅ Resolved |
| AR-C15 | UX & accessibility | What constitutes keyboard parity before RD-12’s complete command system? | Wait for RD-12 / hard-code a full future keymap / expose and mount focused-card/structure move actions through existing input/facade seams | Implement reachable move actions and public programmatic methods using existing normalized input/facade seams; RD-12 later maps the complete configurable command/menu surface | ✅ Resolved |
| AR-C16 | Technical | How is the oversized viewport kept maintainable? | Continue adding to the 1,696-line class / extract Phase C controllers and projection composition / rewrite the viewport | Extract capture/gesture, target resolution, autoscroll, operation lifecycle, and projection modules; keep `KanbanViewport` as lifecycle/composition owner and avoid a risky rewrite | ✅ Resolved |
| AR-C17 | Testing | How is native host evidence produced? | Pipe-backed tests / shell `script` on Unix only / test-only `node-pty` harness with OS-scoped assertions | After explicit install authorization, add Kanban dev-only `node-pty@^1.1.0`, `@xterm/headless@^6.0.0`, and workspace `@jsvision/web@1.5.2`; exercise real `createBrowserHost`, use a bounded `.mjs` child, and run designated Node 22 Ubuntu/macOS/Windows CI host jobs | ✅ Resolved |
| AR-C18 | Testing | Which commands are authoritative for task verification? | Full `yarn verify` every task / project-local changed-file gate plus focused workspace gates | Use `yarn verify:local` for every task plus the smallest applicable Kanban/UI package gate; phase closure runs Kanban build/typecheck/unit/E2E/deps/docs, affected UI tests, plugin checks, and targeted docs checks | ✅ Resolved |
| AR-C19 | Integration | What documentation and generated surfaces move with Phase C? | Defer all docs / update only README / synchronize package docs, architecture, API/plugin references, locales, and kitchen sink evidence | Keep public JSDoc/examples, package/architecture docs, locale roles/messages, generated API/plugin parity, and the existing incremental kitchen sink aligned with shipped Phase C behavior | ✅ Resolved |
| AR-C20 | Security | What may cross the dispatcher/observation boundary? | Raw records/tokens/errors / bounded semantic envelopes and redacted observations | Snapshot exact allowlisted data; never log or observe card bodies, placement/undo tokens, custom payloads, raw errors, or unsanitized ghost text | ✅ Resolved |
| AR-C21 | Technical (runtime) | What happens when the numeric capture generation is exhausted? | Fail closed before mutation / wrap and add a hidden token / reuse only while uncaptured | Fail closed with `RangeError` before changing capture; the current owner remains active | ✅ Resolved |
| AR-C22 | Technical (runtime) | Which limit class should bound committed undo descriptors, and how is the stale exact-manifest oracle synchronized? | Reuse `retainedDescriptors` values / reuse operation-ID retention / introduce unrelated new values | Add the independent key with the established descriptor-retention values `256/2,048/8,192`; first add a requirement-derived red assertion, then update the exact manifest oracle with production | ✅ Resolved |
| AR-C23 | Technical (runtime) | How does the record-independent coordinator revalidate current revisions and eligibility after an asynchronous confirmation? | Coordinator reads source state / reuse admission result / board integration supplies a pure revalidator | Use a package-internal board-supplied revalidator; absence or failure after confirmation cancels fail-closed | ✅ Resolved |
| AR-C24 | Testing (runtime) | How should the parity oracle resolve a fixture whose pointer destination is `doing/beta` while its programmatic and keyboard destination is `doing/alpha`? | Change pointer semantics to ignore the hovered swimlane / align the pointer anchor fixture with the stated same semantic destination | Keep pointer destination semantics intact and place the pointer anchor in `doing/alpha`, so all three origins exercise the same semantic fixture | ✅ Resolved |

## Resolution notes

### AR-C01 — Phase boundary

- **Authority:** User — current request plus previously confirmed long-term requirements scope.
- **Evidence:** `requirements/README.md` names Phase C as RD-07 → RD-08; both RDs are complete and preflighted.
- **Rejected alternatives:** RD-07 alone leaves release semantics unfinished; RD-09–12 would expand the authorized phase.
- **Reopen trigger:** The user changes the Phase C product boundary.

### AR-C02 — Future-producer boundary

- **Authority:** User — accepted roadmap and strict-scope instruction inherited by this plan.
- **Decision:** Phase C ships actual card/column/swimlane pointer moves, public/programmatic operations, and keyboard-reachable move behavior. Saved-view UI, editors, configuration dialogs, full command/menu/event/history surfaces remain with RD-09–12, but their request variants and final consumption seams may be defined now.
- **Reopen trigger:** A later producer proves a request shape cannot be expressed without changing Phase C’s public union.

### AR-C03 — Capture ownership

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal framework mechanism inside the approved capture-loss behavior; no product or scope change.
- **Objective:** Guarantee same-frame, exactly-once invalidation on capture replacement, modal transition, unmount, host loss, release, and loop disposal while preserving existing controls.
- **Evidence:** UI currently stores one `captureTarget`, silently clears it on modal/disposal/unmount paths, and exposes only set/release/has-capture; RD preflight PF-010 requires a reusable synchronous notification seam.
- **Decision:** A generation-bound `PointerCaptureLease` returned by a new capture acquisition API, with synchronous reasoned loss notification and idempotent generation-scoped release. Replacement/modal, a permanent pre-cleanup ViewHost subtree-unmount notification, decoded `focus: false`, explicit host-loss fallback, and private stop-with-reason/direct-dispose paths converge on one exception-contained loss transition. Existing APIs remain compatible wrappers.
- **Rejected alternatives:** Polling cannot notify an inert background board when a modal opens; a generic observer spreads ownership and ordering across subscribers.
- **Strongest counterargument:** A reusable public UI lease enlarges framework API for behavior initially demanded by Kanban.
- **Confidence:** High.
- **Hardening:** Independent challenger converged and strengthened the design with a single internal replace/lose transition plus an explicit host-loss ingress. `Challenger: converged`.
- **Policy version:** 1.
- **Root invocation ID:** `MP-PHASE-C-20260811T0144CEST`.
- **Reopen trigger:** UI already gains an equivalent synchronous capture-loss primitive or compatibility analysis finds a breaking interaction.

### AR-C04 — Controller architecture

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal architecture and sequencing within fixed RD-07/RD-08 behavior.
- **Objective:** Keep pure placement/gesture behavior independently testable while ensuring exactly one operation lifecycle owns dispatch, pending state, cancellation, and reconciliation.
- **Evidence:** `KanbanViewport` is already 1,696 lines; existing source, interaction, projection, damage, and dispatcher helpers are layered modules. Request validation exists but only supports extension requests and has no stateful coordinator.
- **Decision:** A viewport-local drag controller plus pure drop-map/projection/autoscroll functions feed one board-level operation coordinator. The coordinator owns validation, dispatch, IDs/generations, abort, deduplication, conflicts, semantic pending projections, and publication reconciliation; the viewport alone turns immutable semantic snapshots into rectangles. Release uses one atomic `commitProposal` handoff before clearing drag state.
- **Rejected alternatives:** A viewport monolith breaches file/concern limits; callback-linked independent machines risk duplicate dispatch and split cancellation ownership.
- **Strongest counterargument:** More modules and snapshot boundaries increase integration ceremony.
- **Confidence:** High.
- **Hardening:** Independent challenger converged and clarified that semantic pending intent belongs at board level while terminal rectangles remain viewport-owned. `Challenger: converged`.
- **Policy version:** 1.
- **Root invocation ID:** `MP-PHASE-C-20260811T0144CEST`.
- **Reopen trigger:** Measured integration overhead or hot-path allocation evidence shows the composed snapshot boundary cannot meet the bounded frame budget.

### AR-C05–AR-C16 — Delegated technical resolutions

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Data structures, algorithms, public type mechanics, lifecycle recovery, testing design, and maintainability within fixed product behavior.
- **Objective:** Deliver honest modern mouse/keyboard interaction without application-data mutation, stale dispatch, visual corruption, or a second authority path.
- **Evidence:** RD-07/RD-08 acceptance criteria; requirement AR-3/9/15/18/31/32/39/40/42/43; existing cursor placement, workflow evaluation, scene geometry, interaction facade, authority validation, and finite-limit infrastructure.
- **Rejected alternatives:** Direct mutation, numeric index/rank authority, monolithic state, partial bulk results, and renderer-local policy all contradict the approved requirements or existing architecture.
- **Strongest counterargument:** The composed design introduces several explicit state snapshots and validators, increasing code volume.
- **Confidence:** High — changed only if current source contracts cannot provide revision-consistent placement or performance evidence rejects bounded projection composition.
- **Hardening:** Forced reframing retained the composed design; a full viewport rewrite and an event-sourced operation log were considered and rejected as disproportionate.
- **Policy version:** 1.
- **Root invocation ID:** `MP-PHASE-C-20260811T0144CEST`.
- **Reopen triggers:** A source cannot provide the RD-02 placement evidence; the application requires partial bulk success; or RD-12 changes the accepted parity boundary.

### AR-C17 — Native host harness

- **Authority:** AI — delegated by `--auto-design` for test mechanism; dependency installation remains separately user-authorized at execution time.
- **Eligibility:** Verification mechanism for already-approved RD-07 AC-15 and requirements preflight PF-014.
- **Objective:** Prove semantic equivalence through real Unix PTY and Windows ConPTY paths without introducing a runtime dependency.
- **Evidence:** The repository’s current host tests explicitly use pipes; `node-pty` 1.1.0 supports Linux/macOS/Windows ConPTY and carries TypeScript declarations; the existing Web workspace exports `createBrowserHost` and uses `@xterm/headless@^6.0.0`; current CI does not run Kanban E2E on Windows. `check:deps` ignores dev dependencies.
- **Rejected alternatives:** Pipe-backed tests do not meet the accepted criterion; Unix `script` cannot supply Windows ConPTY parity; beta-only forks add avoidable release risk.
- **Strongest counterargument:** Native build prerequisites and OS CI can be flaky.
- **Confidence:** Medium — installation/build behavior on the repository’s Node 22 CI matrix must be proven before committing the dependency.
- **Hardening:** Selected stable `node-pty`, the repository’s public Web host with its existing headless-xterm version, a checked-in `.mjs` child, and designated Node 22 Ubuntu/macOS/Windows CI assertions. Pipe tests remain the deterministic lower layer.
- **Policy version:** 1.
- **Root invocation ID:** `MP-PHASE-C-20260811T0144CEST`.
- **Reopen trigger:** Install proof fails on Node 22 or repository CI lacks an authorized Windows runner.

### AR-C18 — Verification command

- **Authority:** User — project `AGENTS.md` explicitly defines `yarn verify:local` as the normal gate and requires the smallest relevant package-local behavioral gate; prior Phase A/B planning accepted this convention.
- **Decision:** Every task uses `yarn verify:local` plus its smallest relevant focused test/typecheck command. Phase closure runs the literal UI/Kanban/Examples/i18n/docs/plugin commands in 03-06 and verifies designated host CI coverage, but does not routinely run full `yarn verify` locally.
- **Reopen trigger:** Project guidance or package scripts change.

### AR-C19–AR-C20 — Integration and safety

- **Authority:** AI — delegated by `--auto-design` within already-required documentation, i18n, theme, diagnostics, and security behavior.
- **Eligibility:** Technical integration and input-validation mechanisms; no change to product scope or security policy.
- **Objective:** Ship a public SDK surface whose examples, generated references, locale feedback, plugin knowledge, and diagnostic boundaries agree with implementation.
- **Evidence:** Plugin-impact mapping covers Kanban/UI paths; existing package release gates and requirements mandate payload-free observations, bounded text, and incremental kitchen-sink evidence.
- **Rejected alternatives:** Deferring docs creates unsupported public APIs; raw diagnostic payloads violate approved ownership and privacy boundaries.
- **Strongest counterargument:** Cross-cutting synchronization increases Phase C closure cost.
- **Confidence:** High.
- **Policy version:** 1.
- **Root invocation ID:** `MP-PHASE-C-20260811T0144CEST`.
- **Reopen trigger:** Mapping becomes manifest-discovered or later RD-13/RD-15 explicitly assumes ownership of a Phase C-only surface.

### AR-C21 — Capture-generation exhaustion (runtime)

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal failure and recovery design inside the approved generation-bound capture contract; no product behavior, compatibility, or scope change.
- **Objective:** Preserve the invariant that an obsolete lease can never appear active or release a newer owner.
- **Evidence:** The public lease exposes a JavaScript `number` generation, whose largest exact integer is `Number.MAX_SAFE_INTEGER`; wrapping or reusing a visible generation can collide with a retained stale lease.
- **Decision:** Allocate only positive safe-integer generations. Once the last value is active or has been issued, a later acquisition throws `RangeError` before changing the current capture target, callback, or generation. Legacy and lease acquisitions share this fail-closed allocator.
- **Rejected alternatives:** Wrapping with a hidden token keeps internal release safe but makes the public generation cease to be a unique identity; reuse while uncaptured still collides with retained leases.
- **Strongest counterargument:** The loop becomes unable to acquire capture after an astronomically large number of acquisitions, rather than transparently recovering.
- **Confidence:** High — the numeric public contract makes non-colliding reuse impossible without a compatibility change.
- **Hardening:** A 10×-longevity reframe and contrarian wraparound design were tested; both retained the fail-closed choice because stale public leases can outlive any idle interval.
- **Policy version:** 1.
- **Root invocation ID:** `EP-PHASE-C-20260811T1042CEST`.
- **Reopen trigger:** The public generation becomes an opaque non-numeric token or leases gain bounded lifetime enforcement.

### AR-C22 — Retained undo descriptor limit (runtime)

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Resource-limit mechanics and specification synchronization inside the approved bounded undo contract; no product behavior or scope change.
- **Objective:** Bound retained application callbacks and opaque tokens independently while preserving the package's established safe, standard, and advanced resource classes.
- **Evidence:** The lifecycle design requires `limits.retainedUndoDescriptors`, while the current exact limit-manifest oracle predates that key. `retainedDescriptors` already defines the package's whole-descriptor retention classes as 256, 2,048, and 8,192; retained operation IDs have a different collision-history purpose and materially larger ceilings.
- **Decision:** Add `retainedUndoDescriptors` with safe/standard/absolute values 256/2,048/8,192. Add a requirement-derived failing assertion before production, then synchronize the existing exact-manifest oracle when implementation adds the key.
- **Rejected alternatives:** Reusing `retainedDescriptors` directly would couple callback retention to renderer allocation; using `retainedOperationIds` values would retain substantially more closures than the established descriptor budget; inventing new values has no repository evidence.
- **Strongest counterargument:** Matching `retainedDescriptors` makes the two independent limits numerically identical and may look redundant.
- **Confidence:** High — the identical values preserve the established descriptor budget while the separate key preserves independent ownership and future tuning.
- **Hardening:** 10× scale and memory-retention reframes rejected the larger ID-history ceiling; obsolescence analysis retained a separate key so future tuning does not couple unrelated resources.
- **Policy version:** 1.
- **Root invocation ID:** `EP-PHASE-C-20260811T1042CEST`.
- **Reopen trigger:** Measured callback-retention memory requires a lower class budget or application history integration no longer retains descriptors in the component.

### AR-C23 — Post-confirmation authority revalidation (runtime)

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal consistency and callback-boundary architecture inside the approved confirmation and application-authority behavior; no product or scope change.
- **Objective:** Ensure an affirmative asynchronous confirmation cannot dispatch stale intent while the operation coordinator remains independent of application records and source-session ownership.
- **Evidence:** The coordinator owns reservations and generations but deliberately owns no records or source cursor. Board construction already owns both the source projection and coordinator and is therefore the only layer able to recapture current eligibility without adding a second authority path.
- **Decision:** Board integration supplies one package-internal pure revalidator to the coordinator. After any required confirmation, the coordinator requires that callback, snapshots its result, verifies generations/reservations, and dispatches only when the current result is allowed or the previously approved warning remains semantically identical. Missing, throwing, blocked, unavailable, or changed-warning results cancel fail-closed.
- **Rejected alternatives:** Letting the coordinator read source records violates its ownership boundary; reusing the admission result ignores changes while a dialog is open; asking the application confirmer to authorize freshness conflates UX confirmation with persistence authority.
- **Strongest counterargument:** The internal callback adds one integration seam and makes standalone coordinator construction more explicit.
- **Confidence:** High — it follows the existing board/coordinator/source ownership partition and has a deterministic fail-closed fallback.
- **Hardening:** Reentrancy, obsolescence, and 10× callback-latency reframes retained the seam; semantic warning comparison prevents approval from silently carrying across changed warning details.
- **Policy version:** 1.
- **Root invocation ID:** `EP-PHASE-C-20260811T1042CEST`.
- **Reopen trigger:** The coordinator gains a record-independent current-authority snapshot API or board/source ownership changes.

### AR-C24 — Same-fixture parity correction (runtime)

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Testing strategy and fixture mechanics inside the already-approved pointer/keyboard/programmatic parity behavior; no product behavior or acceptance criterion changes.
- **Objective:** Keep the specification assertion a valid comparison of three input origins producing one semantic move.
- **Evidence:** The assertion describes the same semantic fixture and expects deep equality, but its pointer anchor card was assigned to `doing/beta` while the programmatic and keyboard destinations resolve to `doing/alpha`. It also aimed at the anchor's leading half, which correctly means `start`, while the other origins request `end`. Pointer drop resolution preserves both the hovered card's full cell address and its leading/trailing half.
- **Decision:** Assign the pointer anchor card to `doing/alpha` and aim the pointer trace at its trailing row. The expected request remains unchanged and all origins must still traverse their real producer path.
- **Rejected alternatives:** Making pointer drag ignore the hovered swimlane would break explicit cross-swimlane placement; changing the programmatic destination to `beta` would make the keyboard right-move fixture inconsistent because keyboard movement preserves the source swimlane.
- **Strongest counterargument:** A requirement-derived specification should ordinarily remain immutable after its red phase.
- **Confidence:** High — the contradictory addresses make the original equality assertion impossible without corrupting one producer's semantics.
- **Hardening:** The pointer and keyboard resolver contracts were rechecked against the approved semantic-address and card-half behavior; only fixture data/coordinates change, not an expectation or assertion.
- **Policy version:** 1.
- **Root invocation ID:** `EP-PHASE-C-20260812T0118CEST`.
- **Reopen trigger:** Product requirements later define horizontal pointer movement as preserving the source swimlane regardless of the hovered target.

## Systematic category closure

| Category | Closure evidence |
|---|---|
| Feature gaps | Phase C target and downstream producer boundary are explicit in AR-C01/C02. |
| Behavioral gaps | Threshold, eligibility, hysteresis, autoscroll, release, cancellation, pending, reconciliation, and keyboard parity are owned by AR-C05–C15. |
| Scope ambiguities | Strict RD-07/RD-08 boundary is frozen; no optional expansion is planned. |
| Technical unknowns | Capture/controller partition and generation exhaustion are resolved; all mechanisms are closed. |
| Edge cases | Unknown edges, stale revisions, outside release, capture loss, small viewports, bulk atomicity, late outcomes, and disposal are explicit. |
| Integration points | UI capture, Core/Web input, Kanban source/scene/facade/dispatcher, i18n/theme/docs/plugin, and testing boundaries are named. |
| Data & state | Application authority, immutable projections, semantic anchors/tokens, revisions, operation IDs, and bounded registries are resolved. |
| Security & compliance | Exact allowlists, sanitization, token/payload redaction, callback isolation, abort, and finite limits are required; no storage/compliance subsystem is introduced. |
| Non-functional gaps | Bounded visible work, fake-clock timing, damage regions, host parity, file decomposition, and phase gates are specified. |
| UX & presentation | Ghost, placeholder, gap, reflow, target states/reasons, non-color cues, and compact-density behavior are fixed by RD-07 and AR-C07–C09. |
| Stakeholder conflicts | Application authority remains final while component preview stays responsive; no conflicting owner remains. |
| Naming & terminology | `phase-c-modern-interaction`, `column`, `swimlane`, `placement`, `projection`, `operation`, and `dispatcher` follow existing public terminology. |
