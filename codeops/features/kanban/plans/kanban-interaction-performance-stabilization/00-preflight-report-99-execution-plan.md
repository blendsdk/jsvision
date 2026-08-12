# Preflight Report: Kanban Interaction and Performance Stabilization Execution Plan

> **Status**: ✅ PASSED — all 14 findings resolved and verified
> **Passed Artifact SHA-256**: `0ebdbf6e21dd0c229f03b70ce01c4be57c4602dcac6ab017aab05f1b632f1093`
> **Iteration**: 1 (first scan)
> **Artifact**: Single implementation plan at
> `codeops/features/kanban/plans/kanban-interaction-performance-stabilization/99-execution-plan.md`
> **Artifact SHA-256**: `e9ed2ba136b910361883bdcdcd0a63c021e83d2082968f565b677f64f3b277ec`
> **Codebase Grounded**: 31 source/test/config/artifact files examined; 24 material references verified
> **Scope Mode**: Strict (no `--explore-scope`)
> **Same-session warning**: The reviewing agent also created the artifact in this session. Five independent
> dimension-cluster audits and one blind whole-batch challenger were used to reduce shared-author bias.
> **Last Updated**: 2026-08-12

## Audit scope

- **Audit target**: only the single execution-plan document named above.
- **Context only**: project instructions; Kanban roadmap; RD-03, RD-04, RD-07, RD-14; requirements
  ambiguity register; Phase B/C plans; current Kanban/UI/Core/example source, testing seams, and runner.
- **Authorized modification set**: this report only. No plan or context-document fix is authorized yet.
- **Product baseline**: corrective variable-height geometry, immediate mouse interaction, bounded
  performance, and standalone GitHub showcase stabilization. Authentication, private projects, write-back,
  editors, filters, and a new public theme-role inventory remain excluded.

## Codebase context summary

**Tech stack:** Node 22+, ESM TypeScript, Yarn 1 workspaces, Turborepo, Vitest, JSVision UI/Core,
browser/xterm, node-pty/ConPTY host evidence.

**Architecture:** `KanbanBoard<T>` is the DSL-composed shell around a measured `KanbanViewport<T>` leaf.
The viewport requests bounded source windows, caches descriptors, projects geometry/hits, learns sparse card
heights, composes drag/operation overlays, calculates semantic damage, and draws. `EventLoop.dispatch()`
drains input and paints synchronously. `RenderRoot` recomposes dirty subtrees and performs a full-buffer diff;
the native host performs another buffer diff. Testing-only weak-map readers expose bounded counters. The
GitHub application loads public REST data into an application-owned eager source and applies moves locally.

**Key files examined:** `kanban-viewport.ts`, `viewport-source.ts`, `viewport-projector.ts`,
`viewport-metrics.ts`, `viewport-damage.ts`, `viewport-scale-inspection.ts`, `testing.ts`,
`semantic-host-board.ts`, `drag-harness.ts`, `event-loop.ts`, `render-root.ts`, Core `host.ts` and
`serialize.ts`, the GitHub loader/board/shell and specs, `check-performance.mjs`, and `perf-gate.spec.test.ts`.

## Summary by dimension

| # | Dimension | Findings | Highest severity |
|---:|---|---:|---|
| 1 | Ambiguities | PF-003, PF-004, PF-010, PF-011 | 🟠 Major |
| 2 | Implicit Assumptions | PF-005, PF-006, PF-009 | 🟠 Major |
| 3 | Logical Contradictions | PF-001, PF-002 | 🟠 Major |
| 4 | Completeness Gaps | PF-006, PF-007, PF-011 | 🟠 Major |
| 5 | Dependency Issues | PF-005, PF-006 | 🟠 Major |
| 6 | Feasibility Concerns | PF-004, PF-008, PF-010 | 🟠 Major |
| 7 | Testability | PF-003, PF-006, PF-010, PF-011 | 🟠 Major |
| 8 | Security Blind Spots | PF-009, PF-011 | 🟠 Major |
| 9 | Edge Cases | PF-002, PF-004, PF-008, PF-009, PF-011 | 🟠 Major |
| 10 | Scope Creep Indicators | PF-010 | 🟠 Major |
| 11 | Ordering & Sequencing | PF-007 | 🟠 Major |
| 12 | Consistency | PF-001, PF-012 | 🟠 Major |
| 13 | Codebase Alignment | PF-005, PF-006, PF-008, PF-010 | 🟠 Major |

## Summary by severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 Critical | 0 | — |
| 🟠 Major | 11 | 11 resolved |
| 🟡 Minor | 1 | 1 resolved |
| 🔵 Observation | 0 | — |

---

## Findings

### PF-001: The ghost contract is stale after the user's later visual decision 🟠 MAJOR

**Dimension:** Logical Contradictions / Consistency
**Location:** Objective and Acceptance 3; Phase 3.1.1
**Codebase Evidence:** `RD-07-pointer-drag-drop.md:83-87` still requires title/status markers plus a
multi-selection count; `viewport-render.ts:355` and `drag-rendering.spec.test.ts:159` encode the later
user-approved compact title-only ghost.

**The Problem:** The plan says it implements RD-07 unchanged while intentionally preserving the later
title-only visual decision. Restoring the status row would violate the user's reviewed decision; leaving the
governing requirement stale makes the plan's immutable oracle contradictory.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Restore a separate status marker in the ghost | Matches the older RD text | Reverses the user's later approved visual result |
| B | Preserve title-only ghost (and multi-count when applicable), record the superseding decision, and synchronize RD-07/ambiguity traceability | Respects the latest user decision and restores one oracle | Requires explicit authority to expand the modification set to requirements context |

**Recommendation:** Option B. Product behavior is already decided; this is traceability repair, not a new
visual choice. **Confidence: High. Hardening: challenger converged.**

**User Decision:** Resolved — user accepted Option B on 2026-08-12. Product behavior remains the
previously approved title-only ghost; applying the traceability fix still requires exact context-document
modification authority.

### PF-002: The regression trace both continues and cancels drag on resize 🟠 MAJOR

**Dimension:** Logical Contradictions / Edge Cases
**Location:** Task 1.1.5 versus Task 3.1.5
**Codebase Evidence:** `RD-07-pointer-drag-drop.md:195-197` requires synchronous resize cancellation;
`kanban-viewport.ts:480-486` already cancels the pointer router when bounds change.

**The Problem:** One immutable spec cannot require a drag to continue after resize while a later task and
the governing requirement require it to cancel.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Continue after scroll; resize cancels synchronously, clears overlays/capture, and a fresh drag succeeds | Matches the approved safety contract | Resize does not preserve the active gesture |
| B | Revise RD-07 to preserve drag across resize | More fluid in theory | Reopens stale-geometry and capture risks and reverses an approved decision |

**Recommendation:** Option A. **Confidence: High. Hardening: challenger converged.**

**User Decision:** Resolved — user accepted Option A on 2026-08-12.

### PF-003: “Same dispatch/render cycle” has no dispatch-return oracle 🟠 MAJOR

**Dimension:** Ambiguities / Testability
**Location:** Acceptance 3; Tasks 1.1.5 and 3.1.3
**Codebase Evidence:** `event-loop.ts:389-422,568-615` drains and paints synchronously; current showcase
traces batch several pointer events and inspect after later settlement/flushes.

**The Problem:** A ghost that appears only after an explicit flush, promise, timer, or later input could pass
the current wording even though that is the user's reported failure.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Define dispatch-return semantics and combine a lower-level overlay assertion with a mounted EventLoop test after each individual pointer move | Directly proves the visible contract and still localizes failures | Adds two deliberately layered assertions |
| B | Keep separate component and EventLoop tests without an end-to-end per-event assertion | Easier unit isolation | Allows the layers to pass independently while integration remains delayed |

**Recommendation:** Option A: before `dispatch()` returns, inspection and the emitted/serialized frame must
show the new pointer-relative ghost and eligible gap, with no explicit flush, async settlement, timer, or later
event. **Confidence: High. Hardening: challenger strengthened the recommendation with the lower-level
diagnostic layer. Challenger: converged.**

**User Decision:** Resolved — user accepted Option A on 2026-08-12.

### PF-004: Projection convergence has neither an exact ceiling nor safe publication semantics 🟠 MAJOR

**Dimension:** Ambiguities / Feasibility / Edge Cases
**Location:** Tasks 2.1.3 and 2.1.6
**Codebase Evidence:** `kanban-viewport.ts:557-567` performs an initial projection plus at most one
measurement correction; `phase-b-core-board/07-testing-strategy.md:77-80` already fixes at most one
correction pass.

**The Problem:** “Fixed bounded number” can drift, while “fail closed to a valid frame” does not say whether
paint, hits, drops, capture, damage, observations, or retries survive. Reusing stale geometry after resize or
source change is unsafe; self-invalidating fallback can loop.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | After exactly two total projection passes, always publish a current-bounds noninteractive affected-cell fallback | Simplest safe rule | Blanks valid prior content even when fully compatible |
| B | Reuse the prior frame only when a complete projection-compatibility fingerprint matches; otherwise use the atomic fallback | Preserves a proven compatible frame without stale targets | Requires a complete, carefully versioned fingerprint |

**Recommendation:** Option B, with bounds, source/query/layout, presentation, theme/capabilities,
interaction, and geometry revisions in the fingerprint. Otherwise atomically clear card/hit/drop/drag
evidence, cancel capture, damage and observe once, and retry only on an external invalidation. If fingerprint
completeness cannot be proven, fall back to A. **Confidence: Medium-high. Hardening: challenger refined the
fingerprint. Challenger: converged.**

**User Decision:** Resolved — user accepted Option B on 2026-08-12, including the documented fallback to
Option A if fingerprint completeness cannot be proven.

### PF-005: Variable-height projection still acquires the wrong logical source window 🟠 MAJOR

**Dimension:** Dependency Issues / Codebase Alignment
**Location:** Expected modification set; Phase 2
**Codebase Evidence:** `kanban-viewport.ts:1283-1289` passes `framedKanbanCardHeight(2) + 1` as a fixed
stride; `viewport-source.ts:703-723` derives `firstVisibleCard` and requested ranges from that stride.

**The Problem:** With tall mixed cards and non-zero offset, the source coordinator can request the wrong
logical slice before projection. A missing card cannot be repaired by perfect downstream geometry or hits.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Pass an authoritative revision-bound logical range/per-cell range map derived from the viewport's sparse height authority into source refresh | One geometry authority; resident-bounded | Widens viewport/source coordination and needs bootstrap rules |
| B | Maintain another revision-compatible sparse height map inside the source coordinator | Source remains locally autonomous | Duplicates authority and can drift from projection |

**Recommendation:** Option A, using declarative range values rather than exposing a callback across the
boundary. Add `viewport-source.ts` to the modification set and test bootstrap, newly measured, revision, and
non-zero-offset ranges. **Confidence: High. Hardening: challenger converged.**

**User Decision:** Resolved — user accepted Option A on 2026-08-12.

### PF-006: Verification surfaces, runner impacts, and closure gates are incomplete 🟠 MAJOR

**Dimension:** Completeness / Dependencies / Testability / Codebase Alignment
**Location:** Expected modification set; Tasks 1.2.1, 3.2.1, 4.1.1-4.2.3; Phase 6
**Codebase Evidence:** `viewport-scale-inspection.ts:3-43` lacks the requested operation-delta counters;
`testing.ts:61-66` is their testing-only export boundary; `semantic-host-board.ts` and `drag-harness.ts` own
mounted host evidence. Adding a fifth runner entry changes the exact four-worker assertion in
`packages/examples/test/perf-gate.spec.test.ts:16-29`. `yarn verify:local` does not execute
`scripts/check-performance.mjs`, and Phase 6 does not run `yarn perf:check`.

**The Problem:** Strict execution must either modify unplanned files, duplicate established testing seams,
weaken the evidence, or close without exercising the aggregate performance registry.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Extend existing testing-only snapshot/exports/host harnesses; update the runner contract spec; run a focused Kanban check and exact `yarn perf:check` | Reuses canonical seams and proves the real repository gate | Broadens the explicit modification/test set and runs a longer local gate |
| B | Add test-private duplicate fixtures and a new performance-runner selector | Avoids changing shared testing helpers | Duplicates host behavior and adds a runner API solely for this task |

**Recommendation:** Option A. Add the existing testing bridge/harness paths and
`packages/examples/test/perf-gate.spec.test.ts` explicitly, keep production inspection payload-free, update
the exact runner inventory assertion, and execute both direct iteration and aggregate closure.
**Confidence: High. Hardening: challenger converged.**

**User Decision:** Resolved — user accepted Option A on 2026-08-12.

### PF-007: The overlapping dirty tree makes spec-first execution unauditable 🟠 MAJOR

**Dimension:** Ordering & Sequencing
**Location:** Expected modification set preamble; Execution rules; before Phase 1
**Codebase Evidence:** HEAD is `bd87a0107`; the tree contains 21 tracked modified files plus untracked
GitHub app/tests and this plan, including T-03 implementation and specification paths such as
`viewport-drag.ts`, `viewport-render.ts`, `swimlane-geometry.ts`, and drag specs.

**The Problem:** “Establish the task baseline” is not executable. Later task commits cannot distinguish
pre-plan fixes from spec-first changes when they overlap the same files.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Before T-03 execution, focused-verify current work and—only with explicit user authorization—create one dedicated baseline checkpoint commit | Honest, recoverable, and preserves task attribution | Checkpoints incomplete corrective behavior |
| B | Hash the patch, execute all T-03 work with `--no-commit`, then create one combined commit after completion | Avoids committing an intermediate state | Loses per-task spec-first/commit evidence and makes rollback harder |

**Recommendation:** Option A. This is an execution-readiness condition, not authority to commit now.
**Confidence: High. Hardening: challenger converged.**

**User Decision:** Resolved — user accepted Option A on 2026-08-12. This does not itself authorize a
checkpoint commit.

### PF-008: The promised eight-color application palette is infeasible through the closed role API 🟠 MAJOR

**Dimension:** Feasibility / Codebase Alignment
**Location:** Scope exclusions; Acceptance 7; Task 5.1.2
**Codebase Evidence:** `card/adapter.ts:101-119` permits only `KanbanThemeRole` selections;
`card/theme.ts:3-47` closes that inventory; `local-board.ts:32-40` currently groups eight GitHub colors into
four package roles.

**The Problem:** The plan promises arbitrary application-owned background/foreground/attribute combinations
while explicitly excluding the public style/token seam needed to express them. Numeric contrast also does
not exist in mono/`NO_COLOR`.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Deliberately group statuses into existing card-safe role families and preserve exact status through bounded text/glyph/attribute cues at every capability | Implementable in strict scope and accessible | Cannot mimic all eight GitHub colors one-for-one |
| B | Expand the public application-status style/token API | Enables exact arbitrary palettes | Explicitly out of scope and expands SDK/docs/plugin compatibility work |

**Recommendation:** Option A for T-03. It can still be colorful, but the plan must say four deliberate
semantic families rather than claim eight independent application colors. **Confidence: High. Hardening:
challenger converged.**

**User Decision:** Resolved — user accepted Option A on 2026-08-12.

**Iteration 2 evidence:** Reopened. The accepted four-family wording still cannot be implemented truthfully:
the closed inventory contains no neutral accent families, and the current four-way demo works only by
repurposing `card.read-only`, `wip.warning`, and `wip.error`. Those roles carry disabled/warning/danger
semantics and cues. A normal surface plus text/glyph-only cues is truthful but does not meet the user's
explicit colorful-showcase outcome.

**Iteration 2 necessary-correction options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add four generic application-neutral card accent roles, each with legacy fallback; preserve accent surface across focus/selection using border/title/non-color cues | Truthful, colorful, reusable, and bounded | Expands public API/docs/plugin/test scope and needs compatibility design |
| B | Explicitly permit app-only repurposing of read-only/WIP/error roles | Smallest code change | Role names, accessibility cues, and semantics become false |
| C | Use one normal card surface and exact status text/glyph/attributes only | Truthful with no public expansion | Does not satisfy the approved colorful showcase outcome |

**Iteration 2 recommendation:** Option A. It is the smallest correction that satisfies both truthful semantic
roles and the approved colorful showcase, but it is a reserved public-scope expansion and therefore requires
explicit user authority. Use deterministic fallback for callers/themes built against the old inventory and
test all accent families across focused/selected states and every capability fallback. **Confidence: High.
Hardening: Iteration-2 challenger converged.**

**Iteration 2 User Decision:** Resolved — user authorized Option A through completion on 2026-08-12.

### PF-009: Public GitHub responses can still cause unbounded accumulation 🟠 MAJOR

**Dimension:** Security Blind Spots / Edge Cases
**Location:** Phase 1 fixture; Tasks 5.2.2-5.2.3
**Codebase Evidence:** `github-project.ts:252-268` caps pages but appends every member of each response;
field IDs/options, labels, and assignees also have no total/member ceilings.

**The Problem:** A malformed or extremely large public response can consume unbounded memory/CPU before
board construction and make the showcase freeze—the exact failure this blocking work is meant to prevent.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add small app-local ceilings and reject before accumulation with `GitHubProjectLoadError` | Fail-closed, simple, and truthful | Exceptionally large legitimate projects are rejected |
| B | Truncate to a bounded partial snapshot with a prominent omitted-data cue | More large projects remain viewable | Adds a partial-authority contract and can mislead if any cue is lost |

**Recommendation:** Option A. Reject incomplete authoritative card/column collections; optional per-card
metadata may only be bounded if omission is explicitly represented. Add oversized-array and pagination tests.
**Confidence: High. Hardening: challenger refined authoritative versus optional data. Challenger:
converged.**

**User Decision:** Resolved — user accepted Option A on 2026-08-12.

### PF-010: Semantic damage is not actual repaint, and the frame benchmark can miss the sluggish path 🟠 MAJOR

**Dimension:** Ambiguities / Feasibility / Testability / Scope Creep
**Location:** Acceptance 5-6; Tasks 3.1.4 and 4.1-4.2
**Codebase Evidence:** `kanban-viewport.ts:619-635` calculates `#damage` but still calls
`drawKanbanViewport` for the complete leaf. `render-root.ts:383-435` clones the buffer, recomposes dirty
subtrees, and diffs the full screen; Core `host.ts:322-338` performs another full-buffer diff.

**The Problem:** Small semantic damage rectangles can pass while full leaf drawing and two whole-buffer
diffs remain slow. Conversely, taking “repaint only affected regions” literally silently expands T-03 into a
Core/UI region-composition redesign.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Separate semantic damage, visible-set-bounded leaf composition, and changed-cell/run/byte output; benchmark projection/draw and normalized event through both in-memory diffs, excluding terminal I/O | Measures the real controllable UX path without framework redesign | Permits full Kanban-leaf composition within the visible bound |
| B | Expand UI/Core so Kanban damage rectangles drive region-aware composition | Can avoid more CPU work | Material cross-framework architecture expansion before evidence proves it is needed |

**Recommendation:** Option A. Define warmup/sample counts and metadata; time steady invalidation through
compose+diff and one captured pointer sample through synchronous dispatch, overlay projection, compose, and
fake-sink host diff. Report stage diagnostics and deterministic output churn. If this path misses the budget,
measured evidence can justify B later. **Confidence: High. Hardening: challenger converged and required both
in-memory diff layers.**

**User Decision:** Resolved — user accepted Option A on 2026-08-12.

### PF-011: The canonical fixture and manual gate omit the text/capability cases most likely to break geometry 🟠 MAJOR

**Dimension:** Ambiguities / Security / Edge Cases / Testability
**Location:** Tasks 1.1.1, 4.2.1, 5.2.3, and 6.7
**Codebase Evidence:** AR-38 at `requirements/00-ambiguity-register.md:269-274` requires color-depth,
Unicode/ASCII, longest translations, and hostile text. The current app tests inject a two-card snapshot;
the loader accepts bounded long/wide display strings after control cleanup.

**The Problem:** A normal short-text fixture can stay green while wide/combining/bidi/long-locale data
changes display-cell height and hit geometry. “Real fixture” can also be misread as a live network oracle, and
the manual matrix lacks repeatable environment/outcome fields.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Put a named adversarial subset in the canonical deterministic 84-card injected snapshot; keep focused parser/sanitizer tests; reserve the live Node.js URL for a recorded manual check | One realistic geometry oracle without network flakiness | Larger fixture requires named subsets for diagnosis |
| B | Use a separate adversarial fixture plus deterministic GitHub response cassette and manual live check | Better isolation | Multiplies fixtures and maintenance for the same geometry matrix |

**Recommendation:** Option A. Include hostile controls/bidi, wide and combining glyphs, longest supported
locale strings, dense metadata, and truecolor/256/16/mono/`NO_COLOR` plus Unicode/ASCII variants. Manual
evidence records command, host/terminal/version, viewport sizes, URL and observation time, theme inventory,
expected/actual gesture results, and acceptance decision. **Confidence: High. Hardening: challenger
converged.**

**User Decision:** Resolved — user accepted Option A on 2026-08-12.

### PF-012: T-03 uses feature-plan lifecycle metadata despite being a lightweight task 🟡 MINOR

**Dimension:** Consistency
**Location:** Header lines 3-8
**Codebase Evidence:** CodeOps layout convention defines task IDs as lightweight and the compact lifecycle
`Backlog → Executing → Done`; the roadmap currently assigns T-03 the feature-only `Plan Created` stage.

**The Problem:** `Type: Blocking corrective task` and `Status: Plan Created` do not match the task-lane
schema, making roadmap automation and status interpretation inconsistent.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Stamp the exact lightweight task type/feature metadata, use `Backlog` before execution, and synchronize the T-03 roadmap row | Matches CodeOps task lifecycle | Requires the already-related roadmap edit when fixes are authorized |
| B | Convert T-03 into a full RD-linked feature plan | Retains feature stages | Adds unnecessary lifecycle ceremony and changes the task identity |

**Recommendation:** Option A. **Confidence: High. Hardening: no change.**

**User Decision:** Resolved — user accepted Option A on 2026-08-12.

## Current verdict

**FIXES AUTHORIZED — all 12 findings resolved; Iteration 2 re-scan pending.** On 2026-08-12 the user
instructed preflight to proceed until done, authorizing application of all accepted plan corrections and the
required re-scan. This does not authorize T-03 implementation or the PF-007 baseline checkpoint commit.
The authorized fixes and Iteration-2 scan reopened PF-001, PF-003, PF-006, PF-008, and PF-009 and found two
new minor findings. Every resolution is now applied. Iteration 3 is bounded to those fixes and their direct
dependency surface; the roadmap stays at T-03 Backlog until that verification passes.

## Iteration 2 residual findings and resolutions

| Finding | Severity | Iteration-2 result | Resolution applied |
|---|---|---|---|
| PF-001 | Major | Reopened: immutable tasks omitted multi-count and no-blank-row details | Acceptance and trace now state the full AR-44 compact ghost contract |
| PF-003 | Major | Reopened: `pointer-coordinate` could lose the captured grab offset | Raw origin is exactly normalized pointer minus captured offset, tested separately from clipping |
| PF-006 | Major | Reopened: viewport snapshot was assigned downstream frame/host counters | Evidence is partitioned by owner; the stable snapshot shape is preserved and additive fixtures own downstream diffs |
| PF-008 | Major | Reopened: no truthful neutral roles could supply four colorful families | User authorized AR-45's four bounded neutral accents with legacy fallback and focus/selection composition |
| PF-009 | Major | Reopened: post-decode collection limits could not bound raw response allocation | Exact app-local ceilings and byte-bounded streamed pre-parse ingestion are specified |
| PF-013 | Minor | New: verification summary required a nonexistent examples build script | Summary now uses the supported examples typecheck/tests gates |
| PF-014 | Minor | New: performance artifact and runner tuple were unnamed | Exact test path, tuple, and focused command are specified |

All Iteration-2 technical resolutions were selected under the user-invoked `--auto-design` authority.
PF-008 was reserved and separately authorized by the user. One independent challenger reviewed the complete
major residual batch and converged on every recommendation.

## Iteration 3 verification

The final targeted scan verified PF-001, PF-003, PF-006, PF-008, PF-009, PF-013, and PF-014 against artifact
SHA-256 `0ebdbf6e21dd0c229f03b70ce01c4be57c4602dcac6ab017aab05f1b632f1093` and their direct dependency
surface. No Critical, Major, Minor, or Observation finding remains.

**✅ PREFLIGHT PASSED — all 14 findings resolved.** T-03 remains a lightweight task at `Backlog`; its compact
task lifecycle has no separate `Plan Preflighted` stage. Before execution, compare the plan hash above and
perform the explicit verified baseline-checkpoint gate recorded before Task 1.1.1.
