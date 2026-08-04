# Kanban Phase A Foundation Plan Ambiguity Register

> **Status**: ✅ GATE PASSED — all 32 items resolved
> **Last Updated**: 2026-08-04 04:05 CEST
> **Mode**: Auto-design active from PAR-20 onward and for the Phase A execution chain
> **Root Invocation IDs**: `AD-KANBAN-PHASE-A-20260803T213242Z`,
> `AD-KANBAN-PHASE-A-EXEC-20260803T220942Z`
> **Policy Version**: 1
> **CodeOps Artifact Schema**: 1

## Planning scope contract

| Boundary | Recorded boundary |
|---|---|
| Planning target | Kanban Phase A Foundation: complete RD-01, RD-02, and RD-03; RD-04 AC 1–2; RD-05 AC 1 and AC 18 |
| Context artifacts | Full Kanban requirements set and preflight; Kanban architecture docs/ADRs; repository package, UI layout/reactivity/rendering, testing, docs, i18n, distribution, and plugin patterns |
| Modification set | This plan set, Kanban traceability graph, Kanban/portfolio roadmaps; implementation later may change the explicitly planned package, focused repository registries/scripts, canonical docs/skill sources, generated plugin outputs, and tests, but not requirement semantics |

## Register

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| PAR-01 | Scope | Exact Phase A behavior boundary | Complete RD-01–03 plus only RD-04 AC 1–2 and RD-05 AC 1/18 | Imported from preflighted requirements Phase A | ✅ Resolved |
| PAR-02 | Architecture | Package authority and topology | Standalone app-authoritative package; DSL `KanbanBoard` around one exact-cell `KanbanViewport` | Imported requirements AR-1–4, AR-27, AR-41–42 | ✅ Resolved |
| PAR-03 | Data | Scale/source architecture | One revisioned query session with sparse cursors; eager and windowed sources share the contract | Imported requirements AR-10, AR-32, AR-42 | ✅ Resolved |
| PAR-04 | Presentation | Foundational rendered slice | Generic adapter plus `StandardCard`; title/status/non-color focus cue; zero and populated ordered columns | Imported Phase A boundary and requirements AR-4, AR-35 | ✅ Resolved |
| PAR-05 | Security | Trust and resource boundary | Validate/sanitize/bound package inputs/results; callbacks are trusted same-thread code, not sandboxed | Imported requirements AR-22 and preflight corrections | ✅ Resolved |
| PAR-06 | Limits | Defaults and safety ceilings | Export the exact safe-default/standard-ceiling/absolute-maximum manifest owned by RD-14 | Imported requirements AR-43 | ✅ Resolved |
| PAR-07 | Scope | Later-phase exclusion | No navigation/selection commands, component-generated mutations, drag/drop, editors/configuration, saved views, complete swimlanes/workflow, full theme/i18n hardening, docs course/labs, kitchen sink, or showcase; RD-01 raw request/authority contracts remain in scope | Imported Phase B–F boundary | ✅ Resolved |
| PAR-08 | Traceability | How to represent partial RD-04/RD-05 delivery without claiming either complete | A: plan-local slice specifications/criteria in a Phase A planning group; B: group whole RDs and annotate exclusions | User accepted A: slice-specific plan nodes; RD-04/RD-05 remain incomplete | ✅ Resolved |
| PAR-09 | Public API | Identity and revision ergonomics | A: plain validated semantic string aliases, branded opaque placement token, equality-only `string \| number` revision; B: branded factory-created type for every ID/revision | User accepted A | ✅ Resolved |
| PAR-10 | Public API | Reactive query/session shape | A: getter-method reactivity and synchronous `openQuery` returning a live session; async work stays in cursor acquisition/retry; B: promise-returning session open plus property accessors | User accepted A | ✅ Resolved |
| PAR-11 | Data | Eager helper ordering/input contract | A: reactive card/column getters, required key/column adapters, optional stable comparator with source-order fallback; B: require a rank property/value adapter | User accepted A | ✅ Resolved |
| PAR-12 | Public API | Board/viewport construction and imperative surface | A: options-object constructors, board-owned public viewport, query getter, metrics/scroll/reveal methods; B: factories and a separate controller object | User accepted A | ✅ Resolved |
| PAR-13 | Presentation | Descriptor/theme foundation boundary | A: full bounded descriptor shape and package-local semantic theme contract now, implement only basic standard sections; B: temporary Phase A renderer shape replaced in Phase B | User accepted A | ✅ Resolved |
| PAR-14 | Error handling | Invalid configuration versus runtime extension failures | A: typed throws for construction/pure validation misuse; runtime source/renderer failures become sanitized scoped state/observations and retain last valid publication; B: result objects for every boundary | User accepted A | ✅ Resolved |
| PAR-15 | i18n | Ten required locale subpaths before full RD-13 | A: all ten export type-compatible Phase A catalogs with English fallback and current digest-bound review for the bounded vocabulary; B: empty forwarding locale modules until Phase E | User accepted A; PAR-24 established immediate review evidence | ✅ Resolved |
| PAR-16 | Integration | Phase A documentation/plugin footprint | A: package README/changelog/JSDoc, focused architecture reference, package/install/API inventories, i18n export registry, plugin API/impact mapping and generated parity; defer component course/live examples; B: package-only docs until Phase F | User accepted A | ✅ Resolved |
| PAR-17 | Testing | Coverage policy and oracle split | A: 100% of Phase A criteria mapped to immutable spec assertions, separate impl/property/E2E files, no invented numeric line-coverage gate; B: add a new percentage coverage gate | User accepted A | ✅ Resolved |
| PAR-18 | Verification | Canonical local completion gate | A: Kanban build/typecheck/unit/E2E/deps/JSDoc plus affected docs/i18n checks, `yarn verify:local`, mapped `yarn plugin:update`, and `yarn plugin:check`; B: run full `yarn verify` locally | User accepted A | ✅ Resolved |
| PAR-19 | Data | Exact public representation of generic filter values in `KanbanQuery` | A: recursively bounded, immutable semantic JSON values (null/boolean/finite number/string/arrays/objects) validated and snapshotted at the package boundary; B: opaque `unknown` application values retained by reference | User accepted A | ✅ Resolved |
| PAR-20 | Technical | Snapshot mechanism for accepted semantic query values | Recursive fixed-schema copy with depth/entry/string/byte bounds / canonical byte storage / retain validated caller graph | Delegated: package-owned sorted deep-frozen semantic tree; canonical fingerprint is derived only | ✅ Resolved |
| PAR-21 | Technical | Deterministic width distribution after effective minima | Stable progressive waterfill / proportional slack with largest remainder / equal fixed widths | Delegated: tiered monotone progressive waterfill with stable source-order ties | ✅ Resolved |
| PAR-22 | Technical | One-board query session and cursor ownership mechanism | Generation-owned address map / reference-counted pool / separate controller store | Delegated: private generation-owned address map with explicit retention owners | ✅ Resolved |
| PAR-23 | Technical | Descriptor projection caching mechanism | Bounded viewport-local semantic cache / recompute every frame / global LRU | Delegated: bounded visible/overscan semantic cache with owned reactive scopes | ✅ Resolved |
| PAR-24 | Integration | Official locale registration conflicts with provisional review evidence | Approve digest-bound Phase A catalogs now / introduce a provisional registry exemption | Delegated: review and approve the bounded Phase A vocabulary now; later catalog changes renew review | ✅ Resolved |
| PAR-25 | Technical (runtime) | Exact Phase A request, result, capability, dispatcher-context, and publication-metadata shapes were not fixed deeply enough to author an immutable public oracle | Closed package-owned extension envelope / declaration-merging registry / free generic request interface | Delegated: a package-owned `extension` envelope with required semantic payload, captured revisions and signal; four-result union; sync-or-native-Promise dispatcher with context; per-extension UX capability map; separate publication metadata | ✅ Resolved |
| PAR-26 | Technical (runtime) | The requirement mandated namespaced extension IDs but did not fix their grammar or reserved package namespace | Reuse lowercase dotted JSVision message-key grammar / introduce slash-separated IDs | Delegated: reuse lowercase dotted segments and reserve the complete `jsvision.` prefix for package-owned IDs | ✅ Resolved |
| PAR-27 | Technical (runtime) | Query-session criteria fixed lifecycle behavior but not the exact public value shapes or a black-box seam that can test the private generation coordinator | Testing-only lifecycle harness plus exact value unions / expose the coordinator / defer lifecycle proof to Phase 4 | Delegated: exact public query/state/count/structure/publication/location values plus a narrow testing-only lifecycle harness; coordinator internals remain private | ✅ Resolved |
| PAR-28 | Technical (runtime) | Cursor criteria fixed behavior but not exact cell/count/length/placement/identity values, stale-placement validation, or a black-box seam for the private range coordinator | Exact unions plus pure validators and testing-only cursor harness / expose coordinator / move cursor lifecycle to Phase 4 | Delegated: exact immutable cursor unions, pure placement/identity validators, and a narrow testing-only cursor harness; selection reconciliation remains Phase 4 | ✅ Resolved |
| PAR-29 | Technical (runtime) | The approved 100,000-card windowed fixture lacked an exact constructor, settlement controller, and bounded metrics needed for an immutable scale oracle | Lazy testing fixture with explicit range settlement and metrics / self-reported opaque benchmark / mount Board early | Delegated: lazy testing-only windowed source/controller with request-proportional frozen metrics and safe bounded events; no board or coordinator exposure | ✅ Resolved |
| PAR-30 | Technical (runtime) | Eager filter, sort, and summary adapter names were approved without exact callback/result shapes or honest summary publication values | Explicit operator registry plus package numeric aggregations / opaque predicates and arbitrary reducers / defer summary execution | Delegated: finite operator registries, tri-state sort comparison, and package-owned numeric aggregations with explicit authoritative/loaded-only scope and count-like quality | ✅ Resolved |
| PAR-31 | Quality hardening | Independent Phase 2 review exposed contradictions and untested lifecycle/source edge cases after the green oracle | Preserve the green implementation / harden the durable source contract and revise the conflicting signal oracle | Delegated: mandatory hardening with composed locator cancellation, bounded active-range sharing, atomic snapshots, explicit eager search/revision, authoritative identity facts, honest unknown projection counts, exact headers, safe card keys, and session-local windowed fixture state | ✅ Resolved |
| PAR-32 | Public API | Card behavior was specified but the callable adapter/renderer/context/descriptor/fallback surface was not exact enough for immutable tests | Durable semantic descriptor seam / temporary Phase A render result / defer the oracle | Delegated: durable generic adapter + render context + semantic descriptor, pure standard/validation/fallback helpers, and one safe catch/observe wrapper | ✅ Resolved |

## Resolution notes

### PAR-08 — slice-accurate planning target

**Recommendation: Option A.** A planning group containing RD-01–03 plus plan-owned specifications and
criteria for the four named slices preserves the later Phase B ownership of the rest of RD-04/RD-05.
Grouping whole RD-04/RD-05 would make Phase A's traceability claim broader than its approved scope.

### PAR-09 through PAR-12 — public contract family

**Recommendation: Option A for each.** It follows repository ergonomics: JSVision reactive values are
callable getters, specialist components use options-object constructors, and public data-source seams
use stable callback/method contracts. Branding only opaque placement tokens keeps ordinary application
IDs usable without unsafe casts or mandatory conversion factories. A synchronous session object gives
the board a cancellation owner immediately; remote work remains asynchronous where it belongs.

The strongest counterargument is that plain string aliases allow accidental cross-assignment between
column and swimlane IDs at compile time. Runtime boundary validation and distinct property names reduce
that risk without imposing branded-ID ceremony on every consumer record.

### PAR-13 and PAR-14 — durable rendering and failure contracts

**Recommendation: Option A for each.** Phase A establishes public SDK contracts, so a disposable
temporary renderer would create avoidable compatibility debt. Typed throws remain appropriate for
programmer mistakes before mount; runtime callbacks and source publications cannot safely unwind the
render loop and therefore need scoped degradation with last-valid-state retention.

### PAR-15 and PAR-16 — honest incremental distribution

**Recommendation: Option A for each.** The export map requires ten locale entry points now, so each
should be useful and type-compatible. PAR-24 subsequently established current digest-bound approval for
the complete bounded Phase A vocabulary; RD-13 still owns later vocabulary and the final locale matrix.
A publishable public package also needs to enter the current package, API, locale, and plugin inventories;
the large teaching course and live showcase remain Phase F work.

### PAR-17 and PAR-18 — evidence and local gate

**Recommendation: Option A for each.** The repository has no numeric coverage threshold, while the
requirements demand criterion-level traceability and layered evidence. The project guidance explicitly
assigns `yarn verify:local` plus focused package/docs/plugin checks to local work and leaves full
`yarn verify` to CI unless requested.

### PAR-19 — generic query values

**Recommendation: Option A.** Bounded semantic JSON supports dates and domain values through explicit
string/number encodings, is safe to validate/snapshot, and can later flow into RD-09 saved views without
retaining hostile prototypes, getters, functions, or mutable application objects. Opaque `unknown` is
more ergonomic for rich application values, but it makes a "validated semantic query" impossible to
guarantee and creates an incompatible serialization boundary later.

**Authority:** User accepted Option A on 2026-08-03. Auto-design was activated only afterward and did
not supply this decision.

### PAR-20 — query snapshot representation

**Authority:** Delegated under auto-design. **Eligibility:** Internal data representation within the
user-approved semantic-JSON contract; it changes neither product scope nor public ownership.
**Objective:** Detach accepted queries from caller mutation while preserving a usable, serializable
public value. **Decision:** Validate in one bounded recursive walk, reject cycles, accessors, custom
prototypes, unsupported values, non-finite numbers, and limit violations, copy arrays and sorted-key
plain records into package-owned storage, and deep-freeze the result. A canonical fingerprint may be
derived for equality/digests but is not the authoritative public representation.

**Evidence:** RD-02 defines a validated semantic query; Code Editor already uses immutable bounded
snapshots for extension inputs. Canonical bytes would simplify equality but force every in-process
source to decode an opaque representation. Retaining a validated caller graph would leave sessions
vulnerable to later mutation. **Strongest counterargument:** Canonical bytes make byte limits and
comparison cheaper. **Confidence:** High (0.95). **Hardening:** Independent blind challenger concurred
and strengthened the choice with sorted keys and an optional derived fingerprint. **Policy:** v1,
root `AD-KANBAN-PHASE-A-20260803T213242Z`. **Reopen if:** a required domain value cannot use an
explicit tagged-JSON encoding, or profiling proves bounded copying material.

### PAR-21 — responsive width allocation

**Authority:** Delegated under auto-design. **Eligibility:** Pure layout mechanism inside the approved
18/24/32 width contract. **Objective:** Produce deterministic, fair widths that do not visually jump
backward as a terminal grows one cell. **Decision:** Start at each effective minimum; allocate cells to
the lowest normalized minimum-to-preferred fulfillment with stable source-order ties, then repeat for
preferred-to-maximum. Use integer comparison and cap each tier.

**Evidence:** RD-03 requires minima, then preferred widths, then maxima. The repository apportioner is
deterministic but largest-remainder allocation is not house-monotone; one added cell can shrink a
column. Equal fixed widths discard useful bounded space. **Strongest counterargument:** Reusing the
shared apportioner would reduce bespoke code. **Confidence:** Medium-high (0.84). **Hardening:** Blind
challenge confirmed the progressive algorithm and added a monotonic-resize oracle. **Policy:** v1,
same root invocation. **Reopen if:** extreme terminal widths make progressive allocation measurable,
or product policy accepts cell reassignment during growth.

### PAR-22 — session and cursor ownership

**Authority:** Delegated under auto-design. **Eligibility:** Private lifecycle mechanism behind the
approved public source/session/cursor contract. **Objective:** Guarantee sparse reuse, bounded
retention, cancellation, and exactly-once cleanup. **Decision:** One private coordinator owns the
active generation/session and a canonical-address map. Entries contain one cursor and explicit
retention owners (`visible`, `overscan`, `prefetch`) instead of an exposed numeric reference count.
Query replacement increments the generation before cancellation, releases descriptor scopes and map
entries, then disposes cursors and the session.

**Evidence:** RD-02 requires one coherent session and sparse on-demand cursors; RD-14 requires bounded
retention and idempotent disposal. **Strongest counterargument:** A reference-counted pool generalizes
to unrelated consumers, but numeric counts are easier to leak and no such public sharing is in scope.
**Confidence:** High (0.92). **Hardening:** Blind challenger concurred and made disposal order explicit.
**Policy:** v1, same root invocation. **Reopen if:** independent public viewports must share cursors or
cursors become reusable across generations.

### PAR-23 — descriptor projection cache

**Authority:** Delegated under auto-design. **Eligibility:** Private rendering optimization within the
approved visible-plus-overscan bound. **Objective:** Preserve reactive correctness without rebuilding
unrelated descriptors or retaining offscreen application records. **Decision:** Cache only retained
visible/overscan descriptors, keyed by generation, address/cursor revision, card key,
renderer/presentation revision, geometry/degradation, density, theme/capability revision, and
interaction-state revision. Each entry owns a bounded reactive scope; eviction disposes it before the
cursor and session.

**Evidence:** RD-04 makes descriptors depend on semantic, geometry, theme, and reactive inputs; RD-14
bounds steady work to visible projection. A global LRU retains stale records, while per-frame rebuilds
amplify custom-renderer and pointer repaint work. **Strongest counterargument:** Recompute-on-dirty is
simpler and still O(visible). **Confidence:** High (0.88). **Hardening:** Blind challenger concurred and
identified the required invariant that in-place card changes bump a cursor/presentation revision.
**Policy:** v1, same root invocation. **Reopen if:** profiling proves construction cheaper than cache
bookkeeping, or sources cannot publish honest semantic revisions.

### PAR-24 — Phase A translation review evidence

**Authority:** Delegated under auto-design. **Eligibility:** Repository integration mechanism required
by the user-approved ten locale exports and local verification gate. **Objective:** Register the
package without weakening the repository's definition of an official catalog. **Decision:** Translate,
review, and record approved digest-bound evidence for the complete bounded Phase A vocabulary in all
nine non-English catalogs. Any later vocabulary change invalidates the whole-catalog digest and renews
review in Phase E, with review effort focused on the diff.

**Evidence:** `tools/i18n-locale-exports.json` is the official registry;
`scripts/check-i18n-reviews.mjs` requires exactly one approved matching digest per registered
non-English catalog and already accepts disclosed AI-assisted review. **Strongest counterargument:** A
provisional exemption avoids later re-review, but it creates a second meaning of official and weakens
the current release invariant across generator, checker, tests, and docs. **Confidence:** Very high
(0.99). **Hardening:** Independent blind challenger selected the same option. **Policy:** v1, same root
invocation. **Reopen if:** the repository deliberately introduces a first-class provisional-package
registry with non-release semantics.

### PAR-25 — Phase A raw request contract

**Authority:** AI — delegated by `--auto-design`. **Eligibility:** This selects an exact initial
TypeScript interface inside the already approved raw request, application-authority, capability, and
publication-reconciliation behavior. It adds no request feature, command, mutation, or authorization
policy and changes no acceptance criterion. **Objective:** Give specification tests one durable,
runtime-validatable request boundary without freezing later standard mutation variants prematurely.

**Decision:** Phase A exports `KanbanExtensionRequest<TType, TPayload>` as the sole current member of
`KanbanRequest`. It has package-owned `kind: 'extension'`, a validated namespaced `extensionId`, unique
`operationId`, required bounded semantic `payload` (`null` represents no payload), a required structured
`expected` revision snapshot, and a live `AbortSignal`. `KanbanRequestResult` is an operation-correlated
`accepted | rejected | cancelled | superseded` union. `KanbanRequestDispatcher` receives the request
plus a read-only `KanbanRequestContext` and may return a result synchronously or through a native
`Promise`; the package-facing dispatch helper always returns a `Promise`, validates and snapshots before
calling application code, rejects mismatched result operation IDs, and normalizes throws/rejections to
a sanitized rejection. `KanbanCapabilities` is an immutable per-extension UX description using
`allowed | disabled | hidden`; an absent entry means allowed for discoverability, and raw dispatch never
consults the map. Accepted results may carry separate bounded `KanbanPublicationExpectation` metadata.
Pure reconciliation consumes only pending metadata and an authoritative matching/contradictory notice,
preserves `CardKey` identity without stringification, clears the operation in either case, and never
receives or mutates application records.

**Evidence:** The requirements already require operation correlation, captured board/source/query/entity
revisions, typed payload, `AbortSignal`, dispatcher context, four terminal outcomes, and capability as
diagnostic UX rather than authorization. The package specification requires a package-owned
discriminator and a documented extension strategy. Repository scanning found no existing dispatcher
contract that would justify a different house shape. **Rejected alternatives:** Declaration merging
makes the runtime union ambient and dependency-order-sensitive, weakening deterministic validation. A
free generic request type has no package-owned top-level discriminant for later standard variants.
Making payload optional creates two encodings of no payload. Promise-only dispatchers make synchronous
application tests needlessly awkward; accepting arbitrary thenables broadens the hostile callback
surface. **Strongest counterargument:** A declaration-merging registry gives application extensions
more global compile-time ergonomics. The generic extension envelope retains local strong typing without
ambient mutation, and a later typed builder can improve inference compatibly. **Confidence:** High
(0.92). **Hardening:** Independent blind challenger converged on the extension envelope, required
payload, per-extension capability map, and normalized async package boundary; reconciliation added the
already-required signal, context, captured revision structure, and cancelled/superseded outcomes that
the challenge packet held fixed. **Policy:** v1, root
`AD-KANBAN-PHASE-A-EXEC-20260803T220942Z`. **Reopen if:** a later standard request cannot join the
package-owned discriminated union compatibly, native-Promise normalization prevents a supported
dispatcher integration, or publication matching cannot be expressed without retaining application
records.

### PAR-26 — extension namespace grammar

**Authority:** AI — delegated by `--auto-design`. **Eligibility:** This selects the validation grammar
for the already approved namespaced extension identity and package reservation. It does not add an
extension point or change its authority semantics. **Objective:** Make collision rejection predictable
and reuse a grammar JSVision consumers already encounter. **Decision:** Application extension IDs use
two or more lowercase dotted segments. Each segment starts with `a-z` and continues with `a-z`, digits,
or `-`; for example, `example.review`. The complete `jsvision.` prefix is reserved for package-owned
identities and the public application factory rejects it.

**Evidence:** `packages/i18n/src/grammar.ts` already publishes and tests the exact
`^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$` grammar for namespaced public message keys. The approved raw
request example and first specification oracle use `example.review`. Slash-separated IDs occur in some
older Data Grid application fixtures but have no shared public validator and would introduce a second
namespace grammar. **Rejected alternative:** Slash-separated IDs can visually separate owner and name,
but adopting them here would diverge from the repository's explicit reusable namespaced grammar without
a compatibility need. **Strongest counterargument:** Existing Data Grid consumers may expect slash IDs.
This is a new package with no compatibility surface, and one documented SDK-wide validated grammar is
more predictable. **Confidence:** High (0.94). **Hardening:** Rechecked against the shared i18n grammar
and existing consumer fixtures; the reusable validated grammar remained the strongest option. **Policy:**
v1, root `AD-KANBAN-PHASE-A-EXEC-20260803T220942Z`. **Reopen if:** JSVision publishes a cross-package
identifier standard that replaces the dotted grammar or requires slash compatibility.

### PAR-27 — query lifecycle oracle seam

**Authority:** AI — delegated by `--auto-design`. **Eligibility:** This fixes exact representations and
a testing-only observation seam for already approved query-session behavior. It adds no production
capability and keeps the generation coordinator private. **Objective:** Let immutable specifications
prove query replacement, stale suppression, atomic publication validation, redaction, count honesty,
and bounded location without importing private implementation types.

**Decision:** The main entry fixes exact immutable query/filter/sort, source-state, count,
column/swimlane metadata, cell-address, session-publication, and revision-bound card-location shapes.
The testing entry exposes `createKanbanQueryLifecycleHarness`, whose surface is limited to replacing
the semantic query, reading a detached active-publication snapshot and safe observations, locating a
card through the active session, and disposal. It may drive the private coordinator but never exposes
generation maps, retention owners, schedulers, cursors, or coordinator identity. Specifications use
ordinary public source/session fakes; deterministic fixture controllers remain owned by task 2.2.6.

**Evidence:** The public specification already requires synchronous session ownership, generation
invalidation before abort, last-valid publication retention, revision-bound bounded location, and a
testing subpath. Without a black-box lifecycle seam, the oracle must either invent component APIs or
import the forbidden coordinator. **Rejected alternatives:** Exporting the coordinator turns a private
lifecycle mechanism into an SDK compatibility surface. Deferring lifecycle proof to Phase 4 breaks
Phase 2 ownership and allows stale-source defects to survive the source gate. **Strongest
counterargument:** The harness adds a supported testing API, but that subpath is already an approved
consumer-facing fixture surface and the narrow operations describe observable behavior only.
**Confidence:** High (0.93). **Hardening:** Independent challenge converged on exact public value unions
and the testing-only harness and explicitly rejected coordinator exposure. **Policy:** v1, root
`AD-KANBAN-PHASE-A-EXEC-20260803T220942Z`. **Reopen if:** consumers require direct lifecycle control in
production or the harness cannot test the criteria without exposing private state.

### PAR-28 — cursor lifecycle oracle seam

**Authority:** AI — delegated by `--auto-design`. **Eligibility:** This fixes exact representations,
pure validators, and a testing-only observation seam for already approved cursor behavior. It adds no
source feature and keeps range scheduling/coalescing private. **Objective:** Let immutable
specifications prove range validation/coalescing, unloaded reads, placement completeness, stale-token
rejection, error isolation, identity-change validation, and exactly-once disposal without importing
private coordinator state.

**Decision:** The main entry fixes exact immutable cell-state, cell-count, known-length, placement, and
identity-deletion unions. Pure snapshot validators reject malformed or over-bound values atomically;
`assertKanbanPlacementCurrent` compares the placement's cursor revision by equality and rejects stale
anchors or opaque tokens before future dispatch. The testing entry exposes a cursor lifecycle harness
limited to bounded `ensureRange`, safe inspection snapshots, retry, observations, and idempotent
disposal. Inspection returns requested card keys/unloaded markers and redacted placements but never
card bodies, token values, range maps, queues, coordinator identity, or mutable cursor objects.
Selection/focus reconciliation remains assigned to the Phase 4 board oracle; Phase 2 publishes only
bounded authoritative deletion facts.

**Evidence:** Cursor method names and lifecycle behavior were approved, but the prior prose did not
fix permanent union fields or a black-box route through the private range coordinator. **Rejected
alternatives:** Exporting the coordinator creates a compatibility surface for scheduling internals.
Moving cursor lifecycle to Phase 4 breaks Phase 2's source gate. Pulling selection reconciliation into
this task contradicts its existing Phase 4 ownership. **Strongest counterargument:** Multiple pure
validators add public surface, but they make the source and future dispatch boundaries independently
testable without mutable controllers. **Confidence:** High (0.94). **Hardening:** Independent challenge
converged on exact unions, equality-only revision validation, and the testing-only harness and corrected
selection ownership. **Policy:** v1, root `AD-KANBAN-PHASE-A-EXEC-20260803T220942Z`. **Reopen if:**
placement anchor semantics change, selection ownership moves into the source layer, or consumers need
public coordinator control.

### PAR-29 — deterministic windowed scale fixture

**Authority:** AI — delegated by `--auto-design`. **Eligibility:** The 100,000-logical-card fixture,
deterministic controller, instrumentation, and testing export were already approved. This fixes their
minimal representation without adding a production adapter or changing scale semantics. **Objective:**
Make visible/overscan-only acquisition, lazy cursor creation, bounded telemetry, and absence of a
whole-card scan observable in a pure source test.

**Decision:** `createWindowedKanbanFixture` receives a logical card count, bounded column/swimlane
metadata, deterministic initial revision, a card-key adapter, and a `materialize({ address, start,
end })` callback. It returns a public data source plus a testing controller that lists exact pending
half-open requests by numeric ID and explicitly resolves/rejects them or publishes a deterministic
session snapshot. Materialization cannot run until the controller resolves a recorded request.
Detached frozen metrics count actual sessions, cursors, ranges, cards materialized/read, aborts, late
suppression, publication, and disposal. A fixed-capacity safe event ring carries only numeric IDs,
addresses, bounds, revisions, and safe codes—never queries, card keys/bodies, tokens, raw errors,
callbacks, promises, or private identities.

**Evidence:** The scale criterion requires proving that 100,000 logical cards do not cause a full scan
or theoretical cell allocation. A logical count alone cannot prove that; explicit range settlement and
request-proportional counters can. **Rejected alternatives:** Opaque self-reported benchmark numbers
cannot prove callback/materialization boundaries. Mounting the board early violates the pure-source
phase and duplicates Phase 4. Exporting coordinator queues exposes private implementation.
**Strongest counterargument:** The controller is a supported testing surface, but deterministic
deferred settlement is already an approved consumer fixture category and remains isolated under
`./testing`. **Confidence:** High (0.95). **Hardening:** Independent challenge converged on lazy cursor
creation, explicit request IDs, controller settlement, bounded frozen metrics, and safe telemetry.
**Policy:** v1, root `AD-KANBAN-PHASE-A-EXEC-20260803T220942Z`. **Reopen if:** the 100,000 target or
visible/overscan semantics change, or a production windowed adapter becomes package-owned.

### PAR-30 — eager query adapters and honest numeric summaries

**Authority:** AI — delegated by `--auto-design`. **Eligibility:** Filtering, stable sorting, numeric
summaries, authority qualifiers, and their eager option names were already approved. This fixes exact
public callback and value shapes without adding a query language or changing scope. **Objective:**
Reject unsupported operators before session creation, keep sorting deterministic, and ensure a header
never presents a loaded-only or unavailable summary as an authoritative zero.

**Decision:** A filter field owns a finite unique registry of namespaced operator predicates; queries
AND filters in declared order and reject unknown field/operator pairs before `openQuery`. A sort field
returns exactly `-1`, `0`, or `1`; directives apply lexicographically, then the optional source
comparator, then source index. A summary adapter declares a field ID, `authoritative` or `loaded-only`
scope, one of `sum`, `minimum`, `maximum`, or `average`, and a finite numeric `valueOf` callback.
Package code performs aggregation and publishes an exact typed numeric summary; an empty contributing
set publishes `unknown`, never zero. Runtime callback throws or invalid values reject the complete
candidate, emit one sanitized observation, and retain the last valid publication.

**Evidence:** A direct opaque predicate cannot validate supported operators before opening a session,
and an arbitrary reducer makes work, scope, and empty-result semantics unknowable. Package-owned
aggregation makes the scan bounded by resident cards and configured summary count while preserving
the application's domain-value adapter. **Rejected alternatives:** Generic built-in comparison would
invent cross-domain semantics. Arbitrary reducers allow repeated scans and ambiguous authority.
Deferring summaries contradicts the confirmed derivation and RD-02 slice. **Strongest counterargument:**
Custom reducers offer more flexibility, but they can be added later through a separately bounded
contract without weakening this deterministic foundation. **Confidence:** High (0.92).
**Hardening:** Independent challenge selected explicit operators, tri-state comparison, numeric
aggregation, and typed summary quality and rejected silent summary deferral. **Policy:** v1, root
`AD-KANBAN-PHASE-A-EXEC-20260803T220942Z`. **Reopen if:** non-numeric summaries, custom reducers, or
remote authoritative aggregation becomes a package-owned source responsibility.

### PAR-31 — Phase 2 independent-review hardening

**Authority:** AI — delegated by `--auto-design`. **Eligibility:** The user approved all major quality
recommendations and authorized the execution quality loop to resolve them without expanding the Phase
A product boundary. **Objective:** Close contradictions and missing adversarial cases in the already
approved source/session/cursor/testing contracts before the phase checkpoint.

**Decision:** Every locator receives a coordinator-owned signal that mirrors caller cancellation and
can also be aborted on query replacement; this corrects the earlier exact-signal-identity oracle, which
could not satisfy generation-owned cancellation. Session snapshots use opening/closing revision reads.
Locator cancellation races application settlement so a source that ignores abort cannot retain the
public continuation. Range disposal never starts undelegated work; active coordination subtracts active and completed coverage, shares overlapping acquisition, and splits
every delegated span at the configured bound. Eager sources require an explicit search predicate for
non-empty search and an optional application revision getter for in-place field changes, retain authoritative keys separately from the
matching index, allocate revisions across the complete source rather than per session, expose viewport-visible counts as unknown, and keep all counts unknown after an invalid
first publication. Optional swimlane metadata does not force grouping. Structural headers are unique
and complete, and string card keys use the same UTF-8/control-safe identity boundary as other IDs.
Testing harnesses expose only bounded configured resident-key inspections; deterministic windowed
sessions report distinct active resident slots, never cumulative fixture metrics, keep unknown-length
cursors partial, retain validated session-unique keys beside cards, sanitize rejection events, and permit cursor reacquisition after disposal.

**Evidence:** Independent reviewer and auditor reports found no critical issues but identified these as
major contract violations not exercised by the initial 30-test Phase 2 focus. **Rejected alternatives:**
Keeping an exact caller signal makes coordinator cancellation impossible. Treating matching entries as
authoritative identity loses filtered records. Reporting matching as visible invents viewport knowledge.
Leaving testing helpers approximate defeats their purpose as supported deterministic oracles.
**Strongest counterargument:** Composing the locator signal changes observable object identity, but
cancellation semantics are the durable contract and no safe implementation can abort a caller-owned
signal. **Confidence:** High (0.96). **Hardening:** Two independent phase roles reproduced or grounded
the findings against source, requirements, and tests. **Policy:** v1, root
`AD-KANBAN-PHASE-A-EXEC-20260803T220942Z`. **Reopen if:** sources gain a standard platform-independent
signal-composition primitive that preserves identity, or visible-count ownership moves out of the
viewport.

### PAR-32 — durable card rendering seam

**Authority:** AI — delegated by `--auto-design`. **Eligibility:** Generic adapters, the standard card,
bounded descriptors, safe renderer fallback, themes, and later section compatibility were already
approved; this fixes exact names and value shapes without adding a Phase A interaction. **Objective:**
Let immutable card/descriptor tests target a durable public boundary before production rendering code
exists.

**Decision:** `KanbanCardAdapter<TCard>` owns only `keyOf`, `titleOf`, `statusOf`, and optional
`presentationRevisionOf`; styling remains renderer/theme policy. `StandardCard<TDate,TCustom>` fixes the
approved required and optional convenience fields while dates and custom data remain opaque. A renderer
receives the already-validated card key, optional presentation revision, exact width/row budget,
density, semantic interaction state, Kanban theme, terminal capability projection, and injected
formatting context. It returns a semantic descriptor with measured rows/spans, marker/cues, sections,
actions/regions, surface/border roles, and degradation metadata. Descriptors own no inter-card gap.
The standard renderer, descriptor validator, and fallback constructor are pure. One
`renderKanbanCardSafely` wrapper alone catches renderer/validation failures, emits exactly one bounded
payload-free renderer observation, and returns the localized package fallback. Phase A standard output
keeps actions/regions and deferred metadata/summary/checklist sections empty.

**Evidence:** The spec-author could not freeze Task 3.1.1 without inventing the function used to render
or the rows used to inspect it. **Rejected alternatives:** A temporary two-string result would require
a breaking replacement for Phase B sections and Phase 4 hit geometry. Letting adapters choose colors
mixes semantic extraction with theme policy. Giving renderers observation/fallback callbacks creates
multiple inconsistent failure paths. **Strongest counterargument:** Declaring section/action geometry
freezes later semantics early; the chosen contract includes only already-approved normalized concepts
and no checklist-specific payload or active region in Phase A. **Confidence:** High (0.94).
**Hardening:** An independent challenger refined identity ownership, operation-state exclusivity, the
pure/safe boundary, and the Phase A empty-array claims. **Policy:** v1, root
`AD-KANBAN-PHASE-A-EXEC-20260803T220942Z`. **Reopen if:** a renderer must establish identity, descriptors
move away from semantic terminal rows, or Phase B requires a section concept outside the approved
normalized union.

## Zero-Ambiguity Gate checklist

- [x] All twelve ambiguity categories were scanned.
- [x] Requirements-stage decisions were imported without reopening them.
- [x] The user has confirmed the planning target, context artifacts, and modification set.
- [x] PAR-08 through PAR-18 have explicit user decisions.
- [x] The complete register has final user confirmation.
- [x] PAR-19 has an explicit user decision.
- [x] PAR-20 through PAR-32 have complete delegated records; consequential request, lifecycle, scale,
  and eager-adapter shapes received independent challenge and the namespace grammar was grounded in
  the existing shared validator.
- [x] Header reads `✅ GATE PASSED` before any other plan document is created.
