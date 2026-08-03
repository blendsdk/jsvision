## Preflight Report: Kanban Phase A Foundation

> **Status**: ✅ PREFLIGHT PASS — all 13 Iteration 1 findings resolved; final rescan found 0 open findings
> **Iteration**: 8 (authorized correction and complete rescans)
> **Artifact**: implementation plan at `codeops/features/kanban/plans/phase-a-foundation/`
> **Artifact Content Hash**: `sha256:3cf545a7a60c4fa6af69a1509b0724fd25631025eaf642c80848c7e86424e532`
> **Repository Revision**: `092259352a4a214cf57c0ef2b38478106c5322a7`
> **Codebase Grounded**: 17 source/configuration files examined; 32 plan/requirement/code references verified
> **Last Updated**: 2026-08-03

> **SAME-SESSION REVIEW:** This artifact was created in the current session. Same-agent bias risk is
> elevated. Independent clustered auditors and one fresh high-severity challenger were used, but a human
> architecture review or a fresh-session preflight is still advisable before this foundational public API
> is implemented.

### Codebase Context Summary

**Tech Stack:** Node 22+, ESM TypeScript, Yarn 1 workspaces, Turborepo, Vitest, JSVision Core/UI/Forms/i18n.

**Architecture:** Phase A creates a new specialist package from zero. The planned component is a
DSL-composed `Group` around one exact-cell viewport, backed by revisioned sparse query sessions and
application-owned data. Data Grid and Code Editor are the closest package, testing, i18n, and component
precedents.

**Key Files Examined:** the complete 12-document Phase A plan; RD-01 through RD-03 and the requirements
phase map; Kanban traceability and roadmap; UI `Group` and layout DSL; Data Grid and Code Editor component,
i18n, package, and Vitest configuration; Forms exports/types/package metadata; i18n service types and locale
generator; docs/plugin/i18n registries.

The deterministic readiness command was:

```text
python3 .../codeops_state.py readiness --root . --gate audit --target kanban/PLAN-PHASE-A
```

In Iteration 1 it returned `NOT READY` because the plan lacked required execution snapshots and
planned-test evidence. After authorized corrections, the same command returns `READY`.

### Summary by Dimension

Findings may affect more than one dimension; the table lists each dimension touched.

| # | Dimension | Findings | Highest Severity |
|---|---|---:|---|
| 1 | Ambiguities | 3 | 🟠 MAJOR |
| 2 | Implicit Assumptions | 4 | 🟠 MAJOR |
| 3 | Logical Contradictions | 2 | 🟠 MAJOR |
| 4 | Completeness Gaps | 4 | 🟠 MAJOR |
| 5 | Feasibility Concerns | 4 | 🟠 MAJOR |
| 6 | Security Blind Spots | 0 | — |
| 7 | Dependency Issues | 1 | 🟠 MAJOR |
| 8 | Ordering & Sequencing | 2 | 🟠 MAJOR |
| 9 | Edge Cases | 0 | — |
| 10 | Testability | 4 | 🟠 MAJOR |
| 11 | Scope Creep Indicators | 0 | — |
| 12 | Consistency | 5 | 🔴 CRITICAL |
| 13 | Codebase Alignment | 5 | 🟠 MAJOR |

### Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 CRITICAL | 1 | Resolved and rescanned |
| 🟠 MAJOR | 9 | Resolved and rescanned |
| 🟡 MINOR | 3 | Resolved and rescanned |
| 🔵 OBSERVATION | 0 | None |

---

### PF-001: Traceability is not audit-ready 🔴 CRITICAL

**Dimension:** Consistency, testability
**Location:** `codeops/features/kanban/traceability.json:5170-5185,5195-5217,5579-5609`
**Codebase Evidence:** The deterministic `readiness --gate audit` command returned `NOT READY`.
**The Problem:** `PLAN-PHASE-A` has only a plan-gate validation. Its planning group, all 59 task nodes,
and planned-test nodes lack the execution snapshots/evidence required by the audit gate. The current graph
cannot prove that the plan, tasks, tests, and upstream requirement revisions form a current frozen closure.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Use the deterministic CodeOps snapshot mechanism to refresh the exact planning group, planned tests, and 59 tasks, then rerun readiness. | Narrow, tool-owned, preserves existing graph evidence. | Requires updating the traceability artifact. |
| B | Deterministically regenerate the Phase A graph block, inspect its diff, then rerun readiness. | Repairs broader generator corruption if present. | Wider change and higher risk of unrelated graph churn. |

**Recommendation:** Option A. Use B only if targeted refresh proves the graph itself is corrupted.

**Confidence:** High. **Hardening:** Fresh challenger upheld the critical severity and selected targeted,
tool-driven refresh.

**User Decision:** Option A selected by the user on 2026-08-03. Targeted CodeOps snapshot refresh is
authorized as the resolution choice; artifact changes remain pending a separate instruction to apply fixes.

### PF-002: Phase A full-RD claims cross deferred owning phases 🟠 MAJOR

**Dimension:** Logical contradictions, completeness, testability
**Location:** `00-index.md:18-21`; `01-requirements.md:13-15,68-78`; `03-05-responsive-board-viewport.md:74-76`; `07-testing-strategy.md:73,93-94`
**Codebase Evidence:** `requirements/RD-01-package-public-architecture.md:35-41`, `requirements/RD-02-data-sources-query-model.md:188`, and `requirements/RD-03-responsive-layout-viewport.md:25-35,54-77,175-178`
**The Problem:** The plan claims complete RD-01, RD-02, and RD-03 while deferring behaviors those RDs
normatively require. RD-01 requires editor/configuration helpers and editor/saved-view/command/event
contracts. RD02-AC07 requires a neighboring ready cell to remain navigable/editable. RD-03 requires
dialog/lab/example DSL composition, automatic drag reveal, swimlane chrome, and active insertion geometry.
The planned RD02/RD03 tests weaken “editable” to “usable” and real AC06/AC07 hit behavior to reserved or
resting geometry. A green Phase A suite could therefore close RDs whose accepted behavior is absent.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Repartition the requirements so later owning RDs exclusively own later editor/command/drag/swimlane/docs behavior; define exact Phase A slices, re-preflight the changed requirements, and update plan/traceability. | Durable dependency model; preserves the approved Phase A product boundary and honest tests. | Requires a focused requirements amendment and another requirements preflight. |
| B | Keep the requirements unchanged, mark RD-01/RD-02/RD-03 partial, and trace only exact Phase A slices. | Smallest immediate correction; no product-scope expansion. | Leaves foundational downstream dependencies pointing at incomplete parent RDs. |
| C | Expand Phase A to implement all missing behavior. | Makes current full-RD claims literal. | Defeats the approved foundation scope and pulls work from later phases. |

**Recommendation:** Option A. It fixes the root ownership error without expanding Phase A. Option B is a
safe interim correction if requirements repartitioning is deferred.

**Confidence:** High. **Hardening:** The challenger merged three independent audit symptoms into this one
systemic root cause and rejected Phase A expansion as disproportionate.

**User Decision:** Option A selected by the user on 2026-08-03. Repartition requirements, define exact
Phase A slices, re-preflight the changed requirement set, and update plan/traceability.

### PF-003: Planned locale implementations occupy generator-owned files 🟠 MAJOR

**Dimension:** Codebase alignment, feasibility
**Location:** `03-01-package-public-contracts.md:28-38`; `99-execution-plan.md:86-93,134-135`
**Codebase Evidence:** `scripts/update-i18n-locales.mjs:54-57,99-126`; `packages/datagrid/src/i18n/catalog.ts:1-10,37-98`; `packages/datagrid/src/locales/en.ts:1-2`
**The Problem:** Phase 3 authors catalogs/translations directly in `src/locales/*.ts`, but the repository
locale generator owns those files, deletes unexpected names, and rewrites them as wrappers importing
`../i18n/locales.js`. Phase 5 generation would overwrite Phase 3 work and may emit imports from a module
the plan never creates.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Author `src/i18n/catalog.ts` and `src/i18n/locales.ts`; reserve `src/locales/*.ts` for generated wrappers. | Matches every official sibling package and current tooling. | Requires correcting Phase 3 paths/tasks. |
| B | Extend the shared generator to support directly authored locale modules. | Preserves current plan paths. | Expands shared tooling and creates a divergent package convention. |

**Recommendation:** Option A.

**Confidence:** High. **Hardening:** Fresh challenger verified the generator overwrite behavior and rejected
shared-generator expansion.

**User Decision:** Option A selected by the user on 2026-08-03. Follow the repository's authored-catalog
plus generated-wrapper convention.

### PF-004: Localized board behavior has no i18n injection seam 🟠 MAJOR

**Dimension:** Completeness, codebase alignment
**Location:** `03-01-package-public-contracts.md:102-117`; `03-04-cards-descriptors-theme-i18n.md:102-119`; `03-05-responsive-board-viewport.md:50-61,102-110`; `99-execution-plan.md:114-115`
**Codebase Evidence:** `packages/datagrid/src/grid.ts:67-75,477-480`; `packages/code-editor/src/ui/code-editor.ts:37-50,109-113`; `packages/i18n/src/types.ts:252-260`
**The Problem:** The board promises localized state, fallback, navigator, and runtime locale-sensitive
layout behavior, but `KanbanBoardOptions` has no `I18n` service or reactive replacement input. Importable
catalogs alone cannot make package-owned UI use a consumer's locale, and an `I18n` service's locale is
immutable.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add `i18n?: () => I18n`, with isolated English fallback and explicit layout/cache invalidation when the service changes. | Satisfies reactive locale claims and matches the plan's getter-based inputs. | Slightly more ceremony than sibling static options. |
| B | Add static `i18n?: I18n` and remove runtime locale-change claims from Phase A. | Matches current sibling construction ergonomics. | Defers mounted locale replacement and narrows current tests/claims. |

**Recommendation:** Option A because runtime locale changes are already part of the Phase A responsive matrix.

**Confidence:** High. **Hardening:** Fresh challenger upheld the finding and confirmed service replacement is
needed for reactivity.

**User Decision:** Option A selected by the user on 2026-08-03. Add a reactive i18n service getter with
English fallback and explicit invalidation semantics.

### PF-005: `revealCard` has no bounded offscreen lookup contract 🟠 MAJOR

**Dimension:** Feasibility, completeness
**Location:** `03-01-package-public-contracts.md:125-127`; `03-02-query-session-cursors.md:36-59,72-96`; `03-05-responsive-board-viewport.md:94-98`
**Codebase Evidence:** No existing Kanban implementation exists; the proposed source/session/cursor API is
the complete lookup surface, and it exposes no key-to-address/index locator.
**The Problem:** `revealCard(key)` promises bounded acquisition when a windowed source can locate an
offscreen key, but the proposed APIs can only read known cursor indexes. The board must either scan
forbidden ranges, always return unknown for offscreen identities, or invent an unplanned locator API.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add an optional abort-aware, revision-bound locator returning address and position/quality states. | Makes reveal implementable for eager and capable windowed sources without scanning. | Adds a public source contract that must be designed now. |
| B | Restrict Phase A reveal to retained cards and document/rename it accordingly. | Smaller API. | Weakens the stated imperative reveal capability and full RD-03 claim. |

**Recommendation:** Option A if responsive reveal remains in Phase A; otherwise combine B with PF-002's
slice-accurate scope correction.

**Confidence:** High. **Hardening:** Fresh challenger upheld the missing locator and favored the optional,
cancellable contract.

**User Decision:** Option A selected by the user on 2026-08-03. Add the bounded, abort-aware,
revision-bound locator contract.

### PF-006: Forms-backed schema reuse is not grounded in the Forms API 🟠 MAJOR

**Dimension:** Implicit assumptions, dependency issues, codebase alignment
**Location:** `02-current-state.md:66-70`; `03-01-package-public-contracts.md:21-24`; `99-execution-plan.md:86-88`
**Codebase Evidence:** `packages/forms/src/index.ts:1-8`; `packages/forms/src/types.ts:129-153`; `packages/forms/package.json:93-104`
**The Problem:** The plan says Forms supplies a reusable “standard-schema/Zod adapter,” but Forms exposes
form stores, bindings, and dialogs over caller-provided Zod object schemas. It has no generic schema
adapter to reuse. Because Phase A excludes forms/editors/dialogs, the executor would need to invent a
Forms integration or ship an unused runtime dependency merely to match the plan wording.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Define a Kanban-owned narrow Zod schema/validator if needed now; call it future Forms-compatible and omit `@jsvision/forms` until an actual import exists. Amend the RD dependency wording and re-preflight it. | Honest dependency surface; no invented Forms abstraction. | Requires a focused requirements correction. |
| B | Specify and implement a useful Forms-backed helper in Phase A. | Makes the Forms dependency real. | Pulls form/editor concerns into the read-only foundation. |

**Recommendation:** Option A.

**Confidence:** High. **Hardening:** Fresh challenger verified that the assumed public Forms abstraction does
not exist.

**User Decision:** Option A selected by the user on 2026-08-03. The first correction removed the false
Forms dependency. A later ownership rescan established that Phase A does not need runtime schema
validation, so RD-10 now introduces the Kanban-owned Zod adapter and Forms together.

### PF-007: The planned hosting E2E can be silently skipped 🟠 MAJOR

**Dimension:** Testability, codebase alignment
**Location:** `07-testing-strategy.md:19-35`; `99-execution-plan.md:43,107-110`
**Codebase Evidence:** `packages/datagrid/vitest.config.ts:3-29`; `packages/code-editor/vitest.config.ts:8-28`; `packages/datagrid/package.json:90`
**The Problem:** The plan names `test/e2e/board-hosting.spec.test.ts` as E2E, while sibling E2E projects
select only `test/**/*.e2e.test.ts`. Their scripts also permit no tests. The hosting suite could run in
the wrong project or `test:e2e` could pass with zero E2E coverage.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Rename it `test/e2e/board-hosting.e2e.test.ts` and make Kanban E2E fail when empty. | Matches repository convention and removes silent-skip risk. | Requires correcting two plan references and package script details. |
| B | Configure a Kanban-specific `test/e2e/**/*.spec.test.ts` include, exclude it from unit, and assert a non-empty suite. | Retains current filename. | Adds a needless specialist-package convention. |

**Recommendation:** Option A.

**Confidence:** High. **Hardening:** Fresh challenger upheld the discovery failure and strengthened the fix by
removing `--passWithNoTests` for Kanban.

**User Decision:** Option A selected by the user on 2026-08-03. Use the repository E2E filename convention
and prohibit an empty Kanban E2E run.

### PF-008: Execution tasks are not atomic enough for reliable plan execution 🟠 MAJOR

**Dimension:** Testability, ordering and sequencing
**Location:** `99-execution-plan.md:48,114-115,129-140`
**Codebase Evidence:** `packages/datagrid/src/grid.ts:357-510` already demonstrates how a specialist UI
component can accumulate many independent lifecycle responsibilities; current CodeOps guidance targets
small, independently verifiable tasks and splitting files before roughly 700 lines.
**The Problem:** Tasks 4.2.4 and 4.2.5 each combine many independently risky subsystems in two files, while
several Phase 5 tasks name only “owning suites,” “as applicable,” or no concrete targets. Per-task scope,
resume points, verification, and failure ownership are not deterministic.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Split viewport/board work by responsibility and name exact Phase 5 source/test/registry targets. Keep only phase-level aggregate verification tasks. | Bounded implementation and review checkpoints; lower oversized-file risk. | Increases task count. |
| B | Retain task IDs but add exact bounded substeps, target paths, and independent verification/evidence under each. | Less graph churn. | Still creates coarse completion units. |

**Recommendation:** Option A for implementation tasks; aggregate closeout tasks may remain broad.

**Confidence:** Medium-high. **Hardening:** This was the least certain high-severity finding; the challenger
retained MAJOR because it affects lifecycle-heavy UI and final integration work, not simple bookkeeping.

**User Decision:** Option A selected by the user on 2026-08-03. Split implementation work by responsibility
and resolve exact integration targets.

### PF-009: Packed-consumer evidence is authored after its behavior 🟠 MAJOR

**Dimension:** Ordering and sequencing, testability
**Location:** `07-testing-strategy.md:7-17`; `99-execution-plan.md:40-48,129-133`
**Codebase Evidence:** The repository's CodeOps testing policy requires requirements-derived specification
tests before implementation.
**The Problem:** Phase 1 implements the export map, dependency/peer behavior, and package barrel. Phase 5
then authors a new immutable packed-consumer specification for those same behaviors. Its red state would
reflect missing test plumbing, not absent product behavior, so the recorded chronology is not genuinely
spec-first.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Move the packed-consumer spec and minimal harness before Phase 1 package implementation; retain only the final packed rerun/integration closure in Phase 5. | Preserves the immutable-oracle policy and RD01-AC10 intent. | Requires early fixture scaffolding. |
| B | Keep Phase 1 canonical specs and classify Phase 5 packed work only as integration evidence, not a new immutable specification. | Smaller plan reordering. | Packed packaging behavior itself does not drive implementation red-first. |

**Recommendation:** Option A.

**Confidence:** High. **Hardening:** Fresh challenger upheld the sequencing defect.

**User Decision:** Option A selected by the user on 2026-08-03. Move the packed-consumer oracle and minimal
harness before package behavior; retain Phase 5 as the final integration rerun.

### PF-010: Eager grouping queries have no keyed grouping adapter 🟠 MAJOR

**Dimension:** Completeness, feasibility
**Location:** `03-02-query-session-cursors.md:8-12`; `03-03-eager-source-validation.md:10-22,52-63`
**Codebase Evidence:** No existing Kanban implementation can supply an implicit adapter; the proposed eager
options are the complete public construction contract.
**The Problem:** `KanbanQuery` selects a grouping field by stable ID and unknown grouping IDs must reject,
but `EagerKanbanSourceOptions` supplies only an unkeyed `swimlaneOf` callback. It cannot resolve or validate
the selected grouping field, nor later support multiple registered grouping choices without changing the
public API.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add a validated keyed grouping-field registry parallel to filter/sort fields; define or remove `swimlaneOf` accordingly. | Fulfils the current query contract and avoids later API churn. | Adds one more public adapter family now. |
| B | Remove grouping from Phase A queries/eager behavior and make it an explicit later slice. | Smaller Phase A implementation. | Requires PF-002 scope correction and narrows full RD-02 completion. |

**Recommendation:** Option A if RD-02 grouping remains Phase A scope; otherwise Option B only with the
slice-accurate correction.

**Confidence:** High. **Hardening:** Fresh challenger upheld the missing keyed seam.

**User Decision:** Option A selected by the user on 2026-08-03. Add a validated keyed grouping adapter
registry.

### PF-011: Locale review prose contradicts the controlling Phase A decision 🟡 MINOR

**Dimension:** Consistency
**Location:** `00-ambiguity-register.md:36,45,74-79,169-185`; `03-06-distribution-integration.md:44-53`; `99-execution-plan.md:133-135`
**Codebase Evidence:** `scripts/check-i18n-reviews.mjs` enforces current approved digest-bound evidence for
registered catalogs.
**The Problem:** PAR-24 and the execution plan require immediate approved Phase A catalog reviews, but the
earlier PAR-15 explanatory prose still says official review is withheld until RD-13. The later decision
controls, yet an implementer could document the release as provisional.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Mark the PAR-15 prose as superseded by PAR-24 and state that Phase A catalogs receive current bounded-vocabulary approval now. | One source of truth; matches the checker and tasks. | None beyond a small documentation edit. |

**Recommendation:** Option A. Provisional registration was considered and rejected by PAR-24, so no second
viable option remains.

**User Decision:** Authority: AI — delegated by `--auto-design`. Eligibility: terminology/documentation
consistency inside the user-approved immediate locale-review policy. Objective: preserve one truthful
catalog-review state. Decision: Option A; mark PAR-15's prose superseded by PAR-24. Evidence: PAR-24,
Phase 5, and the repository checker all require current digest approval. Rejected alternative: provisional
registration contradicts the controlling decision and checker. Strongest counterargument: preserving the
old prose records decision history, but the decision table already does so without an active contradiction.
Confidence: High. Hardening: the clustered consistency audit independently selected the same correction.
Policy version: 1. Root invocation ID: `AD-PREFLIGHT-PHASE-A-20260803T210259Z`. Reopen trigger: the
repository adopts a first-class provisional locale registry.

### PF-012: Viewport methods are mislabeled as the deferred command surface 🟡 MINOR

**Dimension:** Ambiguities, consistency
**Location:** `01-requirements.md:73`; `03-01-package-public-contracts.md:125-127`; `03-05-responsive-board-viewport.md:88-98`
**Codebase Evidence:** RD-01 distinguishes ordinary public methods from formal command contracts at
`requirements/RD-01-package-public-architecture.md:40-41`.
**The Problem:** The viewport document calls `scrollBy`, `scrollTo`, and `revealCard` “Public commands” even
though the formal command/event surface is explicitly deferred. This can trigger premature RD-12-style
registration/keymap work.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Rename the section to “Imperative viewport methods” and reserve “command” for the formal command API. | Removes ambiguity without changing behavior. | None. |

**Recommendation:** Option A.

**User Decision:** Authority: AI — delegated by `--auto-design`. Eligibility: public terminology cleanup
without behavior or compatibility change. Objective: prevent an ordinary method from being mistaken for
the deferred formal command system. Decision: Option A; rename the section to “Imperative viewport
methods.” Evidence: the plan and RD-01 distinguish methods from commands. Rejected alternative: adding a
formal command surface expands the confirmed phase. Strongest counterargument: “command” can be used
generically, but it is already a formal SDK term here. Confidence: High. Hardening: the ambiguity auditor
independently recommended the rename. Policy version: 1. Root invocation ID:
`AD-PREFLIGHT-PHASE-A-20260803T210259Z`. Reopen trigger: the formal command API moves into Phase A.

### PF-013: Passive card inspection geometry conflicts with the no-card-hit-target exclusion 🟡 MINOR

**Dimension:** Ambiguities, consistency
**Location:** `01-requirements.md:68-71`; `03-05-responsive-board-viewport.md:63-76`
**Codebase Evidence:** This is a plan-internal contract distinction; no Kanban implementation exists yet.
**The Problem:** Phase A excludes pointer hit targets for cards, while the viewport plan permits card
“observation regions” in its hit map. It does not say whether those regions are pointer-addressable,
test-only geometry, or future action targets. That affects public inspection APIs and mouse event routing.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Separate non-actionable inspection geometry from the pointer hit map; document that Phase A returns no actionable card target. | Preserves useful testing evidence and the approved interaction exclusion. | Adds one explicit geometry type/boundary. |
| B | Remove card observation regions entirely until the interaction phase. | Simplest active hit map. | Reduces Phase A geometry inspection evidence and may cause later API churn. |

**Recommendation:** Option A.

**User Decision:** Authority: AI — delegated by `--auto-design`. Eligibility: internal inspection/hit-map
boundary within the approved no-pointer-interaction phase. Objective: retain deterministic geometry evidence
without exposing actionable card targets. Decision: Option A; separate non-actionable inspection geometry
from the pointer hit map. Evidence: Phase A needs geometry inspection but explicitly excludes pointer card
targets. Rejected alternative: removing inspection regions increases later API churn and weakens layout
evidence. Strongest counterargument: two geometry representations add a small maintenance cost. Confidence:
High. Hardening: the testability and logic clusters confirmed active pointer behavior must stay deferred.
Policy version: 1. Root invocation ID: `AD-PREFLIGHT-PHASE-A-20260803T210259Z`. Reopen trigger: pointer
card targeting is intentionally pulled into Phase A.

---

### Hardening and audit conclusion

Five dimension clusters were audited independently. One fresh challenger reviewed the entire critical/
major batch without seeing the primary auditor's recommendations. It upheld every high-severity root cause,
merged the three full-RD symptoms into PF-002, and retained PF-008 at MAJOR with medium-high confidence.

No independent security-blind-spot, edge-case, or scope-creep finding was found. The bounded Phase A i18n,
theme, package docs, API, and plugin work is explicitly approved and repository-required; it is not scope
creep. The main contracts → sources → presentation → mounted board → distribution dependency sequence is
otherwise coherent, and the RD-04/RD-05 partial completion boundary is honest.

This was the Iteration 1 conclusion. The plan remained blocked until the authorized corrections and
complete rescans documented below were finished.

---

### Iterations 2–8 resolution evidence

| Finding | Result | Verified correction |
|---|---|---|
| PF-001 | ✅ Resolved | Kanban traceability has current semantic revisions, 64 task nodes, required snapshots, and `READY` audit gates for `PLAN-PHASE-A` and `SET-KANBAN` |
| PF-002 | ✅ Resolved | RD-01–03 and Phase A now separate foundational read behavior from later focus, drag, schema/editor, event/help, and documentation owners |
| PF-003 | ✅ Resolved | Authored catalogs live under `src/i18n/`; the locale generator alone owns `src/locales/*.ts` wrappers |
| PF-004 | ✅ Resolved | `KanbanViewportOptions`/`KanbanBoardOptions` provide a reactive `i18n` getter, isolated English fallback, and one-reflow replacement semantics |
| PF-005 | ✅ Resolved | Query sessions expose an optional bounded, cancellable, revision-bound `locateCard` result without card bodies or scans |
| PF-006 | ✅ Resolved | Phase A has no Forms/Zod dependency; RD-10 owns the Kanban Zod adapter and Forms integration |
| PF-007 | ✅ Resolved | Hosting coverage uses `test/e2e/board-hosting.e2e.test.ts` and the Kanban E2E command cannot pass with zero tests |
| PF-008 | ✅ Resolved | The plan contains 64 responsibility-scoped tasks with exact owning paths and deterministic resume points |
| PF-009 | ✅ Resolved | The packed-consumer oracle and isolated fixture are authored red before package metadata/implementation |
| PF-010 | ✅ Resolved | Eager grouping uses a validated keyed field registry rather than one unkeyed callback |
| PF-011 | ✅ Resolved | Locale-review prose follows PAR-15 and requires current digest-bound review evidence |
| PF-012 | ✅ Resolved | Viewport imperative methods are no longer mislabeled as the deferred public command surface |
| PF-013 | ✅ Resolved | Non-actionable inspection geometry is separate from the Phase A pointer hit map |

The rescans also caught and corrected residual cross-phase wording, the windowed locator requirement,
criterion-count drift, exact Phase 5 modification targets, the standalone `KanbanViewport`
options/coordinator lifecycle, and every specification's single owning green phase. The final oracle map
separates pure contract/source/descriptor checks from normative mounted and distribution evidence, and
ST-R01-01 now has an exact isolated NodeNext consumer fixture. These were verification refinements of the
accepted findings, not new product scope.

### Final verification

| Check | Result |
|---|---|
| CodeOps audit readiness: `kanban/PLAN-PHASE-A` | `READY` — 0 blockers, 0 problems, 137-node closure |
| CodeOps audit readiness: `kanban/SET-KANBAN` | `READY` — 0 blockers, 0 problems, 101-node closure |
| Execution plan task count | 64 tasks across five phases |
| Immutable Phase A acceptance oracle | 51 criteria plus plan-level invariants |
| Final independent clustered rescan | 0 open critical, major, or minor findings |

### Verdict

**✅ PREFLIGHT PASS — zero critical, major, or minor findings remain open.**

The Phase A plan may advance to `Plan Preflighted`. It remains intentionally foundational: later RDs
retain focus/navigation, pointer drag/drop, card editing, event/help surfaces, full accessibility, and
the flagship documentation/kitchen-sink implementation.
