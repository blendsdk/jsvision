## Preflight Report: Escape to Revert

> **Status**: ✅ PREFLIGHT PASSED — all findings resolved and all gates clean
> **Iteration**: 3 (bounded corrective scan)
> **Previous Iterations**: Iteration 1 found 8 issues; iteration 2 reopened PF-002/PF-004 and added PF-009
> **This Iteration**: PF-002, PF-004, and PF-009 closed; 0 new findings
> **Carried Forward**: none
> **Artifact**: plan at codeops/features/datagrid-row-revert/plans/escape-to-revert/
> **Artifact Revision**: sha256:31dc5dbd59658165feeefc2beb86ab4e5e9c73d8bdd003c5dd2e11c6ba4780b4
> **Codebase Grounded**: 23 source/configuration/documentation files examined, 38 artifact references verified
> **Last Updated**: 2026-08-04
> **Mode**: strict scope; auto-design policy version 1
> **Root Invocation ID**: preflight-datagrid-row-revert-20260804

This artifact was created earlier in the same logical session. Iterations 1 and 2 used five
independent dimension clusters each; iteration 3 used two direct corrective reviewers. Two blind
challengers hardened the consequential finding batches. Reviewers did not edit the artifact.

### Codebase Context Summary

**Tech Stack:** Node 22+, ESM TypeScript, Yarn 1 workspaces, Turborepo, Vitest.

**Architecture:** EditableDataGrid coordinates cell editing, optimistic commit callbacks,
row-leave validation, keymap routing, reactive source reconciliation, and caller-owned row objects.
The proposed feature adds a per-row session and an optimistic asynchronous row rollback transaction.

**Key Files Examined:** packages/datagrid/src/commit.ts, editing.ts, validation.ts, keymap.ts,
editable-grid-rows.ts, grid.ts, data-source.ts, row-mutations.ts, column.ts, index.ts, Data Grid
tests and docs examples, scripts/check-i18n-reviews.mjs, tools/i18n-translation-reviews.json,
tools/jsvision-plugin-impact.json, and the relevant package manifests.

**Selected Domain Lenses:** concurrent/asynchronous settlement and public SDK compatibility.
Compiler, financial, and general web-application lenses were not applicable.

### Deterministic Readiness Result

Feature-local traceability validation is clean, semantic revisions are synchronized, and all
required relationship snapshots are present. The authorized portfolio repair reconciled 118 stale
semantic revisions and their dependent validation snapshots in the clipboard-native, code-editor,
and i18n graphs without changing authored semantics or lifecycle statuses. Full portfolio
validation then passed with zero problems.

The guarded draft-to-approved compare-and-swap transition committed successfully. Plan-gate and
audit-gate readiness both pass with zero blockers.

### Summary by Dimension

| # | Dimension | Open Findings | Result |
|---:|---|---:|---|
| 1 | Ambiguities | 0 | Clean |
| 2 | Implicit Assumptions | 0 | Clean |
| 3 | Logical Contradictions | 0 | Clean |
| 4 | Completeness Gaps | 0 | Clean |
| 5 | Consistency | 0 | Clean |
| 6 | Dependency Issues | 0 | Clean |
| 7 | Ordering & Sequencing | 0 | Clean |
| 8 | Security | 0 | Clean |
| 9 | Edge Cases | 0 | Clean |
| 10 | Testability | 0 | Clean |
| 11 | Feasibility | 0 | Clean |
| 12 | Scope Creep | 0 | Clean |
| 13 | Codebase Alignment | 0 | Clean |

### Summary by Severity

| Severity | Historical Count | Current Status |
|---|---:|---|
| 🔴 Critical | 0 | None |
| 🟠 Major | 6 | All resolved and verified |
| 🟡 Minor | 3 | All resolved and verified |
| 🔵 Observation | 0 | None |

---

### PF-001: Explicit rollback callback can be bypassed 🟠 MAJOR

**Dimensions:** Logical Contradictions, Consistency, Edge Cases, Feasibility

**Location:** 01-requirements.md:25-28; 03-02-rollback-transaction-and-input.md:58,72-73;
07-testing-strategy.md:49-50.

**Codebase Evidence:** packages/datagrid/src/commit.ts:87-117 and
packages/datagrid/src/grid.ts:100-123 show independently optional callback seams.

**The Problem:** R4 and ST-10 require exactly one supplied onRevertRow decision, but transaction
step 4 internally accepts whenever beforeSave and onCommit are absent. A caller can therefore
provide onRevertRow and have it silently ignored.

**Resolution:** Use explicit precedence: invoke onRevertRow exactly once whenever supplied; when it
is absent, accept internally only if both beforeSave and onCommit are absent; otherwise consume
Escape, retain the trap/session, and report rollback unavailable. Add a specification case with
validateRow and onRevertRow but no per-cell callback.

**Rejected Alternatives:** Always treating a grid without per-cell callbacks as local-only makes an
explicit public callback inert and contradicts R4/ST-10. Requiring onRevertRow for every grid
contradicts the confirmed in-memory fallback.

**Authority:** AI — delegated by --auto-design.
**Eligibility:** Implementation and callback-precedence mechanism within confirmed AR-5/AR-8
behavior; no product or scope change.
**Objective:** Preserve explicit host authority without removing the pure in-memory fallback.
**Evidence:** The plan contradiction above and the current independent optional callback design.
**Strongest Counterargument:** AR-8 can be read as making every no-per-cell-callback grid local-only;
that reading cannot coexist with R4 and ST-10.
**Confidence:** High — reopen if onRevertRow is intentionally made conditional on another option.
**Hardening:** Independent challenger upheld the finding and selected the same three-way precedence.
**Policy Version:** 1.
**Root Invocation ID:** preflight-datagrid-row-revert-20260804.
**Resolution State:** Resolved — applied and verified by bounded re-scan.

### PF-002: Stale settlement suppresses required veto compensation 🟠 MAJOR

**Dimensions:** Logical Contradictions, Consistency, Edge Cases, Testability, Feasibility

**Location:** 01-requirements.md:29-35; 03-01-row-edit-sessions.md:140-165;
03-02-rollback-transaction-and-input.md:70-79,155; 07-testing-strategy.md:43,53.

**Codebase Evidence:** packages/datagrid/src/data-source.ts:121-123 establishes caller-owned stable
row references. packages/datagrid/src/commit.ts:98-115 applies optimistically and compensates its
original row on veto.

**The Problem:** Baselines are applied before awaiting onRevertRow, but deletion, replacement, or
disposal makes the attempt stale and forbids every later mutation. A later veto then leaves the
caller-owned original row at the rollback baseline even though persistence rejected that rollback.
ST-9 does not distinguish acceptance from veto. Attempt ownership of dirty bookkeeping is also
underspecified for a same-key replacement.

**Resolution:** Separate transaction data settlement from UI/session settlement. A veto compensates
the captured original row through the captured transaction even after detachment or disposal.
Identity and disposal guards suppress only replacement-row, focus, message, dirty/error registry,
session, and repaint work. Acceptance performs no late data write. Registry entries must be
attempt-owned and deterministically detached before replacement state can inherit a key. Split ST-9
into accepted and vetoed cases.

**Rejected Alternatives:** Suppressing compensation silently turns host veto into acceptance.
Deferring baseline application changes confirmed optimistic timing and payload semantics. Treating
invalidation as acceptance overrides false, throw, or rejection.

**Authority:** AI — delegated by --auto-design.
**Eligibility:** Concurrency, consistency, and recovery design inside the confirmed optimistic
rollback contract.
**Objective:** Keep the row model coherent with host persistence without mutating replacement or
disposed UI state.
**Evidence:** Caller-owned row identity, existing optimistic compensation precedent, and the
contradictory stale rules above.
**Strongest Counterargument:** Mutating a detached row appears to violate the no-removed-row-write
oracle; however that row was already mutated before invalidation, so compensation is the only
coherent response to a veto.
**Confidence:** High — reopen if a cancellation contract or acceptance-first protocol is approved.
**Hardening:** Independent challenger upheld the split-settlement design and identified
attempt-owned dirty bookkeeping as part of the same root cause.
**Policy Version:** 1.
**Root Invocation ID:** preflight-datagrid-row-revert-20260804.
**Resolution State:** Resolved — applied and verified by bounded re-scan.

### PF-003: Source-reset invalidation is unobservable 🟠 MAJOR

**Dimensions:** Ambiguities, Implicit Assumptions, Feasibility, Testability, Codebase Alignment

**Location:** 00-ambiguity-register.md:14; 01-requirements.md:33-35,123-124;
03-01-row-edit-sessions.md:137-142; 07-testing-strategy.md:41-43,106.

**Codebase Evidence:** packages/datagrid/src/data-source.ts:22-67 exposes row reads and an optional
reactive revision, but no reset epoch. Its stable-reference contract is documented at lines 110-162.

**The Problem:** A new collection containing the same keys and exact row objects is
indistinguishable from sorting, filtering, paging, or ordinary reactive republication. C9 therefore
cannot prove unconditional source-reset invalidation without expanding the source protocol.

**Resolution:** Define session continuity by stable row key plus object identity. Disappearance,
key change/reuse, or object replacement invalidates; replacing only the collection container while
preserving exact row identities retains the session. Add a specification fixture for that boundary.

**Rejected Alternatives:** Using revision as a reset signal would invalidate sessions on ordinary
reactive arrivals. Adding a reset epoch is a broader public source-protocol change excluded by the
confirmed scope.

**Authority:** AI — delegated by --auto-design.
**Eligibility:** Internal identity and lifecycle semantics constrained by the existing public data
source contract.
**Objective:** Make C9 deterministic without adding unrelated SDK surface.
**Evidence:** GridDataSource has no observable reset identity and the plan already selected key plus
object identity.
**Strongest Counterargument:** AR-7 names source reset explicitly; its literal form is impossible to
observe under the retained source API.
**Confidence:** High — reopen if same-object semantic resets must intentionally discard sessions.
**Hardening:** Independent challenger upheld identity continuity and rejected revision inference.
**Policy Version:** 1.
**Root Invocation ID:** preflight-datagrid-row-revert-20260804.
**Resolution State:** Resolved — applied and verified by bounded re-scan.

### PF-004: Atomic rollback relies on an undocumented setter precondition 🟠 MAJOR

**Dimensions:** Implicit Assumptions, Edge Cases, Feasibility, Testability, Codebase Alignment

**Location:** 00-ambiguity-register.md:33; 03-02-rollback-transaction-and-input.md:70-83;
07-testing-strategy.md:49-55,92-96; 99-execution-plan.md:93-105.

**Codebase Evidence:** packages/datagrid/src/column.ts:45-50 does not promise that GridColumn.set is
non-throwing. packages/datagrid/src/commit.ts:97-115 invokes optimistic apply and compensation
setters without isolation.

**The Problem:** A throw from the second setter can leave a multi-cell transaction partially
applied before onRevertRow is called. The plan asserts an existing synchronous/non-throwing
contract, but neither the public API nor its tests make that obligation durable.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Document the trusted synchronous/non-throwing precondition only | Smallest compatibility-preserving change | A violated precondition can still escape the input path with partial writes |
| B | Document the precondition and add bounded best-effort prefix recovery | Contains event-loop failure and cleans pending state | Cannot promise strong atomicity if recovery setters also throw |

**Recommendation:** Option B. Guarantee row-level atomicity for conforming setters; on apply
failure, do not call onRevertRow, best-effort restore the applied prefix in reverse order, end
pending state, invalidate the untrustworthy session, and surface only package-owned bounded text.
Add apply-throw and compensation-throw implementation tests and update the public column contract.

**Rejected Alternatives:** Generic shallow-clone staging is unsafe for nested or accessor-based
models. A transactional data-source API is disproportionate public-surface expansion.

**Authority:** AI — delegated by --auto-design.
**Eligibility:** Failure/recovery mechanism and test strategy under the already confirmed trusted
setter assumption.
**Objective:** Bound a new multi-cell partial-write hazard without claiming impossible atomicity
for a host that violates its contract.
**Evidence:** The public setter contract and unguarded current commit path above.
**Strongest Counterargument:** Existing single-cell commit already lets setter exceptions escape,
so Option A preserves precedent. Multi-cell rollback amplifies that failure into a partial row,
which justifies bounded cleanup.
**Confidence:** Medium-high — reopen if setters intentionally perform fallible or asynchronous I/O.
**Hardening:** Independent challenger changed a precondition-only resolution into Option B's
precondition plus bounded recovery.
**Policy Version:** 1.
**Root Invocation ID:** preflight-datagrid-row-revert-20260804.
**Resolution State:** Resolved — applied and verified by bounded re-scan.

### PF-005: Locale work omits digest-bound review evidence 🟠 MAJOR

**Dimensions:** Completeness Gaps, Dependency Issues, Testability, Codebase Alignment

**Location:** 03-03-documentation-and-distribution.md:77-87;
07-testing-strategy.md:61-72,135-145; 99-execution-plan.md:93-110,143-146.

**Codebase Evidence:** scripts/check-i18n-reviews.mjs:144-175 rejects missing or stale catalog
digests. package.json:27,42 defines yarn i18n:reviews:check and runs it before lockstep versioning.
Current Data Grid entries are in tools/i18n-translation-reviews.json.

**The Problem:** Adding four keys changes every affected catalog digest. Locale completeness can
pass while review evidence is stale, the plan's reviewed-translation claim is false, and release
preparation fails.

**Resolution:** Complete translation review atomically with the Phase 2 locale work, refresh every
affected Data Grid entry in tools/i18n-translation-reviews.json after text is final, and run
yarn i18n:reviews:check after the package build.

**Rejected Alternatives:** Deferral contradicts the reviewed deliverable and knowingly leaves the
release gate failing. Removing the claim does not remove repository release policy.

**Authority:** AI — delegated by --auto-design.
**Eligibility:** Verification and delivery sequencing within already approved localization scope.
**Objective:** Deliver reviewable catalogs that satisfy the repository's release evidence policy.
**Evidence:** Digest validation and release scripts above.
**Strongest Counterargument:** This is a release gate, not the ordinary changed-file gate; the
feature nevertheless changes the exact digest-bound inputs and claims they are reviewed.
**Confidence:** High — reopen if repository policy stops requiring digest-bound locale reviews.
**Hardening:** Independent challenger upheld same-phase review and verification.
**Policy Version:** 1.
**Root Invocation ID:** preflight-datagrid-row-revert-20260804.
**Resolution State:** Resolved — applied and verified by bounded re-scan.

### PF-006: Repaint budget contradicts veto behavior 🟡 MINOR

**Dimension:** Consistency

**Location:** 01-requirements.md:49,73; 03-02-rollback-transaction-and-input.md:70,78,163.

**The Problem:** R13 promises one version bump per attempt, while a vetoed optimistic attempt
requires one bump for baseline application and another for compensation.

**Resolution:** State at most one coherent bump per mutation stage: one for accepted/internal
rollback and two for callback veto.

**Rejected Alternatives:** One bump for the entire vetoed attempt would hide either optimistic
application or compensation from reactive consumers.

**Authority:** AI — delegated by --auto-design.
**Eligibility:** Internal repaint wording and verification.
**Objective:** Align the performance requirement with observable transaction stages.
**Evidence:** The detailed transaction flow already specifies both stages.
**Strongest Counterargument:** Coalescing could theoretically render once after settlement, but
that would conceal the confirmed optimistic state.
**Confidence:** High.
**Hardening:** Confirmed independently by the consistency cluster; no Major-only challenge required.
**Policy Version:** 1.
**Root Invocation ID:** preflight-datagrid-row-revert-20260804.
**Reopen Triggers:** A non-observable optimistic protocol is approved.
**Resolution State:** Resolved — applied and verified by bounded re-scan.

### PF-007: Mutation integration path does not exist 🟡 MINOR

**Dimensions:** Consistency, Feasibility, Codebase Alignment

**Location:** 03-01-row-edit-sessions.md:154.

**Codebase Evidence:** The actual controller is packages/datagrid/src/row-mutations.ts; the public
wrapper is EditableDataGrid.deleteRows in packages/datagrid/src/grid.ts:1891-1892.

**The Problem:** The plan names grid-mutations.ts, which can send execution toward a phantom module.

**Resolution:** Replace it with row-mutations.ts and precisely describe guarding
EditableDataGrid.deleteRows before delegation.

**Authority:** AI — delegated by --auto-design.
**Eligibility:** Mechanical codebase-alignment correction.
**Objective:** Keep execution references exact.
**Evidence:** Repository path and wrapper above.
**Rejected Alternatives:** Creating a new module solely to match the typo adds needless structure.
**Strongest Counterargument:** None material.
**Confidence:** High.
**Hardening:** Confirmed by three independent clusters.
**Policy Version:** 1.
**Root Invocation ID:** preflight-datagrid-row-revert-20260804.
**Reopen Triggers:** Mutation ownership is refactored before execution.
**Resolution State:** Resolved — applied and verified by bounded re-scan.

### PF-008: Coverage percentages are not measurable 🟡 MINOR

**Dimension:** Testability

**Location:** 07-testing-strategy.md:15-21,135-145.

**Codebase Evidence:** packages/datagrid/package.json:86-92 runs Vitest without a coverage command
or configured feature threshold.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Remove the percentages and rely on requirement-to-spec mapping | Uses existing verifiable gates | No numeric coverage claim |
| B | Add a coverage command, metric, and threshold | Makes percentages measurable | Adds feature-unrelated coverage infrastructure |

**Recommendation:** Option A. Preserve the detailed ST mapping and avoid inventing coverage
infrastructure for this issue.

**Authority:** AI — delegated by --auto-design.
**Eligibility:** Test-evidence design within confirmed acceptance criteria.
**Objective:** Keep every stated gate reproducible.
**Evidence:** No current command measures the stated percentages.
**Rejected Alternatives:** Option B is viable but disproportionate to issue #100.
**Strongest Counterargument:** Numeric targets can discourage under-testing; unmeasured targets
cannot serve as acceptance evidence.
**Confidence:** High.
**Hardening:** Independent testability review confirmed the mismatch.
**Policy Version:** 1.
**Root Invocation ID:** preflight-datagrid-row-revert-20260804.
**Reopen Triggers:** The package adopts a maintained coverage gate before execution.
**Resolution State:** Resolved — applied and verified by bounded re-scan.

### PF-009: Phase ordering required green behavior before its dependencies 🟠 MAJOR

**Dimensions:** Ordering & Sequencing, Testability, Dependency Issues

**Location:** 07-testing-strategy.md specification matrix;
99-execution-plan.md phases and specification-first tasks.

**Codebase Evidence:** packages/datagrid/src/keymap.ts and editable-grid-rows.ts do not yet contain
the revertRow action/routing, and commit.ts contains no row transaction. The original Phase 1
therefore could not make Escape and pending-callback oracles green before Phase 2.

**The Problem:** The original Phase 1 required ST-1–ST-9B to pass after implementing only session
state, even though those public cases require the body action, optimistic transaction, callback,
compensation, and stale settlement assigned to Phase 2. ST-11/ST-16/ST-17 file ownership was also
missing from the Phase 2 authoring task. A later direct scan found the same sequencing problem for
the source portion of ST-27.

**Resolution:** Use three honest vertical phases. Phase 1 authors ST-1–ST-23 and public-source
ST-27A, observes them red, implements the complete row-recovery behavior, then makes them green.
Phase 2 owns showcase/docs ST-24–ST-26 red-to-green. Phase 3 owns generated/distribution ST-27B
and ST-28 red-to-green. The execution plan now has 31 consistently counted tasks.

**Rejected Alternatives:** A controller-only first phase would implement internals before any
requirements-level public oracle. Duplicating partial transaction scaffolding would blur ownership.
Ending an implementation phase with known-red public tests would violate the repository's required
specification → red → implementation → green sequence.

**Authority:** AI — delegated by --auto-design.
**Eligibility:** Implementation sequencing and test ownership inside confirmed issue #100 scope.
**Objective:** Ensure every phase has an executable, specification-first verification boundary.
**Evidence:** The original cross-phase dependency contradiction and the corrected ST/task mapping.
**Strongest Counterargument:** A merged behavior phase is larger; granular steps preserve review
and commit boundaries while keeping the first green checkpoint honest.
**Confidence:** High — reopen if CodeOps explicitly permits completed implementation phases to
retain expected-red public tests.
**Hardening:** Independent challenger upheld the Major; a direct iteration-3 reviewer verified the
ST-27 split, task count, and phase ordering.
**Policy Version:** 1.
**Root Invocation ID:** preflight-datagrid-row-revert-20260804.
**Resolution State:** Resolved — applied and verified by bounded re-scan.

### Iteration Closure Evidence

| Finding | Final Verification |
|---|---|
| PF-001 | Callback/internal/unavailable authority is selected before prepare or writes; ST-10/ST-11 prove precedence |
| PF-002 | Captured-row settlement, attempt-owned presentation cleanup, live reconciliation, and disposal no-op are separated and covered by ST-8A–ST-9C |
| PF-003 | Key+object identity defines observable continuity; same-identity republication has an oracle |
| PF-004 | Conditional setter contract, mutate-then-throw recovery, and secondary failure containment are explicit |
| PF-005 | Locale review manifest refresh and i18n:reviews:check are owned by the locale phase |
| PF-006 | Repaint budget is one bump per mutation stage |
| PF-007 | Mutation integration names row-mutations.ts and EditableDataGrid.deleteRows |
| PF-008 | Unmeasurable percentages were replaced with mapped evidence goals |
| PF-009 | Every public/source/docs/generated oracle now precedes its implementation and reaches green in the same vertical phase |

### Review Verdict

**PREFLIGHT PASSED.** All six Major and three Minor findings are resolved, the final bounded scan
has no open semantic finding, full portfolio validation is clean, and the guarded plan approval
transition succeeded. The roadmap hook is inert because this feature has no roadmap artifact.

### Verification and Commit Status

| Check | Result |
|---|---|
| Traceability JSON parse | Passed |
| Feature-local traceability validation | Passed: 0 problems |
| Execution relationship snapshots | Passed: complete |
| Report structure (13 dimensions, PF-001 through PF-009) | Passed |
| Feature artifact trailing whitespace | Passed |
| Full portfolio traceability validation | Passed: 0 problems across 6 graphs |
| Plan readiness | Passed: 0 blockers |
| Audit readiness | Passed: 0 blockers |
| Guarded approval transition | Passed: PLAN-ESCAPE-REVERT is approved |
| yarn verify:local | Passed |
| Requested auto-commit | Eligible after all guarded verification checks passed |

Locked workspace dependencies were installed with `yarn install --frozen-lockfile`. The authorized
portfolio metadata repair changed only deterministic revision fields, dependent validation
snapshots, and graph update timestamps. No roadmap was advanced.
