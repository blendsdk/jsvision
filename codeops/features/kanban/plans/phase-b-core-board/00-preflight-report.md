## Preflight Report: Kanban Phase B Core Board

> **Status**: ✅ PREFLIGHT PASS — all 31 findings resolved; Iteration 5 full rescan found 0 open Critical/Major findings
> **Iteration**: 5 (authorized `--auto-design` correction and complete rescans)
> **Artifact**: implementation plan at `codeops/features/kanban/plans/phase-b-core-board/`
> **Artifact Content Hash**: `sha256:59a7d236e2147f14b774fe0440d7061be76cd0d8972dea319afed70a1ca8a1a8`
> **Repository Revision**: `cf7babc6c8f088eff8a723282448e75cb2d39995`
> **Codebase Grounded**: 20 source/configuration files and the owning RD-04–06 requirements examined
> **Last Updated**: 2026-08-04

> **SAME-SESSION REVIEW:** This plan was created and preflighted in the same session. Three independent
> clustered auditors, one consolidated Major-finding challenger, and five complete correction/rescan
> iterations reduced the bias risk. A fresh-session architecture review remains advisable before later
> drag, mutation, command, or editor phases expand these public seams.

### Codebase Context Summary

**Tech Stack:** Node 22+, ESM TypeScript, Yarn 1 workspaces, Turborepo, Vitest, JSVision Core/UI/i18n.

**Architecture:** Phase B extends the Phase A `@jsvision/kanban` package through one DSL-composed
`KanbanBoard`, one exact-cell `KanbanViewport`, pure semantic models, sparse per-cell geometry, one
board-owned interaction facade, and one default or mount-factory state controller. Application records,
policy publication, authorization, persistence, and mutation remain authoritative outside the package.

**Key evidence:** the current viewport still uses fixed card strides; the projector hard-codes the
standard renderer; the eager index preallocates the column-by-swimlane address matrix; the descriptor
cache has roots but no reactive computation; Core/UI events discard Meta/Command; and source sessions
lack aggregate grouped-row layout hints. The corrected plan addresses each fact without implementing
RD-07+ or the RD-12 Core/Web modifier prerequisite.

The deterministic target readiness command is:

```text
python3 .../codeops_state.py readiness --root . --gate plan --target kanban/PLAN-PHASE-B --json
```

It returns `ready: true` with zero target blockers. The tool also reports unrelated pre-existing
portfolio warnings from other feature graphs; they do not enter the `kanban/PLAN-PHASE-B` closure.

### Summary by Dimension

Findings may affect more than one dimension.

| # | Dimension | Findings | Highest Severity |
|---|---|---:|---|
| 1 | Ambiguities | 8 | 🟠 MAJOR |
| 2 | Implicit Assumptions | 9 | 🟠 MAJOR |
| 3 | Logical Contradictions | 7 | 🟠 MAJOR |
| 4 | Completeness Gaps | 14 | 🟠 MAJOR |
| 5 | Feasibility Concerns | 8 | 🟠 MAJOR |
| 6 | Security Blind Spots | 3 | 🟠 MAJOR |
| 7 | Dependency Issues | 12 | 🟠 MAJOR |
| 8 | Ordering & Sequencing | 11 | 🟠 MAJOR |
| 9 | Edge Cases | 7 | 🟠 MAJOR |
| 10 | Testability | 12 | 🟠 MAJOR |
| 11 | Scope Creep Indicators | 2 | 🟠 MAJOR |
| 12 | Consistency | 10 | 🟠 MAJOR |
| 13 | Codebase Alignment | 14 | 🟠 MAJOR |

### Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 CRITICAL | 0 | None |
| 🟠 MAJOR | 23 | Resolved and rescanned |
| 🟡 MINOR | 8 | Resolved and rescanned |
| 🔵 OBSERVATION | 0 | None |

### Resolved Finding Ledger

The ledger consolidates duplicate symptoms reported by independent clusters. Evidence locations name
the corrected owning documents; each selected resolution was authorized by `--auto-design` within the
confirmed strict product boundary.

| ID | Severity | Problem | Selected resolution and evidence | Status |
|---|---|---|---|---|
| PF-B-001 | 🟠 | Phase checkpoints required cross-phase ST cases before their producers existed | Producer-owned assertion slices are authored immediately before each producer and all authored tests are green at every gate (`07-testing-strategy.md`; `99-execution-plan.md`) | ✅ |
| PF-B-002 | 🟠 | Mounted rich cards preceded valid variable-height geometry | Phase 1 remains pure/cache-ready; mounted renderer activation moved behind Phase 3 sparse geometry (`03-02`; `99`) | ✅ |
| PF-B-003 | 🟠 | The scene depended on interaction snapshot types scheduled one phase later | Stable target/snapshot/pending/feedback/detail types and neutral defaults moved to Phase 1; controller algorithms remain Phase 4 (`03-01`; `99`) | ✅ |
| PF-B-004 | 🟠 | An injected controller could not receive its mount-created environment or establish ownership | `interactionFactory(environment)` returns one board-owned controller behind a stable facade; reuse and mixed ownership reject (`03-01`; `03-05`) | ✅ |
| PF-B-005 | 🟠 | Header/state actions could not fit card-only targets/intents | Closed scoped actions cover board/column/swimlane/cell/card/state; source retry stays direct and never double-routes (`03-01`; `03-04`) | ✅ |
| PF-B-006 | 🟠 | Complete card values, DoD, help, actions, and selection count had no carrier | One sanitized centrally bounded `KanbanFocusedDetailSnapshot` feeds help/status chrome and inspection (`03-01`; `03-05`) | ✅ |
| PF-B-007 | 🟠 | Eager indexing allocated the forbidden Cartesian address matrix | Store occupied cells only, synthesize absent empty cells lazily, and assert allocation counters (`03-03`; task 2.2.6) | ✅ |
| PF-B-008 | 🟠 | Typed localization was deferred until after consumers needed it | Each consuming task adds English, all locale entries, placeholders, and review evidence; Phase 6 closes parity (`03-06`; `99`) | ✅ |
| PF-B-009 | 🟠 | Plugin synchronization occurred after mapped task-level auto-commits | Every mapped task must review impact and run update/check before its own commit (`03-06`; global execution rule) | ✅ |
| PF-B-010 | 🟠 | Semantic Primary/Command was impossible through current Core/UI/Web events | Phase B ships programmatic and deliverable Ctrl paths; Command criteria remain traceably open for RD-12; no Core/Web expansion (`01`; `03-06`; `07`) | ✅ |
| PF-B-011 | 🟠 | Selection-on-down contradicted the future drag threshold contract | Bounded pending press focuses on down, commits on matching up, and cancels without capture/threshold/insertion behavior (`03-05`; task 5.2.3) | ✅ |
| PF-B-012 | 🟠 | Arbitrary grouped windowing lacked metadata to locate distant variable-height rows | Add optional abort-aware revision-bound aggregate row-layout hints with honest no-hint degradation (`03-03`; `03-04`) | ✅ |
| PF-B-013 | 🟠 | Select-all-loaded could exceed the selected-key ceiling | Count first and reject atomically with localized feedback; never truncate a bulk target (`03-05`; ST-B-INT-08) | ✅ |
| PF-B-014 | 🟠 | Card-local signal invalidation was impossible with root-only descriptor caching | One owned bounded computation per retained descriptor rebuilds and damages only that card and disposes before its cursor (`03-02`; task 1.2.11) | ✅ |
| PF-B-015 | 🟠 | Query and structure policy competed for grouping authority | `KanbanQuery.groupBy` is the sole semantic field; policy owns presentation and rejects incompatible entries (`03-01`; `03-03`) | ✅ |
| PF-B-016 | 🟠 | Informational WIP could not carry violation evidence | `allowed` optionally carries immutable bounded violation evidence while warning/blocked/unavailable retain their meanings (`03-03`) | ✅ |
| PF-B-017 | 🟠 | Async transition settlement conflicted with synchronous event handling and could double-emit intents | The facade synchronously accepts/handles, serializes async settlement by generation, and alone emits committed intents exactly once (`03-01`; `03-06`) | ✅ |
| PF-B-018 | 🟠 | Checklist Space activation contradicted Space-to-toggle-selection | Editor activation is Enter, matching double-click, or explicit action region; Space remains selection-only (ST-B-CARD-10) | ✅ |
| PF-B-019 | 🟠 | Bulk selection snapshots omitted per-card address/entity revision evidence | Ordered bounded entries now carry typed key, cell address, and entity revision plus session/query/view evidence (`03-01`; ST-B-INT-15) | ✅ |
| PF-B-020 | 🟠 | Factory/controller failure could leak source/scene resources during mount | Setup is an atomic fail-closed transaction with immediate rollback registration, permanent unavailable facade, payload-free observation, and contained transition rejection (`03-05`; `03-06`) | ✅ |
| PF-B-021 | 🟠 | Reactive owners referenced a nonexistent descriptor-cardinality limit | Add central standard/absolute `retainedDescriptors`; clip before creation and emit a non-actionable partial state at limit+1 (`03-02`; `03-04`; ST-B-GEO-04) | ✅ |
| PF-B-022 | 🟠 | Foundational rollback production was initially scheduled after its Phase 4 oracle | Phase 4 owns source→scene/cache→controller rollback; Phase 5 only extends the verified transaction with input/pending-pointer resources (`99`) | ✅ |
| PF-B-023 | 🟠 | After reordering production, the rollback acceptance slice was still authored in Phase 5 | Phase 4 Step 4.1 now authors setup/rollback ST-B-X-04 before task 4.2.6; Phase 5 authors only its input extension (`07`; `99`) | ✅ |
| PF-B-024 | 🟡 | Mandatory `queryRevision` had no value when `viewRevision` was absent | Use required package session revision/query generation plus optional application view revision (`03-01`) | ✅ |
| PF-B-025 | 🟡 | Legacy identity was incorrectly described as deletion authority | Identity is default-controller seed only; source publication owns deletion; identity plus factory rejects (`03-01`; PAR-B29) | ✅ |
| PF-B-026 | 🟡 | Server-wide selection was prose-only | Add an opaque separate reference with explicit set/clear transitions that never expands loaded keys (`03-01`; `03-05`) | ✅ |
| PF-B-027 | 🟡 | The hover lease referenced a missing central timing limit | Phase 2 adds and validates the central hover timing field before the controller consumes it (task 2.2.1/2.2.9) | ✅ |
| PF-B-028 | 🟡 | Phase B security specifications were scheduled after production in a Phase A oracle | New `cards-security.spec.test.ts` is authored in Phase 1 Step 1.1; later tests are implementation-only (`07`; `99`) | ✅ |
| PF-B-029 | 🟡 | Scale claims lacked observable counters and exact ceilings | Limit-derived integer counters cover cursors, ranges, hints, descriptors, effects, damage, addresses, and runs; no timing/heap thresholds (`07`) | ✅ |
| PF-B-030 | 🟡 | The E2E “matrix” had no reproducible bound | Exactly 12 base/pairwise rows plus one-axis edge tests; no Cartesian product (`07`; task 5.3.3) | ✅ |
| PF-B-031 | 🟡 | Final verification referred to descriptive checks rather than commands | The plan names package, packed-consumer, i18n, docs/API, techdocs, plugin, and changed-file commands explicitly (`07`; tasks 6.3.1–6.3.2) | ✅ |

### Challenger and Delegated Decisions

The independent challenger confirmed the lowest-churn in-scope remedies for the original Major batch:
producer-phase tests, Phase 3 renderer activation, early stable snapshot types, mount-time controller
factory plus facade, closed scoped actions, bounded focused details, occupied-only eager indexing,
first-consumer localization, per-mapped-task plugin parity, honest Primary deferral, pending press,
aggregate layout hints, atomic selection overflow, per-entry reactivity, query-owned grouping,
informational WIP evidence, and synchronous route acceptance with async settlement.

Later rescans independently discovered selection-entry, mount-rollback, descriptor-capacity, rollback-
ordering, and rollback-oracle-order defects. Each correction was rescanned by all three clusters until
Iteration 5 returned no Critical/Major finding. Product scope, application authority, and RD-07+/RD-12
ownership never changed.

### Validation Results

| Check | Result |
|---|---|
| 106 task IDs / uniqueness | ✅ 106 / 106 |
| 72 ST identifiers / uniqueness | ✅ 72 / 72 |
| Missing local Markdown links | ✅ None |
| Placeholder/open-decision scan | ✅ None |
| Whitespace/conflict scan | ✅ `git diff --check` clean |
| Target plan readiness | ✅ `ready: true`, zero target blockers |
| Target execution readiness | ✅ `READY`; 225 exact current-revision snapshots generated after the transition API rejected specification targets |
| Full Iteration 5 clustered rescan | ✅ 0 open Critical/Major findings |
| `yarn verify:local` | ⚠️ Environment unavailable: this worktree cannot resolve `eslint/package.json` |

The local verifier failure occurs before artifact validation because dependencies are not installed in
this worktree. No dependency installation was authorized or performed during preflight. Execution must
restore the repository's locked dependency environment before the first task can verify or auto-commit.

### Decision

**PREFLIGHT PASS.** Phase B may enter execution under the confirmed `--auto-design --auto-commit`
workflow. The executor must preserve the strict scope, leave Command-based Primary acceptance open for
RD-12, keep the user-modified portfolio roadmap unstaged, and stop rather than commit if any required
task gate fails.
