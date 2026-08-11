# Preflight Report: Kanban Phase C Modern Interaction

> **Status**: ✅ PREFLIGHT PASSED — all 14 findings resolved
> **Iteration**: 3 (iteration 2 full re-scan plus bounded iteration 3 verification)
> **Previous Iteration**: Iteration 1 blocked with 13 findings; iteration 2 reopened PF-005/PF-008/PF-009 and found PF-014
> **This Iteration**: PF-005/PF-008/PF-009/PF-011/PF-014 fixes verified; no new findings
> **Artifact**: implementation plan at `codeops/features/kanban/plans/phase-c-modern-interaction/`
> **Artifact Content Hash**: `3473021f659ec5b54bca99d8fd12dda4995f8f83a723293e19de44067425f986`
> **Original Iteration-1 Hash**: `398669f590e1fe87501a5caa10b58b883f85239a153d181394d128b0994004bd`
> **Codebase Grounded**: 52 source/test/config artifacts examined; 60 oracle references and 124 task IDs verified
> **Last Updated**: 2026-08-11

> **SAME-SESSION REVIEW:** This artifact was created in the current session. Same-agent bias risk is
> elevated. Independent clustered auditors and one blind major-finding challenger were used, but a fresh
> session or human architecture review provides greater independence.

## Audit Contract

| Item | Frozen value |
|---|---|
| Audit target | All Phase C plan documents in this directory, excluding working notes and this report |
| Context documents | RD-07, RD-08, completed Phase B plan, Kanban roadmap, project guidance, architecture/ADRs, and actual UI/Kanban/Web/Examples source, tests, manifests, and CI |
| Product scope | Strict RD-07 + RD-08; no optional scope expansion |
| Modification set | This report and working notes only; fixes require explicit authorization |
| Auto-design | Active; eligible technical resolutions selected, but no finding waived and no fix applied |

## Codebase Context Summary

**Tech Stack:** Node 22+, ESM TypeScript, Yarn 1 workspaces, Turborepo, Vitest, JSVision Core/UI/Web.

**Architecture:** `@jsvision/kanban` owns bounded presentation and transient interaction while the
application owns records, authorization, persistence, and publication. A board owns the stable facade,
viewport, source lifecycle, and current metadata-only authority adapter. UI currently has one nullable
capture target; Web forwards decoded terminal input; the permanent showcase belongs to the Examples
workspace.

**Key files examined:** `packages/kanban/src/contract/request.ts`,
`packages/kanban/src/contract/authority.ts`, `packages/kanban/src/board/board-authority.ts`,
`packages/kanban/src/board/kanban-board.ts`, `packages/kanban/src/board/kanban-viewport.ts`,
`packages/ui/src/event/{types,event-loop,dispatch}.ts`, `packages/core/src/engine/input/events.ts`,
`packages/web/src/host.ts`, package manifests, Vitest configuration, `.github/workflows/ci.yml`,
Kanban/Examples tests, architecture docs, and ADR-009.

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---:|---|---:|---|
| 1 | Ambiguities | 1 | 🟠 Major |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 1 | 🟠 Major |
| 4 | Completeness Gaps | 1 | 🟠 Major |
| 5 | Dependency Issues | 1 | 🟠 Major |
| 6 | Feasibility Concerns | 1 | 🟠 Major |
| 7 | Testability | 3 | 🟠 Major |
| 8 | Security Blind Spots | 1 | 🟠 Major |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 2 | 🟠 Major |
| 12 | Consistency | 0 | — |
| 13 | Codebase Alignment | 3 | 🟠 Major |

## Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 Critical | 0 | None |
| 🟠 Major | 12 | All applied and verified |
| 🟡 Minor | 2 | All applied and verified |
| 🔵 Observation | 0 | None |

The individual PF-001..PF-013 entries below preserve their iteration-1 decision snapshot, including the
then-current “fix pending” statement. The iteration resolution table and PF-014 section record the applied
and verified final state and supersede those historical pending statements.

## Major Findings

### PF-001: Phase-owned specification gates cannot turn green 🟠 MAJOR

**Dimension:** Ordering & Sequencing
**Location:** `99-execution-plan.md`, Phase 4 Steps 4.1–4.2 and Phases 5–6; `07-testing-strategy.md`,
specification-file matrix
**Codebase Evidence:** The plan itself keeps Phase 4 render-neutral until Phase 5 and defers structural/
keyboard/programmatic parity to Phase 6.

**The Problem:** Phase 4 owns and must green visual frame/reflow cases and cross-input parity cases whose
production behavior is not implemented until Phases 5 and 6. ST-C-DRAG-15 also has two owning spec files.
Execution must either stop, implement later phases early, or weaken immutable oracles.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add an oracle/phase ownership matrix; Phase 4 owns render-neutral gesture/geometry/release, Phase 5 visual/damage, Phase 6 structural/parity | Preserves spec-first closure and current architecture | Requires remapping tests/tasks and recounting |
| B | Merge Phases 4–6 | One green checkpoint | Creates an oversized phase and weakens fault isolation |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design`; Option A selected. Resolution is eligible
implementation sequencing within fixed behavior. Evidence is the contradictory phase gates above;
Option B was rejected as disproportionate. Strongest counterargument: one partly-red cross-phase file
could remain open, but that contradicts the plan’s green checkpoints. **Confidence: High. Hardening:
Challenger converged.** Policy version 1; root invocation `MP-PHASE-C-20260811T0144CEST`. Reopen if the
implementation phases are intentionally merged. Fix remains pending explicit authorization.

### PF-002: Generic publication matching is undefined 🟠 MAJOR

**Dimension:** Ambiguities
**Location:** `03-03-operation-lifecycle.md`, Dispatcher settlement and Pending projection/publication
**Codebase Evidence:** `packages/kanban/src/board/board-authority.ts` currently retains only an explicit
result publication expectation; `packages/kanban/src/contract/request.ts` permits generic application-
owned extension payloads.

**The Problem:** Accepted results may omit publication expectations, yet the plan does not define what
retained evidence matches or contradicts publication for create/update/delete, move, structural,
saved-view, and custom request families. A universal inferred matcher would guess application semantics;
no matcher can leave operations pending accidentally.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Derive a minimum matcher from every admitted request and let result metadata refine it | Lower application burden | Unsafe or impossible for generic/application-owned semantics |
| B | Auto-reconcile only with a validated expectation; otherwise require explicit operation-correlated reconciliation/cancellation while retaining accepted/pending state | Honest and deterministic for every request family | Applications must provide expectation or explicit settlement |

**Recommendation:** Option B, allowing derived matching only for a request family whose public contract
proves the semantics.

**User Decision:** AI — delegated by `--auto-design`; Option B selected. This is an eligible consistency
and failure-recovery mechanism preserving application authority. Option A was rejected as a universal
rule because generic requests cannot prove their future authoritative state. Strongest counterargument:
explicit expectations add application ceremony. **Confidence: High. Hardening: Challenger diverged from
the initial derived-matcher framing and established Option B as safer.** Policy version 1; root invocation
`MP-PHASE-C-20260811T0144CEST`. Reopen if every public standard variant gains a complete derivable
publication contract. Fix remains pending explicit authorization.

### PF-003: Legacy `board.request` ownership conflicts with coordinator guarantees 🟠 MAJOR

**Dimension:** Codebase Alignment
**Location:** `03-02-requests-placement.md`, request envelope/operation ID; `03-03-operation-lifecycle.md`,
Coordinator contracts; `99-execution-plan.md`, task 3.2.8
**Codebase Evidence:** `packages/kanban/src/contract/request.ts` requires caller-created extension
`operationId` and `signal`; `packages/kanban/src/board/kanban-board.ts` forwards that request unchanged.

**The Problem:** The new coordinator claims ownership of IDs and AbortSignals while compatibility says
existing caller-owned envelopes still enter `board.request` unchanged. Overwriting breaks callers;
adopting them silently breaks the ownership guarantee.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add caller-facing standard proposals without lifecycle fields, create internal coordinator envelopes, and retain an explicit validated legacy-extension overload | Clear ownership plus compatibility | Adds one deliberate compatibility path |
| B | Keep caller-owned IDs/signals for all direct requests | Smaller API delta | Splits lifecycle authority for new standard requests |

**Recommendation:** Option A, with the legacy overload explicitly documented as a compatibility-only
adoption path.

**User Decision:** AI — delegated by `--auto-design`; Option A selected. Eligible public-interface
mechanics preserve, rather than break, the approved compatibility contract. Option B was rejected because
it weakens generated-producer ownership. Strongest counterargument: two input shapes add API ceremony.
**Confidence: High. Hardening: Challenger converged and merged the strongest compatibility detail from
both candidates.** Policy version 1; root invocation `MP-PHASE-C-20260811T0144CEST`. Reopen if legacy
request compatibility is explicitly retired by the user. Fix remains pending explicit authorization.

### PF-004: Capture stop/dispose reasons are contradictory 🟠 MAJOR

**Dimension:** Logical Contradictions
**Location:** `03-01-capture-input.md`, Loss sources; `07-testing-strategy.md`, ST-C-CAP-02
**Codebase Evidence:** `packages/ui/src/event/event-loop.ts` implements `dispose()` by calling `stop()`;
`packages/ui/src/event/types.ts` documents the current limited meaning of `stop()`.

**The Problem:** The plan demands exact distinct `stopped` and `disposed` reasons but makes dispose
stop-first, rendering `disposed` unreachable. It also changes capture behavior on public `stop()` without
making that compatibility impact explicit.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Use a private `stop(reason)` transition: direct stop emits `stopped`, direct dispose emits `disposed`, and later teardown is inert | Exact, compatible, testable precedence | Internal lifecycle refactor |
| B | Remove `stopped` as a capture-loss source | Simpler union | Leaves a real stopped loop retaining capture semantics |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design`; Option A selected. Eligible lifecycle recovery
design; it preserves exact once-only loss and current public entry points. Option B was rejected because
stop is a real inactive-loop boundary. Strongest counterargument: threading a reason through stop adds
internal complexity. **Confidence: High. Hardening: Challenger converged.** Policy version 1; root
invocation `MP-PHASE-C-20260811T0144CEST`. Reopen if UI’s public stop contract is intentionally changed.
Fix remains pending explicit authorization.

### PF-005: Confirmation and inverse callbacks lack one safe execution contract 🟠 MAJOR

**Dimension:** Security Blind Spots
**Location:** `03-06-integration-delivery.md`, Construction options/Error Handling;
`03-03-operation-lifecycle.md`, Dispatcher settlement/Undo; `07-testing-strategy.md`, ST-C-REQ-10
**Codebase Evidence:** `docs/architecture/security.md` requires application callbacks to be
exception-contained and reentrancy-safe; current authority validation rejects arbitrary thenables and
hostile settlement values.

**The Problem:** Destructive confirmation has no request-kind policy, coordinator owner, or oracle, while
confirmation and retained inverse builders omit hostile return, Promise subclass/cross-realm/thenable,
reentrancy, cancellation, disposal, and late-settlement rules.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Central coordinator pre-dispatch confirmation with exact boolean/native-Promise settlement, reservation and revalidation, reentrancy guards, late suppression, and fully validated fresh inverse proposals | Covers the accepted contract through one hardened boundary | More coordinator specification/tests |
| B | Limit Phase C confirmation to warning moves and defer destructive confirmation | Smaller implementation | Contradicts RD-08’s accepted destructive-confirmation behavior |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design`; Option A selected. Eligible security mechanism within
the accepted callback policy. Option B was rejected because it would change acceptance scope. Strongest
counterargument: this expands coordinator complexity before deletion UIs ship. **Confidence: High.
Hardening: Challenger converged.** Policy version 1; root invocation
`MP-PHASE-C-20260811T0144CEST`. Reopen if RD-08 destructive confirmation is changed by user authority.
Fix remains pending explicit authorization.

### PF-006: RD-08 producer convergence is not testable 🟠 MAJOR

**Dimension:** Testability
**Location:** `01-requirements.md`, Scope boundaries/Acceptance mapping; `07-testing-strategy.md`,
ST-C-REQ-01 and ST-C-DRAG-15
**Codebase Evidence:** RD-08 AC-1 names editor, dialog, context-menu, keyboard, programmatic, card, column,
and swimlane fixtures, while RD-09–12 UI is correctly absent from the current package.

**The Problem:** Constructing request variants does not prove that deferred producer seams converge on
the same dispatcher. The plan claims full RD-08 acceptance without an oracle for editor/dialog/context-
menu origins.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add bounded producer-contract adapters/fixtures that submit representative drafts/actions through the same public coordinator, without shipping deferred UI | Proves authority convergence without scope creep | Adds test-only producer seams |
| B | Revise RD-08 AC-1 | Smaller Phase C | Requires reserved user authority and weakens the accepted criterion |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design`; Option A selected. Eligible testing architecture
inside strict scope; it preserves the user-approved criterion and avoids future UI. Option B was rejected
because acceptance changes are reserved. Strongest counterargument: fixtures cannot prove future UI code,
only the durable producer contract. **Confidence: High. Hardening: Challenger converged.** Policy version
1; root invocation `MP-PHASE-C-20260811T0144CEST`. Reopen if later producers require a different public
submission seam. Fix remains pending explicit authorization.

### PF-007: Real decoded focus loss does not reach capture cancellation 🟠 MAJOR

**Dimension:** Completeness Gaps
**Location:** `01-requirements.md`, capture-loss behavior; `99-execution-plan.md`, tasks 1.2.1–1.2.4
**Codebase Evidence:** `packages/core/src/engine/input/events.ts` decodes focus reports;
`packages/web/src/host.ts` forwards them; `packages/ui/src/event/event-loop.ts` does not currently turn
`focus: false` into capture loss.

**The Problem:** A synthetic host-loss ingress can pass while a real terminal/browser blur leaves the
drag generation and capture alive.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Route decoded `focus:false` through the central `host-lost` transition before normal dispatch; retain explicit ingress for transports without decoded focus | One safe default across hosts | Couples one normalized event to capture policy |
| B | Require every host to call the ingress separately | Host-controlled | Easy to omit and already inconsistent with forwarded focus reports |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design`; Option A selected. Eligible input-recovery design
required by RD-07 blur cancellation. Option B was rejected because duplicated host wiring is omission-
prone. Strongest counterargument: some focus reports may be application-visible; loss processing must not
prevent ordinary routing after capture cancellation. **Confidence: High. Hardening: Challenger converged.**
Policy version 1; root invocation `MP-PHASE-C-20260811T0144CEST`. Reopen if normalized focus events move
outside EventLoop ownership. Fix remains pending explicit authorization.

### PF-008: Host evidence has no executable dependency and CI contract 🟠 MAJOR

**Dimension:** Dependency Issues
**Location:** `02-current-state.md`, External dependencies; `03-06-integration-delivery.md`, Host
verification; `99-execution-plan.md`, Phase 7
**Codebase Evidence:** `packages/kanban/package.json` declares neither Web/xterm nor native harness tooling;
`packages/web/package.json` alone declares `@xterm/headless`; Kanban’s TS config does not build test child
fixtures; `.github/workflows/ci.yml` does not run Kanban E2E on Windows or the current POSIX E2E step.

**The Problem:** The plan can pass locally through hoisting or skip ConPTY forever. It does not define how
the TypeScript child executes, which workspace owns xterm, or which designated runners must prove real
Unix PTY and Windows ConPTY.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Keep evidence in Kanban; declare exact test-only xterm/native dependencies, use a built/plain-JS child or exact build-before-run script, and add focused supported-OS CI jobs where PTY/ConPTY assertions must execute | One owning suite and reproducible package closure | Adds native CI setup and matrix time |
| B | Split browser/native evidence into Web or a dedicated integration workspace | Transport-local ownership | Fragmented semantic evidence and more orchestration |

**Recommendation:** Option A. Dependency installation still requires separate execution-time user
authorization.

**User Decision:** AI — delegated by `--auto-design`; Option A selected. Eligible verification mechanism
for already-approved RD-07 AC-15; it grants no install/deployment authority. Option B was rejected because
it splits the single semantic oracle. Strongest counterargument: native jobs can be flaky and expensive.
**Confidence: Medium-High — CI image/native-build proof may change the exact matrix. Hardening: Challenger
converged.** Policy version 1; root invocation `MP-PHASE-C-20260811T0144CEST`. Reopen if Node 22/native
install proof fails or no authorized Windows runner exists. Fix remains pending explicit authorization.

### PF-009: I18n delivery points at the wrong repository contract 🟠 MAJOR

**Dimension:** Codebase Alignment
**Location:** `03-05-projection-rendering.md`, I18n; `03-06-integration-delivery.md`, Verification commands;
`99-execution-plan.md`, tasks 7.2.4/7.3.1
**Codebase Evidence:** `packages/kanban/package.json` exports ten locales total (English plus nine
translations); authored translations live under `packages/kanban/src/i18n/translations/`; the review
manifest is `tools/i18n-translation-reviews.json`; `verify:local` does not run locale/review gates.

**The Problem:** The plan calls for English plus ten translations, names a nonexistent review directory,
duplicates English ownership across phases, and omits the exact root i18n checks.

**Only viable resolution:** Phase 5 owns canonical English catalog/consumption. Phase 7 owns all nine
translations, generated exports, `tools/i18n-translation-reviews.json`, and exact
`yarn check:i18n-literals`, `yarn i18n:locales:check`, and `yarn i18n:reviews:check` gates. Adding a phantom
locale or review directory was rejected because it contradicts current public exports/tooling.

**Recommendation:** Apply the only viable resolution.

**User Decision:** AI — delegated by `--auto-design`; the sole viable technical correction selected.
Objective is repository-consistent ten-locale delivery; evidence is the manifest and existing review
tooling. Strongest counterargument: locale inventory can grow before execution. **Confidence: High.
Hardening: Challenger converged.** Policy version 1; root invocation
`MP-PHASE-C-20260811T0144CEST`. Reopen if the public locale inventory or review tool changes. Fix remains
pending explicit authorization.

### PF-010: Kitchen-sink delivery has no real owner or gate 🟠 MAJOR

**Dimension:** Codebase Alignment
**Location:** `03-06-integration-delivery.md`, Documentation and kitchen sink; `99-execution-plan.md`,
tasks 7.1.3/7.2.6/7.3.1
**Codebase Evidence:** The permanent showcase is `packages/examples/kanban-showcase/**`; its smoke oracle
is `packages/examples/test/kanban-showcase.smoke.spec.test.ts`; the owning package is
`@jsvision/examples`.

**The Problem:** “Existing kitchen-sink files” is not executable, puts truthfulness assertions in the
Kanban package, and omits Examples typecheck/test gates.

**Only viable resolution:** Name the exact Examples showcase/story/spec files, author the red showcase
spec before implementation, then run `yarn workspace @jsvision/examples typecheck` and the focused
showcase test. Generic paths were rejected because stable owners already exist.

**Recommendation:** Apply the only viable resolution.

**User Decision:** AI — delegated by `--auto-design`; the sole viable repository-aligned correction
selected. Strongest counterargument: exact paths make future moves require plan maintenance. **Confidence:
High. Hardening: Challenger converged.** Policy version 1; root invocation
`MP-PHASE-C-20260811T0144CEST`. Reopen if the showcase is moved before execution. Fix remains pending
explicit authorization.

### PF-011: The closure matrix is not an exact runnable gate 🟠 MAJOR

**Dimension:** Testability
**Location:** `03-06-integration-delivery.md`, Verification commands; `99-execution-plan.md`, Step 7.3
**Codebase Evidence:** The matrix contains literal `<focused capture suites>`; current workspace/root
scripts expose concrete Vitest, locale, plugin, docs, and Examples commands.

**The Problem:** The execution plan says every exact command must run, but one is a placeholder and the
matrix omits the host, locale/review, and Examples gates required elsewhere in the plan.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Replace placeholders with exact commands and add dedicated scripts for cross-platform host orchestration; enumerate every script-owned gate | Reproducible and auditable | Longer closure matrix |
| B | Reference one aggregate script and enumerate its owned gates | Compact call site | New aggregation can hide drift unless separately validated |

**Recommendation:** Option A; use a dedicated script only where cross-platform host orchestration genuinely
requires it.

**User Decision:** AI — delegated by `--auto-design`; Option A selected. Eligible verification design;
it makes existing acceptance executable. Option B alone was rejected because opaque aggregation can hide
missing gates. Strongest counterargument: command paths may drift before Phase 7. **Confidence: High.
Hardening: Challenger converged.** Policy version 1; root invocation
`MP-PHASE-C-20260811T0144CEST`. Reopen if a canonical repository aggregate gate gains explicit ownership
of all listed checks. Fix remains pending explicit authorization.

## Minor Findings

### PF-012: Numeric coverage targets are not measurable 🟡 MINOR

**Dimension:** Testability
**Location:** `07-testing-strategy.md`, Coverage goals
**Codebase Evidence:** `packages/kanban/package.json` and `vitest.config.ts` define no coverage provider,
script, or threshold.

**The Problem:** The stated 90/80/60 percent targets cannot pass or fail and conflict with the otherwise
behavioral 54-oracle strategy.

**Only viable proportional resolution:** Remove the percentages and state behavioral coverage through the
ST matrix plus implementation/security/E2E suites. Adding repository-new coverage tooling was considered
but rejected as unrequired scope.

**Recommendation:** Apply the proportional resolution.

**User Decision:** AI — delegated by `--auto-design`; resolution selected as eligible testing
documentation. Strongest counterargument: percentages can motivate broader tests even without enforcement.
**Confidence: High.** Policy version 1; root invocation `MP-PHASE-C-20260811T0144CEST`. Reopen if a
coverage provider/gate is adopted. Fix remains pending explicit authorization.

### PF-013: A specification task prematurely owns production helper code 🟡 MINOR

**Dimension:** Ordering & Sequencing
**Location:** `99-execution-plan.md`, tasks 7.1.1 and 7.2.2
**Codebase Evidence:** `packages/kanban/src/testing/drag-harness.ts` is a planned production testing export,
not an existing spec fixture.

**The Problem:** Task 7.1.1 names production helper code before task 7.2.2 implements the same helper,
blurring the required specification-first red boundary.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Keep 7.1.1 test-only with an intentional missing-module/behavior red; create/export the helper in 7.2.2 | Clean production ordering | Initial red may be module-level |
| B | Place the trace fixture under `test/` first and later adapt it to the public helper | Executable spec fixture immediately | Some fixture migration/duplication |

**Recommendation:** Option A unless Vitest cannot collect the intentional missing export, then use Option B.

**User Decision:** AI — delegated by `--auto-design`; Option A selected as eligible implementation
sequencing with a deterministic Option B fallback. Strongest counterargument: module-resolution failure
can be a coarse red signal. **Confidence: Medium — Vitest collection behavior determines the fallback.**
Policy version 1; root invocation `MP-PHASE-C-20260811T0144CEST`. Reopen if the red suite cannot load with
the planned absent export. Fix remains pending explicit authorization.

## Iteration 2–3 Finding

### PF-014: Synchronous subtree unmount lacked a feasible bounded hook 🟠 MAJOR

**Dimension:** Feasibility Concerns
**Location:** `03-01-capture-input.md`, Synchronous subtree unmount seam; `99-execution-plan.md`, Phase 1
**Codebase Evidence:** Current EventLoop detects stale capture lazily during routing;
`packages/ui/src/view/group.ts` removes children through `unmount()`;
`packages/ui/src/view/view.ts` owns synchronous scope disposal but `onCleanup` has no removable
registration; `packages/ui/src/view/render-root.ts` directly disposed its outer root owner.

**The Problem:** The iteration-1 correction promised synchronous `unmounted` loss but named only EventLoop
work. A target/ancestor could unmount with no later event, and per-capture `onCleanup` registration would
accumulate inert callbacks on a long-lived view.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add one permanent pre-cleanup `RenderRootOptions` → `RenderRootImpl`/`ViewHost` subtree-unmount notification; make root/group/dynamic paths converge through `View.unmount()` | Synchronous, bounded, and preserves ancestry for descendant checks | Broadens the shared view lifecycle seam |
| B | Make `View.onCleanup` removable and register one callback per capture | Local lease registration | Adds removable-cleanup machinery, risks retention, and cannot guarantee ordering before user cleanup |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design`; Option A selected and applied under the user’s
authorization to apply all findings. This is eligible lifecycle/recovery architecture required by RD-07.
Option B was rejected because it broadens reactive cleanup machinery while providing weaker ordering.
Strongest counterargument: every root/tree disposal path must now converge through `View.unmount()`.
**Confidence: High. Hardening: Iteration-2 challenger converged.** Policy version 1; root invocation
`MP-PHASE-C-20260811T0144CEST`. Reopen if UI gains an equivalent permanent pre-cleanup subtree lifecycle
signal. **Resolution Verification:** ✅ Fixed in iteration 3 by the exact seam, ancestry/ordering contract,
root-remount convergence, no-per-capture rule, and immediate/bounded specification/tasks.

## Resolution Verification

| Finding | Final result | Verification |
|---|---|---|
| PF-001 | ✅ Fixed | Single oracle-owner matrix; Phase 4 render-neutral, Phase 5 visual, Phase 6 structural/parity |
| PF-002 | ✅ Fixed | Expectation-bound or exact operation-correlated reconciliation; no universal matcher |
| PF-003 | ✅ Fixed | Coordinator-owned standard proposal envelope plus explicit compatible legacy extension adoption |
| PF-004 | ✅ Fixed | Private stop-with-reason gives exact direct stop/dispose precedence |
| PF-005 | ✅ Fixed | Exact frozen callback contexts/results, native-Promise rules, commit-only bounded FIFO undo retention |
| PF-006 | ✅ Fixed | Deferred-producer contract fixtures prove one coordinator without later UI |
| PF-007 | ✅ Fixed | Decoded `focus:false` and explicit fallback route through central host-loss transition |
| PF-008 | ✅ Fixed | Web/xterm/native dev dependencies, real `createBrowserHost`, bounded `.mjs`, cross-OS CI |
| PF-009 | ✅ Fixed | Ten-locale ordered overlays across updater/reviews/API plus exact update/test/docs commands |
| PF-010 | ✅ Fixed | Exact Examples showcase owner, red smoke spec, typecheck/focused test |
| PF-011 | ✅ Fixed | Literal runnable closure matrix and split host-execution/CI-contract evidence map |
| PF-012 | ✅ Fixed | Behavioral oracle goals replace unenforceable percentages |
| PF-013 | ✅ Fixed | Test-local red host oracle precedes production testing helper |
| PF-014 | ✅ Fixed | Permanent pre-cleanup subtree-unmount notification with bounded retention evidence |

## Adversarial Closeout

- Creation-time assumption challenged: the original plan treated one test file as able to span several
  green phases; that was false and is PF-001.
- External convention limitation: `node-pty`/ConPTY behavior is grounded in current package documentation
  and repository CI, but the native Node 22 build and Windows runner must still be proven during execution.
- Contrarian architecture concern: a universal inferred publication matcher would be convenient but would
  violate application-owned semantics; PF-002 therefore requires explicit correlation.
- Shared-framework feasibility concern: capture loss cannot depend on another event or per-lease cleanup;
  PF-014 establishes one permanent pre-cleanup subtree signal.
- Domain lenses: concurrent/asynchronous lifecycle and public data/compatibility migration were examined;
  no separate compiler, financial, or web-application policy lens applies.

## Verdict

✅ **PREFLIGHT PASSED.** All 14 findings are applied and verified against the final artifact hash. The
corrected plan contains 124 specification-first tasks and 60 unique immutable ST oracles, preserves strict
RD-07/RD-08 scope and public compatibility, and has no unresolved critical, major, minor, or observation
finding. The Kanban roadmap may advance RD-07/RD-08 to **Plan Preflighted**.
