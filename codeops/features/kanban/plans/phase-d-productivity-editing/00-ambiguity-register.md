# Ambiguity Register: Kanban Phase D Productivity and Editing

> **Status**: ✅ GATE PASSED — all 29 items resolved
> **Last Updated**: 2026-08-14 16:38 CEST
> **Root Invocation ID**: `MP-PHASE-D-20260814T1058CEST`
> **Mode**: Auto-design · policy version 1 · strict scope

## Planning boundaries

| Boundary | Authorized value |
|---|---|
| Planning target | Phase D “Productivity and editing”: RD-09 → RD-10 → RD-11 → RD-12 |
| Context artifacts | Approved Kanban requirements and preflight; completed Phase A–C plans; current Kanban, Forms, UI, Core/Web input, examples, tests, package manifests, docs, and plugin-impact mapping |
| Modification set | New `phase-d-productivity-editing` plan documents and the Kanban feature roadmap; requirements and implementation source remain read-only during planning |

## Register

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|---|---|---|---|---|
| AR-D01 | Scope | Which approved requirements define the next roadmap increment? | RD-09 only / RD-09–RD-10 / roadmap Phase D RD-09–RD-12 | Implement RD-09 through RD-12 in dependency order, exactly matching the user-approved roadmap | ✅ Resolved |
| AR-D02 | Scope | May Phase D claim final hardening, full documentation-course, or release completion? | Include RD-13–RD-15 / keep their seams compatible but leave completion to Phases E–F | Keep RD-13–RD-15 completion out of scope; update only the public docs, locales, plugin references, examples, and kitchen-sink evidence needed to keep shipped Phase D behavior coherent | ✅ Resolved |
| AR-D03 | Technical · complex | Where should durable local view state and query projection orchestration live? | Board/viewport monolith / external-only application state / dedicated pure view controller bound into the board | Use a dedicated reactive view controller; the board composes optional view chrome and binds its query, while the viewport remains a bounded read-only projection leaf | ✅ Resolved |
| AR-D04 | Data & migration · complex | How should saved-view validation, canonical encoding, migrations, and reconciliation be partitioned? | One codec function / layered envelope codec, migration registry, and reconciler / application-only implementation | Separate exact envelope validation/canonical encoding, sequential migration, registry/data reconciliation, and atomic view application | ✅ Resolved |
| AR-D05 | Technical · complex | How should generic and standard card editing reuse JSVision Forms without imposing Zod on generic consumers? | Bespoke form engine / all schema APIs require Zod / generic protocol plus standard Zod/Forms adapter | Keep the generic editor protocol Zod-free; implement the standard adapter/dialog with `@jsvision/forms` and a `zod:^4` peer | ✅ Resolved |
| AR-D06 | Lifecycle · complex | What owns drafts, stale detection, async validation/submission, and editor exclusivity? | Dialog-local callbacks / board-global mutable draft / isolated editor sessions with generation and revision ownership | One isolated disposable editor session per card identity owns detached draft, base revision, field state, generations, cancellation, and stale policy | ✅ Resolved |
| AR-D07 | UX & layout | How should the standard editors and configuration dialogs remain responsive in a TUI? | Absolute placement / DSL-first flow with scrollable workspace and measured actions / fixed full-screen forms | Use DSL-first responsive sections, scrollable growing content, measured action groups, one-cell insets, and explicit narrow-mode degradation | ✅ Resolved |
| AR-D08 | Integration | How should programmatic structural configuration and optional package dialogs converge? | Dialogs mutate directly / independent APIs / pure request builders consumed by dialogs and applications | Export pure validated request builders; package dialogs collect drafts and invoke those builders in result-only or shared-dispatch modes | ✅ Resolved |
| AR-D09 | Technical · complex | How should commands, keymap conflicts, capabilities, and read-only behavior be layered? | Hard-code into viewport / action registry plus pure eligibility and keymap builder / application-only commands | Use one action registry, conflict-validating keymap builder, pure synchronous capability provider, read-only preset, and one board action router | ✅ Resolved |
| AR-D10 | Events & concurrency · complex | How should normalized events relate to existing observations and request lifecycle snapshots? | Replace observations / emit ad hoc callbacks / separate public event hub sourced from existing authoritative seams | Keep observations diagnostic; add a bounded ordered event hub fed after observable state transitions and existing operation publications | ✅ Resolved |
| AR-D11 | History | How should undo/redo integrate without giving the component data authority? | Component snapshot stack / application availability and fresh request callbacks / expose no history seam | Consume reactive application availability plus fresh request builders/tokens; never retain card snapshots or claim commit before publication | ✅ Resolved |
| AR-D12 | Performance | How should search debounce, query replacement, projection application, and event delivery avoid input lag? | Rebuild synchronously on each input / bounded debounced revisions plus pure snapshots and damage-aware repaint / worker-only pipeline | Use the approved configurable 150 ms debounce, generation cancellation, one atomic view publication per change, bounded registries, and existing damage-aware repaint | ✅ Resolved |
| AR-D13 | Security | What may saved views, filters, editor drafts, events, and diagnostics retain or execute? | Trust registered application values / bounded allowlisted snapshots with inert IDs and redaction / stringify arbitrary objects | Validate exact shapes and limits before allocation; IDs select registered behavior only; events/diagnostics remain payload-free and sensitive values redact | ✅ Resolved |
| AR-D14 | Public API | How should the package expose Phase D without fragmenting its supported entry points? | New production subpaths / main barrel plus existing locale/testing subpaths / internal-only APIs | Export supported production APIs from the main barrel and keep only existing locale/testing subpaths; split implementation internally by concern | ✅ Resolved |
| AR-D15 | Testing | Which evidence proves Phase D behavior? | Post-implementation unit tests / specification-first model, migration, dialog, command/event, host, and example evidence / snapshots only | Use specification-first pure-contract, mounted-dialog, migration/fuzz, command parity, lifecycle, host, performance, and example tests | ✅ Resolved |
| AR-D16 | Verification | Which commands are authoritative during execution? | Full `yarn verify` per task / `yarn verify:local` plus smallest relevant package gates and phase closure matrix | Project guidance explicitly selects the changed-file gate plus focused package checks; CI retains the full repository gate | ✅ Resolved |
| AR-D17 | Availability · critical | How can failed query replacement preserve the prior usable board? | Destructive replacement / transactional candidate session | Open and validate a candidate through first valid publication, then atomically activate it and retire the prior generation | ✅ Resolved |
| AR-D18 | View concurrency | What is public during search debounce? | Immediate split state/query / atomic committed projection | View bar owns immediate draft text; controller state, query, revision, capture, and event commit together after debounce | ✅ Resolved |
| AR-D19 | Saved-view reconciliation | How are raw reconciled facets and missing IDs retained? | Resolved-only / raw provenance plus missing policy | Retain bounded per-identity provenance; reconciled widths survive edits until explicit resave; every reference category has an exact missing default | ✅ Resolved |
| AR-D20 | Input prerequisite | Where are Primary/Meta and DOM pointer dedupe implemented? | Kanban inference / additive Core and Web prerequisite | Add source-compatible Core Primary plus Web DOM keyboard/pointer normalization, coordinate mapping, capability fallback, and SGR dedupe | ✅ Resolved |
| AR-D21 | Editor ownership | How does an editor obtain the authoritative record and revision? | Viewport residency / application resolver | Require an application-owned async record/revision resolver with cancellation, publication/deletion subscription, and typed absence | ✅ Resolved |
| AR-D22 | Compatibility | Which owner wins when controller facets overlap legacy getters? | Implicit merge / reject overlap / effective getter composition | Board binding composes all view getters; controller wins supplied facets and legacy behavior remains otherwise | ✅ Resolved |
| AR-D23 | Reentrancy | What exact action/event nesting behavior is supported? | Queue or reject unspecified / closed per-surface policies | Reject same-action recursion before mutation; queue nested events breadth-first with exact bound and typed overflow | ✅ Resolved |
| AR-D24 | Performance | What is the responsiveness pass/fail contract? | Qualitative / deterministic work bounds plus calibrated timing | Assert bounded query/repaint/reflow/session work and use the existing 16 ms median harness as secondary evidence | ✅ Resolved |
| AR-D25 | Technical · runtime | How should view registry lookup relate to source-owned evaluator authority? | Duplicate all source evaluators in the view controller / retain immutable bounded view metadata while source adapters own record evaluation | Keep quick-filter metadata and stable lookup in an immutable bounded view registry; keep sort/filter/group execution in source adapters and validate selected identities at the binding boundary | ✅ Resolved |
| AR-D26 | Technical · runtime · complex | What exact candidate boundary preserves the usable viewport when query projection fails after session open? | Stage only a query session publication / stage a complete isolated viewport source through current-geometry refresh / mutate the live viewport and roll back | Stage a complete isolated viewport source through synchronous publication validation and one current-geometry refresh, then install it non-reentrantly, retire the exact old generation, and notify subscribers afterward | ✅ Resolved |
| AR-D27 | Quality review · runtime · complex | How should the seven accepted Phase 1 Major findings be corrected without widening source authority or the public query protocol? | Parallel quick-filter query directives / executable filter builders / declarative quick-filter mappings plus focused transaction, presentation, ordering, and geometry corrections | Map quick filters to existing source-owned filters declaratively; apply every remaining focused correction and require one fix-scoped re-review | ✅ Resolved |
| AR-D28 | Security limits · runtime | Which safe/standard/absolute budgets bound saved-view parsing, migration, diagnostics, registries, and extensions? | Independent saved-view budgets / shared semantic budgets plus saved-view-specific count limits | Reuse the shared semantic rows exactly for JSON shape and bytes; add fixed saved-view migration, diagnostic, registered-ID, and extension count rows; untrusted parsing always uses the safe class | ✅ Resolved |
| AR-D29 | Confirmation policy · runtime · reserved | Does public programmatic saved-view deletion require the existing destructive confirmation, or is the store API itself an already-authorized boundary? | Preserve confirmation and explicitly approve it in the store oracle / formally make store deletion an already-authorized public authority seam | Preserve destructive confirmation; the store oracle supplies an approving board confirmer explicitly | ✅ Resolved |

## Resolution notes

### AR-D01 — Phase boundary

- **Authority:** User — approved the complete Kanban requirements and the roadmap’s Phase D sequence, then requested continuation of the Kanban roadmap.
- **Decision:** Plan the complete productivity/editing increment in dependency order: RD-09, RD-10, RD-11, then RD-12.
- **Rejected alternatives:** RD-09 alone strands the package-owned editors/configuration producers; broadening into RD-13–RD-15 would cross the accepted phase boundary.
- **Reopen trigger:** The user changes the roadmap phase boundary.

### AR-D02 — Later-phase boundary

- **Authority:** User — approved phased implementation and the permanent incremental kitchen sink while reserving complete hardening and release evidence for later phases.
- **Decision:** Keep final locale/theme/accessibility hardening, scale/security certification, component-course documentation, and release completion with RD-13–RD-15. Phase D still keeps its public JSDoc, messages, generated plugin references, package README, and examples synchronized.
- **Reopen trigger:** A later requirement is explicitly pulled into Phase D.

### AR-D16 — Verification command

- **Authority:** User through project `AGENTS.md` and previously accepted Kanban planning conventions.
- **Decision:** Every task runs `yarn verify:local` plus the smallest affected Kanban/Forms/UI/Examples gate. Phase closure runs Kanban build, typecheck, unit/E2E, dependency and JSDoc checks; affected workspace gates; Examples typecheck/tests/import smoke; plugin update/check; and `yarn verify:local`. CI owns full `yarn verify`.
- **Reopen trigger:** Project guidance or package scripts change.

### AR-D03–AR-D04 — View ownership and durable migration

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal state partitioning, compatibility codec, and migration mechanisms inside the already approved RD-09 behavior; no product or persistence-ownership change.
- **Objective:** Keep typing and scrolling responsive while making saved views deterministic, bounded, atomic, and evolvable.
- **Evidence:** `KanbanBoard` already composes reactive chrome around one viewport; the viewport already consumes a reactive semantic query and replaces revisioned sessions; semantic values already have exact bounded snapshots and canonical encoding; eager and windowed sources already share `KanbanQuery`.
- **Decision:** A dedicated disposable view controller owns immutable durable local view state and derives `KanbanQuery`; the board may compose its optional search/filter/view chrome, while the viewport remains the exact-cell projection. Saved-view work is layered into envelope validation/canonical encoding, sequential migration adapters, registry/data reconciliation, and one atomic controller apply.
- **Rejected alternatives:** Adding all state to the viewport would deepen an already oversized hot-path class; application-only state would fail the package-owned view helpers and UI requirement; one monolithic codec would entangle untrusted parsing, migration, reconciliation, and live mutation.
- **Strongest counterargument:** A controller adds one more public object applications must understand beside the board.
- **Confidence:** Medium — the required independent challenger did not return within the bounded planning window; execution must reopen if the board binding cannot remain source-compatible or measured query churn exceeds the approved budget.
- **Hardening:** Forced reframing considered a standalone workspace service and an event-sourced view log. The controller is smaller, deterministic, and easier to reconcile; challenger unavailable.
- **Policy version:** 1.
- **Root invocation ID:** `MP-PHASE-D-20260814T1058CEST`.
- **Reopen triggers:** A remote source cannot consume the derived query without duplicate state, or schema evolution requires preserving information outside the bounded raw envelope.

### AR-D05–AR-D08 — Editing and configuration architecture

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** SDK interfaces, lifecycle ownership, responsive composition, and implementation reuse within the user-approved editors/configuration workflows.
- **Objective:** Provide mainstream package dialogs without imposing an application record schema or bypassing the existing dispatcher.
- **Evidence:** `@jsvision/forms` already provides reactive typed fields, async validation generations, submit state, and disposal; UI provides modal dialogs, scroll containers, measured buttons, confirmations, and DSL layout; Kanban already defines card/structure request variants and one board authority coordinator.
- **Decision:** Define a Zod-free generic field/section/control protocol. The optional standard adapter uses `@jsvision/forms` and a `zod:^4` peer. Each open editor owns one disposable identity-keyed session with detached draft, base revision, dirty/touched/submitting state, cancellation, and stale-result suppression. Configuration and card dialogs use DSL-first scrollable content, collect a validated result, and feed public pure request builders into the shared authority only when requested.
- **Rejected alternatives:** A bespoke forms engine duplicates lifecycle behavior; Zod in the generic protocol imposes a schema technology; dialog-local mutations create a second authority path; absolute layouts contradict the accepted responsive contract.
- **Strongest counterargument:** Forms/Zod increase the dependency and public-type surface of the package.
- **Confidence:** Medium — challenger unavailable; the design is reopened if the Forms public API cannot preserve focus/drafts through responsive section reflow or if optional standard-editor loading creates an unacceptable consumer dependency failure.
- **Hardening:** A separate editor package/subpath was considered but rejected because the approved architecture requires the canonical main barrel to expose package dialogs. Internal modules still isolate the dependency from generic protocol types.
- **Policy version:** 1.
- **Root invocation ID:** `MP-PHASE-D-20260814T1058CEST`.
- **Reopen triggers:** Generic custom controls cannot share one session protocol, or a valid stale-policy workflow cannot be expressed as reload/cancel/application merge/overwrite.

### AR-D09–AR-D12 — Actions, events, history, and responsiveness

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal routing, event ordering, scheduling, and performance mechanisms within fixed commands/capabilities/history behavior.
- **Objective:** Give every keyboard, pointer, menu, dialog, status, palette, and programmatic route identical eligibility and application-authority semantics without adding input latency.
- **Evidence:** Core/UI provide Ctrl/Alt/Shift keymaps and command events, but Core lacks semantic Primary/Meta and Web lacks the required DOM pointer adapter. The board facade/authority already centralize semantic actions and request lifecycle; observations are diagnostic and payload-free.
- **Decision:** Add the Core/Web prerequisite, then feed one board router from a validated action registry and keymap builder. A synchronous capability provider/read-only preset resolves eligibility. A bounded breadth-first event hub publishes after observable state. History creates fresh application requests. Search uses a 150 ms draft-to-committed debounce, and query replacement is transactional.
- **Rejected alternatives:** Viewport hard-coding prevents menus/palettes and remapping; replacing observations conflates diagnostics with public events; component history snapshots violate application ownership; synchronous rebuild per keystroke risks the failure condition the user explicitly identified.
- **Strongest counterargument:** Multiple explicit registries and routers add integration code and could duplicate identifiers.
- **Confidence:** Medium — challenger unavailable; exact action inventory and event ordering remain specification-owned and must be proven before integration.
- **Hardening:** A single all-purpose facade was considered, but separating pure registries from the board-owned router preserves testability and lifecycle ownership while keeping one public invocation path.
- **Policy version:** 1.
- **Root invocation ID:** `MP-PHASE-D-20260814T1058CEST`.
- **Reopen triggers:** The UI command loop cannot update resolved bindings atomically, or event delivery measurably blocks input under bounded subscriber load.

### AR-D17–AR-D24 — Preflight closure

- **Authority:** User — accepted the complete preflight recommendation batch on 2026-08-14.
- **Decision:** Apply AR-D17–AR-D24. Comparator identity is optional/defaulted for backward
  compatibility; ties use a total typed `CardKey` order. Configuration collision keys use
  sanitized/trimmed NFKC plus fixed `en-US` lowercase. Canonical object ordering uses an explicit
  Unicode code-point comparator with BMP, astral, and lone-surrogate fixtures.
- **Execution policy:** Cross-surface oracles turn green only after dependencies exist. Every commit
  touching mapped SDK paths runs plugin impact review, `yarn plugin:update`, inspection, and
  `yarn plugin:check`. Dist-consuming tests build Kanban immediately beforehand.
- **Hardening:** Five independent audit clusters and a blind challenger grounded the batch in source;
  the challenger raised transactional replacement to Critical and confirmed the other principal findings.
- **Reopen triggers:** A candidate source cannot stage through first publication, additive Core input
  changes prove source-incompatible, or deterministic responsiveness bounds cannot be measured reliably.

### AR-D13–AR-D15 — Safety, exports, and evidence

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Validation, module topology, and testing strategy inside approved security and quality constraints.
- **Objective:** Keep the public SDK safe, source-compatible, discoverable, and independently verifiable.
- **Evidence:** Existing Kanban boundaries use exact member allowlists, semantic snapshots, finite registries, redacted observations, one main barrel, locale/testing subpaths, specification/implementation test separation, native/browser fixtures, and plugin-impact synchronization.
- **Decision:** All untrusted state is exact-shape and limit validated before interpretation; IDs can select only registered functions; subscriber/callback failures isolate; saved filter secrets and draft values never enter events or observations. Production APIs export through the main barrel, with internal concern-based modules and existing locale/testing subpaths only. Evidence is specification-first and spans pure contracts, fuzz/migrations, mounted responsive dialogs, command-origin parity, async/stale lifecycle, host key behavior, performance bounds, and incrementally updated examples.
- **Rejected alternatives:** Trusting callbacks or stringifying arbitrary objects violates established boundaries; new subpaths fragment the canonical SDK; snapshot-only tests cannot prove lifecycle or interaction behavior.
- **Strongest counterargument:** The phase closure matrix is large and may slow iteration.
- **Confidence:** High for the safety/export/test direction; exact task partition may change if focused tests expose a smaller dependency surface.
- **Hardening:** The plan uses focused per-task gates and reserves the complete matrix for phase closure, matching project guidance without weakening evidence.
- **Policy version:** 1.
- **Root invocation ID:** `MP-PHASE-D-20260814T1058CEST`.
- **Reopen triggers:** Plugin impact mapping changes, a new production subpath becomes necessary for safe optional loading, or host fixtures cannot exercise resolved Primary behavior.

### AR-D25 — Registry and source authority (runtime)

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal interface partitioning within the approved view-controller and registered-behavior model; it changes neither product behavior nor application data ownership.
- **Objective:** Give chrome and saved-view reconciliation stable bounded metadata without creating a second record-evaluation pipeline.
- **Evidence:** Eager source adapters already own grouping, filter, search, and sort callbacks, while the planned controller owns only semantic state/query projection. The security oracle requires registry construction to reject hostile metadata without invoking accessors or evaluators.
- **Decision:** The view registry snapshots immutable quick-filter metadata and behavior references for lookup, without executing them during construction. Source adapters remain the sole record-evaluation authority. Comparator identities live additively on source sort fields and query directives; the board binding validates controller selections against the active source.
- **Rejected alternatives:** Copying every source evaluator into the view registry duplicates authority and risks divergent local/remote behavior. Making the registry an unvalidated callback bag violates the established exact-shape boundary.
- **Strongest counterargument:** Separating metadata lookup from source execution requires an explicit binding validation step before controller publication.
- **Confidence:** High — it follows the existing source/query split and makes the transaction boundary explicit.
- **Hardening:** The 10× and contrarian reframes considered a unified evaluator registry, but that design couples UI metadata to eager execution and cannot represent remote/windowed sources cleanly. The selected split remains smaller and source-compatible.
- **Policy version:** 1.
- **Root invocation ID:** `EP-PHASE-D-20260814T1231CEST`.
- **Reopen triggers:** A required quick-filter semantic cannot be expressed as source query filters, or remote sources need executable registry callbacks rather than inert IDs.

### AR-D26 — Transactional viewport-source activation (runtime)

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal availability, concurrency, and recovery mechanics inside the approved
  atomic view-publication behavior; public product behavior and source ownership remain unchanged.
- **Objective:** Preserve the last usable board when opening, validating, or projecting a candidate
  query fails, while keeping each successful transition to one source open and one subscriber delivery.
- **Evidence:** `KanbanQuerySession` exposes a synchronous atomic publication, but
  `KanbanViewportSource.refresh()` performs additional fallible geometry validation and cursor
  acquisition. UI `batch()` coalesces signal effects but provides no rollback. The current viewport
  independently calls `replaceQuery()` from its reactive effect, which would otherwise open twice.
- **Decision:** One exclusive generation-tagged internal controller binding stages a complete isolated
  `KanbanViewportSource`, validates its first publication, and performs one refresh using the candidate
  all-or-nothing facets and current viewport geometry. Commit is non-reentrant: install the prepared
  source/snapshot, batch controller/binding signals, let the viewport recognize the prepared revision,
  retire the exact captured old source, verify committed revision evidence, and only then notify external
  subscribers. Prepare failure or supersession disposes only the candidate. Existing standalone and
  controller-free query getters remain unchanged.
- **Rejected alternatives:** Session-only staging leaves later cursor/geometry failure outside rollback.
  Mutating the live viewport and attempting rollback cannot restore disposed cursors reliably. Treating
  `batch()` as a database transaction is unsound because its closing effect flush may throw.
- **Strongest counterargument:** A full candidate viewport source temporarily duplicates bounded session
  and cursor resources during the synchronous prepare window.
- **Confidence:** High — candidate retention is already bounded by the same viewport limits and the
  independent challenger identified and resolved the remaining activation-order and reentrancy hazards.
- **Hardening:** A blind Phase D grounding reviewer rejected session-only preparation, subscriber-before-
  retirement ordering, and rollback assumptions around `batch()`. The corrected design stages through
  current geometry, retires before callbacks, rejects nested commit, and keeps exact-generation ownership.
- **Policy version:** 1.
- **Root invocation ID:** `EP-PHASE-D-20260814T1231CEST`.
- **Reopen triggers:** Candidate refresh requires asynchronous readiness, source implementations cannot
  sustain two bounded sessions during prepare, or committed revision evidence cannot suppress the legacy
  reactive replacement without a second query open.

### AR-D27 — Phase 1 quality-review remediation (runtime)

- **Authority:** AI — delegated by `--auto-design`; no risk is waived.
- **Eligibility:** Implementation, source-query mapping, transaction consistency, reentrancy,
  presentation composition, eligibility, and geometry mechanisms inside the confirmed RD-09 behavior.
- **Objective:** Make every committed view facet effective and observer-atomic while preserving source
  evaluation authority, application geometry constraints, legacy query compatibility, and bounded work.
- **Evidence:** Three independent Phase 1 reviewers found seven unique Major defects, and primary
  consolidation found the required ordered summary-ID facet absent from the public model. Quick-filter state
  never reached a query; two presentation facets were inert; sorted moves bypassed ordering eligibility;
  width preferences expanded application limits; activation refreshed twice; subscriber delivery was
  recursively reentrant; and summary evidence lagged committed state/query delivery.
- **Decision:** Replace the new registry's unused per-card predicate with one declarative mapping to an
  existing `KanbanFilter` field/operator plus a fixed value or a codec-validated parameter. The controller
  binds the immutable registry, contains applicability/codec failures, combines explicit and derived
  filters under the existing query validator, and leaves all per-card evaluation in source adapters.
  Compose controller checklist/field/summary selection with the preserved legacy presentation and record callback,
  using the already approved two-item standard preview. Clamp effective widths without rewriting raw state.
  Apply sorted within-cell blocking before application eligibility. Consume the staged viewport snapshot
  exactly once, verify its generation/revision, commit coherent summary evidence before external delivery,
  and keep the transition guard active from query derivation through the complete subscriber pass. Abort
  if an application callback disposes the controller. Candidate preparation receives the prospective
  composed presentation and verifies that revision during activation. Operation eligibility snapshots the
  query around application policy, rejects a changed view, and reapplies package ordering afterward.
- **Rejected alternatives:** Adding parallel quick-filter directives to `KanbanQuery` would require every
  source implementation to add a second interpreter without a capability-negotiation seam. Arbitrary
  filter-builder callbacks permit output amplification and add a hostile executable-output boundary when
  one application-owned field/operator can express compound semantics. Retaining any finding would waive
  known incorrect behavior and is prohibited by the quality gate.
- **Strongest counterargument:** One declarative mapping may require an application to register a synthetic
  source operator for a named filter spanning several fields.
- **Confidence:** High — the existing filter contract already provides inert stable semantics and bounded
  eager/remote interpretation, and the independent challenger selected declarative mapping over both
  viable alternatives.
- **Hardening:** Correctness, security, and performance/concurrency/API reviewers independently audited the
  complete phase diff. A separate blind design challenge compared all viable quick-filter mechanisms and
  converged on the existing-filter mapping. The one permitted fix-scoped re-review found three additional
  Major callback/prospective-state gaps; all were accepted, corrected, and covered by red-then-green tests.
- **Policy version:** 1.
- **Root invocation ID:** `EP-PHASE-D-20260814T1231CEST`.
- **Reopen triggers:** An approved quick filter cannot be expressed by one source operator without semantic
  duplication, a remote protocol must retain original quick-filter identity for authorization, or source
  capability negotiation is added.

### AR-D28 — Saved-view safety budgets (runtime)

- **Authority:** AI — delegated by `--auto-design`; no security risk is waived.
- **Eligibility:** Resource ceilings and their internal derivation are security and performance
  mechanisms inside the already approved bounded saved-view format; product behavior and application
  storage ownership remain unchanged.
- **Objective:** Reject hostile allocation before retention while guaranteeing that every valid safe-class
  durable controller state can be captured, parsed, and canonically serialized under one coherent budget.
- **Evidence:** The semantic snapshot/canonicalizer already fixes safe/standard/absolute budgets for
  encoded bytes, depth, arrays, object keys, and strings. Safe controller structure permits enough
  columns, swimlanes, filters, and maximum-length identities that a separate 64 KiB envelope ceiling can
  reject valid captures.
- **Decision:** Saved-view JSON shape budgets reuse the exact semantic limit rows: encoded bytes
  262,144/1,048,576/4,194,304; depth 16/32/64; arrays 4,096/16,384/65,536; object keys
  256/1,024/4,096; and strings 16,384/65,536/262,144. Add saved-view-specific rows for migrations
  16/32/64, diagnostics 256/1,024/4,096, registered IDs 1,024/4,096/16,384, and extensions
  256/1,024/4,096. Untrusted parse APIs use the fixed safe projection; broader classes remain internal
  ceilings unless a later public policy explicitly authorizes them.
- **Rejected alternatives:** A 65,536-byte envelope cannot contain every otherwise-valid safe controller
  state. Larger saved semantic depth/key/string budgets would accept extension values that the shared
  semantic snapshot and serializer later reject. Refactoring the semantic walker to accept arbitrary
  profiles adds complexity without an approved public need.
- **Strongest counterargument:** A 262 KiB input permits more parser work per call than the initially
  proposed 64 KiB ceiling.
- **Confidence:** High — the final limits align with existing hardened traversal code and retain exact
  category-specific ceilings.
- **Hardening:** The independent challenger found both the valid-round-trip failure and parser/serializer
  acceptance mismatch in the initial proposal. The revised design incorporates both findings and keeps
  the untrusted entry point on the conservative safe class.
- **Policy version:** 1.
- **Root invocation ID:** `EP-PHASE-D-20260814T1443CEST`.
- **Reopen triggers:** A valid safe-class captured envelope exceeds the shared safe encoded budget, or
  saved-view canonicalization stops using the shared semantic-value validation path.

### AR-D29 — Saved-view delete confirmation policy (runtime)

- **Authority:** User — accepted the recommendation to preserve destructive confirmation.
- **Conflict:** The existing request contract requires confirmation for every `saved-view-delete`, while
  the new store oracle supplies no confirmer yet expects the delete to reach the dispatcher.
- **Recommendation:** Preserve the existing destructive confirmation policy and revise the store oracle
  to provide an approving confirmer. The store remains a proposal helper, not proof of user consent.
- **Alternative:** Formally define public `store.delete()` as already authorized and add a visible typed
  authority seam. This satisfies the new oracle but lets every programmatic store caller bypass the
  existing confirmation rule.
- **Rejected mechanism:** An internal WeakSet marker is neither confirmation evidence nor compatible with
  structural request cloning/queueing, and a retained marked object could be replayed later.
- **Hardening:** Independent security challenge classified the implicit bypass as Critical and the hidden
  object-identity capability as Major.
- **Decision:** The existing confirmation classification remains unchanged. Programmatic store deletion
  follows the same board authority path, and callers or package dialogs provide explicit confirmation at
  that boundary.
- **Root invocation ID:** `EP-PHASE-D-20260814T1443CEST`.
