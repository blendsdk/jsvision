# Ambiguity Register: JSVision i18n Implementation Plan

> **Status**: ✅ GATE PASSED — all 25 plan items resolved
> **Last Updated**: 2026-07-26 01:19 CEST
> **Planning Target**: `i18n/SET-I18N` (RD-01 through RD-04 as one implementation group)
> **Context Artifacts**: i18n requirements set, current UI/Forms/Files/Datagrid source and tests,
> BlendSDK `packages/i18n` source/tests, plugin generators and canonical skill
> **Modification Set**: this plan folder and the i18n feature traceability graph; requirements are
> approved read-only inputs
> **Mode**: auto-design
> **Root Invocation ID**: `i18n-20260725-01`
> **Policy Version**: 1

Requirements decisions AR-1…AR-29 remain authoritative in
`../../requirements/00-ambiguity-register.md`. This register records only implementation-plan
decisions discovered after the requirements gate.

| # | Category | Ambiguity / Gap | Options Considered | Decision | Status |
|---|---|---|---|---|---|
| 30 | Scope / planning | One plan per RD or one dependency-ordered feature plan? | Four plans / one planning group | One feature plan covering RD-01…RD-04 with four dependency-ordered phases | ✅ Resolved |
| 31 | Technical / files | How is `@jsvision/i18n` split into maintainable modules? | Monolithic translator / domain modules under 500 lines | Separate catalog, locale, validation, messages, service, source, diagnostics, cache, and Node-loader modules | ✅ Resolved |
| 32 | Security / parser | How are duplicate JSON members detected without a dependency? | `JSON.parse` / third-party parser / bounded internal recursive-descent parser | Small strict recursive-descent JSON parser in the Node entry, bounded before and during parse | ✅ Resolved |
| 33 | Data / state | What snapshot representation supports locale-first layered lookup and atomic replacement? | Nested objects / immutable Map snapshot / per-key mutable cache | Immutable Map-backed snapshot with precompiled message records and one copy-on-write overlay map | ✅ Resolved |
| 34 | Diagnostics | How are dedupe and bounds implemented? | Array scan / Set plus ring / unbounded Map | Ordered Map keyed by diagnostic identity, evict oldest past 100, optional sink isolated by try/catch | ✅ Resolved |
| 35 | Packaging | How are forty package-locale export families authored without drift? | Handwritten exports / generated locale modules / all-locale bundle | Checked source catalogs plus generated thin locale subpath entry modules and export-map verification | ✅ Resolved |
| 36 | Integration | Where is i18n carried through existing host seams? | Add to event loop / extend modal and composite hosts / global context | Store on Application; extend only hosts/composites that mint framework text; keep event loop and primitives locale-neutral | ✅ Resolved |
| 37 | Migration | How is the complete framework-string inventory enforced? | One-time manual list / checked manifest plus source scanner | Checked ownership manifest and conservative scanner that requires classification for candidate built-in literals | ✅ Resolved |
| 38 | UI / sequencing | In what order are localized composites migrated? | Package-wide bulk rewrite / shared UI foundations then dependent packages | UI application/dialog/date/control foundations first, then Forms, Files, and Datagrid | ✅ Resolved |
| 39 | Accelerators | What data structure validates co-occurrence scopes? | Infer from catalogs / package manifest | Package-owned manifest maps scope IDs to ordered message-key arrays; validator resolves labels per locale | ✅ Resolved |
| 40 | Testing | How are immutable specification tests partitioned? | One feature suite / package-local suites by RD behavior | Package-local `*.spec.test.ts` suites plus focused integration/package tests; internals in separate `*.impl.test.ts` | ✅ Resolved |
| 41 | Execution | What task size and sequence keeps auto-commit checkpoints reviewable? | Large phase commits / 1–3 file tasks and verified phase checkpoints | 1–3 file tasks, spec-red before code, immediate plan updates, focused verification per task, full phase quality loops | ✅ Resolved |
| 42 | Verification | Which command is authoritative? | Package checks / custom aggregate / project command | `yarn verify` is the final gate; focused package scripts are iteration gates; `yarn plugin:update` precedes plugin/full checks | ✅ Resolved |
| 43 | Legal / packaging | Where is BlendSDK attribution preserved? | README only / package notice plus README/changelog | Publish package-level third-party notice and cite it from README/changelog | ✅ Resolved |
| 44 | Quality / translations | When does human review occur relative to code integration? | Block all code first / draft then review before release phase completion | Implement catalogs as reviewable drafts, but keep RD-04/release incomplete until digest-bound proficient review exists | ✅ Resolved |
| 45 | Port boundary | Which BlendSDK implementation pieces are reused? | Literal package copy / concepts and suitable tests / dependency wrapper | Port translator/source/merge concepts and applicable behavioral tests; replace stdlib, plural tuples, permissive loader, and omit content files | ✅ Resolved |
| 46 | Testing / sequencing (runtime) | How are implementation tests kept after the green oracle when module tasks originally named them early? | Keep tests beside module tasks / defer all implementation tests into bounded hardening tasks | Remove `*.impl.test.ts` from implementation tasks; after the complete spec suite turns green, add six bounded implementation-test/documentation/verification tasks | ✅ Resolved |
| 47 | Node loader API / testing (runtime) | What are the public lower-limit names and deterministic race seam? | Short names / unit-explicit names; public adapter / internal hook | Use unit-explicit limit fields and a non-exported post-open test hook | ✅ Resolved |
| 48 | Security / resource bounds (runtime) | How do Phase 2 sources remain contained and bounded across races and aggregate inputs? | Path-only rechecks / identity-bound fail-closed handles; per-item limits / aggregate ceilings | Bind opened files to canonicalization-time identity, open POSIX targets non-blocking, use intrinsic abort operations, and enforce source-wide catalog/file/byte ceilings | ✅ Resolved |
| 49 | UI API / catalog keys (runtime) | What concrete service seams and UI key taxonomy can immutable Phase 3 tests pin? | Direct service parameter / new options objects / global context | Direct optional service for button factories, optional service on widget options, required host service for modal helpers, and stable semantic `ui.*` keys | ✅ Resolved |
| 50 | Dependency sequencing (runtime) | When are the four direct dependency declarations added? | Phase 3 together / defer consumer manifests to Phase 4 | Add all four manifests in Phase 3 so the accepted package-graph oracle can turn green before consumer localization | ✅ Resolved |
| 51 | Consumer API / catalog keys (runtime) | How does explicit i18n reach consumer widgets and pure Datagrid filter/collation functions? | Grid-only context / optional public seams / ambient global service | Add optional services to owning options and trailing pure-function parameters; hosts remain authoritative; omission preserves every current signature and behavior | ✅ Resolved |
| 52 | Accelerators / public validation (runtime) | How do consumers validate official scopes and how does one malformed app label fall back? | Internal-only manifests / public readonly manifests; catalog sanitization / package label fallback | Export one readonly manifest per package main entry; package label helpers reject only malformed translated labels and use English defaults; official collisions remain strict validation failures | ✅ Resolved |
| 53 | Files host compatibility (runtime) | Must every structural Files modal host add `i18n`, or may existing minimal hosts retain their public shape? | Required service / optional service with isolated English fallback | Keep `ExecHost.i18n` optional; applications pass their service, while legacy hosts receive isolated English text | ✅ Resolved |
| 54 | Translation-review testability (runtime) | How do specification tests inject approved, missing, stale, duplicate, and unapproved review evidence without coupling to repository paths? | CLI-only temporary repository / exported pure verifier plus thin CLI | Export pure normalized-digest and review-verification functions; the CLI supplies real package catalogs and the checked manifest | ✅ Resolved |

## Resolution Notes

Every entry below uses:

- **Authority:** AI — delegated by `--auto-design`
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`

**AR-30 — Planning group**

- **Eligibility:** Implementation sequencing within the approved four-RD feature scope.
- **Objective:** Preserve dependency order while avoiding four interacting plans and duplicated integration tasks.
- **Evidence:** RD-02 depends on RD-01, RD-03 on both, and RD-04 on all three.
- **Rejected alternatives:** Separate plans create cross-plan catalog/API coordination and cannot independently satisfy end-to-end acceptance.
- **Strongest counterargument:** One plan is larger; component specifications and phase checkpoints keep it bounded.
- **Confidence:** High.
- **Hardening:** Requirements challenger already converged on the cross-package architecture.
- **Reopen triggers:** One RD becomes independently blocked by a reserved decision.

**AR-31 — Module decomposition**

- **Eligibility:** Internal file architecture.
- **Objective:** Keep public logic junior-readable and source files below project size guidance.
- **Evidence:** BlendSDK's translator and loader are already near 300 lines before required hardening.
- **Rejected alternatives:** A monolith would exceed the expected 700-line split threshold; excessive one-function files obscure ownership.
- **Strongest counterargument:** More modules add imports; each selected module owns a coherent domain.
- **Confidence:** High.
- **Hardening:** No change after forced-reframing review.
- **Reopen triggers:** A module remains below 50 lines without independent responsibility or grows beyond 500 lines.

**AR-32 — Strict JSON parser**

- **Eligibility:** Parser/security mechanism within the approved zero-dependency strict-loader contract.
- **Objective:** Detect duplicate members and enforce depth/resource bounds before catalog conversion.
- **Evidence:** Native `JSON.parse` silently overwrites duplicate members and no dependency is permitted.
- **Rejected alternatives:** A third-party parser violates dependency goals; pre-scanning strings is incorrect around escapes.
- **Strongest counterargument:** Parser code is security-sensitive; a deliberately small JSON-only grammar plus property/adversarial tests is auditable.
- **Confidence:** Medium.
- **Hardening:** The independent requirements challenger specifically required duplicate detection.
- **Reopen triggers:** A zero-dependency platform strict parser becomes available or review finds grammar ambiguity.

**AR-33 — Snapshot representation**

- **Eligibility:** Data structure and consistency mechanism.
- **Objective:** Make translation lookup allocation-light and replacement atomic.
- **Evidence:** Lookup is synchronous and locale/layer order is fixed at publication.
- **Rejected alternatives:** Nested caller objects retain prototype/coercion risks; per-key mutation permits partial visibility.
- **Strongest counterargument:** Rebuilding a snapshot costs O(catalog size); catalog replacement is rare and outside the draw path.
- **Confidence:** High.
- **Hardening:** Requirements challenger converged.
- **Reopen triggers:** Catalogs exceed validated limits or background streaming enters scope.

**AR-34 — Diagnostic store**

- **Eligibility:** Bounded internal recovery mechanism.
- **Objective:** Deduplicate without unbounded memory and preserve deterministic inspection order.
- **Evidence:** The public bound is 100 records and diagnostics carry stable identity fields.
- **Rejected alternatives:** Array scan is O(n) per fault; an unbounded map violates the accepted bound.
- **Strongest counterargument:** Map reinsertion for recency is slightly more complex; diagnostics are cold-path.
- **Confidence:** High.
- **Hardening:** No change.
- **Reopen triggers:** Diagnostics need occurrence counts or persistence.

**AR-35 — Locale entry generation**

- **Eligibility:** Build/package mechanism within approved explicit subpath imports.
- **Objective:** Avoid hand-maintained export-map drift across four packages and ten locales.
- **Evidence:** Forty locale families plus package exports are mechanically repetitive.
- **Rejected alternatives:** Handwriting invites drift; one all-locale bundle violates tree-shaking.
- **Strongest counterargument:** Generated source adds tooling; generation is deterministic and verified in-tree.
- **Confidence:** High.
- **Hardening:** Requirements challenger emphasized bundle isolation.
- **Reopen triggers:** Package exports support a data-driven wildcard without losing declaration resolution.

**AR-36 — Host seam**

- **Eligibility:** Internal integration mechanism within explicit injection.
- **Objective:** Minimize locale coupling and preserve standalone composition.
- **Evidence:** Modal helpers already receive narrow hosts; EventLoop owns input/render policy, not application content.
- **Rejected alternatives:** Event-loop injection spreads i18n to primitives; global context violates requirements.
- **Strongest counterargument:** Several host interfaces need one new property; this is explicit and structurally typed.
- **Confidence:** High.
- **Hardening:** Requirements challenger identified ModalDialogHost as the key seam and converged.
- **Reopen triggers:** A general application-service container is introduced.

**AR-37 — Literal inventory**

- **Eligibility:** Migration/tooling mechanism.
- **Objective:** Detect omissions while allowing developer strings and caller data.
- **Evidence:** Repository scanning found hundreds of string candidates across package code.
- **Rejected alternatives:** A one-time list immediately drifts; an automatic rewrite cannot infer ownership safely.
- **Strongest counterargument:** A conservative scanner creates classification work; that work is the required ownership review.
- **Confidence:** Medium.
- **Hardening:** Challenger upgraded the inventory from a hand list to a checked manifest.
- **Reopen triggers:** TypeScript AST extraction provides a more precise stable classifier.

**AR-38 — Migration order**

- **Eligibility:** Implementation sequencing.
- **Objective:** Land the shared injection/default/layout primitives before dependent packages.
- **Evidence:** Forms, Files, and Datagrid all consume UI dialog/host/control behavior.
- **Rejected alternatives:** Bulk rewriting all packages makes regressions hard to isolate.
- **Strongest counterargument:** UI must expose enough stable API early; RD-01/02 specification tests pin that boundary.
- **Confidence:** High.
- **Hardening:** No change.
- **Reopen triggers:** A dependent package proves it can be migrated independently with fewer touched seams.

**AR-39 — Accelerator scopes**

- **Eligibility:** Validation data structure.
- **Objective:** Validate labels that actually coexist instead of global false-positive collisions.
- **Evidence:** Current validator consumes already-instantiated scope lists and cannot infer catalog co-occurrence.
- **Rejected alternatives:** Global key collision rejects unrelated screens; catalog-only inference lacks topology.
- **Strongest counterargument:** Manifests duplicate some UI composition knowledge; checked tests keep them aligned.
- **Confidence:** High.
- **Hardening:** Requirements challenger converged.
- **Reopen triggers:** UI composition metadata becomes machine-extractable.

**AR-40 — Test partition**

- **Eligibility:** Testing structure.
- **Objective:** Preserve requirement-oracle tests and package-local feedback.
- **Evidence:** Existing repository convention already separates `.spec.test.ts` and `.impl.test.ts`.
- **Rejected alternatives:** One feature suite creates cross-package build coupling and poor failure locality.
- **Strongest counterargument:** Cross-package behavior still needs integration tests; those are separately planned.
- **Confidence:** High.
- **Hardening:** No change.
- **Reopen triggers:** Vitest project boundaries prevent a required browser/package integration scenario.

**AR-41 — Task granularity**

- **Eligibility:** Execution sequencing.
- **Objective:** Make each auto-commit independently reviewable and recoverable.
- **Evidence:** The feature spans a new package, four consumers, docs, generated plugin content, and security tests.
- **Rejected alternatives:** Phase-sized commits mix concerns and make rollback unsafe.
- **Strongest counterargument:** More commits add overhead; auto-commit removes prompt latency and focused gates reduce rework.
- **Confidence:** High.
- **Hardening:** No change.
- **Reopen triggers:** A mechanical generated change cannot be split without leaving the tree invalid.

**AR-42 — Verification commands**

- **Eligibility:** Test-command selection from governing project configuration.
- **Objective:** Use the repository's actual authoritative gate.
- **Evidence:** Project guidance explicitly names `yarn verify`, focused package commands, `yarn plugin:update`, and `yarn plugin:check`.
- **Rejected alternatives:** A new aggregate command would duplicate existing policy.
- **Strongest counterargument:** Full verify is expensive per task; it remains phase/final while focused checks gate tasks.
- **Confidence:** High.
- **Hardening:** No change.
- **Reopen triggers:** Project guidance or root scripts change.

**AR-43 — Attribution artifact**

- **Eligibility:** Packaging mechanism within the user-authorized MIT port.
- **Objective:** Keep attribution in the published artifact even when consumers do not open repository history.
- **Evidence:** Package `files` controls published content and the BlendSDK package declares TrueSoftware B.V./MIT.
- **Rejected alternatives:** README-only attribution is easy to omit from downstream audits.
- **Strongest counterargument:** A notice adds one file; legal clarity outweighs negligible package size.
- **Confidence:** High.
- **Hardening:** No change.
- **Reopen triggers:** Authoritative upstream license text requires a different notice form.

**AR-44 — Translation review sequencing**

- **Eligibility:** Implementation sequencing within the user-defined human-review acceptance policy.
- **Objective:** Allow engine/integration progress without falsely declaring catalogs release-ready.
- **Evidence:** Proficient review is external evidence unavailable to code generation.
- **Rejected alternatives:** Blocking all code prevents reviewers seeing final context; accepting machine drafts violates the requirement.
- **Strongest counterargument:** The feature may stop late awaiting review; the plan makes the gate visible from the start and prepares digest-stable review artifacts early.
- **Confidence:** High.
- **Hardening:** No change.
- **Reopen triggers:** Reviewers are unavailable or the user changes the accepted translation-quality policy.

**AR-45 — Port boundary**

- **Eligibility:** Source-reuse mechanism within the authorized port.
- **Objective:** Reuse proven behavior and tests without inheriting incompatible contracts.
- **Evidence:** BlendSDK provides locale fallback, interpolation, merge/source abstractions, atomic catalog swap, and tests; its tuple plurals, coercion, loader, stdlib dependency, and content source conflict with approved requirements.
- **Rejected alternatives:** Literal copy fails the requirements; dependency wrapping gives JSVision no independent ownership.
- **Strongest counterargument:** A larger rewrite increases initial effort; specification-first tests protect behavioral intent.
- **Confidence:** High.
- **Hardening:** Independent challenger converged on a hardened owned implementation.
- **Reopen triggers:** A BlendSDK component is found to satisfy all JSVision contracts unchanged.

**AR-46 — Implementation-test ordering (runtime)**

- **Eligibility:** Testing and implementation sequencing within the already-approved behavior.
- **Objective:** Preserve the immutable-oracle order while keeping each auto-commit reviewable.
- **Evidence:** The execution protocol requires spec tests, red, implementation, green, then
  implementation tests; the original module tasks named `*.impl.test.ts` before the green task.
- **Rejected alternatives:** Keeping the mixed tasks violates the ordering gate; moving every
  implementation test into one task exceeds the accepted file/task granularity.
- **Strongest counterargument:** More hardening tasks add commits; they make failures attributable
  and prevent implementation-derived tests from influencing the specification oracle.
- **Confidence:** High.
- **Hardening:** Forced-reframing review found no product or API effect; this is the only sequence
  consistent with both testing and task-size policies.
- **Reopen triggers:** The specification-first protocol changes or a package test boundary makes a
  bounded hardening group impossible.

**AR-47 — Node loader limits and race seam (runtime)**

- **Authority:** AI delegated by `--auto-design`.
- **Eligibility:** Public option naming and internal test instrumentation within the approved
  rooted-loader behavior.
- **Objective:** Make caller-lowered resource limits self-explanatory and prove the file-replacement
  defense deterministically without exposing a production hook.
- **Decision:** `JsonFileSourceLimits` uses `maxFileBytes`, `maxMessages`, `maxKeyScalars`, and
  `maxMessageBytes`; every supplied value may lower but never raise its hard maximum. A
  non-package-exported Node test seam installs an `afterOpen` hook that runs after the candidate
  handle and metadata are checked but before bytes are read, then restores the prior hook.
- **Evidence:** The requirements define four independent maxima and require a deterministic
  replacement-race test, but intentionally do not authorize a consumer-facing filesystem
  abstraction.
- **Rejected alternatives:** Short field names obscure units; a public filesystem adapter expands
  the supported API and security boundary; a timing-only replacement test is nondeterministic.
- **Strongest counterargument:** A test hook adds internal state; the hook is unreachable through
  package exports, restored after each test, and never changes the checked-handle production path.
- **Confidence:** High.
- **Hardening:** The spec-author independently identified both gaps before implementation.
- **Policy version:** 1.
- **Reopen triggers:** A portable handle-based test mechanism removes the need for an internal hook,
  or a future loader adds another independently configurable resource dimension.

**AR-48 — Race containment and aggregate source bounds (runtime)**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Security, concurrency, data-structure, and resource-bound mechanisms within the
  approved rooted-loader and atomic source behavior.
- **Objective:** Prevent path replacement, blocking special-file swaps, hostile cancellation
  objects, and individually valid source results from escaping the approved containment and
  bounded-resource guarantees.
- **Decision:** Resolved paths retain canonicalization-time device/inode identity and fail closed
  when meaningful identity is unavailable; POSIX opens add non-blocking and no-follow flags before
  handle validation. Linux additionally proves containment from `/proc/self/fd/<fd>`, tying it to
  the opened object rather than a pathname snapshot. Abort state/listeners use captured platform
  intrinsics, Node rejects live proxies through its built-in proxy detector, and filesystem work
  checks cancellation between asynchronous operations. One atomic load starts at most 256 sources,
  publishes at most 10,000 catalogs, compiles at most 100,000 message/case templates, and compiles
  at most 16 MiB of message text. Built-in sources collectively inspect at most 100,000 directory
  entries, select at most 10,000 files, and accept at most 16 MiB of checked file bytes. Canonical
  directory aliases reuse one scan. Already validated catalogs carry a module-private weak brand
  and work metrics so each identity is validated once and charged before compilation.
- **Evidence:** The independent Phase 2 reviewers reproduced a parent-directory containment escape
  and measured aggregate source, glob, buffer, and parser amplification despite per-item limits.
  Existing engine limits already establish 10,000 catalogs/messages and a 16 MiB in-memory text
  ceiling, providing consistent internal ceilings without expanding public options.
- **Rejected alternatives:** Path-only post-open checks still race through replaced parents;
  component-by-component `openat` traversal has no portable Node API; keeping only per-item limits
  permits multiplicative exhaustion; a public filesystem adapter or new limit fields would expand
  the accepted API.
- **Strongest counterargument:** Fail-closed identity checks may reject unusual filesystems that
  report zero device/inode values; accepting an unverifiable handle would silently weaken the
  mandatory containment guarantee.
- **Confidence:** High.
- **Hardening:** Independent correctness, security, and performance reviews converged on the same
  containment and aggregate-bound failures. The selected correction preserves the public API and
  will receive the required one-time fix re-review.
- **Policy version:** 1.
- **Root invocation ID:** `i18n-20260725-01`.
- **Reopen triggers:** Node exposes portable directory-relative no-follow traversal, supported
  platforms lack meaningful stable file identity, or real application catalogs approach an
  aggregate ceiling.

**AR-49 — UI key and explicit-service seam (runtime)**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Reversible public parameter naming, catalog-key taxonomy, and test-fixture
  mechanism within the approved injection, ownership, precedence, and compatibility behavior.
- **Objective:** Give immutable Phase 3 specification tests a concrete contract without pulling
  Phase 4 locale exports forward or creating conflicting service sources.
- **Decision:** Standard button factories and their pair factories accept one direct optional
  `I18n`; existing widget option objects add `readonly i18n?: I18n`; modal and editor helpers use
  their required `host.i18n`. UI catalog keys use semantic `ui.action.*`, `ui.dialog.*`,
  `ui.calendar.*`, `ui.switch.*`, and `ui.editor.*` names fixed in the framework-integration
  specification, with lowercase dotted/kebab segments required by the engine grammar. Phase 3
  precedence tests define minimal Dutch/English catalogs in their fixture; those catalogs are test
  data, not official package exports.
- **Evidence:** Existing standard buttons are zero-argument factories, widgets already use options
  objects, and modal/editor helpers already share a narrow host. A direct optional button parameter
  preserves every existing call while letting internal hosted callers pass one authoritative
  service. Official locale subpaths are explicitly sequenced in Phase 4.
- **Rejected alternatives:** A new options object for button factories adds ceremony to a
  single-dependency seam and changes every future call shape; global service state violates the
  accepted application ownership model; adding a second modal-helper service permits disagreement
  with the host; exporting partial Dutch catalogs in Phase 3 crosses the accepted phase boundary.
- **Strongest counterargument:** A direct optional parameter leaves less room for future
  button-factory options; an options overload can be added compatibly if another independent
  concern appears.
- **Confidence:** High.
- **Hardening:** The independent specification author found the missing contract and stopped
  before encoding an implementation guess. Grounding against the current factories, widget
  options, and modal host converged on one authoritative service per call. The first collection
  run then rejected camelCase editor segments under the existing engine grammar; the contract was
  corrected to kebab-case before any component implementation.
- **Policy version:** 1.
- **Root invocation ID:** `i18n-20260725-01`.
- **Reopen triggers:** Standard button factories need another independent option, the engine's key
  grammar or UI key deprecation policy changes, or Phase 4 locale exports must ship before UI
  integration.

**AR-50 — Direct-dependency sequencing (runtime)**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Implementation sequencing within the already-approved direct-dependency
  boundary and unchanged package scope.
- **Objective:** Let the Phase 3 package-graph oracle pass before consumer localization work begins.
- **Decision:** Phase 3 task 3.2.1 adds `@jsvision/i18n` to UI, Forms, Files, and Datagrid manifests
  and updates the root lockfile. It still implements Application injection only in UI. Phase 4
  consumer tasks add catalogs and behavior but no longer introduce dependency metadata.
- **Evidence:** The accepted ST-32 oracle checks all four direct dependencies, while the execution
  plan requires the complete Phase 3 spec suite to pass before Phase 4. Delaying three manifests
  makes those two gates mutually exclusive.
- **Rejected alternatives:** Weakening ST-32 to UI-only contradicts the accepted requirement;
  leaving Phase 3 intentionally red violates specification-first phase completion; moving consumer
  implementation into Phase 3 destroys the accepted integration sequencing.
- **Strongest counterargument:** Three packages temporarily declare a dependency before importing
  it; the interval is one verified phase and keeps dependency ownership explicit without exposing
  incomplete localized behavior.
- **Confidence:** High.
- **Hardening:** Forced reframing found no product or API change; moving metadata is the only
  sequence that satisfies both existing gates without broadening implementation.
- **Policy version:** 1.
- **Root invocation ID:** `i18n-20260725-01`.
- **Reopen triggers:** ST-32 is reassigned to a later phase or package-manager policy rejects a
  temporarily unused direct dependency.

**AR-51 — Consumer service seams and representative keys (runtime)**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Reversible optional parameter placement and semantic catalog-key naming within
  the approved package ownership, explicit-service, caller-precedence, and compatibility contract.
- **Objective:** Give immutable Phase 4 tests a concrete public seam for consumer localization and
  locale-sensitive Datagrid filtering without introducing ambient state.
- **Decision:** FormDialog continues to use its required `host.i18n`. Files opener/error hosts gain
  required `i18n`; standalone FileDialog, ChDirDialog, and FileInfoPane options gain optional
  `i18n`. `EditableDataGridOptions` and `FilterPopupConfig` gain optional `i18n`; `filterRows` and
  `computeDistinct` gain one optional trailing `I18n` parameter, and the grid passes its service to
  both. Explicit filtering normalizes strings to NFC, applies locale-aware casing, and uses
  `I18n.compare` for framework-owned distinct ordering. Omitting the service preserves the current
  ambient collator and casing behavior. `sortRowsMulti` remains unchanged because general data
  ordering and custom column comparators are caller-owned, not a framework search affordance.
  `fmt.boolean(labels?, i18n?)` localizes only absent labels. Representative stable keys are
  `forms.action.ok`; `files.action.open/cancel/ok`, `files.dialog.error.title`,
  `files.error.invalid-file-name`, and `files.info.month.<name>.short`; and
  `datagrid.boolean.yes/no`, `datagrid.empty`, `datagrid.filter.action.apply/clear`, and
  `datagrid.personalize.action.save/reset`. Further package keys follow the same lowercase semantic
  namespace and are fixed by each English catalog.
- **Evidence:** Existing Forms and personalization APIs already carry `ModalDialogHost`; Files
  openers already carry a structurally similar host; File and Datagrid widgets already use options
  objects; the public pure functions have append-compatible trailing positions. The Phase 4
  implementation list includes `filter.ts` but not `sort.ts`, confirming that locale behavior is
  scoped to filtering and distinct-label collation.
- **Rejected alternatives:** A grid-only service leaves direct public pure-function callers unable
  to request locale behavior; a global service violates application isolation; changing
  `sortRowsMulti` broadens caller-data semantics and the planned modification set; a new context
  object breaks every pure-function call.
- **Strongest counterargument:** Optional service parameters enlarge several public signatures.
  They are append-only or optional option fields, preserve source compatibility, and make the
  locale boundary explicit at every independently callable surface.
- **Confidence:** High.
- **Hardening:** The independent spec author stopped before inventing a seam. Grounding against the
  current public signatures and planned file set ruled out global state and general sort changes.
- **Policy version:** 1.
- **Root invocation ID:** `i18n-20260725-01`.
- **Reopen triggers:** Locale-aware general data sorting becomes an explicit requirement, pure
  functions move behind the grid API, or Files replaces its modal host seam.

**AR-52 — Public accelerator manifests and per-label fallback (runtime)**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Public constant naming and internal fallback placement within the accepted
  accelerator validation, official hard-gate, and per-key application recovery behavior.
- **Objective:** Make official scopes verifiable through package APIs while ensuring one malformed
  application label cannot make a framework control unreachable.
- **Decision:** UI, Forms, Files, and Datagrid main entries export readonly
  `UI_ACCELERATOR_MANIFEST`, `FORMS_ACCELERATOR_MANIFEST`, `FILES_ACCELERATOR_MANIFEST`, and
  `DATAGRID_ACCELERATOR_MANIFEST` constants. Locale subpaths continue to export exactly one catalog.
  Package-internal label translation helpers accept the service, stable key, English default, and
  whether an accelerator is required. A translated label with malformed tilde markup, more than one
  marker, a non-ASCII accelerator, or no required marker is ignored for that key and the English
  default is rendered. Official catalogs are still validated with their full public manifest and
  fail on scoped collisions; runtime app collisions remain diagnosable validation warnings rather
  than silently rewriting unrelated keys.
- **Evidence:** Accelerator manifests are already browser-safe readonly data and are necessary for
  consumers to run the public strict validator. Locale subpaths have a one-catalog contract, so the
  manifests belong on package main entries. The engine validation API returns issues but deliberately
  does not mutate caller catalogs; the accepted requirements assign per-key recovery to runtime
  package helpers.
- **Rejected alternatives:** Keeping manifests internal prevents public strict validation and an
  immutable public oracle; exporting them from every locale subpath violates the single-catalog
  contract; changing `defineCatalog` to mutate or discard messages breaks the engine's atomic
  validation semantics; rejecting an entire application catalog loses valid unrelated overrides.
- **Strongest counterargument:** Four new public constants enlarge package surfaces. They are stable
  authoring metadata required by strict validation and contain no locale strings or Node dependency.
- **Confidence:** High.
- **Hardening:** The independent locale spec author stopped at the missing seam. Requirements and the
  engine specification explicitly place per-key recovery in package helpers, leaving one compatible
  boundary.
- **Policy version:** 1.
- **Root invocation ID:** `i18n-20260725-01`.
- **Reopen triggers:** Catalogs gain first-class validation metadata, the locale-subpath export
  contract changes, or application collision policy changes from warning to automatic repair.

**AR-53 — Files host compatibility (runtime)**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Reversible dependency-injection mechanism within the accepted application
  ownership and English-default behavior; public compatibility breaks remain reserved and are not
  delegated.
- **Objective:** Let application-created hosts provide translations without breaking existing
  structural Files hosts that only mount and execute modal views.
- **Decision:** `ExecHost.i18n` is optional. `openFile`, `changeDir`, and `errorBox` use the supplied
  service when present and otherwise create one isolated English Files service. Standalone dialog
  option services remain optional. This refines AR-51's required Files host field while preserving
  its explicit-service behavior for every Application.
- **Evidence:** Existing immutable opener specifications construct public structural hosts with
  only `loop` and `desktop`, and the package typecheck rejects a newly required property. The
  approved default locale is English, and per-instance English factories already prevent mutable
  overlay leakage.
- **Rejected alternatives:** Making the field required is a public compatibility break outside
  delegated authority; editing immutable existing specifications would weaken the established
  contract; ambient global state violates application isolation.
- **Strongest counterargument:** An omitted service can hide accidental failure to propagate an
  application's locale; the concrete Application always exposes `i18n`, and integration
  specifications verify propagation through the normal opener path.
- **Confidence:** High.
- **Hardening:** Forced reframing found no compatible alternative that preserves both structural
  host typing and explicit application injection; the fallback reuses the already-reviewed
  per-instance isolation pattern.
- **Policy version:** 1.
- **Root invocation ID:** `i18n-20260725-01`.
- **Reopen triggers:** A future major release explicitly removes structural-host compatibility, or
  all modal APIs adopt a nominal Application-only host.

**AR-54 — Translation-review testability (runtime)**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal script/test seam within the accepted digest-bound review policy; it
  does not define reviewer identity, approve translations, or weaken the release gate.
- **Objective:** Let immutable tests cover every review-evidence failure structurally without
  copying the repository or inventing hidden CLI path overrides.
- **Decision:** `scripts/check-i18n-reviews.mjs` exports a pure normalized catalog-digest function
  and a pure verifier that accepts catalog descriptors plus a parsed review manifest and returns
  structured issues. The executable entry point remains a thin adapter that loads the 36
  non-English official catalogs and `tools/i18n-translation-reviews.json`, formats issues, and sets
  a failing exit code. Review entries use schema 1 and identify package, locale, digest, reviewer
  reference, proficiency attestation, review date, and `approved` status. Tests construct catalog
  and manifest values directly.
- **Evidence:** Missing/stale/duplicate/unapproved cases need deterministic fixture injection.
  Existing repository-root CLI patterns would require copying package output or adding a hidden
  path override, while the digest and evidence decision is pure data validation.
- **Rejected alternatives:** CLI-only temporary roots couple tests to filesystem layout and make
  catalog loading part of every negative case; environment overrides add production behavior used
  only by tests; embedding fixtures in the executable prevents isolated validation.
- **Strongest counterargument:** Exporting script functions creates another callable surface. The
  script is repository tooling rather than a published package, and the pure boundary makes the
  release CLI smaller and more directly testable.
- **Confidence:** High — the separation follows existing deterministic generator/check tooling and
  introduces no runtime package API.
- **Hardening:** The independent spec author stopped rather than inventing a seam. Forced reframing
  favored a pure boundary under both minimal and expanded test budgets.
- **Policy version:** 1.
- **Root invocation ID:** `i18n-20260725-01`.
- **Reopen triggers:** Review evidence moves to a signed external service or the repository adopts a
  standard validation-tool harness with fixture injection.
