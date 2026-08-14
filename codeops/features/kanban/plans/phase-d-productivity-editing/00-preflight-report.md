# Preflight Report: Kanban Phase D Productivity and Editing

> **Artifact**: `codeops/features/kanban/plans/phase-d-productivity-editing/` (13 plan documents)
> **Plan hash at final clean scan**: `ebbbc7e0f0fb1bd810d9db6e000cd9c2c176b4182ffd862fd39547a8fcb650de`
> (excludes this report and `_preflight-notes.md`)
> **Scanned**: 2026-08-14 · strict scope · auto-design
> **Status**: ✅ PASSED — all 16 findings resolved in the plan (1 CRITICAL, 13 MAJOR, 2 MINOR)
> **Iteration**: 4 (final clean re-scan)
>
> ⚠️ **SAME-SESSION REVIEW** — the plan was authored and audited in the same session. Five independent
> audit clusters grounded the findings in source, and one blind challenger reviewed the consolidated
> batch. The challenger confirmed every principal finding and raised PF-001 from Major to Critical.

## Codebase context

Phase D implements RD-09 through RD-12 on the existing `KanbanBoard`/`KanbanViewport`, source-session,
operation-authority, Core input, Web host, Forms, Examples, docs, and plugin surfaces. The plan is
structurally sound: its parser reports Ready, all 122 task IDs are unique, links and whitespace pass,
and `yarn verify:local` passes. The findings below concern behavioral closure, missing architectural
prerequisites, and execution ordering rather than plan-file mechanics.

## Findings

| PF | Severity | Dimension | Finding | Recommended ruling |
|---|---|---|---|---|
| PF-001 | 🔴 CRITICAL | Feasibility / availability | Query replacement disposes the usable session before a candidate opens, so evaluator/open failure cannot preserve the prior board as promised. | Stage the candidate session and activate it only after its first valid publication; retain the old session until then. |
| PF-002 | 🟠 MAJOR | Ambiguity / consistency | Debounced search does not define whether public state changes before its query, contradicting atomic state/query revision semantics. | Keep immediate text as view-bar draft; commit controller state, query, and revision together after 150 ms. |
| PF-003 | 🟠 MAJOR | Ambiguity | Saved-view width reconciliation preserves raw `40` while applying live `32`, but no owner or invalidation rule preserves the raw value for later capture. | Store bounded raw facet provenance in the controller; invalidate only the directly edited facet or explicit resave. |
| PF-004 | 🟠 MAJOR | Contradiction | Missing saved-view IDs are both droppable and fatal, but the v1 artifact has no required/optional policy. | Encode `onMissing: 'reject' | 'drop'` per durable reference with a conservative default. |
| PF-005 | 🟠 MAJOR | Completeness / testability | The ST matrix omits approved RD-09/RD-10/RD-11 behavior, disagrees with ST ranges/files, and misses exact Forms/Zod packaging and Unicode canonical-order fixtures. | Add explicit requirements-derived oracles, rebuild the AC→ST trace matrix, and use one exact ST/file inventory everywhere. |
| PF-006 | 🟠 MAJOR | Ambiguity / ordering | Event and action reentrancy accepts incompatible queued-or-rejected outcomes. | Queue nested events breadth-first with an exact bound; reject same-action recursion before mutation with a typed outcome. |
| PF-007 | 🟠 MAJOR | Dependency / feasibility | RD-12 requires semantic Primary/Meta and pre-xterm DOM pointer normalization/deduplication, but Core/Web discard or never create that information and Phase 6 has no implementation work for them. | Add an additive Core/Web prerequisite slice before Kanban commands, including compatibility fixtures and public/plugin impacts. |
| PF-008 | 🟠 MAJOR | Sequencing | Configuration command and action-event specifications must turn green before their command/event dependencies exist. | Keep phase-local assertions early and move complete command/event lifecycle assertions to the later integration phase. |
| PF-009 | 🟠 MAJOR | Project policy | Plugin regeneration is delayed to Phase 9 although mapped SDK changes must carry generated plugin updates in the same commit. | Add a global per-commit plugin-impact/update/check rule; retain Phase 9 as the aggregate parity gate. |
| PF-010 | 🟠 MAJOR | Verification | Packed-consumer and Examples checks can read stale Kanban `dist` output. | Build `@jsvision/kanban` before every packed-consumer and Examples verification that imports package exports. |
| PF-011 | 🟠 MAJOR | Codebase alignment | Comparator IDs and card-identity tie-breaks cannot be implemented only in new view files; current query validation has no comparator ID and eager ties use source order. | Add optional/defaulted comparator identity and update query types, exact validation, registries, eager/remote behavior, docs, and tests. |
| PF-012 | 🟠 MAJOR | Feasibility | Editors need the current application record and base revision, but board/source inspection exposes only presentation/location data. | Require an application-owned async record/revision resolver with cancellation and not-loaded/not-found outcomes. |
| PF-013 | 🟠 MAJOR | Integration / compatibility | Saved-view facets overlap independent board getters, but their mappings and precedence versus legacy options are undefined. | Make the board-view binding the single effective getter composer; controller facets win when supplied, legacy behavior remains otherwise. |
| PF-014 | 🟠 MAJOR | Testability / performance | “Responsive”, “no freeze”, and “bounded regression” have no measurable workload or pass budget. | Define deterministic work/repaint/session bounds plus a calibrated timing fixture using the existing 16 ms median benchmark precedent. |
| PF-015 | 🟡 MINOR | Consistency | Configuration duplicate-name normalization is promised but unspecified. | Reuse sanitized/trimmed NFKC plus fixed `en-US` lowercase, matching existing grouping behavior. |
| PF-016 | 🟡 MINOR | Testability | Percentage coverage targets have no provider, command, or enforced threshold. | Remove the unenforced percentages and keep the stronger AC/ST contract unless coverage becomes repo policy. |

## Evidence highlights

- PF-001: `packages/kanban/src/source/session-coordinator.ts:121-131,253-258` disposes the current
  session before replacement; eager open can fail synchronously in `eager-source.ts:596-607`.
- PF-007: Core events/keymaps expose only Ctrl/Alt/Shift in
  `packages/core/src/engine/input/{events,keymap}.ts`; Web has no DOM pointer adapter in
  `packages/web/src/{host,mount}.ts`.
- PF-011: `packages/kanban/src/source/types.ts` and `validation.ts` have no comparator identity;
  `eager-index.ts:320-343` resolves equal comparisons by source position.
- PF-012: `card/adapter.ts`, board options, viewport inspection, and source location lookup expose no
  authoritative `TCard` plus base revision.
- PF-013: `kanban-board.ts:148-176` and `kanban-viewport.ts:199-244` forward query, density,
  presentation, collapse, and structure through independent getters.
- PF-014: `packages/kanban/test/perf-kanban-bench.spec.test.ts` already supplies a 16 ms median
  benchmark convention that the Phase D workload can extend.

## Independent challenge

The blind challenger found all 14 principal concerns valid. It strengthened PF-001 to Critical
because the plan's required rollback is architecturally impossible through the current destructive
replacement order. It also confirmed that ST-range/file inconsistencies belong under PF-005 rather
than standing alone. No finding was rejected, and no scope-creep finding was found.

## Resolutions applied

The user authorized the complete recommendation batch. The plan now defines the cross-controller/source
transaction, exact debounce publication, saved-view provenance/missing defaults, comparator compatibility
and total ordering, application-owned editor resolver, all-or-nothing facet ownership, additive Core/Web
input prerequisite, exact reentrancy/performance bounds, full AC→ST→file traceability, dependency ordering,
same-commit plugin parity, and build-before-dist-consumer gates.

Iteration 2 reopened eight underspecified resolutions; iteration 3 reopened five exactness/ownership
details; iteration 4 rechecked the last two residuals and returned **Clean**. No Critical/Major/Minor
finding remains, and RD-09–RD-12 product scope did not expand.

**Confidence: High.** Every Critical/Major finding is grounded in current source or an approved RD,
the consolidated batch was independently challenged, and the corrected plan passed a final independent
clean-gate re-scan.
