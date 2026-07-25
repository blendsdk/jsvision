# Ambiguity Register: JSVision i18n Implementation Plan

> **Status**: ✅ GATE PASSED — all 17 plan items resolved
> **Last Updated**: 2026-07-25 08:13 CEST
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
